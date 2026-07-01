-- Subcategory = product: Belts & Ties get sellable children; one product per leaf category.

INSERT INTO categories (name, slug, parent_id, variant_types)
SELECT 'Belts', 'belts', id, '["size","color"]'
FROM categories WHERE slug = 'belts-ties'
  AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'belts');

INSERT INTO categories (name, slug, parent_id, variant_types)
SELECT 'Ties', 'ties', id, '["color"]'
FROM categories WHERE slug = 'belts-ties'
  AND NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'ties');

-- Move any products on the parent Belts & Ties row to the Ties subcategory.
UPDATE products p
SET category_id = ties.id, name = ties.name, updated_at = NOW()
FROM categories belts_ties
JOIN categories ties ON ties.slug = 'ties' AND ties.parent_id = belts_ties.id
WHERE p.category_id = belts_ties.id AND belts_ties.slug = 'belts-ties';

-- One sellable product per leaf category.
CREATE UNIQUE INDEX IF NOT EXISTS products_category_id_unique ON products (category_id);
