-- =====================================================
-- LANDING PAGE SETTINGS
-- =====================================================
-- Adds configurable landing page subtitle

-- Insert default landing subtitle setting
INSERT INTO game_settings (key, value) VALUES
  ('landing_subtitle', '{"text": "ENTER THE NEON SHADOWS"}')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- VERIFICATION
-- =====================================================
SELECT * FROM game_settings WHERE key = 'landing_subtitle';
