package handlers

import (
	"net/http"

	"github.com/cresdynamics-lang/pos-prince/backend/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func (h *Handler) ListShops(c *gin.Context) {
	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT id, name, location, phone, manager_id, is_active, created_at
		FROM shops
		WHERE is_active = TRUE
		ORDER BY name
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load shops"})
		return
	}
	defer rows.Close()

	shops := []models.Shop{}
	for rows.Next() {
		var s models.Shop
		if err := rows.Scan(&s.ID, &s.Name, &s.Location, &s.Phone, &s.ManagerID, &s.IsActive, &s.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to parse shops"})
			return
		}
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
