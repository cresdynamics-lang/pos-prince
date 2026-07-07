package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type activityRow struct {
	ID         string          `json:"id"`
	ShopID     *string         `json:"shop_id,omitempty"`
	ShopName   *string         `json:"shop_name,omitempty"`
	UserID     *string         `json:"user_id,omitempty"`
	UserName   *string         `json:"user_name,omitempty"`
	Action     string          `json:"action"`
	EntityType *string         `json:"entity_type,omitempty"`
	EntityID   *string         `json:"entity_id,omitempty"`
	Summary    string          `json:"summary"`
	Metadata   json.RawMessage `json:"metadata"`
	CreatedAt  string          `json:"created_at"`
}

func (h *Handler) ListActivity(c *gin.Context) {
	sc := scopeFromRequest(c)
	if !sc.Director {
		c.JSON(http.StatusForbidden, gin.H{"error": "directors only"})
		return
	}
	limit := 50
	if n, err := strconv.Atoi(c.DefaultQuery("limit", "50")); err == nil && n > 0 && n <= 200 {
		limit = n
	}
	shopFilter := c.Query("shop_id")
	actionFilter := c.Query("action")

	query := `
		SELECT a.id::text, a.shop_id::text, s.name, a.user_id::text, u.name,
		       a.action, a.entity_type, a.entity_id, a.summary, a.metadata, a.created_at::text
		FROM activity_log a
		LEFT JOIN shops s ON s.id = a.shop_id
		LEFT JOIN users u ON u.id = a.user_id
		WHERE 1=1
	`
	args := []interface{}{}
	n := 1
	if shopFilter != "" {
		query += ` AND a.shop_id = $` + strconv.Itoa(n)
		args = append(args, shopFilter)
		n++
	}
	if actionFilter != "" {
		query += ` AND a.action = $` + strconv.Itoa(n)
		args = append(args, actionFilter)
		n++
	}
	query += ` ORDER BY a.created_at DESC LIMIT $` + strconv.Itoa(n)
	args = append(args, limit)

	rows, err := h.DB.Query(c.Request.Context(), query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load activity"})
		return
	}
	defer rows.Close()

	out := []activityRow{}
	for rows.Next() {
		var r activityRow
		if rows.Scan(&r.ID, &r.ShopID, &r.ShopName, &r.UserID, &r.UserName,
			&r.Action, &r.EntityType, &r.EntityID, &r.Summary, &r.Metadata, &r.CreatedAt) == nil {
			out = append(out, r)
		}
	}
	c.JSON(http.StatusOK, gin.H{"activity": out})
}
