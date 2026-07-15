package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type reportSaleRow struct {
	ID              string    `json:"id"`
	Product         string    `json:"product"`
	VariantLabel    string    `json:"variant_label"`
	ShopName        string    `json:"shop_name"`
	Cashier         string    `json:"cashier"`
	Quantity        int       `json:"quantity"`
	ListPrice       float64   `json:"list_price"`
	SalePrice       float64   `json:"sale_price"`
	DiscountAmount  float64   `json:"discount_amount"`
	Total           float64   `json:"total"`
	PaymentMethod   string    `json:"payment_method"`
	TransactionTime time.Time `json:"transaction_time"`
}

type reportStockRow struct {
	ProductVariantID    string `json:"product_variant_id"`
	Product             string `json:"product"`
	VariantLabel        string `json:"variant_label"`
	ShopID              string `json:"shop_id"`
	ShopName            string `json:"shop_name"`
	SKU                 string `json:"sku"`
	OpeningStock        int    `json:"opening_stock"`
	UnitsSold           int    `json:"units_sold"`
	UnitsTransferredIn  int    `json:"units_transferred_in"`
	UnitsTransferredOut int    `json:"units_transferred_out"`
	ClosingStock        int    `json:"closing_stock"`
	LiveQuantity        *int   `json:"live_quantity,omitempty"`
}

type reportSummary struct {
	Orders        int     `json:"orders"`
	UnitsSold     int     `json:"units_sold"`
	GrossRevenue  float64 `json:"gross_revenue"`
	DiscountTotal float64 `json:"discount_total"`
	NetRevenue    float64 `json:"net_revenue"`
	OpeningUnits  int     `json:"opening_units"`
	ClosingUnits  int     `json:"closing_units"`
	LiveOnHand    *int    `json:"live_on_hand,omitempty"`
	ProductsMoved int     `json:"products_moved"`
}

