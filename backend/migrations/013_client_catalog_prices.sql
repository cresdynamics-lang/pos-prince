-- Client price list + Caps / Fedora Hats subcategories under Caps & Hats.

INSERT INTO categories (name, slug, parent_id, variant_types)
SELECT 'Caps', 'caps', id, '["size","color"]'
FROM categories WHERE slug = 'caps-hats'
  AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'caps');

INSERT INTO categories (name, slug, parent_id, variant_types)
SELECT 'Fedora Hats', 'fedora-hats', id, '["size","color"]'
FROM categories WHERE slug = 'caps-hats'
  AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'fedora-hats');

-- Move any product on parent Caps & Hats row to the Caps subcategory.
UPDATE products p
SET category_id = caps.id, name = caps.name, updated_at = NOW()
FROM categories caps_parent
JOIN categories caps ON caps.slug = 'caps' AND caps.parent_id = caps_parent.id
WHERE p.category_id = caps_parent.id AND caps_parent.slug = 'caps-hats';

-- Client list prices (KES). Cost ≈ 45% of list.
UPDATE products p
SET base_price = v.list_price,
    cost_price = v.cost_price,
    updated_at = NOW()
FROM categories cat
JOIN (VALUES
    ('polos', 3000, 1350),
    ('knitted-polos', 3000, 1350),
    ('casual-shoes', 6500, 2900),
    ('loafers', 6500, 2900),
    ('jeans', 2500, 1100),
    ('khaki', 3000, 1350),
    ('two-piece', 13000, 5850),
    ('three-piece', 15000, 6750),
    ('jackets-sub', 5500, 2500),
    ('half-jackets', 5500, 2500),
    ('round-neck-t-shirts', 2000, 900),
    ('v-neck-t-shirts', 2000, 900),
    ('sweat-shirts', 2000, 900),
    ('caps', 2500, 1100),
    ('fedora-hats', 2500, 1100),
    ('belts', 2000, 900)
) AS v(slug, list_price, cost_price) ON cat.slug = v.slug
WHERE p.category_id = cat.id;
