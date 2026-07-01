package handlers

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/cresdynamics-lang/pos-prince/backend/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type expenseRecord struct {
	ID           string    `json:"id"`
	ShopID       *string   `json:"shop_id,omitempty"`
	ShopName     *string   `json:"shop_name,omitempty"`
	Category     string    `json:"category"`
	Amount       float64   `json:"amount"`
	Note         *string   `json:"note,omitempty"`
	RecordedBy   string    `json:"recorded_by"`
	RecordedName string    `json:"recorded_by_name"`
	ExpenseDate  string    `json:"expense_date"`
	CreatedAt    time.Time `json:"created_at"`
}

func (h *Handler) ListExpenses(c *gin.Context) {
	shopFilter := c.Query("shop_id")
	query := `
		SELECT e.id::text, e.shop_id::text, s.name, e.category::text, e.amount, e.note,
		       e.recorded_by::text, u.name, e.expense_date::text, e.created_at
		FROM expenses e
		LEFT JOIN shops s ON s.id = e.shop_id
		JOIN users u ON u.id = e.recorded_by
		WHERE 1=1
	`
	args := []interface{}{}
	if shopFilter != "" {
		query += ` AND e.shop_id = $1`
		args = append(args, shopFilter)
	}
	query += ` ORDER BY e.expense_date DESC, e.created_at DESC LIMIT 200`

	rows, err := h.DB.Query(c.Request.Context(), query, args...)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"expenses": []expenseRecord{}})
		return
	}
	defer rows.Close()

	out := []expenseRecord{}
	for rows.Next() {
		var e expenseRecord
		if rows.Scan(&e.ID, &e.ShopID, &e.ShopName, &e.Category, &e.Amount, &e.Note,
			&e.RecordedBy, &e.RecordedName, &e.ExpenseDate, &e.CreatedAt) == nil {
			out = append(out, e)
		}
	}
	c.JSON(http.StatusOK, gin.H{"expenses": out})
}

type createExpenseRequest struct {
	ShopID      *string `json:"shop_id"`
	Category    string  `json:"category" binding:"required"`
	Amount      float64 `json:"amount" binding:"required,gt=0"`
	Note        string  `json:"note"`
	ExpenseDate string  `json:"expense_date"`
}

func (h *Handler) CreateExpense(c *gin.Context) {
	var req createExpenseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cat := strings.ToLower(strings.TrimSpace(req.Category))
	switch cat {
	case "marketing", "rent", "transport", "other":
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "category must be marketing, rent, transport, or other"})
		return
	}

	note := strings.TrimSpace(req.Note)
	if cat == "other" && note == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "note is required when category is other"})
		return
	}

	expenseDate := time.Now().Format("2006-01-02")
	if req.ExpenseDate != "" {
		if _, err := time.Parse("2006-01-02", req.ExpenseDate); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid expense_date"})
			return
		}
		expenseDate = req.ExpenseDate
	}

	var shopID *uuid.UUID
	if req.ShopID != nil && *req.ShopID != "" {
		id, err := uuid.Parse(*req.ShopID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid shop_id"})
			return
		}
		shopID = &id
	}

	claims := middleware.GetClaims(c)
	if shopID == nil {
		var assigned *uuid.UUID
		_ = h.DB.QueryRow(c.Request.Context(), `SELECT shop_id FROM users WHERE id = $1`, claims.UserID).Scan(&assigned)
		if assigned != nil {
			shopID = assigned
		}
	}
	var id string
	err := h.DB.QueryRow(c.Request.Context(), `
		INSERT INTO expenses (shop_id, category, amount, note, recorded_by, expense_date)
		VALUES ($1, $2::expense_category, $3, NULLIF($4, ''), $5, $6::date)
		RETURNING id::text
	`, shopID, cat, req.Amount, note, claims.UserID, expenseDate).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not record expense"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"id": id})
	h.logAction(c, shopID, "expense.create", "expense", id,
		fmt.Sprintf("Expense %s: %s (%s)", cat, kes(req.Amount), expenseDate),
		map[string]interface{}{"category": cat, "amount": req.Amount})
}

func (h *Handler) DeleteExpense(c *gin.Context) {
	expenseID := c.Param("id")
	_, err := h.DB.Exec(c.Request.Context(), `DELETE FROM expenses WHERE id = $1`, expenseID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "delete failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": true})
}
