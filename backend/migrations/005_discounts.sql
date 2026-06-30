-- Discount tracking on sales + sync helper
ALTER TABLE sales_transactions
    ADD COLUMN IF NOT EXISTS list_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;

-- Backfill list_price from product base_price for existing rows
UPDATE sales_transactions st
SET list_price = p.base_price,
    discount_amount = GREATEST(0, (p.base_price - st.sale_price) * st.quantity)
FROM product_variants pv
JOIN products p ON p.id = pv.product_id
WHERE pv.id = st.product_variant_id AND st.list_price = 0;
