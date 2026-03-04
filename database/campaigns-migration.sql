-- ============================================================
-- CAMPAIGNS & THEMES MIGRATION
-- Multi-campaign support: scopes all game data by campaign
-- ============================================================

-- Campaign themes: define visual style per campaign
CREATE TABLE IF NOT EXISTS campaign_themes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Cyberpunk',
  -- Color palette
  color_primary TEXT NOT NULL DEFAULT '#40E0D0',       -- main accent (cyan)
  color_secondary TEXT NOT NULL DEFAULT '#D93654',      -- secondary accent (magenta/pink)
  color_tertiary TEXT NOT NULL DEFAULT '#FF9F1C',       -- tertiary accent (yellow/orange)
  color_success TEXT NOT NULL DEFAULT '#1A3A3A',        -- success/positive
  color_danger TEXT NOT NULL DEFAULT '#FF003C',         -- danger/negative
  color_bg_dark TEXT NOT NULL DEFAULT '#0D1117',        -- dark background
  color_bg_darker TEXT NOT NULL DEFAULT '#010409',      -- darker background
  -- Fonts
  font_heading TEXT NOT NULL DEFAULT '''Orbitron'', sans-serif',
  font_body TEXT NOT NULL DEFAULT '''Courier New'', monospace',
  -- Neon shadows
  shadow_primary TEXT NOT NULL DEFAULT '0 0 5px #40E0D0, 0 0 20px rgba(64, 224, 208, 0.3)',
  shadow_secondary TEXT NOT NULL DEFAULT '0 0 5px #D93654, 0 0 20px rgba(217, 54, 84, 0.3)',
  -- Landing page
  landing_title TEXT NOT NULL DEFAULT 'CAMPAIGN',
  landing_subtitle TEXT DEFAULT '',
  landing_bg_image TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  theme_id UUID REFERENCES campaign_themes(id),
  owner_id UUID REFERENCES auth.users(id) NOT NULL,
  invite_code TEXT UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Campaign members: who belongs to which campaign + their role in that campaign
CREATE TABLE IF NOT EXISTS campaign_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  role TEXT NOT NULL DEFAULT 'player', -- 'admin' or 'player'
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(campaign_id, user_id)
);

-- ============================================================
-- Enable RLS on new tables
-- ============================================================
ALTER TABLE campaign_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_members ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS policies for campaign_themes
-- ============================================================
DROP POLICY IF EXISTS "Anyone can read themes" ON campaign_themes;
CREATE POLICY "Anyone can read themes" ON campaign_themes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Campaign owners can manage themes" ON campaign_themes;
CREATE POLICY "Campaign owners can manage themes" ON campaign_themes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      WHERE c.theme_id = campaign_themes.id
      AND c.owner_id = auth.uid()
    )
  );

-- Allow insert for anyone authenticated (they'll link it to their campaign)
DROP POLICY IF EXISTS "Authenticated users can create themes" ON campaign_themes;
CREATE POLICY "Authenticated users can create themes" ON campaign_themes
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- RLS policies for campaigns
-- ============================================================
DROP POLICY IF EXISTS "Members can read their campaigns" ON campaigns;
CREATE POLICY "Members can read their campaigns" ON campaigns
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM campaign_members cm
      WHERE cm.campaign_id = campaigns.id
      AND cm.user_id = auth.uid()
    )
    OR owner_id = auth.uid()
  );

DROP POLICY IF EXISTS "Owners can manage their campaigns" ON campaigns;
CREATE POLICY "Owners can manage their campaigns" ON campaigns
  FOR ALL USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can create campaigns" ON campaigns;
CREATE POLICY "Authenticated users can create campaigns" ON campaigns
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Allow anyone to read campaigns (for invite code lookup)
DROP POLICY IF EXISTS "Anyone can lookup campaigns by invite" ON campaigns;
CREATE POLICY "Anyone can lookup campaigns by invite" ON campaigns
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ============================================================
-- RLS policies for campaign_members
-- ============================================================
DROP POLICY IF EXISTS "Members can read campaign members" ON campaign_members;
CREATE POLICY "Members can read campaign members" ON campaign_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM campaign_members cm2
      WHERE cm2.campaign_id = campaign_members.campaign_id
      AND cm2.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Campaign owners can manage members" ON campaign_members;
CREATE POLICY "Campaign owners can manage members" ON campaign_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      WHERE c.id = campaign_members.campaign_id
      AND c.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can join campaigns" ON campaign_members;
CREATE POLICY "Users can join campaigns" ON campaign_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can leave campaigns" ON campaign_members;
CREATE POLICY "Users can leave campaigns" ON campaign_members
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- Add campaign_id to ALL existing game tables
-- ============================================================

-- Create a default campaign + theme for existing data
DO $$
DECLARE
  default_theme_id UUID;
  default_campaign_id UUID;
  admin_user_id UUID;
