-- =====================================================
-- FIX SHOP INVENTORY STOCK RLS POLICY
-- =====================================================
-- This migration adds a policy to allow players to update
-- shop_inventory stock_quantity when they make purchases.
-- Without this, player purchases don't actually decrement stock.

-- Drop the existing UPDATE policy if it exists (avoid conflict)
DROP POLICY IF EXISTS "Players can update shop stock on purchase" ON shop_inventory;

-- Create policy to allow authenticated users to update stock_quantity
-- This allows the purchase flow to actually decrement stock
CREATE POLICY "Players can update shop stock on purchase"
  ON shop_inventory FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- VERIFICATION
-- =====================================================
-- Check that the policy was created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'shop_inventory';
