-- Belts & caps: no sizes (name/color only). Allow consolidating old sized belt rows.

-- Belts: collapse sized variants into one row per color (keep lowest id per color).
WITH ranked AS (
  SELECT pv.id,
         pv.product_id,
         pv.color,
         ROW_NUMBER() OVER (
           PARTITION BY pv.product_id, COALESCE(pv.color, '')
           ORDER BY pv.created_at, pv.id
         ) AS rn
  FROM product_variants pv
  JOIN products p ON p.id = pv.product_id
  JOIN categories c ON c.id = p.category_id
  WHERE c.slug = 'belts' AND pv.size IS NOT NULL
),
keepers AS (SELECT id FROM ranked WHERE rn = 1),
dupes AS (SELECT id FROM ranked WHERE rn > 1)
UPDATE inventory i
SET product_variant_id = k.id
FROM dupes d
JOIN ranked r ON r.id = d.id
JOIN ranked k ON k.product_id = r.product_id
  AND COALESCE(k.color, '') = COALESCE(r.color, '')
  AND k.rn = 1
WHERE i.product_variant_id = d.id
  AND NOT EXISTS (
    SELECT 1 FROM inventory i2
    WHERE i2.product_variant_id = k.id AND i2.shop_id = i.shop_id
  );

DELETE FROM inventory i
USING (
  SELECT pv.id
  FROM product_variants pv
  JOIN products p ON p.id = pv.product_id
  JOIN categories c ON c.id = p.category_id
  WHERE c.slug = 'belts' AND pv.size IS NOT NULL
    AND pv.id NOT IN (
      SELECT DISTINCT ON (pv2.product_id, COALESCE(pv2.color, '')) pv2.id
      FROM product_variants pv2
      JOIN products p2 ON p2.id = pv2.product_id
      JOIN categories c2 ON c2.id = p2.category_id
      WHERE c2.slug = 'belts'
      ORDER BY pv2.product_id, COALESCE(pv2.color, ''), pv2.created_at, pv2.id
    )
) dup
WHERE i.product_variant_id = dup.id;

DELETE FROM product_variants pv
USING products p, categories c
WHERE pv.product_id = p.id AND p.category_id = c.id
  AND c.slug = 'belts' AND pv.size IS NOT NULL
  AND pv.id NOT IN (
    SELECT DISTINCT ON (pv2.product_id, COALESCE(pv2.color, '')) pv2.id
    FROM product_variants pv2
    JOIN products p2 ON p2.id = pv2.product_id
    JOIN categories c2 ON c2.id = p2.category_id
    WHERE c2.slug = 'belts'
    ORDER BY pv2.product_id, COALESCE(pv2.color, ''), pv2.created_at, pv2.id
  );

UPDATE product_variants pv
SET size = NULL
FROM products p
JOIN categories c ON c.id = p.category_id
WHERE pv.product_id = p.id AND c.slug IN ('belts', 'caps', 'fedora-hats');

-- Caps: remove size dimension (one variant per product/color).
UPDATE product_variants pv
SET size = NULL
FROM products p
JOIN categories c ON c.id = p.category_id
WHERE pv.product_id = p.id AND c.slug IN ('caps', 'fedora-hats');
