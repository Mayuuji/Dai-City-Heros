-- Game Effects table for DM-controlled screen effects on player clients
-- Uses Supabase Realtime to push effects to players in real-time

CREATE TABLE IF NOT EXISTS game_effects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  effect_type TEXT NOT NULL, -- 'blackout', 'flash', 'glitch', 'media', 'clear'
  target_type TEXT NOT NULL DEFAULT 'all', -- 'all' or 'select'
  target_character_ids TEXT[] DEFAULT '{}', -- specific character IDs if target_type='select'
  display_mode TEXT DEFAULT 'fullscreen', -- 'fullscreen' or 'popup'
  
  -- Media projection fields
  media_url TEXT, -- URL to image or video
  media_type TEXT, -- 'image' or 'video'
  
  -- Flash effect fields
  flash_interval_ms INTEGER DEFAULT 200, -- milliseconds between flashes
  flash_duration_s INTEGER DEFAULT 5, -- legacy, not used (flash is toggle-based now)
  
  -- General
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE game_effects ENABLE ROW LEVEL SECURITY;

-- Admin (DM) can do anything
CREATE POLICY "Admin full access on game_effects" ON game_effects
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Players can read all effects (need to see DELETE events via realtime)
CREATE POLICY "Players can read effects" ON game_effects
  FOR SELECT USING (true);

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE game_effects;

-- ============================================================
-- Storage bucket for DM media uploads (images/videos)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('effect-media', 'effect-media', true)
ON CONFLICT (id) DO NOTHING;

-- Admin can upload to the bucket
CREATE POLICY "Admin upload effect media" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'effect-media'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Admin can delete from the bucket
CREATE POLICY "Admin delete effect media" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'effect-media'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Anyone authenticated can read from the bucket (public bucket anyway)
CREATE POLICY "Public read effect media" ON storage.objects
  FOR SELECT USING (bucket_id = 'effect-media');
