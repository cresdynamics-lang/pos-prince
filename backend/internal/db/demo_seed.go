package db

import (
	"context"
	"encoding/json"
	"log"

	"github.com/cresdynamics-lang/pos-prince/backend/internal/auth"
	"github.com/cresdynamics-lang/pos-prince/backend/internal/catalog"
	"github.com/cresdynamics-lang/pos-prince/backend/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type demoProduct struct {
	Name         string
	Slug         string
	CategorySlug string
	Brand        string
	Price        float64
	Cost         float64
	Colors       []string
	SizeProfile  string // apparel, shoe, cap, none
}

func EnsureDemoCatalog(ctx context.Context, pool *pgxpool.Pool) {
	var count int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM products`).Scan(&count); err != nil || count > 0 {
		return
	}

	ensureDemoStaff(ctx, pool)

	products := []demoProduct{
		{"Loafers", "loafers", "loafers", "Prince Esquire", 32500, 18000, []string{"Black", "Brown"}, "shoe"},
		{"Presidential", "presidential", "presidential", "Prince Esquire", 8500, 4200, []string{"White", "Blue"}, "apparel"},
		{"Sweaters", "sweaters", "sweaters", "Prince Esquire", 12000, 5500, []string{"Navy", "Grey"}, "apparel"},
		{"Knitted Polos", "knitted-polos", "knitted-polos", "Prince Esquire", 6500, 3200, []string{"Black", "White"}, "apparel"},
		{"Ties", "ties", "ties", "Prince Esquire", 3500, 1200, []string{"Burgundy", "Navy"}, "none"},
		{"Caps & Hats", "caps-hats", "caps-hats", "Prince Esquire", 2500, 900, []string{"Navy", "Black"}, "cap"},
	}

	shopIDs := map[string]uuid.UUID{}
	rows, _ := pool.Query(ctx, `SELECT id, name FROM shops`)
	for rows != nil && rows.Next() {
		var id uuid.UUID
		var name string
		if rows.Scan(&id, &name) == nil {
			if name == "Prince Esquire — Main" || name == "Prince Esquire — Westlands" {
				shopIDs["westlands"] = id
			}
			if name == "Prince Esquire — CBD" {
				shopIDs["cbd"] = id
			}
		}
	}
	if rows != nil {
		rows.Close()
	}
	if len(shopIDs) < 2 {
		log.Printf("demo catalog: need 2 shops")
		return
	}

	cashierIDs := map[string]uuid.UUID{}
	urows, _ := pool.Query(ctx, `SELECT id, email FROM users WHERE email LIKE '%@prince-esquire.co.ke'`)
	for urows != nil && urows.Next() {
		var id uuid.UUID
		var email string
		if urows.Scan(&id, &email) == nil {
			cashierIDs[email] = id
		}
	}
	if urows != nil {
		urows.Close()
	}

	for _, dp := range products {
		var catID uuid.UUID
		if err := pool.QueryRow(ctx, `SELECT id FROM categories WHERE slug = $1`, dp.CategorySlug).Scan(&catID); err != nil {
			log.Printf("demo catalog: category %s: %v", dp.CategorySlug, err)
			continue
		}

		var productID uuid.UUID
		err := pool.QueryRow(ctx, `
			INSERT INTO products (category_id, name, brand, base_price, cost_price)
			VALUES ($1, $2, $3, $4, $5) RETURNING id
		`, catID, dp.Name, dp.Brand, dp.Price, dp.Cost).Scan(&productID)
		if err != nil {
			log.Printf("demo catalog product %s: %v", dp.Name, err)
			continue
		}

		sizes := sizesFor(dp.SizeProfile)
		if len(sizes) == 0 {
			sizes = []string{""}
		}

		for _, color := range dp.Colors {
			for _, size := range sizes {
				sku := dp.Slug
				var sizePtr, colorPtr *string
				if size != "" {
					sku += "-" + size
					sizePtr = &size
				}
				if color != "" {
					sku += "-" + color
					colorPtr = &color
				}

				var variantID uuid.UUID
				err := pool.QueryRow(ctx, `
					INSERT INTO product_variants (product_id, sku, size, color)
					VALUES ($1, $2, $3, $4) RETURNING id
				`, productID, sku, sizePtr, colorPtr).Scan(&variantID)
				if err != nil {
					continue
				}

				for shopKey, shopID := range shopIDs {
					qty := 8
					if shopKey == "cbd" {
						qty = 5
					}
					if size == "42" || size == "L" {
						qty = 3
					}
					pool.Exec(ctx, `
						INSERT INTO inventory (product_variant_id, shop_id, quantity)
						VALUES ($1, $2, $3)
						ON CONFLICT DO NOTHING
					`, variantID, shopID, qty)

					pool.Exec(ctx, `
						INSERT INTO daily_stock_snapshots
							(shop_id, product_variant_id, opening_stock, closing_stock, snapshot_date)
						VALUES ($1, $2, $3, $3, CURRENT_DATE)
						ON CONFLICT DO NOTHING
					`, shopID, variantID, qty)
				}
			}
		}
	}

	// Sample sales across shops and cashiers
	recordDemoSale(ctx, pool, shopIDs["westlands"], cashierIDs["james@prince-esquire.co.ke"], "loafers-42-Black", 1, 32500, "mpesa")
	recordDemoSale(ctx, pool, shopIDs["cbd"], cashierIDs["mary@prince-esquire.co.ke"], "presidential-L-White", 2, 7500, "cash")
	recordDemoSale(ctx, pool, shopIDs["westlands"], cashierIDs["charles@prince-esquire.co.ke"], "sweaters-L-Navy", 1, 12000, "mpesa")
	recordDemoSale(ctx, pool, shopIDs["cbd"], cashierIDs["mary@prince-esquire.co.ke"], "ties-Burgundy", 1, 3500, "cash")

	pool.Exec(ctx, `
		INSERT INTO inventory (product_variant_id, shop_id, quantity)
		SELECT pv.id, s.id, 0 FROM product_variants pv CROSS JOIN shops s WHERE s.is_active = TRUE
		ON CONFLICT DO NOTHING
	`)

	log.Printf("demo catalog seeded")
}

func sizesFor(profile string) []string {
	switch profile {
	case "shoe":
		return catalog.ShoeSizes
	case "cap":
		return catalog.CapSizes
	case "none":
		return []string{""}
	default:
		return catalog.ApparelSizes
	}
}

func ensureDemoStaff(ctx context.Context, pool *pgxpool.Pool) {
	type staff struct {
		name, email, role string
		shopName          string
	}
	staffList := []staff{
		{"James Kariuki", "james@prince-esquire.co.ke", "cashier", "Prince Esquire — Westlands"},
		{"Mary Wanjiku", "mary@prince-esquire.co.ke", "cashier", "Prince Esquire — CBD"},
	}
	pass, _ := auth.HashPassword("Cashier123")

	for _, s := range staffList {
		var exists bool
		pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)`, s.email).Scan(&exists)
		if exists {
			continue
		}
		var shopID *uuid.UUID
		var id uuid.UUID
		if err := pool.QueryRow(ctx, `SELECT id FROM shops WHERE name = $1`, s.shopName).Scan(&id); err == nil {
			shopID = &id
		}
		perms, _ := json.Marshal(auth.DefaultPermissions(models.RoleCashier))
		pool.Exec(ctx, `
			INSERT INTO users (name, email, password_hash, role, shop_id, permissions)
			VALUES ($1, $2, $3, 'cashier', $4, $5)
		`, s.name, s.email, pass, shopID, perms)
	}
}

