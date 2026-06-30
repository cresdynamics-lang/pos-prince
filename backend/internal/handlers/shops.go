package handlers

import (
	"net/http"
	"time"

	"github.com/cresdynamics-lang/pos-prince/backend/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type shopResponse struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	Location  *string `json:"location,omitempty"`
	Phone     *string `json:"phone,omitempty"`
	ManagerID *string `json:"manager_id,omitempty"`
	IsActive  bool    `json:"is_active"`
	CreatedAt string  `json:"created_at"`
}

func (h *Handler) ListShops(c *gin.Context) {
	includeInactive := c.Query("include_inactive") == "1" || c.Query("include_inactive") == "true"
	query := `
		SELECT id::text, name, location, phone, manager_id::text, is_active, created_at
		FROM shops
	`
	if !includeInactive {
		query += ` WHERE is_active = TRUE`
	}
	query += ` ORDER BY name`

	rows, err := h.DB.Query(c.Request.Context(), query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load shops"})
		return
	}
	defer rows.Close()

	shops := []shopResponse{}
	for rows.Next() {
		var s shopResponse
		var createdAt time.Time
		if err := rows.Scan(&s.ID, &s.Name, &s.Location, &s.Phone, &s.ManagerID, &s.IsActive, &createdAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to parse shops"})
			return
		}
		s.CreatedAt = createdAt.Format(time.RFC3339)
		shops = append(shops, s)
	}

	c.JSON(http.StatusOK, gin.H{"shops": shops})
}

func (h *Handler) GetShopInventory(c *gin.Context) {
	shopID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid shop id"})
		return
	}

	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT i.id, i.product_variant_id, i.shop_id, i.quantity, i.reorder_threshold,
		       pv.sku, p.name, s.name
		FROM inventory i
		JOIN product_variants pv ON pv.id = i.product_variant_id
		JOIN products p ON p.id = pv.product_id
		JOIN shops s ON s.id = i.shop_id
		WHERE i.shop_id = $1
		ORDER BY p.name, pv.sku
	`, shopID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load inventory"})
		return
	}
	defer rows.Close()

	items := []models.InventoryRow{}
	for rows.Next() {
		var row models.InventoryRow
		if err := rows.Scan(
			&row.ID, &row.ProductVariantID, &row.ShopID, &row.Quantity, &row.ReorderThreshold,
			&row.SKU, &row.ProductName, &row.ShopName,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to parse inventory"})
			return
		}
		items = append(items, row)
	}

	c.JSON(http.StatusOK, gin.H{"inventory": items})
}