// DayReport — director daily sales + stock movement (opening → sold → closing).
func (h *Handler) DayReport(c *gin.Context) {
	sc := scopeFromRequest(c)
	if !sc.Director {
		c.JSON(http.StatusForbidden, gin.H{"error": "directors only"})
		return
	}

	_ = rolloverDailySnapshots(c.Request.Context(), h.DB)

	dateStr := c.Query("date")
	today := time.Now().Format("2006-01-02")
	if dateStr == "" {
		dateStr = today
	}
	day, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "date must be YYYY-MM-DD"})
		return
	}
	dateStr = day.Format("2006-01-02")
	isToday := dateStr == today

	shopClause := ""
	salesArgs := []interface{}{dateStr}
	if sc.ShopID != "" {
		shopClause = " AND st.shop_id = $2"
		salesArgs = append(salesArgs, sc.ShopID)
	}

	sales := []reportSaleRow{}
	rows, err := h.DB.Query(c.Request.Context(), fmt.Sprintf(`
		SELECT st.id::text, p.name, pv.size, pv.color, pv.material,
		       s.name, COALESCE(u.name, u.email),
		       st.quantity, st.list_price, st.sale_price, st.discount_amount,
		       st.sale_price * st.quantity, st.payment_method::text, st.transaction_time
		FROM sales_transactions st
		JOIN product_variants pv ON pv.id = st.product_variant_id
		JOIN products p ON p.id = pv.product_id
		JOIN shops s ON s.id = st.shop_id
		JOIN users u ON u.id = st.cashier_id
		WHERE st.transaction_time::date = $1::date%s
		ORDER BY st.transaction_time DESC
		LIMIT 500
	`, shopClause), salesArgs...)
	if err != nil {
		// keep sales empty but still return summary/stock
		_ = err
	} else {
		defer rows.Close()
		for rows.Next() {
			var r reportSaleRow
			var size, color, material *string
			if rows.Scan(
				&r.ID, &r.Product, &size, &color, &material,
				&r.ShopName, &r.Cashier,
				&r.Quantity, &r.ListPrice, &r.SalePrice, &r.DiscountAmount,
				&r.Total, &r.PaymentMethod, &r.TransactionTime,
			) == nil {
				r.VariantLabel = variantLabel(size, color, material)
				sales = append(sales, r)
			}
		}
	}

	var summary reportSummary
	sumArgs := []interface{}{dateStr}
	orderShop := ""
	bareShop := ""
	if sc.ShopID != "" {
		orderShop = " AND shop_id = $2"
		bareShop = " AND shop_id = $2"
		sumArgs = append(sumArgs, sc.ShopID)
	}
	_ = h.DB.QueryRow(c.Request.Context(), fmt.Sprintf(`
		SELECT
			COALESCE((
				SELECT COUNT(*) FROM sales_orders
				WHERE transaction_time::date = $1::date%s
			), 0)::int + COALESCE((
				SELECT COUNT(*) FROM sales_transactions
				WHERE order_id IS NULL AND transaction_time::date = $1::date%s
			), 0)::int,
			COALESCE((
				SELECT SUM(quantity) FROM sales_transactions
				WHERE transaction_time::date = $1::date%s
			), 0)::int,
			COALESCE((
				SELECT SUM(list_price * quantity) FROM sales_transactions
				WHERE transaction_time::date = $1::date%s
			), 0),
			COALESCE((
				SELECT SUM(discount_amount) FROM sales_transactions
				WHERE transaction_time::date = $1::date%s
			), 0) + COALESCE((
				SELECT SUM(overall_discount) FROM sales_orders
				WHERE transaction_time::date = $1::date%s
			), 0),
			COALESCE((
				SELECT SUM(net_total) FROM sales_orders
				WHERE transaction_time::date = $1::date%s
			), 0) + COALESCE((
				SELECT SUM(sale_price * quantity) FROM sales_transactions
				WHERE order_id IS NULL AND transaction_time::date = $1::date%s
			), 0)
	`, orderShop, bareShop, bareShop, bareShop, bareShop, orderShop, orderShop, bareShop), sumArgs...).Scan(
		&summary.Orders, &summary.UnitsSold, &summary.GrossRevenue, &summary.DiscountTotal, &summary.NetRevenue,
	)

	stockShop := ""
	stockArgs := []interface{}{dateStr}
	if sc.ShopID != "" {
		stockShop = " AND ds.shop_id = $2"
		stockArgs = append(stockArgs, sc.ShopID)
	}

	stock := []reportStockRow{}
	openingTot, closingTot, liveTot, moved := 0, 0, 0, 0

	if isToday {
		srows, qerr := h.DB.Query(c.Request.Context(), `
			SELECT pv.id::text, p.name, pv.size, pv.color, pv.material,
			       s.id::text, s.name, pv.sku,
			       ds.opening_stock, ds.units_sold, ds.units_transferred_in, ds.units_transferred_out,
			       ds.closing_stock, COALESCE(i.quantity, ds.closing_stock)
			FROM daily_stock_snapshots ds
			JOIN product_variants pv ON pv.id = ds.product_variant_id
			JOIN products p ON p.id = pv.product_id
			JOIN shops s ON s.id = ds.shop_id
			LEFT JOIN inventory i ON i.product_variant_id = ds.product_variant_id AND i.shop_id = ds.shop_id
			WHERE ds.snapshot_date = $1::date`+stockShop+`
			ORDER BY s.name, p.name, pv.size NULLS LAST
			LIMIT 1000`, stockArgs...)
		if qerr == nil {
			defer srows.Close()
			for srows.Next() {
				var r reportStockRow
				var size, color, material *string
				var live int
				if srows.Scan(
					&r.ProductVariantID, &r.Product, &size, &color, &material,
					&r.ShopID, &r.ShopName, &r.SKU,
					&r.OpeningStock, &r.UnitsSold, &r.UnitsTransferredIn, &r.UnitsTransferredOut,
					&r.ClosingStock, &live,
				) == nil {
					r.VariantLabel = variantLabel(size, color, material)
					r.LiveQuantity = &live
					stock = append(stock, r)
					openingTot += r.OpeningStock
					closingTot += r.ClosingStock
					liveTot += live
					if r.UnitsSold > 0 || r.OpeningStock != r.ClosingStock {
						moved++
					}
				}
			}
			summary.LiveOnHand = &liveTot
		}
	} else {
		srows, qerr := h.DB.Query(c.Request.Context(), `
			SELECT pv.id::text, p.name, pv.size, pv.color, pv.material,
			       s.id::text, s.name, pv.sku,
			       ds.opening_stock, ds.units_sold, ds.units_transferred_in, ds.units_transferred_out,
			       ds.closing_stock
			FROM daily_stock_snapshots ds
			JOIN product_variants pv ON pv.id = ds.product_variant_id
			JOIN products p ON p.id = pv.product_id
			JOIN shops s ON s.id = ds.shop_id
			WHERE ds.snapshot_date = $1::date`+stockShop+`
			  AND (ds.units_sold > 0 OR ds.units_transferred_in > 0 OR ds.units_transferred_out > 0
			       OR ds.opening_stock <> ds.closing_stock)
			ORDER BY s.name, p.name, pv.size NULLS LAST
			LIMIT 1000`, stockArgs...)
		if qerr == nil {
			defer srows.Close()
			for srows.Next() {
				var r reportStockRow
				var size, color, material *string
				if srows.Scan(
					&r.ProductVariantID, &r.Product, &size, &color, &material,
					&r.ShopID, &r.ShopName, &r.SKU,
					&r.OpeningStock, &r.UnitsSold, &r.UnitsTransferredIn, &r.UnitsTransferredOut,
					&r.ClosingStock,
				) == nil {
					r.VariantLabel = variantLabel(size, color, material)
					stock = append(stock, r)
					openingTot += r.OpeningStock
					closingTot += r.ClosingStock
					if r.UnitsSold > 0 || r.OpeningStock != r.ClosingStock {
						moved++
					}
				}
			}
		}
	}
	summary.OpeningUnits = openingTot
	summary.ClosingUnits = closingTot
	summary.ProductsMoved = moved

	histArgs := []interface{}{}
	snapHist := ""
	saleHist := ""
	if sc.ShopID != "" {
		snapHist = " WHERE shop_id = $1"
		saleHist = " WHERE shop_id = $1"
		histArgs = append(histArgs, sc.ShopID)
	}
	history := []string{}
	hrows, err := h.DB.Query(c.Request.Context(), `
		SELECT to_char(d, 'YYYY-MM-DD') FROM (
			SELECT DISTINCT snapshot_date AS d FROM daily_stock_snapshots`+snapHist+`
			UNION
			SELECT DISTINCT transaction_time::date AS d FROM sales_transactions`+saleHist+`
		) x
		ORDER BY d DESC
		LIMIT 60
	`, histArgs...)
	if err == nil {
		defer hrows.Close()
		for hrows.Next() {
			var d string
			if hrows.Scan(&d) == nil {
				history = append(history, d)
			}
		}
	}
	if len(history) == 0 {
		history = []string{today}
	}

	c.JSON(http.StatusOK, gin.H{
		"date":          dateStr,
		"is_today":      isToday,
		"summary":       summary,
		"sales":         sales,
		"stock":         stock,
		"history_dates": history,
		"shop_id":       sc.ShopID,
	})
}
