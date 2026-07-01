-- Remove sales inserted by demo seed (demo cashiers on demo SKUs only).
DELETE FROM sales_transactions st
USING product_variants pv, users u
WHERE st.product_variant_id = pv.id
  AND st.cashier_id = u.id
  AND u.email IN ('james@prince-esquire.co.ke', 'mary@prince-esquire.co.ke')
  AND pv.sku IN ('loafers-42-Black', 'presidential-L-White', 'sweaters-L-Navy', 'ties-Burgundy');

DELETE FROM sales_orders so
WHERE NOT EXISTS (SELECT 1 FROM sales_transactions st WHERE st.order_id = so.id);
