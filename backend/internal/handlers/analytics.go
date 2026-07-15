package handlers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type analyticsSummary struct {
	SalesToday        int     `json:"sales_today"`
	RevenueToday      float64 `json:"revenue_today"`
	GrossRevenueToday float64 `json:"gross_revenue_today"`
	DiscountToday     float64 `json:"discount_today"`
	ProfitToday       float64 `json:"profit_today"`
	OrdersToday       int     `json:"orders_today"`
}

type todaySaleRow struct {
	ID              string    `json:"id"`
	Product         string    `json:"product"`
	VariantLabel    string    `json:"variant_label"`
	Quantity        int       `json:"quantity"`
	ListPrice       float64   `json:"list_price"`
	SalePrice       float64   `json:"sale_price"`
	DiscountAmount  float64   `json:"discount_amount"`
	Total           float64   `json:"total"`
	PaymentMethod   string    `json:"payment_method"`
	TransactionTime time.Time `json:"transaction_time"`
}

type storeTodayStats struct {
	StoreID       string  `json:"store_id"`
	StoreName     string  `json:"store_name"`
	SalesToday    int     `json:"sales_today"`
	RevenueToday  float64 `json:"revenue_today"`
	ProfitToday   float64 `json:"profit_today"`
	UnitsSold     int     `json:"units_sold"`
	ExpensesToday float64 `json:"expenses_today"`
	NetToday      float64 `json:"net_today"`
}

type storeRevenue struct {
	StoreID      string  `json:"store_id"`
	StoreName    string  `json:"store_name"`
	GrossRevenue float64 `json:"gross_revenue"`
	Discounts    float64 `json:"discounts"`
	NetRevenue   float64 `json:"net_revenue"`
	UnitsSold    int     `json:"units_sold"`
}

type chartPoint struct {
	Label string  `json:"label"`
	Value float64 `json:"value"`
}

func shopIDFromQuery(c *gin.Context) string {
	return c.Query("shop_id")
}

func (h *Handler) DashboardAnalytics(c *gin.Context) {
	sc := scopeFromRequest(c)
	summary, _ := h.queryTodaySummary(c.Request.Context(), sc)
	line, pie, movers := h.queryCharts(c.Request.Context(), sc)

	payload := gin.H{
		"summary":           summary,
		"revenue_trend":     line,
		"sales_by_category": pie,
		"top_products":      movers,
		"shop_id":           sc.ShopID,
		"personal_view":     !sc.Director,
	}

	if sc.Director {
		payload["by_store"] = h.queryStoreTodayStats(c.Request.Context())
	} else {
		summary.RevenueToday = 0
		summary.GrossRevenueToday = 0
		summary.DiscountToday = 0
		summary.ProfitToday = 0
		payload["summary"] = summary
		payload["revenue_trend"] = []chartPoint{}
		payload["today_sales"] = h.queryTodaySales(c.Request.Context(), sc)
	}

	c.JSON(http.StatusOK, payload)
}

