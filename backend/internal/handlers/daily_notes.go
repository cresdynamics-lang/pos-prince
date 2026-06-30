package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/cresdynamics-lang/pos-prince/backend/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type dailyNoteRecord struct {
	ID         string `json:"id"`
	ShopID     string `json:"shop_id"`
	ShopName   string `json:"shop_name"`
	NoteDate   string `json:"note_date"`
	Note       string `json:"note"`
	AuthorID   string `json:"author_id"`
	AuthorName string `json:"author_name"`
}

func (h *Handler) ListDailyNotes(c *gin.Context) {
	shopFilter := c.Query("shop_id")
	dateFilter := c.Query("date")

	query := `
		SELECT n.id::text, n.shop_id::text, s.name, n.note_date::text, n.note,
		       n.author_id::text, u.name
		FROM daily_shop_notes n
		JOIN shops s ON s.id = n.shop_id
		JOIN users u ON u.id = n.author_id
		WHERE 1=1
	`
	args := []interface{}{}
	n := 1
	if shopFilter != "" {
		query += ` AND n.shop_id = $` + strconv.Itoa(n)
		args = append(args, shopFilter)
		n++
	}
	if dateFilter != "" {
		query += ` AND n.note_date = $` + strconv.Itoa(n) + `::date`
		args = append(args, dateFilter)
		n++
	} else {
		query += ` AND n.note_date >= CURRENT_DATE - 7`
	}
	query += ` ORDER BY n.note_date DESC, n.updated_at DESC LIMIT 50`

	rows, err := h.DB.Query(c.Request.Context(), query, args...)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"notes": []dailyNoteRecord{}})
		return
	}
	defer rows.Close()

	out := []dailyNoteRecord{}
	for rows.Next() {
		var r dailyNoteRecord
		if rows.Scan(&r.ID, &r.ShopID, &r.ShopName, &r.NoteDate, &r.Note, &r.AuthorID, &r.AuthorName) == nil {
			out = append(out, r)
		}
	}
	c.JSON(http.StatusOK, gin.H{"notes": out})
}

type upsertDailyNoteRequest struct {
	ShopID   string `json:"shop_id" binding:"required"`
	Note     string `json:"note" binding:"required"`
	NoteDate string `json:"note_date"`
}

func (h *Handler) UpsertDailyNote(c *gin.Context) {
	var req upsertDailyNoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	note := strings.TrimSpace(req.Note)
	if note == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "note is required"})
		return
	}

	shopID, err := uuid.Parse(req.ShopID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid shop_id"})
		return
	}

	noteDate := time.Now().Format("2006-01-02")
	if req.NoteDate != "" {
		if _, err := time.Parse("2006-01-02", req.NoteDate); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid note_date"})
			return
		}
		noteDate = req.NoteDate
	}

	claims := middleware.GetClaims(c)
	var id string
	err = h.DB.QueryRow(c.Request.Context(), `
		INSERT INTO daily_shop_notes (shop_id, note_date, note, author_id)
		VALUES ($1, $2::date, $3, $4)
		ON CONFLICT (shop_id, note_date) DO UPDATE SET
			note = EXCLUDED.note,
			author_id = EXCLUDED.author_id,
			updated_at = NOW()
		RETURNING id::text
	`, shopID, noteDate, note, claims.UserID).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save note"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"id": id})
}
