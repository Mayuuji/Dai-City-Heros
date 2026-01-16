-- Enable Realtime for tables that need live updates
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)

-- First, check if tables are already in the publication
-- If you get errors, you may need to remove and re-add them

-- Add tables to the supabase_realtime publication
-- This enables postgres_changes subscriptions in the client

-- Characters table - for HP, stats, CDD updates from DM
ALTER PUBLICATION supabase_realtime ADD TABLE characters;

-- Inventory - for when DM gives/removes items
ALTER PUBLICATION supabase_realtime ADD TABLE inventory;

-- Character abilities - for when DM grants/removes abilities
ALTER PUBLICATION supabase_realtime ADD TABLE character_abilities;

-- Game settings - for player lock status
ALTER PUBLICATION supabase_realtime ADD TABLE game_settings;

-- Missions - for mission updates
ALTER PUBLICATION supabase_realtime ADD TABLE missions;

-- Locations - for location discoveries (table is named "locations" not "map_locations")
ALTER PUBLICATION supabase_realtime ADD TABLE locations;

-- Shops - for shop availability changes
ALTER PUBLICATION supabase_realtime ADD TABLE shops;

-- Shop inventory - for item availability changes
ALTER PUBLICATION supabase_realtime ADD TABLE shop_inventory;

-- Encounters - for encounter updates
ALTER PUBLICATION supabase_realtime ADD TABLE encounters;

-- Encounter participants - for combat updates (table is named "encounter_participants" not "encounter_combatants")
ALTER PUBLICATION supabase_realtime ADD TABLE encounter_participants;

-- ============================================
-- ALTERNATIVE: If you get "already exists" errors, 
-- you can check current publication tables with:
-- 
-- SELECT * FROM pg_publication_tables 
-- WHERE pubname = 'supabase_realtime';
--
-- Or remove a table first then re-add:
-- ALTER PUBLICATION supabase_realtime DROP TABLE characters;
-- ALTER PUBLICATION supabase_realtime ADD TABLE characters;
-- ============================================

-- ============================================
-- EASIEST METHOD: Use the Supabase Dashboard
-- 1. Go to Database > Replication
-- 2. Find "supabase_realtime" publication
-- 3. Toggle ON for each table you want realtime on:
--    - characters
--    - inventory
--    - character_abilities
--    - game_settings
--    - missions
--    - locations
--    - shops
--    - shop_inventory
--    - encounters
--    - encounter_participants
-- ============================================
