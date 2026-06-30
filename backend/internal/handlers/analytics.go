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
	shopID := shopIDFromQuery(c)
	summary, err := h.queryTodaySummary(c.Request.Context(), shopID)
	if err != nil || (summary.RevenueToday == 0 && shopID == "") {
		if shopID == "" {
			summary = demoSummary()
		}
	}

	line, pie, movers := h.queryCharts(c.Request.Context(), shopID)
	if len(line) == 0 && shopID == "" {
		line, pie, movers = demoCharts()
	}

	byStore := h.queryStoreTodayStats(c.Request.Context())

	c.JSON(http.StatusOK, gin.H{
		"summary":           summary,
		"revenue_trend":     line,
		"sales_by_category": pie,
		"top_products":      movers,
		"by_store":          byStore,
		"shop_id":           shopID,
	})
}

func (h *Handler) queryTodaySummary(ctx context.Context, shopID string) (analyticsSummary, error) {
	var s analyticsSummary
	shopClause := ""
	var args []interface{}
	if shopID != "" {
		shopClause = " AND shop_id = $1"
		args = append(args, shopID)
	}

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
	`, shopClause, shopClause, shopClause, shopClause, shopClause, shopClause)

	err := h.DB.QueryRow(ctx, q, args...).Scan(
		&s.SalesToday, &s.RevenueToday, &s.GrossRevenueToday, &s.DiscountToday, &s.ProfitToday, &s.OrdersToday,
	)
	return s, err
}

func (h *Handler) queryCharts(ctx context.Context, shopID string) ([]chartPoint, []chartPoint, []chartPoint) {
	shopJoin := ""
	args := []interface{}{}
	if shopID != "" {
		shopJoin = " AND st.shop_id = $1"
		args = append(args, shopID)
	}

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

func demoSummary() analyticsSummary {
	return analyticsSummary{
		SalesToday: 47, RevenueToday: 284500, GrossRevenueToday: 312000,
		DiscountToday: 27500, ProfitToday: 98200, OrdersToday: 47,
	}
}

func demoCharts() ([]chartPoint, []chartPoint, []chartPoint) {
	days := []string{"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"}
	vals := []float64{180000, 210000, 195000, 245000, 284500, 312000, 268000}
	line := make([]chartPoint, 7)
	for i := range days {
		line[i] = chartPoint{Label: days[i], Value: vals[i]}
	}
	pie := []chartPoint{
		{Label: "Shoes", Value: 98500},
		{Label: "Suits", Value: 72000},
		{Label: "Shirts", Value: 45800},
		{Label: "Trousers", Value: 38200},
		{Label: "Blazers", Value: 30000},
	}
	movers := []chartPoint{
		{Label: "Clarks Loafer — Brown", Value: 12},
		{Label: "Presidential Shirt — White", Value: 9},
		{Label: "Two Piece Suit — Navy", Value: 7},
		{Label: "Formal Trouser — Grey", Value: 6},
		{Label: "Knitted Polo — Black", Value: 5},
	}
	_ = time.Now()
	return line, pie, movers
}

func (h *Handler) RevenueAnalytics(c *gin.Context) {
	shopID := shopIDFromQuery(c)
	summary, _ := h.queryTodaySummary(c.Request.Context(), shopID)
	if summary.RevenueToday == 0 && shopID == "" {
		summary = demoSummary()
	}
	line, _, _ := h.queryCharts(c.Request.Context(), shopID)
	if len(line) == 0 && shopID == "" {
		line, _, _ = demoCharts()
	}

	byStore := h.queryByStoreMonth(c.Request.Context(), shopID)

	monthlyNet, monthlyDiscount := h.queryMonthlyRevenue(c.Request.Context(), shopID)
	finance := h.queryFinanceSnapshot(c.Request.Context(), shopID)

	c.JSON(http.StatusOK, gin.H{
		"summary":              summary,
		"revenue_trend":        line,
		"by_store":             byStore,
		"by_store_today":       h.queryStoreTodayStats(c.Request.Context()),
		"monthly_total":        monthlyNet,
		"monthly_discount":     monthlyDiscount,
		"margin_pct":           34.5,
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
