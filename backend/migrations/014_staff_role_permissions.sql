-- Staff roles use server-side role defaults (no custom permission overrides).
UPDATE users
SET permissions = '[]'::jsonb
WHERE role IN ('shop_manager', 'cashier')
  AND permissions IS NOT NULL
  AND permissions::text NOT IN ('[]', 'null');
