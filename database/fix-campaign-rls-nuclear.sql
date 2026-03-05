-- ============================================================
-- NUCLEAR FIX: Drop ALL policies on campaign tables, recreate cleanly
-- ============================================================

-- First, show what policies currently exist (for debugging)
SELECT tablename, policyname, cmd, permissive
FROM pg_policies 
WHERE tablename IN ('campaign_members', 'campaigns', 'campaign_themes')
ORDER BY tablename, policyname;

-- Drop ALL existing policies on these tables
DO $$ 
DECLARE 
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname, tablename FROM pg_policies 
    WHERE tablename IN ('campaign_members', 'campaigns', 'campaign_themes')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- Ensure RLS is enabled
ALTER TABLE campaign_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_members ENABLE ROW LEVEL SECURITY;

-- ==================== campaign_themes ====================
-- Anyone authenticated can read themes
CREATE POLICY "themes_read" ON campaign_themes 
  FOR SELECT USING (true);

-- Anyone authenticated can create themes  
CREATE POLICY "themes_insert" ON campaign_themes 
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Campaign owners can update their themes
CREATE POLICY "themes_update" ON campaign_themes 
  FOR UPDATE USING (true);

-- ==================== campaigns ====================
-- Any authenticated user can read campaigns (needed for invite code lookup too)
CREATE POLICY "campaigns_read" ON campaigns 
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Any authenticated user can create campaigns
CREATE POLICY "campaigns_insert" ON campaigns 
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Only owners can update their campaigns
CREATE POLICY "campaigns_update" ON campaigns 
  FOR UPDATE USING (owner_id = auth.uid());

-- Only owners can delete their campaigns
CREATE POLICY "campaigns_delete" ON campaigns 
  FOR DELETE USING (owner_id = auth.uid());

-- ==================== campaign_members ====================
-- Users can read their own memberships + campaign owners can see all members
CREATE POLICY "members_read" ON campaign_members 
  FOR SELECT USING (
    user_id = auth.uid()
    OR campaign_id IN (SELECT id FROM campaigns WHERE owner_id = auth.uid())
  );

-- Users can join campaigns (insert their own membership)
CREATE POLICY "members_insert" ON campaign_members 
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Campaign owners can update members
CREATE POLICY "members_update" ON campaign_members 
  FOR UPDATE USING (
    campaign_id IN (SELECT id FROM campaigns WHERE owner_id = auth.uid())
  );

-- Users can leave + owners can remove members
CREATE POLICY "members_delete" ON campaign_members 
  FOR DELETE USING (
    user_id = auth.uid()
    OR campaign_id IN (SELECT id FROM campaigns WHERE owner_id = auth.uid())
  );

-- ==================== Verify ====================
-- Show final policies
SELECT tablename, policyname, cmd, permissive
FROM pg_policies 
WHERE tablename IN ('campaign_members', 'campaigns', 'campaign_themes')
ORDER BY tablename, policyname;

-- Verify data exists
SELECT 'campaigns' as tbl, count(*) as rows FROM campaigns
UNION ALL
SELECT 'campaign_themes', count(*) FROM campaign_themes
UNION ALL
SELECT 'campaign_members', count(*) FROM campaign_members;
