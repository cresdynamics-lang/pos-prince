-- Ensure Jackets parent has Half Jacket + Puff Jacket sellable subcategories.
INSERT INTO categories (name, slug, parent_id, variant_types)
SELECT 'Half Jacket', 'half-jackets', id, '["size","color","material"]'
FROM categories WHERE slug = 'jackets'
  AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'half-jackets');

UPDATE categories
SET name = 'Half Jacket',
    variant_types = '["size","color","material"]'::jsonb
WHERE slug = 'half-jackets';

INSERT INTO categories (name, slug, parent_id, variant_types)
SELECT 'Puff Jacket', 'puff-jackets', id, '["size","color","material"]'
FROM categories WHERE slug = 'jackets'
  AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'puff-jackets');

-- Keep generic Jackets subcategory if present (older seed).
UPDATE categories
SET name = 'Jackets',
    variant_types = '["size","color","material"]'::jsonb
WHERE slug = 'jackets-sub';