func (h *Handler) queryTodaySummary(ctx context.Context, sc analyticsScope) (analyticsSummary, error) {
	var s analyticsSummary
	stClause, orderClause, args := txnFilters(sc, "st")
	bareClause, _, _ := txnFilters(sc, "")

	q := fmt.Sprintf(`
		SELECT
			COALESCE(SUM(st.quantity), 0)::int,
			COALESCE((
				SELECT SUM(net_total) FROM sales_orders
				WHERE transaction_time::date = CURRENT_DATE%s
			), 0) + COALESCE((
				SELECT SUM(sale_price * quantity) FROM sales_transactions
				WHERE order_id IS NULL AND transaction_time::date = CURRENT_DATE%s
			), 0),
			COALESCE(SUM(st.list_price * st.quantity), 0),
			COALESCE(SUM(st.discount_amount), 0) + COALESCE((
				SELECT SUM(overall_discount) FROM sales_orders
				WHERE transaction_time::date = CURRENT_DATE%s
			), 0),
			COALESCE(SUM((st.sale_price - p.cost_price) * st.quantity), 0),
			COALESCE((
				SELECT COUNT(*) FROM sales_orders
				WHERE transaction_time::date = CURRENT_DATE%s
			), 0)::int + COALESCE((
				SELECT COUNT(*) FROM sales_transactions
				WHERE order_id IS NULL AND transaction_time::date = CURRENT_DATE%s
			), 0)::int
		FROM sales_transactions st
		JOIN product_variants pv ON pv.id = st.product_variant_id
		JOIN products p ON p.id = pv.product_id
		WHERE st.transaction_time::date = CURRENT_DATE%s
	`, orderClause, bareClause, orderClause, orderClause, bareClause, stClause)

	err := h.DB.QueryRow(ctx, q, args...).Scan(
		&s.SalesToday, &s.RevenueToday, &s.GrossRevenueToday, &s.DiscountToday, &s.ProfitToday, &s.OrdersToday,
	)
	return s, err
}

func (h *Handler) queryTodaySales(ctx context.Context, sc analyticsScope) []todaySaleRow {
	out := []todaySaleRow{}
	stClause, _, args := txnFilters(sc, "st")
	rows, err := h.DB.Query(ctx, fmt.Sprintf(`
		SELECT st.id::text, p.name, pv.size, pv.color, pv.material,
		       st.quantity, st.list_price, st.sale_price, st.discount_amount,
		       st.sale_price * st.quantity, st.payment_method::text, st.transaction_time
		FROM sales_transactions st
		JOIN product_variants pv ON pv.id = st.product_variant_id
		JOIN products p ON p.id = pv.product_id
		WHERE st.transaction_time::date = CURRENT_DATE%s
		ORDER BY st.transaction_time DESC
		LIMIT 100
	`, stClause), args...)
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var r todaySaleRow
		var size, color, material *string
		if rows.Scan(
			&r.ID, &r.Product, &size, &color, &material,
			&r.Quantity, &r.ListPrice, &r.SalePrice, &r.DiscountAmount,
			&r.Total, &r.PaymentMethod, &r.TransactionTime,
		) == nil {
			r.VariantLabel = variantLabel(size, color, material)
			out = append(out, r)
		}
	}
	return out
}

func (h *Handler) queryCharts(ctx context.Context, sc analyticsScope) ([]chartPoint, []chartPoint, []chartPoint) {
	stClause, _, args := txnFilters(sc, "st")
	shopJoin := stClause

	line := []chartPoint{}
	rows, err := h.DB.Query(ctx, fmt.Sprintf(`
		SELECT to_char(d, 'Dy') AS label, COALESCE(SUM(st.sale_price * st.quantity), 0)
		FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, '1 day'::interval) d
		LEFT JOIN sales_transactions st ON st.transaction_time::date = d::date%s
		GROUP BY d ORDER BY d
	`, shopJoin), args...)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var p chartPoint
			if rows.Scan(&p.Label, &p.Value) == nil {
				line = append(line, p)
			}
		}
	}

	pie := []chartPoint{}
	rows2, err := h.DB.Query(ctx, fmt.Sprintf(`
		SELECT COALESCE(parent.name, cat.name), COALESCE(SUM(st.sale_price * st.quantity), 0)
		FROM sales_transactions st
		JOIN product_variants pv ON pv.id = st.product_variant_id
		JOIN products p ON p.id = pv.product_id
		JOIN categories cat ON cat.id = p.category_id
		LEFT JOIN categories parent ON parent.id = cat.parent_id
		WHERE st.transaction_time >= CURRENT_DATE - 30%s
		GROUP BY 1 ORDER BY 2 DESC LIMIT 8
	`, shopJoin), args...)
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var p chartPoint
			if rows2.Scan(&p.Label, &p.Value) == nil {
				pie = append(pie, p)
			}
		}
	}

	movers := []chartPoint{}
	rows3, err := h.DB.Query(ctx, fmt.Sprintf(`
		SELECT p.name, COALESCE(SUM(st.quantity), 0)::float
		FROM sales_transactions st
		JOIN product_variants pv ON pv.id = st.product_variant_id
		JOIN products p ON p.id = pv.product_id
		WHERE st.transaction_time >= CURRENT_DATE - 7%s
		GROUP BY p.name ORDER BY 2 DESC LIMIT 6
	`, shopJoin), args...)
	if err == nil {
		defer rows3.Close()
		for rows3.Next() {
			var p chartPoint
			if rows3.Scan(&p.Label, &p.Value) == nil {
				movers = append(movers, p)
			}
		}
	}

	return line, pie, movers
}

