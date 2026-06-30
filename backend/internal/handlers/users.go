package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/cresdynamics-lang/pos-prince/backend/internal/auth"
	"github.com/cresdynamics-lang/pos-prince/backend/internal/middleware"
	"github.com/cresdynamics-lang/pos-prince/backend/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func toUserPublic(u models.User, permsRaw json.RawMessage) models.UserPublic {
	return models.UserPublic{
		ID:           u.ID,
		Name:         u.Name,
		Email:        u.Email,
		Role:         u.Role,
		ShopID:       u.ShopID,
		Permissions:  auth.ResolvePermissions(u.Role, permsRaw),
		IsActive:     u.IsActive,
		IsSuperAdmin: auth.IsSuperAdmin(u.Email),
		CreatedAt:    u.CreatedAt,
	}
}

type createUserRequest struct {
	Name        string          `json:"name" binding:"required"`
	Email       string          `json:"email" binding:"required,email"`
	Password    string          `json:"password" binding:"required,min=6"`
	Role        models.UserRole `json:"role" binding:"required"`
	ShopID      *string         `json:"shop_id"`
	Permissions []string        `json:"permissions"`
}

func (h *Handler) CreateUser(c *gin.Context) {
	var req createUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if auth.IsSuperAdmin(req.Email) {
		c.JSON(http.StatusConflict, gin.H{"error": "super admin account already exists"})
		return
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not hash password"})
		return
	}

	perms := req.Permissions
	if len(perms) == 0 {
		perms = auth.DefaultPermissions(req.Role)
	}
	// Non-super-admin accounts cannot receive user-management permissions.
	perms = stripUserManagementPerms(perms)
	permsJSON, _ := json.Marshal(perms)

	var shopID *uuid.UUID
	if req.ShopID != nil && *req.ShopID != "" {
		id, err := uuid.Parse(*req.ShopID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid shop_id"})
			return
		}
		shopID = &id
	}

	var id string
	err = h.DB.QueryRow(c.Request.Context(), `
		INSERT INTO users (name, email, password_hash, role, shop_id, permissions)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id::text
	`, req.Name, strings.ToLower(strings.TrimSpace(req.Email)), hash, req.Role, shopID, permsJSON).Scan(&id)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "could not create user (email may exist)"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"id": id, "permissions": perms})
}

