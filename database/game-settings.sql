-- =====================================================
-- GAME SETTINGS TABLE
-- =====================================================
-- Global game settings that the DM can control
-- This includes player lock state for encounters

-- Create game_settings table
CREATE TABLE IF NOT EXISTS game_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Insert default settings
INSERT INTO game_settings (key, value) VALUES
  ('players_locked', '{"locked": false, "reason": null}')
ON CONFLICT (key) DO NOTHING;

-- Enable RLS
ALTER TABLE game_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read game settings
CREATE POLICY "Everyone can view game settings"
  ON game_settings FOR SELECT
  USING (true);

-- Only admins can update game settings
CREATE POLICY "Only admins can update game settings"
  ON game_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Only admins can insert game settings"
  ON game_settings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_game_settings_key ON game_settings(key);

-- Function to toggle player lock
CREATE OR REPLACE FUNCTION toggle_players_locked(
  is_locked BOOLEAN,
  lock_reason TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE game_settings
  SET 
    value = jsonb_build_object('locked', is_locked, 'reason', lock_reason),
    updated_at = NOW(),
    updated_by = auth.uid()
  WHERE key = 'players_locked';
  
  -- Insert if not exists
  IF NOT FOUND THEN
    INSERT INTO game_settings (key, value, updated_by)
    VALUES ('players_locked', jsonb_build_object('locked', is_locked, 'reason', lock_reason), auth.uid());
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION toggle_players_locked(BOOLEAN, TEXT) TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================
SELECT * FROM game_settings;
