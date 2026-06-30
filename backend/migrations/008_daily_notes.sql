-- End-of-day notes from shop staff for directors
CREATE TABLE IF NOT EXISTS daily_shop_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    note_date DATE NOT NULL DEFAULT CURRENT_DATE,
    note TEXT NOT NULL,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (shop_id, note_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_shop_notes_date ON daily_shop_notes(note_date DESC);
