package audit

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Entry struct {
	ShopID     *uuid.UUID
	UserID     *uuid.UUID
	Action     string
	EntityType string
	EntityID   string
	Summary    string
	Metadata   map[string]interface{}
}

func Log(ctx context.Context, pool *pgxpool.Pool, e Entry) {
	if e.Action == "" || e.Summary == "" {
		return
	}
	meta := e.Metadata
	if meta == nil {
		meta = map[string]interface{}{}
	}
	b, _ := json.Marshal(meta)
	_, _ = pool.Exec(ctx, `
		INSERT INTO activity_log (shop_id, user_id, action, entity_type, entity_id, summary, metadata)
		VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''), $6, $7::jsonb)
	`, e.ShopID, e.UserID, e.Action, e.EntityType, e.EntityID, e.Summary, string(b))
}