func recordDemoSale(ctx context.Context, pool *pgxpool.Pool, shopID, cashierID uuid.UUID, sku string, qty int, price float64, payment string) {
	if shopID == uuid.Nil || cashierID == uuid.Nil {
		return
	}
	var variantID uuid.UUID
	if err := pool.QueryRow(ctx, `SELECT id FROM product_variants WHERE sku = $1`, sku).Scan(&variantID); err != nil {
		return
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return
	}
	defer tx.Rollback(ctx)

	var stock int
	if err := tx.QueryRow(ctx, `
		SELECT quantity FROM inventory WHERE shop_id = $1 AND product_variant_id = $2 FOR UPDATE
	`, shopID, variantID).Scan(&stock); err != nil || stock < qty {
		return
	}

	var listPrice float64
	_ = tx.QueryRow(ctx, `SELECT p.base_price FROM products p JOIN product_variants pv ON pv.product_id = p.id WHERE pv.id = $1`, variantID).Scan(&listPrice)
	discount := 0.0
	if listPrice > price {
		discount = (listPrice - price) * float64(qty)
	}

	newQty := stock - qty
	tx.Exec(ctx, `
		INSERT INTO sales_transactions (shop_id, cashier_id, product_variant_id, quantity, list_price, sale_price, discount_amount, payment_method, transaction_time)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8::payment_method, NOW() - INTERVAL '2 hours')
	`, shopID, cashierID, variantID, qty, listPrice, price, discount, payment)

	tx.Exec(ctx, `UPDATE inventory SET quantity = $1, updated_at = NOW() WHERE shop_id = $2 AND product_variant_id = $3`, newQty, shopID, variantID)
	tx.Exec(ctx, `
		INSERT INTO daily_stock_snapshots (shop_id, product_variant_id, opening_stock, units_sold, closing_stock, snapshot_date)
		VALUES ($1, $2, $3, $4, $5, CURRENT_DATE)
		ON CONFLICT (shop_id, product_variant_id, snapshot_date) DO UPDATE SET
			units_sold = daily_stock_snapshots.units_sold + EXCLUDED.units_sold,
			closing_stock = EXCLUDED.closing_stock
	`, shopID, variantID, stock, qty, newQty)

	tx.Commit(ctx)
}
