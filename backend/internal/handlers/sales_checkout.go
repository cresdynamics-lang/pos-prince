package handlers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/cresdynamics-lang/pos-prince/backend/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type checkoutLineRequest struct {
	ProductVariantID string  `json:"product_variant_id" binding:"required"`
	Quantity         int     `json:"quantity" binding:"required,min=1"`
	SalePrice        float64 `json:"sale_price" binding:"required,min=0"`
	InventoryShopID  string  `json:"inventory_shop_id"`
}

type checkoutRequest struct {
	ShopID          string                `json:"shop_id" binding:"required"`
	PaymentMethod   string                `json:"payment_method" binding:"required"`
	OverallDiscount float64               `json:"overall_discount"`
	Items           []checkoutLineRequest `json:"items" binding:"required,min=1,dive"`
}

type checkoutLineResult struct {
	ProductVariantID string  `json:"product_variant_id"`
	Quantity         int     `json:"quantity"`
	ListPrice        float64 `json:"list_price"`
	SalePrice        float64 `json:"sale_price"`
	LineDiscount     float64 `json:"line_discount"`
	InventoryShopID  string  `json:"inventory_shop_id"`
	ClosingStock     int     `json:"closing_stock"`
}

func (h *Handler) CheckoutSale(c *gin.Context) {
	var req checkoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.OverallDiscount < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "overall_discount cannot be negative"})
		return
	}

	claims := middleware.GetClaims(c)
	sellingShopID, err := uuid.Parse(req.ShopID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid shop_id"})
		return
	}

	ctx := c.Request.Context()
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "transaction failed"})
		return
	}
	defer tx.Rollback(ctx)

	var grossTotal, lineDiscountTotal, netBeforeOverall float64
	lineResults := []checkoutLineResult{}

	for _, item := range req.Items {
		variantID, err := uuid.Parse(item.ProductVariantID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid product_variant_id"})
			return
		}

		invShopID := sellingShopID
		if item.InventoryShopID != "" {
			parsed, err := uuid.Parse(item.InventoryShopID)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid inventory_shop_id"})
				return
			}
			invShopID = parsed
		}

		var listPrice float64
		if err := tx.QueryRow(ctx, `
			SELECT p.base_price FROM products p
			JOIN product_variants pv ON pv.product_id = p.id WHERE pv.id = $1
		`, variantID).Scan(&listPrice); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
			return
		}

		lineGross := listPrice * float64(item.Quantity)
		lineNet := item.SalePrice * float64(item.Quantity)
		lineDiscount := lineGross - lineNet
		if lineDiscount < 0 {
			lineDiscount = 0
		}

		grossTotal += lineGross
		lineDiscountTotal += lineDiscount
		netBeforeOverall += lineNet

		qty, err := lockInventory(ctx, tx, invShopID, variantID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "stock not found for fulfillment store"})
			return
		}
		if qty < item.Quantity {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":     "insufficient stock at fulfillment store",
				"variant":   item.ProductVariantID,
				"available": qty,
			})
			return
		}

		newQty, err := deductInventoryForSale(ctx, tx, sellingShopID, invShopID, variantID, item.Quantity, qty)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		lineResults = append(lineResults, checkoutLineResult{
			ProductVariantID: item.ProductVariantID,
			Quantity:         item.Quantity,
			ListPrice:        listPrice,
			SalePrice:        item.SalePrice,
			LineDiscount:     lineDiscount,
			InventoryShopID:  invShopID.String(),
			ClosingStock:     newQty,
		})
	}

	if req.OverallDiscount > netBeforeOverall {
		c.JSON(http.StatusBadRequest, gin.H{"error": "overall_discount exceeds sale total"})
		return
	}

	netTotal := netBeforeOverall - req.OverallDiscount

	var orderID uuid.UUID
	err = tx.QueryRow(ctx, `
		INSERT INTO sales_orders
			(shop_id, cashier_id, payment_method, gross_total, line_discount_total, overall_discount, net_total)
		VALUES ($1, $2, $3::payment_method, $4, $5, $6, $7)
		RETURNING id
	`, sellingShopID, claims.UserID, req.PaymentMethod, grossTotal, lineDiscountTotal, req.OverallDiscount, netTotal).Scan(&orderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create order"})
		return
	}

	for i, item := range req.Items {
		variantID, _ := uuid.Parse(item.ProductVariantID)
		invShopID, _ := uuid.Parse(lineResults[i].InventoryShopID)
		line := lineResults[i]

		_, err = tx.Exec(ctx, `
			INSERT INTO sales_transactions
				(order_id, shop_id, inventory_shop_id, cashier_id, product_variant_id,
				 quantity, list_price, sale_price, discount_amount, payment_method)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::payment_method)
		`, orderID, sellingShopID, invShopID, claims.UserID, variantID,
			item.Quantity, line.ListPrice, item.SalePrice, line.LineDiscount, req.PaymentMethod)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not record sale line"})
			return
		}
	}

	if err := tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "commit failed"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"order_id":            orderID.String(),
		"gross_total":         grossTotal,
		"line_discount_total": lineDiscountTotal,
		"overall_discount":    req.OverallDiscount,
		"net_total":           netTotal,
		"items":               lineResults,
	})
	h.logAction(c, &sellingShopID, "sale.checkout", "order", orderID.String(),
		fmt.Sprintf("POS sale %s (%d items, %s)", kes(netTotal), len(req.Items), req.PaymentMethod),
		map[string]interface{}{"net_total": netTotal, "items": len(req.Items), "payment": req.PaymentMethod})
}

