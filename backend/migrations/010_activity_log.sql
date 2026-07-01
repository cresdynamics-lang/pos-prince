CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(64) NOT NULL,
    entity_type VARCHAR(32),
    entity_id VARCHAR(64),
    summary TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS activity_log_created_at_idx ON activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_shop_id_idx ON activity_log (shop_id);
CREATE INDEX IF NOT EXISTS activity_log_action_idx ON activity_log (action);
