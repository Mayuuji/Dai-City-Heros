-- Add 'region' to the locations icon constraint
-- Run this in Supabase SQL Editor

ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_icon_check;
ALTER TABLE locations ADD CONSTRAINT locations_icon_check 
  CHECK (icon IN ('marker', 'city', 'dungeon', 'shop', 'quest', 'danger', 'safe-zone', 'region'));
