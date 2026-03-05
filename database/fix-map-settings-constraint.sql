-- Fix map_settings for multi-campaign support
-- Run this in the Supabase SQL Editor

-- 1. Drop the CHECK constraint that only allows a single hard-coded UUID
--    This was blocking createCampaign from inserting new map_settings rows.
ALTER TABLE map_settings DROP CONSTRAINT IF EXISTS only_one_setting;

-- 2. Ensure campaign_id is NOT NULL going forward
ALTER TABLE map_settings ALTER COLUMN campaign_id SET NOT NULL;

-- 3. One settings row per campaign
ALTER TABLE map_settings DROP CONSTRAINT IF EXISTS map_settings_campaign_unique;
ALTER TABLE map_settings ADD CONSTRAINT map_settings_campaign_unique UNIQUE (campaign_id);

-- 4. Index for fast campaign lookups
CREATE INDEX IF NOT EXISTS idx_map_settings_campaign ON map_settings(campaign_id);

-- 5. Replace old RLS policies with campaign-aware ones
--    Old policies used profiles.role = 'admin' (global role, ignores campaigns)

-- map_settings
DROP POLICY IF EXISTS "Anyone can view map settings" ON map_settings;
DROP POLICY IF EXISTS "Admins can manage map settings" ON map_settings;

CREATE POLICY "Campaign members can view map settings"
  ON map_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM campaign_members cm
      WHERE cm.campaign_id = map_settings.campaign_id
        AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Campaign DMs can manage map settings"
  ON map_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM campaign_members cm
      WHERE cm.campaign_id = map_settings.campaign_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin', 'dm')
    )
  );

-- locations
DROP POLICY IF EXISTS "Anyone can view visible locations" ON locations;
DROP POLICY IF EXISTS "Admins can manage locations" ON locations;

CREATE POLICY "Campaign members can view visible locations"
  ON locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM campaign_members cm
      WHERE cm.campaign_id = locations.campaign_id
        AND cm.user_id = auth.uid()
    )
    AND (
      is_visible = true
      OR EXISTS (
        SELECT 1 FROM campaign_members cm
        WHERE cm.campaign_id = locations.campaign_id
          AND cm.user_id = auth.uid()
          AND cm.role IN ('admin', 'dm')
      )
    )
  );

CREATE POLICY "Campaign DMs can manage locations"
  ON locations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM campaign_members cm
      WHERE cm.campaign_id = locations.campaign_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin', 'dm')
    )
  );

-- Done! Now createCampaign can insert new map_settings rows,
-- and each campaign's map data is properly scoped.