BEGIN
  -- Find existing admin user to own the default campaign
  SELECT id INTO admin_user_id FROM profiles WHERE role = 'admin' LIMIT 1;
  IF admin_user_id IS NULL THEN
    SELECT id INTO admin_user_id FROM auth.users LIMIT 1;
  END IF;

  -- Create default theme (the current cyberpunk theme)
  INSERT INTO campaign_themes (id, name) 
  VALUES ('00000000-0000-0000-0000-000000000001', 'Dai City Cyberpunk')
  ON CONFLICT (id) DO NOTHING;
  default_theme_id := '00000000-0000-0000-0000-000000000001';

  -- Create default campaign for existing data
  INSERT INTO campaigns (id, name, description, theme_id, owner_id)
  VALUES (
    '00000000-0000-0000-0000-000000000002',
    'Dai City Heros',
    'The original campaign',
    default_theme_id,
    COALESCE(admin_user_id, '00000000-0000-0000-0000-000000000000')
  )
  ON CONFLICT (id) DO NOTHING;
  default_campaign_id := '00000000-0000-0000-0000-000000000002';

  -- Add all existing users as members of the default campaign
  INSERT INTO campaign_members (campaign_id, user_id, role)
  SELECT default_campaign_id, p.id, p.role
  FROM profiles p
  ON CONFLICT (campaign_id, user_id) DO NOTHING;
END $$;

-- Add campaign_id column to each table with a default pointing to the existing campaign
-- characters
ALTER TABLE characters ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id);
UPDATE characters SET campaign_id = '00000000-0000-0000-0000-000000000002' WHERE campaign_id IS NULL;

-- items
ALTER TABLE items ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id);
UPDATE items SET campaign_id = '00000000-0000-0000-0000-000000000002' WHERE campaign_id IS NULL;

-- abilities
ALTER TABLE abilities ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id);
UPDATE abilities SET campaign_id = '00000000-0000-0000-0000-000000000002' WHERE campaign_id IS NULL;

-- inventory (scoped through character, but adding for direct queries)
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id);
UPDATE inventory SET campaign_id = '00000000-0000-0000-0000-000000000002' WHERE campaign_id IS NULL;

-- character_abilities
ALTER TABLE character_abilities ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id);
UPDATE character_abilities SET campaign_id = '00000000-0000-0000-0000-000000000002' WHERE campaign_id IS NULL;

-- locations
ALTER TABLE locations ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id);
UPDATE locations SET campaign_id = '00000000-0000-0000-0000-000000000002' WHERE campaign_id IS NULL;

-- map_settings
ALTER TABLE map_settings ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id);
UPDATE map_settings SET campaign_id = '00000000-0000-0000-0000-000000000002' WHERE campaign_id IS NULL;

-- shops
ALTER TABLE shops ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id);
UPDATE shops SET campaign_id = '00000000-0000-0000-0000-000000000002' WHERE campaign_id IS NULL;

-- shop_inventory
ALTER TABLE shop_inventory ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id);
UPDATE shop_inventory SET campaign_id = '00000000-0000-0000-0000-000000000002' WHERE campaign_id IS NULL;

-- missions
ALTER TABLE missions ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id);
UPDATE missions SET campaign_id = '00000000-0000-0000-0000-000000000002' WHERE campaign_id IS NULL;

-- mission_rewards_distributed
ALTER TABLE mission_rewards_distributed ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id);
UPDATE mission_rewards_distributed SET campaign_id = '00000000-0000-0000-0000-000000000002' WHERE campaign_id IS NULL;

-- npcs
ALTER TABLE npcs ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id);
UPDATE npcs SET campaign_id = '00000000-0000-0000-0000-000000000002' WHERE campaign_id IS NULL;

-- encounters
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id);
UPDATE encounters SET campaign_id = '00000000-0000-0000-0000-000000000002' WHERE campaign_id IS NULL;

-- encounter_participants
ALTER TABLE encounter_participants ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id);
UPDATE encounter_participants SET campaign_id = '00000000-0000-0000-0000-000000000002' WHERE campaign_id IS NULL;

-- player_encounter_notes
ALTER TABLE player_encounter_notes ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id);
UPDATE player_encounter_notes SET campaign_id = '00000000-0000-0000-0000-000000000002' WHERE campaign_id IS NULL;

-- game_settings
ALTER TABLE game_settings ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id);
UPDATE game_settings SET campaign_id = '00000000-0000-0000-0000-000000000002' WHERE campaign_id IS NULL;

-- game_effects
ALTER TABLE game_effects ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id);
UPDATE game_effects SET campaign_id = '00000000-0000-0000-0000-000000000002' WHERE campaign_id IS NULL;

-- item_abilities (junction table, scoped via items)
ALTER TABLE item_abilities ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id);
UPDATE item_abilities SET campaign_id = '00000000-0000-0000-0000-000000000002' WHERE campaign_id IS NULL;

