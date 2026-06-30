package handlers

import (
	"context"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

type paymentTotal struct {
	Method string  `json:"method"`
	Label  string  `json:"label"`
	Amount float64 `json:"amount"`
}

type categoryTotal struct {
	Category string  `json:"category"`
	Amount   float64 `json:"amount"`
}

type financeSnapshot struct {
	RevenueToday         float64         `json:"revenue_today"`
	RevenueMonth         float64         `json:"revenue_month"`
	ExpensesToday        float64         `json:"expenses_today"`
	ExpensesMonth        float64         `json:"expenses_month"`
	NetToday             float64         `json:"net_today"`
	NetMonth             float64         `json:"net_month"`
	ExpensesByCategory   []categoryTotal `json:"expenses_by_category"`
}

func (h *Handler) queryFinanceSnapshot(ctx context.Context, shopID string) financeSnapshot {
	var snap financeSnapshot
	shopClause := ""
	expShopClause := ""
	args := []interface{}{}
	if shopID != "" {
		shopClause = " AND shop_id = $1"
		expShopClause = " AND (shop_id = $1 OR shop_id IS NULL)"
		args = append(args, shopID)
	}

	q := fmt.Sprintf(`
		SELECT
			COALESCE((SELECT SUM(net_total) FROM sales_orders
				WHERE transaction_time::date = CURRENT_DATE%s), 0)
			+ COALESCE((SELECT SUM(sale_price * quantity) FROM sales_transactions
				WHERE order_id IS NULL AND transaction_time::date = CURRENT_DATE%s), 0),
			COALESCE((SELECT SUM(net_total) FROM sales_orders
				WHERE transaction_time >= date_trunc('month', CURRENT_DATE)%s), 0)
			+ COALESCE((SELECT SUM(sale_price * quantity) FROM sales_transactions
				WHERE order_id IS NULL AND transaction_time >= date_trunc('month', CURRENT_DATE)%s), 0),
			COALESCE((SELECT SUM(amount) FROM expenses
				WHERE expense_date = CURRENT_DATE%s), 0),
			COALESCE((SELECT SUM(amount) FROM expenses
				WHERE expense_date >= date_trunc('month', CURRENT_DATE)::date%s), 0)
	`, shopClause, shopClause, shopClause, shopClause, expShopClause, expShopClause)

	allArgs := []interface{}{}
	if shopID != "" {
		allArgs = append(allArgs, shopID, shopID, shopID, shopID, shopID, shopID)
	}
	_ = h.DB.QueryRow(ctx, q, allArgs...).Scan(
		&snap.RevenueToday, &snap.RevenueMonth, &snap.ExpensesToday, &snap.ExpensesMonth,
	)

	snap.NetToday = snap.RevenueToday - snap.ExpensesToday
	snap.NetMonth = snap.RevenueMonth - snap.ExpensesMonth

	expArgs := []interface{}{}
	expFilter := ""
	if shopID != "" {
		expFilter = " AND (shop_id = $1 OR shop_id IS NULL)"
		expArgs = append(expArgs, shopID)
	}
	rows, err := h.DB.Query(ctx, fmt.Sprintf(`
		SELECT category::text, COALESCE(SUM(amount), 0)
		FROM expenses
		WHERE expense_date >= date_trunc('month', CURRENT_DATE)::date%s
		GROUP BY category ORDER BY 2 DESC
	`, expFilter), expArgs...)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var c categoryTotal
			if rows.Scan(&c.Category, &c.Amount) == nil {
				snap.ExpensesByCategory = append(snap.ExpensesByCategory, c)
			}
		}
	}
	if snap.ExpensesByCategory == nil {
		snap.ExpensesByCategory = []categoryTotal{}
	}
	return snap
}

func (h *Handler) FinanceOverview(c *gin.Context) {
	ctx := c.Request.Context()
	shopID := c.Query("shop_id")
	snap := h.queryFinanceSnapshot(ctx, shopID)

	shopPayment := ""
	payArgs := []interface{}{}
	if shopID != "" {
		shopPayment = " AND shop_id = $1"
		payArgs = append(payArgs, shopID)
	}
	byPaymentToday := h.queryPaymentTotals(ctx, "transaction_time::date = CURRENT_DATE"+shopPayment, payArgs)
	byPaymentMonth := h.queryPaymentTotals(ctx, "transaction_time >= date_trunc('month', CURRENT_DATE)"+shopPayment, payArgs)

	byStore := h.queryStoreTodayStats(ctx)

	c.JSON(http.StatusOK, gin.H{
		"revenue_today":        snap.RevenueToday,
		"revenue_month":        snap.RevenueMonth,
		"expenses_today":       snap.ExpensesToday,
		"expenses_month":       snap.ExpensesMonth,
		"net_today":            snap.NetToday,
		"net_month":            snap.NetMonth,
		"by_payment_today":     byPaymentToday,
		"by_payment_month":     byPaymentMonth,
		"expenses_by_category": snap.ExpensesByCategory,
		"by_store_today":       byStore,
		"shop_id":              shopID,
	})
}

func (h *Handler) queryPaymentTotals(ctx context.Context, timeFilter string, extraArgs []interface{}) []paymentTotal {
	labels := map[string]string{
		"cash":          "Cash",
		"mpesa":         "M-Pesa",
		"card":          "Card",
		"bank_transfer": "Bank transfer",
	}
	totals := map[string]float64{}

	rows, err := h.DB.Query(ctx, `
		SELECT payment_method::text, COALESCE(SUM(net_total), 0)
		FROM sales_orders
		WHERE `+timeFilter+`
		GROUP BY payment_method
	`, extraArgs...)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var method string
			var amount float64
			if rows.Scan(&method, &amount) == nil {
				totals[method] += amount
			}
		}
	}

	rows2, err := h.DB.Query(ctx, `
		SELECT payment_method::text, COALESCE(SUM(sale_price * quantity), 0)
		FROM sales_transactions
		WHERE order_id IS NULL AND `+timeFilter+`
		GROUP BY payment_method
	`, extraArgs...)
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var method string
			var amount float64
			if rows2.Scan(&method, &amount) == nil {
				totals[method] += amount
			}
		}
	}

	order := []string{"cash", "mpesa", "card", "bank_transfer"}
	out := []paymentTotal{}
	for _, m := range order {
		if totals[m] > 0 {
			out = append(out, paymentTotal{
				Method: m,
				Label:  labels[m],
				Amount: totals[m],
			})
		}
	}
	for m, amt := range totals {
		found := false
		for _, o := range order {
			if o == m {
				found = true
				break
			}
		}
		if !found && amt > 0 {
			out = append(out, paymentTotal{Method: m, Label: m, Amount: amt})
		}
	}
	return out
}
