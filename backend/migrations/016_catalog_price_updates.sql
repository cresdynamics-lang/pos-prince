-- Client price corrections (Jul 2026): boots/shoes 7k, sweaters/dresses 5.5k, t-shirts 3k,
-- track suits 8k, trousers ~3k. Suits stay 13k / 15k.

INSERT INTO categories (name, slug, parent_id, variant_types)
SELECT 'Dresses', 'dresses', NULL, '["size","color"]'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'dresses');

UPDATE products p
SET base_price = v.list_price,
    cost_price = v.cost_price,
    updated_at = NOW()
FROM categories cat
JOIN (VALUES
    ('boots', 7000, 3150),
    ('formal-shoes', 7000, 3150),
    ('casual-shoes', 7000, 3150),
    ('loafers', 7000, 3150),
    ('sandals', 7000, 3150),
    ('two-piece', 13000, 5850),
    ('three-piece', 15000, 6750),
    ('sweaters', 5500, 2500),
    ('dresses', 5500, 2500),
    ('round-neck-t-shirts', 3000, 1350),
    ('v-neck-t-shirts', 3000, 1350),
    ('sweat-shirts', 3000, 1350),
    ('track-suits', 8000, 3600),
    ('khaki', 3000, 1350),
    ('formal-trousers', 3000, 1350),
    ('chino', 3000, 1350),
    ('jeans', 3000, 1350),
    ('gurkha', 3000, 1350)
) AS v(slug, list_price, cost_price) ON cat.slug = v.slug
WHERE p.category_id = cat.id;