func deductInventoryForSale(ctx context.Context, tx pgx.Tx, sellingShopID, inventoryShopID, variantID uuid.UUID, soldQty, currentQty int) (int, error) {
	newQty := currentQty - soldQty
	_, err := tx.Exec(ctx, `
		UPDATE inventory SET quantity = $1, updated_at = NOW()
		WHERE shop_id = $2 AND product_variant_id = $3
	`, newQty, inventoryShopID, variantID)
	if err != nil {
		return 0, err
	}

	if err := ensureDailySnapshot(ctx, tx, inventoryShopID, variantID, currentQty); err != nil {
		return 0, err
	}
	if err := refreshClosingStock(ctx, tx, inventoryShopID, variantID, newQty); err != nil {
		return 0, err
	}

	if sellingShopID == inventoryShopID {
		if err := bumpSnapshotSold(ctx, tx, inventoryShopID, variantID, soldQty, newQty); err != nil {
			return 0, err
		}
		return newQty, nil
	}

	if err := bumpSnapshotTransferredOut(ctx, tx, inventoryShopID, variantID, soldQty, newQty); err != nil {
		return 0, err
	}
	if err := bumpSnapshotSoldAtOtherStore(ctx, tx, sellingShopID, variantID, soldQty); err != nil {
		return 0, err
	}

	return newQty, nil
}

func bumpSnapshotTransferredOut(ctx context.Context, tx pgx.Tx, shopID, variantID uuid.UUID, qty, closing int) error {
	today := timeToday()
	var opening int
	_ = tx.QueryRow(ctx, `
		SELECT COALESCE(opening_stock, $4) FROM daily_stock_snapshots
		WHERE shop_id = $1 AND product_variant_id = $2 AND snapshot_date = $3::date
	`, shopID, variantID, today, closing+qty).Scan(&opening)

	_, err := tx.Exec(ctx, `
		INSERT INTO daily_stock_snapshots
			(shop_id, product_variant_id, opening_stock, units_transferred_out, closing_stock, snapshot_date)
		VALUES ($1, $2, $3, $4, $5, $6::date)
		ON CONFLICT (shop_id, product_variant_id, snapshot_date) DO UPDATE SET
			units_transferred_out = daily_stock_snapshots.units_transferred_out + EXCLUDED.units_transferred_out,
			closing_stock = EXCLUDED.closing_stock
	`, shopID, variantID, opening, qty, closing, today)
	return err
}

func bumpSnapshotSoldAtOtherStore(ctx context.Context, tx pgx.Tx, shopID, variantID uuid.UUID, sold int) error {
	today := timeToday()
	var invQty int
	_ = tx.QueryRow(ctx, `
		SELECT COALESCE(quantity, 0) FROM inventory WHERE shop_id = $1 AND product_variant_id = $2
	`, shopID, variantID).Scan(&invQty)

	_, err := tx.Exec(ctx, `
		INSERT INTO daily_stock_snapshots
			(shop_id, product_variant_id, opening_stock, units_sold, closing_stock, snapshot_date)
		VALUES ($1, $2, $3, $4, $5, $6::date)
		ON CONFLICT (shop_id, product_variant_id, snapshot_date) DO UPDATE SET
			units_sold = daily_stock_snapshots.units_sold + EXCLUDED.units_sold
	`, shopID, variantID, invQty, sold, invQty, today)
	return err
}

func timeToday() string {
	return timeNow().Format("2006-01-02")
}

// timeNow is overridden in tests; default uses real clock.
var timeNow = func() time.Time { return time.Now() }
