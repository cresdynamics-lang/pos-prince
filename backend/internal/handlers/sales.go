package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/cresdynamics-lang/pos-prince/backend/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type saleRecord struct {
	ID                string    `json:"id"`
	OrderID           *string   `json:"order_id,omitempty"`
	Product           string    `json:"product"`
	VariantLabel      string    `json:"variant_label"`
	SKU               string    `json:"sku"`
	Shop              string    `json:"shop"`
	StoreName         string    `json:"store_name"`
	ShopID            string    `json:"shop_id"`
	InventoryShop     string    `json:"inventory_shop"`
	InventoryShopID   string    `json:"inventory_shop_id"`
	Cashier           string    `json:"cashier"`
	CashierID         string    `json:"cashier_id"`
	Quantity          int       `json:"quantity"`
	ListPrice         float64   `json:"list_price"`
	SalePrice         float64   `json:"sale_price"`
	DiscountAmount    float64   `json:"discount_amount"`
	OverallDiscount   float64   `json:"overall_discount"`
	OrderNetTotal     *float64  `json:"order_net_total,omitempty"`
	Total             float64   `json:"total"`
	GrossTotal        float64   `json:"gross_total"`
	PaymentMethod     string    `json:"payment_method"`
	TransactionTime   time.Time `json:"transaction_time"`
}

func (h *Handler) SalesList(c *gin.Context) {
	sc := scopeFromRequest(c)
	shopFilter := sc.ShopID
	query := `
		SELECT st.id, st.order_id::text, p.name, pv.sku, pv.size, pv.color, pv.material,
		       ss.name, st.shop_id::text, invs.name, st.inventory_shop_id::text,
		       u.name, st.cashier_id::text,
		       st.quantity, st.list_price, st.sale_price, st.discount_amount,
		       COALESCE(so.overall_discount, 0), so.net_total,
		       st.payment_method::text, st.transaction_time
		FROM sales_transactions st
		JOIN product_variants pv ON pv.id = st.product_variant_id
		JOIN products p ON p.id = pv.product_id
		JOIN shops ss ON ss.id = st.shop_id
		LEFT JOIN shops invs ON invs.id = st.inventory_shop_id
		JOIN users u ON u.id = st.cashier_id
		LEFT JOIN sales_orders so ON so.id = st.order_id
		WHERE 1=1
	`
	args := []interface{}{}
	argN := 1
	if shopFilter != "" {
		query += fmt.Sprintf(` AND st.shop_id = $%d`, argN)
		args = append(args, shopFilter)
		argN++
	}
	if sc.CashierID != nil {
		query += fmt.Sprintf(` AND st.cashier_id = $%d`, argN)
		args = append(args, *sc.CashierID)
	}
	query += ` ORDER BY st.transaction_time DESC LIMIT 200`

	rows, err := h.DB.Query(c.Request.Context(), query, args...)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"sales": []saleRecord{}})
		return
	}
	defer rows.Close()

	sales := []saleRecord{}
	for rows.Next() {
		var s saleRecord
		var size, color, material *string
		var orderID *string
		var orderNet *float64
		if err := rows.Scan(
			&s.ID, &orderID, &s.Product, &s.SKU, &size, &color, &material,
			&s.Shop, &s.ShopID, &s.InventoryShop, &s.InventoryShopID,
			&s.Cashier, &s.CashierID,
			&s.Quantity, &s.ListPrice, &s.SalePrice, &s.DiscountAmount,
			&s.OverallDiscount, &orderNet,
			&s.PaymentMethod, &s.TransactionTime,
		); err != nil {
			continue
		}
		s.OrderID = orderID
		s.OrderNetTotal = orderNet
		s.StoreName = s.Shop
		if s.InventoryShop == "" {
			s.InventoryShop = s.Shop
		}
		s.VariantLabel = variantLabel(size, color, material)
		s.Total = s.SalePrice * float64(s.Quantity)
		s.GrossTotal = s.ListPrice * float64(s.Quantity)
		sales = append(sales, s)
	}
	c.JSON(http.StatusOK, gin.H{"sales": sales})
}

type createSaleRequest struct {
	ShopID           string  `json:"shop_id" binding:"required"`
	ProductVariantID string  `json:"product_variant_id" binding:"required"`
	Quantity         int     `json:"quantity" binding:"required,min=1"`
	SalePrice        float64 `json:"sale_price" binding:"required,min=0"`
	PaymentMethod    string  `json:"payment_method" binding:"required"`
}

func (h *Handler) CreateSale(c *gin.Context) {
	var req createSaleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	claims := middleware.GetClaims(c)
	shopID, _ := uuid.Parse(req.ShopID)
	variantID, _ := uuid.Parse(req.ProductVariantID)

	ctx := c.Request.Context()
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "transaction failed"})
		return
	}
	defer tx.Rollback(ctx)

	var listPrice float64
	if err := tx.QueryRow(ctx, `
		SELECT p.base_price FROM products p
		JOIN product_variants pv ON pv.product_id = p.id WHERE pv.id = $1
	`, variantID).Scan(&listPrice); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "product not found"})
		return
	}

	discountPerUnit := listPrice - req.SalePrice
	if discountPerUnit < 0 {
		discountPerUnit = 0
	}
	discountTotal := discountPerUnit * float64(req.Quantity)

	qty, err := lockInventory(ctx, tx, shopID, variantID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "stock not found for this store"})
		return
	}
	if qty < req.Quantity {
		c.JSON(http.StatusBadRequest, gin.H{"error": "insufficient stock", "available": qty})
		return
	}

	newQty, err := deductInventoryForSale(ctx, tx, shopID, shopID, variantID, req.Quantity, qty)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	netTotal := req.SalePrice * float64(req.Quantity)
	var orderID uuid.UUID
	err = tx.QueryRow(ctx, `
		INSERT INTO sales_orders
			(shop_id, cashier_id, payment_method, gross_total, line_discount_total, overall_discount, net_total)
		VALUES ($1, $2, $3::payment_method, $4, $5, 0, $6)
		RETURNING id
	`, shopID, claims.UserID, req.PaymentMethod,
		listPrice*float64(req.Quantity), discountTotal, netTotal).Scan(&orderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create order"})
		return
	}

	var saleID string
	err = tx.QueryRow(ctx, `
		INSERT INTO sales_transactions
			(order_id, shop_id, inventory_shop_id, cashier_id, product_variant_id, quantity,
			 list_price, sale_price, discount_amount, payment_method)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::payment_method)
		RETURNING id::text
	`, orderID, shopID, shopID, claims.UserID, variantID, req.Quantity,
		listPrice, req.SalePrice, discountTotal, req.PaymentMethod).Scan(&saleID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not record sale"})
		return
	}

	if err := tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "commit failed"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id": saleID,
		"closing_stock": newQty,
		"list_price": listPrice,
		"discount_amount": discountTotal,
		"net_revenue": req.SalePrice * float64(req.Quantity),
	})
	h.logAction(c, &shopID, "sale.create", "sale", saleID,
		fmt.Sprintf("Sale %s × %d @ %s (%s)", kes(req.SalePrice), req.Quantity, kes(netTotal), req.PaymentMethod),
		map[string]interface{}{"quantity": req.Quantity, "sale_price": req.SalePrice, "net_total": netTotal})
}
