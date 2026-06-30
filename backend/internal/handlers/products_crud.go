package handlers

import (
	"context"
	"net/http"

	"github.com/cresdynamics-lang/pos-prince/backend/internal/catalog"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type productRecord struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Brand        *string  `json:"brand,omitempty"`
	CategoryID   string   `json:"category_id"`
	CategoryName string   `json:"category_name"`
	CategorySlug string   `json:"category_slug"`
	BasePrice    float64  `json:"base_price"`
	CostPrice    float64  `json:"cost_price"`
	IsActive     bool     `json:"is_active"`
	VariantCount int      `json:"variant_count"`
}

func (h *Handler) ListProducts(c *gin.Context) {
	categoryFilter := c.Query("category_id")
	activeOnly := c.Query("active") != "false"

	query := `
		SELECT p.id::text, p.name, p.brand, p.category_id::text,
		       COALESCE(parent.name, cat.name), cat.slug,
		       p.base_price, p.cost_price, p.is_active,
		       COUNT(pv.id)::int
		FROM products p
		JOIN categories cat ON cat.id = p.category_id
		LEFT JOIN categories parent ON parent.id = cat.parent_id
		LEFT JOIN product_variants pv ON pv.product_id = p.id
		WHERE 1=1
	`
	args := []interface{}{}
	if categoryFilter != "" {
		query += ` AND p.category_id = $1`
		args = append(args, categoryFilter)
	}
	if activeOnly {
		query += ` AND p.is_active = TRUE`
	}
	query += ` GROUP BY p.id, cat.id, parent.id ORDER BY p.name`

	rows, err := h.DB.Query(c.Request.Context(), query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load products"})
		return
	}
	defer rows.Close()

	out := []productRecord{}
	for rows.Next() {
		var p productRecord
		if rows.Scan(&p.ID, &p.Name, &p.Brand, &p.CategoryID, &p.CategoryName, &p.CategorySlug,
			&p.BasePrice, &p.CostPrice, &p.IsActive, &p.VariantCount) == nil {
			out = append(out, p)
		}
	}
	c.JSON(http.StatusOK, gin.H{"products": out})
}

type createProductRequest struct {
	Name                  string   `json:"name" binding:"required"`
	CategoryID            string   `json:"category_id" binding:"required"`
	Brand                 string   `json:"brand"`
	BasePrice             float64  `json:"base_price"`
	CostPrice             float64  `json:"cost_price"`
	Colors                []string `json:"colors"`
	InitialStockPerStore  int      `json:"initial_stock_per_store"`
}

func (h *Handler) CreateProduct(c *gin.Context) {
	var req createProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	catID, err := uuid.Parse(req.CategoryID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid category_id"})
		return
	}

	var catSlug string
	if err := h.DB.QueryRow(c.Request.Context(), `SELECT slug FROM categories WHERE id = $1`, catID).Scan(&catSlug); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "category not found"})
		return
	}

	colors := req.Colors
	if len(colors) == 0 {
		colors = []string{"Default"}
	}

	ctx := c.Request.Context()
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "transaction failed"})
		return
	}
	defer tx.Rollback(ctx)

	var productID uuid.UUID
	err = tx.QueryRow(ctx, `
		INSERT INTO products (category_id, name, brand, base_price, cost_price)
		VALUES ($1, $2, NULLIF($3, ''), $4, $5)
		RETURNING id
	`, catID, req.Name, req.Brand, req.BasePrice, req.CostPrice).Scan(&productID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "create product failed"})
		return
	}

	baseSlug := slugify(req.Name)
	variantCount, err := createProductVariants(ctx, tx, productID, baseSlug, catSlug, colors)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	initialQty := req.InitialStockPerStore
	if initialQty < 0 {
		initialQty = 0
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO inventory (product_variant_id, shop_id, quantity)
		SELECT pv.id, s.id, $1
		FROM product_variants pv
		CROSS JOIN shops s
		WHERE pv.product_id = $2 AND s.is_active = TRUE
		ON CONFLICT (product_variant_id, shop_id) DO NOTHING
	`, initialQty, productID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "inventory sync failed"})
		return
	}

	if err := tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "commit failed"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":            productID.String(),
		"variant_count": variantCount,
	})
}

func createProductVariants(ctx context.Context, tx pgx.Tx, productID uuid.UUID, baseSlug, catSlug string, colors []string) (int, error) {
	sizes := catalog.SizeProfile(catSlug)
	if len(sizes) == 0 {
		sizes = []string{""}
	}

	count := 0
	for _, color := range colors {
		for _, size := range sizes {
			sku := baseSlug
			var sizePtr, colorPtr *string
			if size != "" {
				sku += "-" + size
				sizePtr = &size
			}
			if color != "" && color != "Default" {
				sku += "-" + color
				colorPtr = &color
			} else if color == "Default" && len(colors) == 1 {
				// single default color — no suffix
			} else if color != "" {
				sku += "-" + slugify(color)
				colorPtr = &color
			}

			_, err := tx.Exec(ctx, `
				INSERT INTO product_variants (product_id, sku, size, color)
				VALUES ($1, $2, $3, $4)
				ON CONFLICT DO NOTHING
			`, productID, sku, sizePtr, colorPtr)
			if err != nil {
				// retry with unique suffix on sku collision
				sku = sku + "-" + uuid.New().String()[:6]
				_, err = tx.Exec(ctx, `
					INSERT INTO product_variants (product_id, sku, size, color)
					VALUES ($1, $2, $3, $4)
				`, productID, sku, sizePtr, colorPtr)
				if err != nil {
					return count, err
				}
			}
			count++
		}
	}
	return count, nil
}

func (h *Handler) DeleteProduct(c *gin.Context) {
	productID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid product id"})
		return
	}

	var saleCount int
	_ = h.DB.QueryRow(c.Request.Context(), `
		SELECT COUNT(*) FROM sales_transactions st
		JOIN product_variants pv ON pv.id = st.product_variant_id
		WHERE pv.product_id = $1
	`, productID).Scan(&saleCount)

	if saleCount > 0 {
		_, err = h.DB.Exec(c.Request.Context(), `UPDATE products SET is_active = FALSE, updated_at = NOW() WHERE id = $1`, productID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "deactivate failed"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"deactivated": true})
		return
	}

	_, err = h.DB.Exec(c.Request.Context(), `DELETE FROM products WHERE id = $1`, productID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "delete failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": true})
}
