-- Remove Dresses category from POS catalog (was added in 016; not sold).

DELETE FROM inventory
WHERE product_variant_id IN (
  SELECT pv.id
  FROM product_variants pv
  JOIN products p ON p.id = pv.product_id
  JOIN categories c ON c.id = p.category_id
  WHERE c.slug = 'dresses'
);

DELETE FROM product_variants
WHERE product_id IN (
  SELECT p.id
  FROM products p
  JOIN categories c ON c.id = p.category_id
  WHERE c.slug = 'dresses'
);

DELETE FROM products
WHERE category_id IN (SELECT id FROM categories WHERE slug = 'dresses');

DELETE FROM categories WHERE slug = 'dresses';
