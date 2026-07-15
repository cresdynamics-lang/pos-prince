-- Category tree aligned with Prince Esquire storefront catalog
-- variant_types drives POS variant picker per category

INSERT INTO categories (name, slug, parent_id, variant_types) VALUES
('Polo T-Shirts', 'polo-t-shirts', NULL, '["size","color"]'),
('Shoes', 'shoes', NULL, '["size","color","material"]'),
('Shirts', 'shirts', NULL, '["size","color","sleeve_type"]'),
('Suits', 'suits', NULL, '["size","color"]'),
('Blazers', 'blazers', NULL, '["size","color"]'),
('Track Suits', 'track-suits', NULL, '["size","color"]'),
('Jackets', 'jackets', NULL, '["size","color","material"]'),
('Trousers', 'trousers', NULL, '["size","length","color"]'),
('Linen', 'linen', NULL, '["size","color"]'),
('Caps & Hats', 'caps-hats', NULL, '["size","color"]'),
('Belts & Ties', 'belts-ties', NULL, '["color","size"]'),
('Sweaters', 'sweaters', NULL, '["size","color"]'),
('T-Shirts', 't-shirts', NULL, '["size","color"]');

-- Polo T-Shirts
INSERT INTO categories (name, slug, parent_id, variant_types)
SELECT 'Knitted Polos', 'knitted-polos', id, '["size","color"]' FROM categories WHERE slug = 'polo-t-shirts';
INSERT INTO categories (name, slug, parent_id, variant_types)
SELECT 'Polos', 'polos', id, '["size","color"]' FROM categories WHERE slug = 'polo-t-shirts';

-- Shoes
INSERT INTO categories (name, slug, parent_id, variant_types)
SELECT v.name, v.slug, c.id, '["size","color","material"]'
FROM categories c
CROSS JOIN (VALUES
    ('Formal Shoes', 'formal-shoes'),
    ('Casual', 'casual-shoes'),
    ('Boots', 'boots'),
    ('Sandals', 'sandals'),
    ('Loafers', 'loafers')
) AS v(name, slug)
WHERE c.slug = 'shoes';

-- Shirts
INSERT INTO categories (name, slug, parent_id, variant_types)
SELECT v.name, v.slug, c.id, '["size","color","sleeve_type"]'
FROM categories c
CROSS JOIN (VALUES
    ('Formal Shirts', 'formal-shirts'),
    ('Casual', 'casual-shirts'),
    ('Presidential', 'presidential')
) AS v(name, slug)
WHERE c.slug = 'shirts';

-- Suits
INSERT INTO categories (name, slug, parent_id, variant_types)
SELECT v.name, v.slug, c.id, '["size","color"]'
FROM categories c
CROSS JOIN (VALUES
    ('Two Piece', 'two-piece'),
    ('Three Piece', 'three-piece')
) AS v(name, slug)
WHERE c.slug = 'suits';

-- Jackets
INSERT INTO categories (name, slug, parent_id, variant_types)
SELECT v.name, v.slug, c.id, '["size","color","material"]'
FROM categories c
CROSS JOIN (VALUES
    ('Jackets', 'jackets-sub'),
    ('Half Jacket', 'half-jackets'),
    ('Puff Jacket', 'puff-jackets')
) AS v(name, slug)
WHERE c.slug = 'jackets';

-- Trousers
INSERT INTO categories (name, slug, parent_id, variant_types)
SELECT v.name, v.slug, c.id, '["size","length","color"]'
FROM categories c
CROSS JOIN (VALUES
    ('Khaki', 'khaki'),
    ('Formal', 'formal-trousers'),
    ('Chino', 'chino'),
    ('Jeans', 'jeans'),
    ('Gurkha', 'gurkha')
) AS v(name, slug)
WHERE c.slug = 'trousers';

-- Linen
INSERT INTO categories (name, slug, parent_id, variant_types)
SELECT v.name, v.slug, c.id, '["size","color"]'
FROM categories c
CROSS JOIN (VALUES
    ('Linen Set', 'linen-set'),
    ('Linen Trousers', 'linen-trousers'),
    ('Linen Shirts', 'linen-shirts'),
    ('Linen Shorts', 'linen-shorts')
) AS v(name, slug)
WHERE c.slug = 'linen';

-- T-Shirts
INSERT INTO categories (name, slug, parent_id, variant_types)
SELECT v.name, v.slug, c.id, '["size","color"]'
FROM categories c
CROSS JOIN (VALUES
    ('Sweat-Shirts', 'sweat-shirts'),
    ('Round-Neck T-Shirts', 'round-neck-t-shirts'),
    ('V-Neck T-Shirts', 'v-neck-t-shirts')
) AS v(name, slug)
WHERE c.slug = 't-shirts';

-- Belts & Ties (subcategory = product)
INSERT INTO categories (name, slug, parent_id, variant_types)
SELECT 'Belts', 'belts', id, '["size","color"]' FROM categories WHERE slug = 'belts-ties';
INSERT INTO categories (name, slug, parent_id, variant_types)
SELECT 'Ties', 'ties', id, '["color"]' FROM categories WHERE slug = 'belts-ties';

-- Demo shop (update when client confirms locations)
INSERT INTO shops (name, location, phone) VALUES
('Prince Esquire — Main', 'Nairobi', '0724-494089');
