-- ============================================================
-- Fix game_settings unique constraint
-- The original table had UNIQUE on (key) alone, which prevents
-- multiple campaigns from using the same setting key.
-- Drop the old constraint; keep only (key, campaign_id).
-- Run this in Supabase SQL Editor.
-- ============================================================

-- Drop the old single-column unique constraint on key
ALTER TABLE game_settings DROP CONSTRAINT IF EXISTS game_settings_key_key;

-- Also drop the old unique index if it exists separately
DROP INDEX IF EXISTS game_settings_key_key;

-- Ensure the composite unique constraint exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'game_settings_key_campaign_unique'
  ) THEN
    ALTER TABLE game_settings ADD CONSTRAINT game_settings_key_campaign_unique UNIQUE (key, campaign_id);
  END IF;
END $$;

-- Verify
SELECT conname, contype FROM pg_constraint WHERE conrelid = 'game_settings'::regclass;
