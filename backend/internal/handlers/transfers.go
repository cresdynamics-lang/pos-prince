package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/cresdynamics-lang/pos-prince/backend/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type transferRecord struct {
	ID              string    `json:"id"`
	ProductName     string    `json:"product_name"`
	SKU             string    `json:"sku"`
	VariantLabel    string    `json:"variant_label"`
	SourceShop      string    `json:"source_shop"`
	DestShop        string    `json:"destination_shop"`
	Quantity        int       `json:"quantity"`
	Status          string    `json:"status"`
	InitiatedBy     string    `json:"initiated_by"`
	InitiatedAt     time.Time `json:"initiated_at"`
	CompletedAt     *time.Time `json:"completed_at,omitempty"`
	Notes           *string   `json:"notes,omitempty"`
}

func (h *Handler) ListTransfers(c *gin.Context) {
	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT sm.id::text, p.name, pv.sku, pv.size, pv.color, pv.material,
		       ss.name, ds.name, sm.quantity, sm.status::text, u.name,
		       sm.initiated_at, sm.completed_at, sm.notes
		FROM stock_movements sm
		JOIN product_variants pv ON pv.id = sm.product_variant_id
		JOIN products p ON p.id = pv.product_id
		JOIN shops ss ON ss.id = sm.source_shop_id
		JOIN shops ds ON ds.id = sm.destination_shop_id
		JOIN users u ON u.id = sm.initiated_by_user_id
		ORDER BY sm.initiated_at DESC LIMIT 100
	`)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"transfers": []transferRecord{}})
		return
	}
	defer rows.Close()

	out := []transferRecord{}
	for rows.Next() {
		var t transferRecord
		var size, color, material *string
		if rows.Scan(&t.ID, &t.ProductName, &t.SKU, &size, &color, &material,
			&t.SourceShop, &t.DestShop, &t.Quantity, &t.Status, &t.InitiatedBy,
			&t.InitiatedAt, &t.CompletedAt, &t.Notes) == nil {
			t.VariantLabel = variantLabel(size, color, material)
			out = append(out, t)
		}
	}
	c.JSON(http.StatusOK, gin.H{"transfers": out})
}

type createTransferRequest struct {
	ProductVariantID  string `json:"product_variant_id" binding:"required"`
	SourceShopID      string `json:"source_shop_id" binding:"required"`
	DestinationShopID string `json:"destination_shop_id" binding:"required"`
	Quantity          int    `json:"quantity" binding:"required,min=1"`
	Notes             string `json:"notes"`
}

func (h *Handler) CreateTransfer(c *gin.Context) {
	var req createTransferRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.SourceShopID == req.DestinationShopID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "source and destination store must differ"})
		return
	}

	claims := middleware.GetClaims(c)
	srcID, _ := uuid.Parse(req.SourceShopID)
	dstID, _ := uuid.Parse(req.DestinationShopID)
	variantID, _ := uuid.Parse(req.ProductVariantID)

	ctx := c.Request.Context()
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "transaction failed"})
		return
	}
	defer tx.Rollback(ctx)

	srcQty, err := lockInventory(ctx, tx, srcID, variantID)
	if err != nil || srcQty < req.Quantity {
		c.JSON(http.StatusBadRequest, gin.H{"error": "insufficient stock at source store", "available": srcQty})
		return
	}

	// Ensure destination row exists (all stores carry same catalog)
	_, _ = tx.Exec(ctx, `
		INSERT INTO inventory (product_variant_id, shop_id, quantity)
		VALUES ($1, $2, 0) ON CONFLICT DO NOTHING
	`, variantID, dstID)

	dstQty, err := lockInventory(ctx, tx, dstID, variantID)
	if err != nil {
		dstQty = 0
	}

	var transferID string
	err = tx.QueryRow(ctx, `
		INSERT INTO stock_movements
			(product_variant_id, source_shop_id, destination_shop_id, quantity, status, initiated_by_user_id, completed_at, notes)
		VALUES ($1, $2, $3, $4, 'completed', $5, NOW(), NULLIF($6, ''))
		RETURNING id::text
	`, variantID, srcID, dstID, req.Quantity, claims.UserID, req.Notes).Scan(&transferID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "transfer record failed"})
		return
	}

	newSrc := srcQty - req.Quantity
	newDst := dstQty + req.Quantity
	_, err = tx.Exec(ctx, `UPDATE inventory SET quantity = $1, updated_at = NOW() WHERE shop_id = $2 AND product_variant_id = $3`, newSrc, srcID, variantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "source update failed"})
		return
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO inventory (product_variant_id, shop_id, quantity)
		VALUES ($1, $2, $3)
		ON CONFLICT (product_variant_id, shop_id) DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = NOW()
	`, variantID, dstID, newDst)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "destination update failed"})
		return
	}

	// Snapshot transfers
	today := time.Now().Format("2006-01-02")
	_, _ = tx.Exec(ctx, `
		INSERT INTO daily_stock_snapshots (shop_id, product_variant_id, opening_stock, units_transferred_out, closing_stock, snapshot_date)
		VALUES ($1, $2, $3, $4, $5, $6::date)
		ON CONFLICT (shop_id, product_variant_id, snapshot_date) DO UPDATE SET
			units_transferred_out = daily_stock_snapshots.units_transferred_out + EXCLUDED.units_transferred_out,
			closing_stock = $5
	`, srcID, variantID, srcQty, req.Quantity, newSrc, today)
	_, _ = tx.Exec(ctx, `
		INSERT INTO daily_stock_snapshots (shop_id, product_variant_id, opening_stock, units_transferred_in, closing_stock, snapshot_date)
		VALUES ($1, $2, $3, $4, $5, $6::date)
		ON CONFLICT (shop_id, product_variant_id, snapshot_date) DO UPDATE SET
			units_transferred_in = daily_stock_snapshots.units_transferred_in + EXCLUDED.units_transferred_in,
			closing_stock = $5
	`, dstID, variantID, dstQty, req.Quantity, newDst, today)

	if err := tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "commit failed"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id": transferID,
		"source_closing": newSrc,
		"destination_closing": newDst,
	})
	h.logAction(c, &srcID, "transfer.create", "transfer", transferID,
		fmt.Sprintf("Moved %d units between stores", req.Quantity),
		map[string]interface{}{"quantity": req.Quantity, "source": req.SourceShopID, "destination": req.DestinationShopID})
}

// SyncStoreCatalog ensures every variant has an inventory row in every active store.
func (h *Handler) SyncStoreCatalog(c *gin.Context) {
	_, err := h.DB.Exec(c.Request.Context(), `
		INSERT INTO inventory (product_variant_id, shop_id, quantity)
		SELECT pv.id, s.id, 0
		FROM product_variants pv
		CROSS JOIN shops s
		WHERE s.is_active = TRUE
		ON CONFLICT (product_variant_id, shop_id) DO NOTHING
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "sync failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"synced": true})
}
