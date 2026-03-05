-- ============================================================
-- FIX: Re-insert all existing users into campaign_members
-- for the default "Dai City Heros" campaign
-- ============================================================

-- First verify the default campaign exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM campaigns WHERE id = '00000000-0000-0000-0000-000000000002') THEN
    RAISE EXCEPTION 'Default campaign does not exist! Run campaigns-migration.sql first.';
  END IF;
END $$;

-- Insert ALL profiles into campaign_members for the default campaign
-- Uses ON CONFLICT to skip anyone already added
INSERT INTO campaign_members (campaign_id, user_id, role)
SELECT 
  '00000000-0000-0000-0000-000000000002',
  p.id,
  p.role
FROM profiles p
ON CONFLICT (campaign_id, user_id) DO NOTHING;

-- Show what we have now
SELECT 
  cm.user_id,
  p.username,
  cm.role,
  c.name as campaign_name
FROM campaign_members cm
JOIN profiles p ON p.id = cm.user_id
JOIN campaigns c ON c.id = cm.campaign_id
ORDER BY cm.role, p.username;
