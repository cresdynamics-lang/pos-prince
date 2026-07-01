package handlers

import (
	"fmt"

	"github.com/cresdynamics-lang/pos-prince/backend/internal/audit"
	"github.com/cresdynamics-lang/pos-prince/backend/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func (h *Handler) logAction(c *gin.Context, shopID *uuid.UUID, action, entityType, entityID, summary string, metadata map[string]interface{}) {
	claims := middleware.GetClaims(c)
	var userID *uuid.UUID
	if claims != nil {
		userID = &claims.UserID
	}
	audit.Log(c.Request.Context(), h.DB, audit.Entry{
		ShopID:     shopID,
		UserID:     userID,
		Action:     action,
		EntityType: entityType,
		EntityID:   entityID,
		Summary:    summary,
		Metadata:   metadata,
	})
}

func kes(n float64) string {
	return fmt.Sprintf("KES %s", formatInt(int64(n)))
}

func formatInt(n int64) string {
	s := fmt.Sprintf("%d", n)
	if n < 1000 {
		return s
	}
	out := ""
	for i, c := range s {
		if i > 0 && (len(s)-i)%3 == 0 {
			out += ","
		}
		out += string(c)
	}
	return out
}
