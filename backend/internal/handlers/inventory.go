package handlers

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type inventoryItem struct {
	ID               string  `json:"id"`
	ProductVariantID string  `json:"product_variant_id"`
	ShopID           string  `json:"shop_id"`
	ShopName         string  `json:"shop_name"`
	ProductName      string  `json:"product_name"`
	Category         string  `json:"category"`
	SKU              string  `json:"sku"`
	Size             *string `json:"size,omitempty"`
	Color            *string `json:"color,omitempty"`
	Quantity         int     `json:"quantity"`
	OpeningStock     int     `json:"opening_stock"`
	ClosingStock     int     `json:"closing_stock"`
	UnitsSoldToday   int     `json:"units_sold_today"`
	ReorderThreshold int     `json:"reorder_threshold"`
}

func (h *Handler) ListInventory(c *gin.Context) {
	_ = rolloverDailySnapshots(c.Request.Context(), h.DB)

	shopFilter := c.Query("shop_id")
	categoryFilter := c.Query("category_slug")

	query := `
		SELECT i.id, i.product_variant_id, i.shop_id, s.name, p.name,
		       COALESCE(parent.name, cat.name), pv.sku, pv.size, pv.color,
		       i.quantity, COALESCE(ds.opening_stock, i.quantity), COALESCE(ds.closing_stock, i.quantity),
		       COALESCE(ds.units_sold, 0), i.reorder_threshold
		FROM inventory i
		JOIN product_variants pv ON pv.id = i.product_variant_id
		JOIN products p ON p.id = pv.product_id
		JOIN categories cat ON cat.id = p.category_id
		LEFT JOIN categories parent ON parent.id = cat.parent_id
		JOIN shops s ON s.id = i.shop_id
		LEFT JOIN daily_stock_snapshots ds ON ds.shop_id = i.shop_id
			AND ds.product_variant_id = i.product_variant_id
			AND ds.snapshot_date = CURRENT_DATE
		WHERE 1=1
	`
	args := []interface{}{}
	n := 1
	if shopFilter != "" {
		query += fmt.Sprintf(" AND i.shop_id = $%d", n)
		args = append(args, shopFilter)
		n++
	}
	if categoryFilter != "" {
		query += fmt.Sprintf(" AND (cat.slug = $%d OR parent.slug = $%d)", n, n)
		args = append(args, categoryFilter)
		n++
	}
	query += ` ORDER BY s.name, p.name, pv.size NULLS LAST, pv.color`

	rows, err := h.DB.Query(c.Request.Context(), query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load inventory"})
		return
	}
	defer rows.Close()

	items := []inventoryItem{}
	for rows.Next() {
		var it inventoryItem
		if err := rows.Scan(
			&it.ID, &it.ProductVariantID, &it.ShopID, &it.ShopName, &it.ProductName,
			&it.Category, &it.SKU, &it.Size, &it.Color,
			&it.Quantity, &it.OpeningStock, &it.ClosingStock, &it.UnitsSoldToday, &it.ReorderThreshold,
		); err != nil {
			continue
		}
		items = append(items, it)
	}
	c.JSON(http.StatusOK, gin.H{"inventory": items})
}

type addStockRequest struct {
	ShopID           string `json:"shop_id" binding:"required"`
	ProductVariantID string `json:"product_variant_id" binding:"required"`
	Quantity         int    `json:"quantity" binding:"required,min=1"`
}