func (h *Handler) ListUsers(c *gin.Context) {
	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT id, name, email, role, shop_id, permissions, is_active, created_at
		FROM users ORDER BY
			CASE WHEN LOWER(email) = LOWER($1) THEN 0 ELSE 1 END,
			created_at DESC
	`, auth.SuperAdminEmail())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load users"})
		return
	}
	defer rows.Close()

	users := []models.UserPublic{}
	for rows.Next() {
		var u models.User
		var permsRaw json.RawMessage
		if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.ShopID, &permsRaw, &u.IsActive, &u.CreatedAt); err != nil {
			continue
		}
		users = append(users, toUserPublic(u, permsRaw))
	}
	c.JSON(http.StatusOK, gin.H{"users": users})
}

type updateUserRequest struct {
	Name        *string          `json:"name"`
	Email       *string          `json:"email"`
	Password    *string          `json:"password"`
	Role        *models.UserRole `json:"role"`
	ShopID      *string          `json:"shop_id"`
	Permissions []string         `json:"permissions"`
	IsActive    *bool            `json:"is_active"`
}

func (h *Handler) UpdateUser(c *gin.Context) {
	targetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	actor := middleware.GetClaims(c)
	if actor == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "authorization required"})
		return
	}

	var targetEmail string
	var targetActive bool
	if err := h.DB.QueryRow(c.Request.Context(), `
		SELECT email, is_active FROM users WHERE id = $1
	`, targetID).Scan(&targetEmail, &targetActive); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	targetIsSuperAdmin := auth.IsSuperAdmin(targetEmail)

	if targetIsSuperAdmin && actor.UserID != targetID {
		c.JSON(http.StatusForbidden, gin.H{"error": "cannot modify the super admin account"})
		return
	}

	var req updateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}

	if targetIsSuperAdmin {
		if req.Role != nil && *req.Role != models.RoleDirector {
			c.JSON(http.StatusForbidden, gin.H{"error": "super admin role cannot be changed"})
			return
		}
		if req.IsActive != nil && !*req.IsActive {
			c.JSON(http.StatusForbidden, gin.H{"error": "super admin cannot be deactivated"})
			return
		}
		if req.Permissions != nil {
			req.Permissions = auth.DefaultPermissions(models.RoleDirector)
		}
	} else if req.Permissions != nil {
		req.Permissions = stripUserManagementPerms(req.Permissions)
	}

	var passwordHash *string
	if req.Password != nil && strings.TrimSpace(*req.Password) != "" {
		if len(*req.Password) < 6 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "password must be at least 6 characters"})
			return
		}
		hash, err := auth.HashPassword(*req.Password)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not hash password"})
			return
		}
		passwordHash = &hash
	}

	var shopID interface{}
	clearShop := false
	if req.ShopID != nil {
		if *req.ShopID == "" {
			clearShop = true
		} else {
			id, err := uuid.Parse(*req.ShopID)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid shop_id"})
				return
			}
			shopID = id
		}
	}

	var permsJSON *string
	if req.Permissions != nil {
		b, _ := json.Marshal(req.Permissions)
		s := string(b)
		permsJSON = &s
	}

	var email *string
	if req.Email != nil {
		e := strings.ToLower(strings.TrimSpace(*req.Email))
		if auth.IsSuperAdmin(e) && !targetIsSuperAdmin {
			c.JSON(http.StatusConflict, gin.H{"error": "email reserved for super admin"})
			return
		}
		email = &e
	}

	_, err = h.DB.Exec(c.Request.Context(), `
		UPDATE users SET
			name = COALESCE($1, name),
			email = COALESCE($2, email),
			password_hash = COALESCE($3, password_hash),
			role = COALESCE($4::user_role, role),
			shop_id = CASE WHEN $5 THEN NULL WHEN $6::uuid IS NOT NULL THEN $6::uuid ELSE shop_id END,
			permissions = COALESCE($7::jsonb, permissions),
			is_active = COALESCE($8, is_active),
			updated_at = NOW()
		WHERE id = $9
	`, req.Name, email, passwordHash, req.Role, clearShop, shopID, permsJSON, req.IsActive, targetID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "update failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"updated": true})
}

func (h *Handler) DeleteUser(c *gin.Context) {
	targetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	actor := middleware.GetClaims(c)
	if actor != nil && actor.UserID == targetID {
		c.JSON(http.StatusForbidden, gin.H{"error": "cannot delete your own account"})
		return
	}

	var targetEmail string
	if err := h.DB.QueryRow(c.Request.Context(), `SELECT email FROM users WHERE id = $1`, targetID).Scan(&targetEmail); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	if auth.IsSuperAdmin(targetEmail) {
		c.JSON(http.StatusForbidden, gin.H{"error": "super admin cannot be deleted"})
		return
	}

	var saleCount int
	_ = h.DB.QueryRow(c.Request.Context(), `
		SELECT COUNT(*) FROM sales_transactions WHERE cashier_id = $1
	`, targetID).Scan(&saleCount)

	if saleCount > 0 {
		_, err = h.DB.Exec(c.Request.Context(), `
			UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1
		`, targetID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "deactivate failed"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"deactivated": true})
		return
	}

	_, err = h.DB.Exec(c.Request.Context(), `DELETE FROM users WHERE id = $1`, targetID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "delete failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": true})
}

func stripUserManagementPerms(perms []string) []string {
	out := make([]string, 0, len(perms))
	for _, p := range perms {
		if p == auth.PermUsers || p == auth.PermUsersC || p == auth.PermUsersE {
			continue
		}
		out = append(out, p)
	}
	return out
}
