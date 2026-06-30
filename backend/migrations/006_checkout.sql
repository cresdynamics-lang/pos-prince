-- Multi-item checkout orders + cross-store fulfillment
CREATE TABLE IF NOT EXISTS sales_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE RESTRICT,
    cashier_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    payment_method payment_method NOT NULL DEFAULT 'cash',
    gross_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    line_discount_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    overall_discount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    net_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    transaction_time TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sales_transactions
    ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES sales_orders(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS inventory_shop_id UUID REFERENCES shops(id) ON DELETE RESTRICT;

UPDATE sales_transactions
SET inventory_shop_id = shop_id
WHERE inventory_shop_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_sales_order ON sales_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_shop_time ON sales_orders(shop_id, transaction_time DESC);
