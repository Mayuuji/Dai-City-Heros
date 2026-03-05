-- ============================================================
-- Update existing "Modern/Urban" campaign themes to new light colors
-- Run this in Supabase SQL Editor
-- ============================================================

-- Update any campaign_themes that still have the old dark modern values
UPDATE campaign_themes
SET
  color_primary = '#4F46E5',
  color_secondary = '#E11D48',
  color_tertiary = '#0D9488',
  color_success = '#16A34A',
  color_danger = '#DC2626',
  color_bg_dark = '#F5F5F5',
  color_bg_darker = '#FFFFFF',
  color_text = '#1F2937',
  color_text_muted = '#6B7280',
  font_heading = '''Segoe UI'', sans-serif',
  font_body = '''Inter'', ''Segoe UI'', sans-serif'
WHERE name = 'Modern/Urban';

-- Also add color_text and color_text_muted columns if they don't exist yet
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaign_themes' AND column_name = 'color_text'
  ) THEN
    ALTER TABLE campaign_themes ADD COLUMN color_text TEXT DEFAULT '#E6EDF3';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaign_themes' AND column_name = 'color_text_muted'
  ) THEN
    ALTER TABLE campaign_themes ADD COLUMN color_text_muted TEXT DEFAULT '#8B949E';
  END IF;
END $$;

-- Set text colors for all existing themes that don't have them
UPDATE campaign_themes SET color_text = '#E6EDF3' WHERE color_text IS NULL;
UPDATE campaign_themes SET color_text_muted = '#8B949E' WHERE color_text_muted IS NULL;

-- Set dark text for light-background themes specifically
UPDATE campaign_themes 
SET color_text = '#1F2937', color_text_muted = '#6B7280'
WHERE color_bg_darker = '#FFFFFF' OR color_bg_dark = '#F5F5F5';

-- Verify
SELECT id, name, color_bg_dark, color_bg_darker, color_text, color_text_muted 
FROM campaign_themes;
