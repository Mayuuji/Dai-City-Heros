-- ============================================================
-- FIX: campaign_members RLS was self-referencing (circular dependency)
-- The old policy tried to SELECT from campaign_members to authorize
-- reading campaign_members, which returns 0 rows always.
-- ============================================================

-- Fix campaign_members SELECT policy
DROP POLICY IF EXISTS "Members can read campaign members" ON campaign_members;
CREATE POLICY "Members can read campaign members" ON campaign_members
  FOR SELECT USING (
    -- Users can always see their own memberships
    user_id = auth.uid()
    -- Campaign owners can see all members
    OR campaign_id IN (
      SELECT c.id FROM campaigns c WHERE c.owner_id = auth.uid()
    )
  );

-- Also drop the duplicate policies that may have been created
DROP POLICY IF EXISTS "campaign_members_select" ON campaign_members;
DROP POLICY IF EXISTS "campaign_members_insert" ON campaign_members;
DROP POLICY IF EXISTS "campaign_members_update" ON campaign_members;
DROP POLICY IF EXISTS "campaign_members_delete" ON campaign_members;
DROP POLICY IF EXISTS "campaign_themes_select" ON campaign_themes;
DROP POLICY IF EXISTS "campaign_themes_insert" ON campaign_themes;
DROP POLICY IF EXISTS "campaign_themes_update" ON campaign_themes;
DROP POLICY IF EXISTS "campaigns_select" ON campaigns;
DROP POLICY IF EXISTS "campaigns_insert" ON campaigns;
DROP POLICY IF EXISTS "campaigns_update" ON campaigns;
DROP POLICY IF EXISTS "campaigns_delete" ON campaigns;
