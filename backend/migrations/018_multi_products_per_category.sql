-- Allow multiple named products under the same leaf category/subcategory.
DROP INDEX IF EXISTS products_category_id_unique;

-- Complete missing subcategory trees for top-level parents that had no children.
INSERT INTO categories (name, slug, parent_id, variant_types)
SELECT v.name, v.slug, c.id, '["size","color"]'
FROM categories c
CROSS JOIN (VALUES
    ('Formal Blazers', 'formal-blazers'),
    ('Casual Blazers', 'casual-blazers')
) AS v(name, slug)
WHERE c.slug = 'blazers'
  AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = v.slug);

INSERT INTO categories (name, slug, parent_id, variant_types)
SELECT v.name, v.slug, c.id, '["size","color"]'
FROM categories c
CROSS JOIN (VALUES
    ('Track Suits', 'track-suits-set'),
    ('Joggers Set', 'joggers-set')
) AS v(name, slug)
WHERE c.slug = 'track-suits'
  AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = v.slug);

INSERT INTO categories (name, slug, parent_id, variant_types)
SELECT v.name, v.slug, c.id, '["size","color"]'
FROM categories c
CROSS JOIN (VALUES
    ('Crew Neck', 'crew-neck-sweaters'),
    ('V-Neck', 'v-neck-sweaters'),
    ('Cardigans', 'cardigans')
) AS v(name, slug)
WHERE c.slug = 'sweaters'
  AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = v.slug);

-- If products were attached to former leaf parents, move them onto the first new child.
UPDATE products p
SET category_id = child.id,
    updated_at = NOW()
FROM categories parent
JOIN LATERAL (
  SELECT c.id
  FROM categories c
  WHERE c.parent_id = parent.id
  ORDER BY c.name
  LIMIT 1
) child ON TRUE
WHERE p.category_id = parent.id
  AND parent.slug IN ('blazers', 'track-suits', 'sweaters')
  AND EXISTS (SELECT 1 FROM categories ch WHERE ch.parent_id = parent.id);
