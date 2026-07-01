package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strings"

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
	ParentName   string   `json:"parent_name,omitempty"`
	CategorySlug string   `json:"category_slug"`
	BasePrice    float64  `json:"base_price"`
	CostPrice    float64  `json:"cost_price"`
	IsActive     bool     `json:"is_active"`
	VariantCount int      `json:"variant_count"`
	Provisioned  bool     `json:"provisioned"`
}

func (h *Handler) ListProducts(c *gin.Context) {
	categoryFilter := c.Query("category_id")
	parentFilter := c.Query("parent_id")
	activeOnly := c.Query("active") != "false"

	// List every sellable leaf category (subcategory = product). Parent categories with
	// children are navigational only; a leaf is either a subcategory or a root with no children.
	query := `
		SELECT COALESCE(p.id::text, ''),
		       COALESCE(p.name, cat.name),
		       p.brand,
		       cat.id::text,
		       COALESCE(parent.name, cat.name),
		       COALESCE(parent.name, ''),
		       cat.slug,
		       COALESCE(p.base_price, 0),
		       COALESCE(p.cost_price, 0),
		       COALESCE(p.is_active, FALSE),
		       COALESCE(COUNT(pv.id), 0)::int,
		       (p.id IS NOT NULL)
		FROM categories cat
		LEFT JOIN categories parent ON parent.id = cat.parent_id
		LEFT JOIN products p ON p.category_id = cat.id
		LEFT JOIN product_variants pv ON pv.product_id = p.id
		WHERE NOT EXISTS (SELECT 1 FROM categories ch WHERE ch.parent_id = cat.id)
	`
	args := []interface{}{}
	n := 1
	if categoryFilter != "" {
		query += fmt.Sprintf(` AND cat.id = $%d`, n)
		args = append(args, categoryFilter)
		n++
	}
	if parentFilter != "" {
		query += fmt.Sprintf(` AND (parent.id = $%d OR cat.id = $%d)`, n, n)
		args = append(args, parentFilter)
		n++
	}
	if activeOnly {
		query += ` AND (p.id IS NULL OR p.is_active = TRUE)`
	}
	query += ` GROUP BY cat.id, parent.id, p.id ORDER BY COALESCE(parent.name, cat.name), cat.name`

	rows, err := h.DB.Query(c.Request.Context(), query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load products"})
		return
	}
	defer rows.Close()

	out := []productRecord{}
	for rows.Next() {
		var p productRecord
		if rows.Scan(&p.ID, &p.Name, &p.Brand, &p.CategoryID, &p.CategoryName, &p.ParentName, &p.CategorySlug,
			&p.BasePrice, &p.CostPrice, &p.IsActive, &p.VariantCount, &p.Provisioned) == nil {
			out = append(out, p)
		}
	}
	c.JSON(http.StatusOK, gin.H{"products": out})
}

type createProductRequest struct {
	Name                 string   `json:"name"`
	CategoryID           string   `json:"category_id" binding:"required"`
	Brand                string   `json:"brand"`
	BasePrice            float64  `json:"base_price"`
	CostPrice            float64  `json:"cost_price"`
	Colors               []string `json:"colors"`
	InitialStockPerStore int      `json:"initial_stock_per_store"`
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

	var catSlug, catName string
	var childCount, existingProducts int
	err = h.DB.QueryRow(c.Request.Context(), `
		SELECT cat.slug, cat.name,
		       (SELECT COUNT(*) FROM categories ch WHERE ch.parent_id = cat.id),
		       (SELECT COUNT(*) FROM products p WHERE p.category_id = cat.id)
		FROM categories cat WHERE cat.id = $1
	`, catID).Scan(&catSlug, &catName, &childCount, &existingProducts)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "category not found"})
		return
	}
	if childCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "choose a subcategory — parent categories are not sellable products"})
		return
	}
	if existingProducts > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "this subcategory already has a product — update stock or pricing instead"})
		return
	}

	productName := strings.TrimSpace(req.Name)
	if productName == "" {
		productName = catName
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
	`, catID, productName, req.Brand, req.BasePrice, req.CostPrice).Scan(&productID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "create product failed"})
		return
	}

	baseSlug := catSlug
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
