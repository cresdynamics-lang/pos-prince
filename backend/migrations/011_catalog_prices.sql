-- Apply retail list/cost prices from category slug (only where still zero).
UPDATE products p
SET base_price = v.list_price,
    cost_price = v.cost_price,
    updated_at = NOW()
FROM categories cat
JOIN (VALUES
    ('knitted-polos', 6500, 2900),
    ('polos', 5500, 2500),
    ('formal-shoes', 38500, 17300),
    ('casual-shoes', 12500, 5600),
    ('boots', 22000, 9900),
    ('sandals', 6500, 2900),
    ('loafers', 32500, 14600),
    ('formal-shirts', 9500, 4300),
    ('casual-shirts', 5500, 2500),
    ('presidential', 8500, 3800),
    ('two-piece', 95000, 42800),
    ('three-piece', 135000, 60800),
    ('blazers', 32000, 14400),
    ('track-suits', 15000, 6800),
    ('jackets-sub', 18500, 8300),
    ('half-jackets', 14000, 6300),
    ('khaki', 5500, 2500),
    ('formal-trousers', 7500, 3400),
    ('chino', 6500, 2900),
    ('jeans', 5500, 2500),
    ('gurkha', 8500, 3800),
    ('linen-set', 18500, 8300),
    ('linen-trousers', 7500, 3400),
    ('linen-shirts', 8500, 3800),
    ('linen-shorts', 6500, 2900),
    ('caps-hats', 2500, 1100),
    ('belts', 4500, 2000),
    ('ties', 3500, 1600),
    ('sweaters', 12000, 5400),
    ('sweat-shirts', 4500, 2000),
    ('round-neck-t-shirts', 3500, 1600),
    ('v-neck-t-shirts', 3500, 1600)
) AS v(slug, list_price, cost_price) ON cat.slug = v.slug
WHERE p.category_id = cat.id
  AND (p.base_price = 0 OR p.cost_price = 0);
