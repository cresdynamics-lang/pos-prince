package handlers

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type variantDetail struct {
	ID          string  `json:"id"`
	ProductID   string  `json:"product_id"`
	CategoryID  string  `json:"category_id"`
	SKU         string  `json:"sku"`
	Size        *string `json:"size,omitempty"`
	Color       *string `json:"color,omitempty"`
	ProductName string  `json:"product_name"`
	Category    string  `json:"category"`
	BasePrice   float64 `json:"base_price"`
	CostPrice   float64 `json:"cost_price"`
	Brand       *string `json:"brand,omitempty"`
	IsActive    bool    `json:"is_active"`
}

type storeStock struct {
	StoreID      string `json:"store_id"`
	StoreName    string `json:"store_name"`
	Quantity     int    `json:"quantity"`
	OpeningStock int    `json:"opening_stock"`
	ClosingStock int    `json:"closing_stock"`
	UnitsSold    int    `json:"units_sold_today"`
}

func (h *Handler) GetVariantDetail(c *gin.Context) {
	variantID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid variant id"})
		return
	}

	var v variantDetail
	var brand *string
	err = h.DB.QueryRow(c.Request.Context(), `
		SELECT pv.id::text, pv.product_id::text, p.category_id::text, pv.sku, pv.size, pv.color,
		       p.name, COALESCE(parent.name, cat.name), p.base_price, COALESCE(p.cost_price, 0), p.brand, p.is_active
		FROM product_variants pv
		JOIN products p ON p.id = pv.product_id
		JOIN categories cat ON cat.id = p.category_id
		LEFT JOIN categories parent ON parent.id = cat.parent_id
		WHERE pv.id = $1
	`, variantID).Scan(&v.ID, &v.ProductID, &v.CategoryID, &v.SKU, &v.Size, &v.Color,
		&v.ProductName, &v.Category, &v.BasePrice, &v.CostPrice, &brand, &v.IsActive)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "variant not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load variant"})
		return
	}
	v.Brand = brand

	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT s.id::text, s.name,
		       COALESCE(i.quantity, 0),
		       COALESCE(ds.opening_stock, COALESCE(i.quantity, 0)),
		       COALESCE(ds.closing_stock, COALESCE(i.quantity, 0)),
		       COALESCE(ds.units_sold, 0)
		FROM shops s
		LEFT JOIN inventory i ON i.shop_id = s.id AND i.product_variant_id = $1
		LEFT JOIN daily_stock_snapshots ds ON ds.shop_id = s.id
			AND ds.product_variant_id = $1 AND ds.snapshot_date = CURRENT_DATE
		WHERE s.is_active = TRUE
		ORDER BY s.name
	`, variantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load store stock"})
		return
	}
	defer rows.Close()

	stores := []storeStock{}
	for rows.Next() {
		var st storeStock
		if rows.Scan(&st.StoreID, &st.StoreName, &st.Quantity, &st.OpeningStock, &st.ClosingStock, &st.UnitsSold) == nil {
			stores = append(stores, st)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"variant": v,
		"stores":  stores,
	})
}

type updateProductRequest struct {
	Name       *string  `json:"name"`
	CategoryID *string  `json:"category_id"`
	BasePrice  *float64 `json:"base_price"`
	CostPrice  *float64 `json:"cost_price"`
	Brand      *string  `json:"brand"`
	IsActive   *bool    `json:"is_active"`
}

func (h *Handler) UpdateProduct(c *gin.Context) {
	productID := c.Param("id")
	var req updateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	_, err := h.DB.Exec(c.Request.Context(), `
		UPDATE products SET
			name = COALESCE($1, name),
			category_id = COALESCE($2::uuid, category_id),
			base_price = COALESCE($3, base_price),
			cost_price = COALESCE($4, cost_price),
			brand = COALESCE($5, brand),
			is_active = COALESCE($6, is_active),
			updated_at = NOW()
		WHERE id = $7
	`, req.Name, req.CategoryID, req.BasePrice, req.CostPrice, req.Brand, req.IsActive, productID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "update failed"})
		return
	}
	summary := "Product updated"
	meta := map[string]interface{}{}
	if req.BasePrice != nil {
		summary = fmt.Sprintf("Product price set to %s", kes(*req.BasePrice))
		meta["base_price"] = *req.BasePrice
	}
	if req.CostPrice != nil {
		meta["cost_price"] = *req.CostPrice
	}
	h.logAction(c, nil, "product.update", "product", productID, summary, meta)
	c.JSON(http.StatusOK, gin.H{"updated": true})
}
