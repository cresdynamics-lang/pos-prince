-- Permissions + cost tracking for profit analytics
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '[]';

ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0;

-- Demo shops (if not already present)
INSERT INTO shops (name, location, phone)
SELECT 'Prince Esquire — Westlands', 'Westlands, Nairobi', '0724-494089'
WHERE NOT EXISTS (SELECT 1 FROM shops WHERE name = 'Prince Esquire — Westlands');

INSERT INTO shops (name, location, phone)
SELECT 'Prince Esquire — CBD', 'Nairobi CBD', '0724-494089'
WHERE NOT EXISTS (SELECT 1 FROM shops WHERE name = 'Prince Esquire — CBD');