-- ============================================================
-- Add realtime for new tables
-- ============================================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE campaigns;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE campaign_members;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- Helper function: get current user's role in a campaign
-- ============================================================
CREATE OR REPLACE FUNCTION get_campaign_role(p_campaign_id UUID)
RETURNS TEXT AS $$
  SELECT role FROM campaign_members
  WHERE campaign_id = p_campaign_id AND user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- Indexes for campaign_id lookups
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_characters_campaign ON characters(campaign_id);
CREATE INDEX IF NOT EXISTS idx_items_campaign ON items(campaign_id);
CREATE INDEX IF NOT EXISTS idx_abilities_campaign ON abilities(campaign_id);
CREATE INDEX IF NOT EXISTS idx_inventory_campaign ON inventory(campaign_id);
CREATE INDEX IF NOT EXISTS idx_character_abilities_campaign ON character_abilities(campaign_id);
CREATE INDEX IF NOT EXISTS idx_locations_campaign ON locations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_shops_campaign ON shops(campaign_id);
CREATE INDEX IF NOT EXISTS idx_shop_inventory_campaign ON shop_inventory(campaign_id);
CREATE INDEX IF NOT EXISTS idx_missions_campaign ON missions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_npcs_campaign ON npcs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_encounters_campaign ON encounters(campaign_id);
CREATE INDEX IF NOT EXISTS idx_encounter_participants_campaign ON encounter_participants(campaign_id);
CREATE INDEX IF NOT EXISTS idx_game_settings_campaign ON game_settings(campaign_id);
CREATE INDEX IF NOT EXISTS idx_game_effects_campaign ON game_effects(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_members_user ON campaign_members(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_members_campaign ON campaign_members(campaign_id);

-- ============================================================
-- Composite unique constraint on game_settings for upserts
-- ============================================================
-- The app uses onConflict: 'key,campaign_id' so we need a unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'game_settings_key_campaign_unique'
  ) THEN
    ALTER TABLE game_settings ADD CONSTRAINT game_settings_key_campaign_unique UNIQUE (key, campaign_id);
  END IF;
END $$;

-- ============================================================
-- Updated toggle_players_locked RPC with campaign_id support
-- ============================================================
CREATE OR REPLACE FUNCTION toggle_players_locked(
  is_locked BOOLEAN,
  lock_reason TEXT DEFAULT NULL,
  p_campaign_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  IF p_campaign_id IS NOT NULL THEN
    UPDATE game_settings
    SET 
      value = jsonb_build_object('locked', is_locked, 'reason', lock_reason),
      updated_at = NOW(),
      updated_by = auth.uid()
    WHERE key = 'players_locked' AND campaign_id = p_campaign_id;

    IF NOT FOUND THEN
      INSERT INTO game_settings (key, value, updated_by, campaign_id)
      VALUES ('players_locked', jsonb_build_object('locked', is_locked, 'reason', lock_reason), auth.uid(), p_campaign_id);
    END IF;
  ELSE
    UPDATE game_settings
    SET 
      value = jsonb_build_object('locked', is_locked, 'reason', lock_reason),
      updated_at = NOW(),
      updated_by = auth.uid()
    WHERE key = 'players_locked';

    IF NOT FOUND THEN
      INSERT INTO game_settings (key, value, updated_by)
      VALUES ('players_locked', jsonb_build_object('locked', is_locked, 'reason', lock_reason), auth.uid());
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on updated function signature
GRANT EXECUTE ON FUNCTION toggle_players_locked(BOOLEAN, TEXT, UUID) TO authenticated;

-- ============================================================
-- Migrate existing users to campaign_members for default campaign
-- ============================================================
INSERT INTO campaign_members (campaign_id, user_id, role)
SELECT 
  '00000000-0000-0000-0000-000000000002',
  p.id,
  p.role
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM campaign_members cm 
  WHERE cm.campaign_id = '00000000-0000-0000-0000-000000000002' 
  AND cm.user_id = p.id
);

-- ============================================================
-- RLS policies for new tables
-- ============================================================
ALTER TABLE campaign_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_members ENABLE ROW LEVEL SECURITY;

-- Campaign themes: readable by all authenticated users
CREATE POLICY "campaign_themes_select" ON campaign_themes FOR SELECT TO authenticated USING (true);
-- Only campaign owner can manage themes
CREATE POLICY "campaign_themes_insert" ON campaign_themes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "campaign_themes_update" ON campaign_themes FOR UPDATE TO authenticated USING (true);

-- Campaigns: members can read, owners can manage
CREATE POLICY "campaigns_select" ON campaigns FOR SELECT TO authenticated 
  USING (id IN (SELECT campaign_id FROM campaign_members WHERE user_id = auth.uid()) OR owner_id = auth.uid());
CREATE POLICY "campaigns_insert" ON campaigns FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "campaigns_update" ON campaigns FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "campaigns_delete" ON campaigns FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- Campaign members: members can see other members, admins can manage
CREATE POLICY "campaign_members_select" ON campaign_members FOR SELECT TO authenticated
  USING (campaign_id IN (SELECT campaign_id FROM campaign_members WHERE user_id = auth.uid()));
CREATE POLICY "campaign_members_insert" ON campaign_members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "campaign_members_update" ON campaign_members FOR UPDATE TO authenticated
  USING (campaign_id IN (SELECT cm.campaign_id FROM campaign_members cm WHERE cm.user_id = auth.uid() AND cm.role = 'admin'));
CREATE POLICY "campaign_members_delete" ON campaign_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR campaign_id IN (SELECT cm.campaign_id FROM campaign_members cm WHERE cm.user_id = auth.uid() AND cm.role = 'admin'));
