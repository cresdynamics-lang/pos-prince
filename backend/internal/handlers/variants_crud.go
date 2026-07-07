package handlers

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/cresdynamics-lang/pos-prince/backend/internal/catalog"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type createVariantRequest struct {
	ProductID        string `json:"product_id" binding:"required"`
	Size             string `json:"size"`
	Color            string `json:"color"`
	ShopID           string `json:"shop_id" binding:"required"`
	InitialQuantity  int    `json:"initial_quantity"`
}

func (h *Handler) CreateVariant(c *gin.Context) {
	var req createVariantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	productID, err := uuid.Parse(req.ProductID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid product_id"})
		return
	}
	shopID, err := uuid.Parse(req.ShopID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid shop_id"})
		return
	}

	var catSlug, productName string
	if err := h.DB.QueryRow(c.Request.Context(), `
		SELECT c.slug, p.name FROM products p
		JOIN categories c ON c.id = p.category_id WHERE p.id = $1
	`, productID).Scan(&catSlug, &productName); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
		return
	}

	size := strings.TrimSpace(req.Size)
	color := strings.TrimSpace(req.Color)
	if catalog.IsNameOnlyCategory(catSlug) {
		size = ""
		if color == "" {
			color = "Default"
		}
	} else if size == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "size is required for this product"})
		return
	}

	ctx := c.Request.Context()
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "transaction failed"})
		return
	}
	defer tx.Rollback(ctx)

	sku := catSlug
	var sizePtr, colorPtr *string
	if size != "" {
		sku += "-" + size
		sizePtr = &size
	}
	if color != "" && color != "Default" {
		sku += "-" + slugify(color)
		colorPtr = &color
	} else if color == "Default" {
		colorPtr = &color
	}

	var variantID uuid.UUID
	err = tx.QueryRow(ctx, `
		INSERT INTO product_variants (product_id, sku, size, color)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT DO NOTHING
		RETURNING id
	`, productID, sku, sizePtr, colorPtr).Scan(&variantID)
	if err != nil {
		sku = sku + "-" + uuid.New().String()[:6]
		err = tx.QueryRow(ctx, `
			INSERT INTO product_variants (product_id, sku, size, color)
			VALUES ($1, $2, $3, $4) RETURNING id
		`, productID, sku, sizePtr, colorPtr).Scan(&variantID)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create variant"})
		return
	}

	qty := req.InitialQuantity
	if qty < 0 {
		qty = 0
	}
	var stock int
	_ = tx.QueryRow(ctx, `
		INSERT INTO inventory (product_variant_id, shop_id, quantity)
		VALUES ($1, $2, $3)
		ON CONFLICT (product_variant_id, shop_id) DO UPDATE
		SET quantity = inventory.quantity + EXCLUDED.quantity, updated_at = NOW()
		RETURNING quantity
	`, variantID, shopID, qty).Scan(&stock)

	if err := tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "commit failed"})
		return
	}

	label := productName
	if size != "" {
		label += " size " + size
	}
	h.logAction(c, &shopID, "inventory.add", "variant", variantID.String(),
		fmt.Sprintf("Added variant %s — %d in stock", label, stock),
		map[string]interface{}{"size": size, "color": color, "quantity": stock})

	c.JSON(http.StatusCreated, gin.H{"id": variantID.String(), "quantity": stock})
}

type setStockRequest struct {
	ShopID           string `json:"shop_id" binding:"required"`
	ProductVariantID string `json:"product_variant_id" binding:"required"`
	Quantity         int    `json:"quantity" binding:"min=0"`
}

func (h *Handler) SetStock(c *gin.Context) {
	var req setStockRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	shopID, err := uuid.Parse(req.ShopID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid shop_id"})
		return
	}
	variantID, err := uuid.Parse(req.ProductVariantID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid product_variant_id"})
		return
	}

	ctx := c.Request.Context()
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "transaction failed"})
		return
	}
	defer tx.Rollback(ctx)

	var qty int
	err = tx.QueryRow(ctx, `
		INSERT INTO inventory (product_variant_id, shop_id, quantity)
		VALUES ($1, $2, $3)
		ON CONFLICT (product_variant_id, shop_id) DO UPDATE
		SET quantity = EXCLUDED.quantity, updated_at = NOW()
		RETURNING quantity
	`, variantID, shopID, req.Quantity).Scan(&qty)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not set stock"})
		return
	}

	_ = ensureDailySnapshot(ctx, tx, shopID, variantID, qty)
	_ = refreshClosingStock(ctx, tx, shopID, variantID, qty)

	if err := tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "commit failed"})
		return
	}

	h.logAction(c, &shopID, "inventory.set", "variant", variantID.String(),
		fmt.Sprintf("Stock set to %d units", qty),
		map[string]interface{}{"quantity": qty})

	c.JSON(http.StatusOK, gin.H{"quantity": qty})
}
