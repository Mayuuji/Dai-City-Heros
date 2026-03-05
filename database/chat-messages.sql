-- Chat / Messaging System
-- Run this in the Supabase SQL Editor

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Message content
  content TEXT NOT NULL,
  
  -- Target type: 'all' = everyone, 'dm' = DM only, 'player' = specific player
  target_type TEXT NOT NULL DEFAULT 'all'
    CHECK (target_type IN ('all', 'dm', 'player')),
  
  -- For whisper to a specific player (NULL when target_type = 'all' or 'dm')
  target_player_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_messages_campaign ON messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_target ON messages(target_player_id);

-- RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Everyone in the campaign can see messages targeted to 'all',
-- DMs can see everything, players can see their own whispers
CREATE POLICY "Campaign members can view relevant messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM campaign_members cm
      WHERE cm.campaign_id = messages.campaign_id
        AND cm.user_id = auth.uid()
    )
    AND (
      -- Public messages: everyone sees
      target_type = 'all'
      -- DM messages: only DM/admin sees
      OR (target_type = 'dm' AND (
        EXISTS (
          SELECT 1 FROM campaign_members cm
          WHERE cm.campaign_id = messages.campaign_id
            AND cm.user_id = auth.uid()
            AND cm.role IN ('admin', 'dm')
        )
        OR sender_id = auth.uid()
      ))
      -- Player whispers: only sender and target see
      OR (target_type = 'player' AND (
        sender_id = auth.uid()
        OR target_player_id = auth.uid()
        -- DMs can also see whispers
        OR EXISTS (
          SELECT 1 FROM campaign_members cm
          WHERE cm.campaign_id = messages.campaign_id
            AND cm.user_id = auth.uid()
            AND cm.role IN ('admin', 'dm')
        )
      ))
    )
  );

-- Campaign members can send messages
CREATE POLICY "Campaign members can send messages"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM campaign_members cm
      WHERE cm.campaign_id = messages.campaign_id
        AND cm.user_id = auth.uid()
    )
  );

-- Enable realtime
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add temp_hp column to characters
ALTER TABLE characters ADD COLUMN IF NOT EXISTS temp_hp INTEGER DEFAULT 0;
