-- ============================================
-- CLEANUP: Remove Map, Shop, Location, and Chat features
-- Run this in Supabase SQL Editor
-- ============================================

-- Drop shop_inventory first (depends on shops and items)
DROP TABLE IF EXISTS shop_inventory CASCADE;

-- Drop shops (depends on locations)
DROP TABLE IF EXISTS shops CASCADE;

-- Drop locations
DROP TABLE IF EXISTS locations CASCADE;

-- Drop map_settings
DROP TABLE IF EXISTS map_settings CASCADE;

-- Drop messages (chat)
DROP TABLE IF EXISTS messages CASCADE;

-- Verify removal
DO $$
BEGIN
  RAISE NOTICE 'Removed tables: shop_inventory, shops, locations, map_settings, messages';
END $$;