func (h *Handler) queryStoreTodayStats(ctx context.Context) []storeTodayStats {
	out := []storeTodayStats{}
	rows, err := h.DB.Query(ctx, `
		SELECT s.id::text, s.name,
			COALESCE(SUM(st.quantity), 0)::int,
			COALESCE(SUM(st.sale_price * st.quantity), 0),
			COALESCE(SUM((st.sale_price - p.cost_price) * st.quantity), 0),
			COALESCE(SUM(st.quantity), 0)::int,
			COALESCE((SELECT SUM(amount) FROM expenses e WHERE e.shop_id = s.id AND e.expense_date = CURRENT_DATE), 0)
		FROM shops s
		LEFT JOIN sales_transactions st ON st.shop_id = s.id AND st.transaction_time::date = CURRENT_DATE
		LEFT JOIN product_variants pv ON pv.id = st.product_variant_id
		LEFT JOIN products p ON p.id = pv.product_id
		WHERE s.is_active = TRUE
		GROUP BY s.id, s.name
		ORDER BY s.name
	`)
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var r storeTodayStats
		if rows.Scan(&r.StoreID, &r.StoreName, &r.UnitsSold, &r.RevenueToday, &r.ProfitToday, &r.SalesToday, &r.ExpensesToday) == nil {
			r.NetToday = r.RevenueToday - r.ExpensesToday
			out = append(out, r)
		}
	}
	return out
}

func (h *Handler) monthProfitQuery(shopID string) string {
	shopClause := ""
	if shopID != "" {
		shopClause = " AND st.shop_id = $1"
	}
	return fmt.Sprintf(`
		SELECT COALESCE(SUM((st.sale_price - COALESCE(p.cost_price, 0)) * st.quantity), 0)
		FROM sales_transactions st
		JOIN product_variants pv ON pv.id = st.product_variant_id
		JOIN products p ON p.id = pv.product_id
		WHERE st.transaction_time >= date_trunc('month', CURRENT_DATE)%s
	`, shopClause)
}

func (h *Handler) RevenueAnalytics(c *gin.Context) {
	sc := scopeFromRequest(c)
	if !sc.Director {
		c.JSON(http.StatusForbidden, gin.H{"error": "directors only"})
		return
	}
	shopID := sc.ShopID
	summary, _ := h.queryTodaySummary(c.Request.Context(), sc)
	line, _, _ := h.queryCharts(c.Request.Context(), sc)
	byStore := h.queryByStoreMonth(c.Request.Context(), shopID)
	monthlyNet, monthlyDiscount := h.queryMonthlyRevenue(c.Request.Context(), shopID)
	finance := h.queryFinanceSnapshot(c.Request.Context(), shopID)

	marginPct := 0.0
	if summary.GrossRevenueToday > 0 {
		marginPct = (summary.ProfitToday / summary.GrossRevenueToday) * 100
	} else if monthlyNet > 0 {
		var monthProfit float64
		q := h.monthProfitQuery(shopID)
		if shopID != "" {
			_ = h.DB.QueryRow(c.Request.Context(), q, shopID).Scan(&monthProfit)
		} else {
			_ = h.DB.QueryRow(c.Request.Context(), q).Scan(&monthProfit)
		}
		marginPct = (monthProfit / monthlyNet) * 100
	}

	c.JSON(http.StatusOK, gin.H{
		"summary":              summary,
		"revenue_trend":        line,
		"by_store":             byStore,
		"by_store_today":       h.queryStoreTodayStats(c.Request.Context()),
		"monthly_total":        monthlyNet,
		"monthly_discount":     monthlyDiscount,
		"margin_pct":           marginPct,
		"expenses_today":       finance.ExpensesToday,
		"expenses_month":       finance.ExpensesMonth,
		"net_today":            finance.NetToday,
		"net_month":            finance.NetMonth,
		"expenses_by_category": finance.ExpensesByCategory,
		"shop_id":              shopID,
	})
}

