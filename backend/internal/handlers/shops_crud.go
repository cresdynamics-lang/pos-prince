package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type createShopRequest struct {
	Name      string  `json:"name" binding:"required"`
	Location  string  `json:"location"`
	Phone     string  `json:"phone"`
	ManagerID *string `json:"manager_id"`
}

func (h *Handler) CreateShop(c *gin.Context) {
	var req createShopRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}

	var managerID *uuid.UUID
	if req.ManagerID != nil && *req.ManagerID != "" {
		id, err := uuid.Parse(*req.ManagerID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid manager_id"})
			return
		}
		managerID = &id
	}

	var shopID string
	err := h.DB.QueryRow(c.Request.Context(), `
		INSERT INTO shops (name, location, phone, manager_id, is_active)
		VALUES ($1, NULLIF($2, ''), NULLIF($3, ''), $4, TRUE)
		RETURNING id::text
	`, name, strings.TrimSpace(req.Location), strings.TrimSpace(req.Phone), managerID).Scan(&shopID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create store"})
		return
	}

	id, _ := uuid.Parse(shopID)
	_, _ = h.DB.Exec(c.Request.Context(), `
		INSERT INTO inventory (product_variant_id, shop_id, quantity)
		SELECT pv.id, $1, 0 FROM product_variants pv
		ON CONFLICT (product_variant_id, shop_id) DO NOTHING
	`, id)

	c.JSON(http.StatusCreated, gin.H{"id": shopID})
}

type updateShopRequest struct {
	Name      *string `json:"name"`
	Location  *string `json:"location"`
	Phone     *string `json:"phone"`
	ManagerID *string `json:"manager_id"`
	IsActive  *bool   `json:"is_active"`
}

func (h *Handler) UpdateShop(c *gin.Context) {
	shopID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid shop id"})
		return
	}

	var req updateShopRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Name != nil && strings.TrimSpace(*req.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name cannot be empty"})
		return
	}

	var managerID *uuid.UUID
	managerProvided := false
	if req.ManagerID != nil {
		managerProvided = true
		if *req.ManagerID != "" {
			id, err := uuid.Parse(*req.ManagerID)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid manager_id"})
				return
			}
			managerID = &id
		}
	}

	_, err = h.DB.Exec(c.Request.Context(), `
		UPDATE shops SET
			name = COALESCE($2, name),
			location = CASE WHEN $3::text IS NOT NULL THEN NULLIF($3, '') ELSE location END,
			phone = CASE WHEN $4::text IS NOT NULL THEN NULLIF($4, '') ELSE phone END,
			manager_id = CASE WHEN $5 THEN $6 ELSE manager_id END,
			is_active = COALESCE($7, is_active)
		WHERE id = $1
	`, shopID, req.Name, req.Location, req.Phone, managerProvided, managerID, req.IsActive)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "update failed"})
		return
	}

	if req.IsActive != nil && *req.IsActive {
		_, _ = h.DB.Exec(c.Request.Context(), `
			INSERT INTO inventory (product_variant_id, shop_id, quantity)
			SELECT pv.id, $1, 0 FROM product_variants pv
			ON CONFLICT (product_variant_id, shop_id) DO NOTHING
		`, shopID)
	}

	c.JSON(http.StatusOK, gin.H{"updated": true})
}

func (h *Handler) DeleteShop(c *gin.Context) {
	shopID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid shop id"})
		return
	}

	var salesCount int
	_ = h.DB.QueryRow(c.Request.Context(), `
		SELECT (
			(SELECT COUNT(*) FROM sales_transactions WHERE shop_id = $1) +
			(SELECT COUNT(*) FROM sales_orders WHERE shop_id = $1)
		)
	`, shopID).Scan(&salesCount)

	if salesCount > 0 {
		_, err = h.DB.Exec(c.Request.Context(), `UPDATE shops SET is_active = FALSE WHERE id = $1`, shopID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "deactivate failed"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"deactivated": true})
		return
	}

	_, err = h.DB.Exec(c.Request.Context(), `DELETE FROM shops WHERE id = $1`, shopID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "delete failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": true})
}
