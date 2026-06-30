package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/cresdynamics-lang/pos-prince/backend/internal/auth"
	"github.com/cresdynamics-lang/pos-prince/backend/internal/middleware"
	"github.com/cresdynamics-lang/pos-prince/backend/internal/models"
	"github.com/gin-gonic/gin"
)

type loginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

func (h *Handler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid credentials payload"})
		return
	}

	var user models.User
	var hash string
	var permsRaw json.RawMessage
	err := h.DB.QueryRow(c.Request.Context(), `
		SELECT id, name, email, password_hash, role, shop_id, permissions, is_active
		FROM users WHERE email = $1
	`, req.Email).Scan(
		&user.ID, &user.Name, &user.Email, &hash, &user.Role, &user.ShopID, &permsRaw, &user.IsActive,
	)
	if err != nil || !user.IsActive || !auth.CheckPassword(hash, req.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
		return
	}

	perms := auth.ResolvePermissions(user.Role, permsRaw)
	token, err := auth.IssueToken(h.Config.JWTSecret, user, perms, 24*time.Hour)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not issue token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user": models.UserPublic{
			ID: user.ID, Name: user.Name, Email: user.Email, Role: user.Role,
			ShopID: user.ShopID, Permissions: perms, IsActive: user.IsActive,
			IsSuperAdmin: auth.IsSuperAdmin(user.Email),
		},
	})
}

func (h *Handler) Me(c *gin.Context) {
	claims := middleware.GetClaims(c)
	var name string
	_ = h.DB.QueryRow(c.Request.Context(), `SELECT name FROM users WHERE id = $1`, claims.UserID).Scan(&name)

	c.JSON(http.StatusOK, gin.H{
		"user": models.UserPublic{
			ID: claims.UserID, Name: name, Email: claims.Email, Role: claims.Role,
			ShopID: claims.ShopID, Permissions: claims.Permissions,
			IsSuperAdmin: auth.IsSuperAdmin(claims.Email),
		},
	})
}
