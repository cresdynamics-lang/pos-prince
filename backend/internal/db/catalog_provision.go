package db

import (
	"context"
	"log"
	"strings"

	"github.com/cresdynamics-lang/pos-prince/backend/internal/catalog"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type leafCategory struct {
	ID   uuid.UUID
	Name string
	Slug string
}

// EnsureLeafCategoryProducts creates a product + default variants for every sellable
// leaf category that does not yet have one. Pricing stays at zero until set in admin.
func EnsureLeafCategoryProducts(ctx context.Context, pool *pgxpool.Pool) {
	rows, err := pool.Query(ctx, `
		SELECT cat.id, cat.name, cat.slug
		FROM categories cat
		WHERE NOT EXISTS (SELECT 1 FROM categories ch WHERE ch.parent_id = cat.id)
		  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.category_id = cat.id)
		ORDER BY cat.name
	`)
	if err != nil {
		log.Printf("catalog provision: list leaf categories: %v", err)
		return
	}
	defer rows.Close()

	var leaves []leafCategory
	for rows.Next() {
		var c leafCategory
		if rows.Scan(&c.ID, &c.Name, &c.Slug) == nil {
			leaves = append(leaves, c)
		}
	}
	if len(leaves) == 0 {
		return
	}

	provisioned := 0
	for _, leaf := range leaves {
		if err := provisionLeafProduct(ctx, pool, leaf); err != nil {
			log.Printf("catalog provision: %s (%s): %v", leaf.Name, leaf.Slug, err)
			continue
		}
		provisioned++
	}
	if provisioned > 0 {
		log.Printf("catalog provision: created products for %d leaf categories", provisioned)
	}
}

func provisionLeafProduct(ctx context.Context, pool *pgxpool.Pool, leaf leafCategory) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var productID uuid.UUID
	err = tx.QueryRow(ctx, `
		INSERT INTO products (category_id, name, brand, base_price, cost_price)
		VALUES ($1, $2, 'Prince Esquire', 0, 0)
		RETURNING id
	`, leaf.ID, leaf.Name).Scan(&productID)
	if err != nil {
		return err
	}

	colors := []string{"Default"}
	sizes := catalog.SizeProfile(leaf.Slug)
	if len(sizes) == 0 {
		sizes = []string{""}
	}

	for _, color := range colors {
		for _, size := range sizes {
			sku := leaf.Slug
			var sizePtr, colorPtr *string
			if size != "" {
				sku += "-" + size
				sizePtr = &size
			}
			if color != "" && color != "Default" {
				sku += "-" + slugToken(color)
				colorPtr = &color
			}
			if _, err := tx.Exec(ctx, `
				INSERT INTO product_variants (product_id, sku, size, color)
				VALUES ($1, $2, $3, $4)
				ON CONFLICT DO NOTHING
			`, productID, sku, sizePtr, colorPtr); err != nil {
				return err
			}
		}
	}

	if err := syncInventoryForProduct(ctx, tx, productID, 0); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func syncInventoryForProduct(ctx context.Context, tx pgx.Tx, productID uuid.UUID, qty int) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO inventory (product_variant_id, shop_id, quantity)
		SELECT pv.id, s.id, $1
		FROM product_variants pv
		CROSS JOIN shops s
		WHERE pv.product_id = $2 AND s.is_active = TRUE
		ON CONFLICT (product_variant_id, shop_id) DO NOTHING
	`, qty, productID)
	return err
}

func slugToken(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = strings.ReplaceAll(s, " ", "-")
	return s
}