func (h *Handler) queryByStoreMonth(ctx context.Context, shopID string) []storeRevenue {
	out := []storeRevenue{}
	shopFilter := ""
	args := []interface{}{}
	if shopID != "" {
		shopFilter = " AND s.id = $1"
		args = append(args, shopID)
	}
	rows, err := h.DB.Query(ctx, fmt.Sprintf(`
		SELECT s.id::text, s.name,
			COALESCE(SUM(st.list_price * st.quantity), 0),
			COALESCE(SUM(st.discount_amount), 0) + COALESCE(od.overall_discount, 0),
			COALESCE(SUM(st.sale_price * st.quantity), 0) - COALESCE(od.overall_discount, 0),
			COALESCE(SUM(st.quantity), 0)::int
		FROM shops s
		LEFT JOIN sales_transactions st ON st.shop_id = s.id
			AND st.transaction_time >= date_trunc('month', CURRENT_DATE)
		LEFT JOIN (
			SELECT shop_id, SUM(overall_discount) AS overall_discount
			FROM sales_orders
			WHERE transaction_time >= date_trunc('month', CURRENT_DATE)
			GROUP BY shop_id
		) od ON od.shop_id = s.id
		WHERE s.is_active = TRUE%s
		GROUP BY s.id, s.name, od.overall_discount ORDER BY 5 DESC
	`, shopFilter), args...)
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var r storeRevenue
		if rows.Scan(&r.StoreID, &r.StoreName, &r.GrossRevenue, &r.Discounts, &r.NetRevenue, &r.UnitsSold) == nil {
			out = append(out, r)
		}
	}
	return out
}

func (h *Handler) queryMonthlyRevenue(ctx context.Context, shopID string) (float64, float64) {
	shopClause := ""
	args := []interface{}{}
	if shopID != "" {
		shopClause = " AND shop_id = $1"
		args = append(args, shopID)
	}
	var monthlyNet, monthlyDiscount float64
	monthArgs := []interface{}{}
	if shopID != "" {
		for i := 0; i < 4; i++ {
			monthArgs = append(monthArgs, shopID)
		}
	}
	_ = h.DB.QueryRow(ctx, fmt.Sprintf(`
		SELECT
			COALESCE((SELECT SUM(net_total) FROM sales_orders
				WHERE transaction_time >= date_trunc('month', CURRENT_DATE)%s), 0)
			+ COALESCE((SELECT SUM(sale_price * quantity) FROM sales_transactions
				WHERE order_id IS NULL AND transaction_time >= date_trunc('month', CURRENT_DATE)%s), 0),
			COALESCE((SELECT SUM(discount_amount) FROM sales_transactions
				WHERE transaction_time >= date_trunc('month', CURRENT_DATE)%s), 0)
			+ COALESCE((SELECT SUM(overall_discount) FROM sales_orders
				WHERE transaction_time >= date_trunc('month', CURRENT_DATE)%s), 0)
	`, shopClause, shopClause, shopClause, shopClause), monthArgs...).Scan(&monthlyNet, &monthlyDiscount)
	return monthlyNet, monthlyDiscount
}
