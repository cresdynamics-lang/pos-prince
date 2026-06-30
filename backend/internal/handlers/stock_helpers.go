package handlers

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// rolloverDailySnapshots sets today's opening stock from yesterday's closing stock.
func rolloverDailySnapshots(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, `
		INSERT INTO daily_stock_snapshots
			(shop_id, product_variant_id, opening_stock, closing_stock, snapshot_date)
		SELECT i.shop_id, i.product_variant_id,
			COALESCE(yd.closing_stock, i.quantity),
			i.quantity,
			CURRENT_DATE
		FROM inventory i
		LEFT JOIN daily_stock_snapshots yd
			ON yd.shop_id = i.shop_id
			AND yd.product_variant_id = i.product_variant_id
			AND yd.snapshot_date = CURRENT_DATE - 1
		LEFT JOIN daily_stock_snapshots td
			ON td.shop_id = i.shop_id
			AND td.product_variant_id = i.product_variant_id
			AND td.snapshot_date = CURRENT_DATE
		WHERE td.id IS NULL
		ON CONFLICT (shop_id, product_variant_id, snapshot_date) DO NOTHING
	`)
	return err
}

func ensureDailySnapshot(ctx context.Context, tx pgx.Tx, shopID, variantID uuid.UUID, qty int) error {
	today := time.Now().Format("2006-01-02")
	var opening int
	err := tx.QueryRow(ctx, `
		SELECT COALESCE((
			SELECT closing_stock FROM daily_stock_snapshots
			WHERE shop_id = $1 AND product_variant_id = $2 AND snapshot_date = CURRENT_DATE - 1
		), $3)
	`, shopID, variantID, qty).Scan(&opening)
	if err != nil {
		opening = qty
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO daily_stock_snapshots
			(shop_id, product_variant_id, opening_stock, closing_stock, snapshot_date)
		VALUES ($1, $2, $3, $4, $5::date)
		ON CONFLICT (shop_id, product_variant_id, snapshot_date) DO NOTHING
	`, shopID, variantID, opening, qty, today)
	return err
}

func refreshClosingStock(ctx context.Context, tx pgx.Tx, shopID, variantID uuid.UUID, qty int) error {
	today := time.Now().Format("2006-01-02")
	_, err := tx.Exec(ctx, `
		UPDATE daily_stock_snapshots
		SET closing_stock = $1
		WHERE shop_id = $2 AND product_variant_id = $3 AND snapshot_date = $4::date
	`, qty, shopID, variantID, today)
	return err
}

func bumpSnapshotSold(ctx context.Context, tx pgx.Tx, shopID, variantID uuid.UUID, sold int, closing int) error {
	today := time.Now().Format("2006-01-02")
	_, err := tx.Exec(ctx, `
		INSERT INTO daily_stock_snapshots
			(shop_id, product_variant_id, opening_stock, units_sold, closing_stock, snapshot_date)
		VALUES ($1, $2, $3, $4, $5, $6::date)
		ON CONFLICT (shop_id, product_variant_id, snapshot_date) DO UPDATE SET
			units_sold = daily_stock_snapshots.units_sold + EXCLUDED.units_sold,
			closing_stock = EXCLUDED.closing_stock
	`, shopID, variantID, closing+sold, sold, closing, today)
	return err
}

func lockInventory(ctx context.Context, tx pgx.Tx, shopID, variantID uuid.UUID) (int, error) {
	var qty int
	err := tx.QueryRow(ctx, `
		SELECT quantity FROM inventory
		WHERE shop_id = $1 AND product_variant_id = $2
		FOR UPDATE
	`, shopID, variantID).Scan(&qty)
	return qty, err
}

func skuFor(productSlug, size, color string) string {
	s := productSlug
	if size != "" {
		s += "-" + size
	}
	if color != "" {
		s += "-" + color
	}
	return s
}

func variantLabel(size, color, material *string) string {
	parts := []string{}
	if color != nil && *color != "" {
		parts = append(parts, *color)
	}
	if size != nil && *size != "" {
		parts = append(parts, "Size "+*size)
	}
	if material != nil && *material != "" {
		parts = append(parts, *material)
	}
	if len(parts) == 0 {
		return "Standard"
	}
	out := parts[0]
	for i := 1; i < len(parts); i++ {
		out += " · " + parts[i]
	}
	return out
}

// unused but kept for future product creation API
func _fmtPrice(p float64) string { return fmt.Sprintf("%.2f", p) }