func (h *Handler) AddStock(c *gin.Context) {
	var req addStockRequest
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
		SET quantity = inventory.quantity + EXCLUDED.quantity, updated_at = NOW()
		RETURNING quantity
	`, variantID, shopID, req.Quantity).Scan(&qty)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not add stock"})
		return
	}

	if err := ensureDailySnapshot(ctx, tx, shopID, variantID, qty-req.Quantity); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "snapshot failed"})
		return
	}
	if err := refreshClosingStock(ctx, tx, shopID, variantID, qty); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "snapshot update failed"})
		return
	}

	if err := tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "commit failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"quantity": qty, "added": req.Quantity})
	h.logAction(c, &shopID, "inventory.add", "variant", variantID.String(),
		fmt.Sprintf("Added %d units (now %d in store)", req.Quantity, qty),
		map[string]interface{}{"added": req.Quantity, "quantity": qty})
}

func (h *Handler) ListProductVariants(c *gin.Context) {
	categorySlug := c.Query("category_slug")
	shopID := c.Query("shop_id")
	search := strings.TrimSpace(c.Query("q"))
	includeStores := c.Query("include_stores") == "1" || c.Query("include_stores") == "true"

	type storeQty struct {
		StoreID   string `json:"store_id"`
		StoreName string `json:"store_name"`
		Quantity  int    `json:"quantity"`
	}

	type variant struct {
		ID       string     `json:"id"`
		Product  string     `json:"product"`
		Category string     `json:"category"`
		SKU      string     `json:"sku"`
		Size     *string    `json:"size,omitempty"`
		Color    *string    `json:"color,omitempty"`
		Price    float64    `json:"price"`
		Stock    *int       `json:"stock,omitempty"`
		Stores   []storeQty `json:"stores,omitempty"`
	}

	query := `
		SELECT pv.id::text, p.name, COALESCE(parent.name, cat.name), pv.sku, pv.size, pv.color, p.base_price
	`
	if shopID != "" {
		query += `, COALESCE(i.quantity, 0)`
	}
	query += `
		FROM product_variants pv
		JOIN products p ON p.id = pv.product_id
		JOIN categories cat ON cat.id = p.category_id
		LEFT JOIN categories parent ON parent.id = cat.parent_id
	`
	args := []interface{}{}
	n := 1
	if shopID != "" {
		query += fmt.Sprintf(` LEFT JOIN inventory i ON i.product_variant_id = pv.id AND i.shop_id = $%d`, n)
		args = append(args, shopID)
		n++
	}
	query += ` WHERE p.is_active = TRUE`
	if categorySlug != "" {
		query += fmt.Sprintf(` AND (cat.slug = $%d OR parent.slug = $%d)`, n, n)
		args = append(args, categorySlug)
		n++
	}
	if search != "" {
		query += fmt.Sprintf(` AND (p.name ILIKE $%d OR pv.sku ILIKE $%d)`, n, n)
		args = append(args, "%"+search+"%")
		n++
	}
	query += ` ORDER BY p.name, pv.size NULLS LAST LIMIT 100`

	rows, err := h.DB.Query(c.Request.Context(), query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load variants"})
		return
	}
	defer rows.Close()

	out := []variant{}
	for rows.Next() {
		var v variant
		if shopID != "" {
			var stock int
			if rows.Scan(&v.ID, &v.Product, &v.Category, &v.SKU, &v.Size, &v.Color, &v.Price, &stock) == nil {
				v.Stock = &stock
				out = append(out, v)
			}
		} else if rows.Scan(&v.ID, &v.Product, &v.Category, &v.SKU, &v.Size, &v.Color, &v.Price) == nil {
			out = append(out, v)
		}
	}

	if includeStores && len(out) > 0 {
		ids := make([]uuid.UUID, len(out))
		for i, v := range out {
			if id, err := uuid.Parse(v.ID); err == nil {
				ids[i] = id
			}
		}
		stockRows, err := h.DB.Query(c.Request.Context(), `
			SELECT i.product_variant_id::text, s.id::text, s.name, COALESCE(i.quantity, 0)
			FROM inventory i
			JOIN shops s ON s.id = i.shop_id
			WHERE s.is_active = TRUE AND i.product_variant_id = ANY($1)
			ORDER BY s.name
		`, ids)
		if err == nil {
			byVariant := map[string][]storeQty{}
			for stockRows.Next() {
				var variantID, storeID, storeName string
				var qty int
				if stockRows.Scan(&variantID, &storeID, &storeName, &qty) == nil {
					byVariant[variantID] = append(byVariant[variantID], storeQty{
						StoreID: storeID, StoreName: storeName, Quantity: qty,
					})
				}
			}
			stockRows.Close()
			for i := range out {
				out[i].Stores = byVariant[out[i].ID]
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"variants": out})
}
