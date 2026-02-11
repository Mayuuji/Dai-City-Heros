-- World Map and Locations System
-- DM can create locations with lore, set map bounds, control visibility
-- Players can view locations within DM-defined bounds

-- Drop existing tables to ensure clean slate
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS map_settings CASCADE;

-- Map Settings (stores DM configuration)
CREATE TABLE map_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- View bounds (southwest and northeast corners)
  min_lat DECIMAL(10, 7) NOT NULL DEFAULT -90,
  min_lng DECIMAL(10, 7) NOT NULL DEFAULT -180,
  max_lat DECIMAL(10, 7) NOT NULL DEFAULT 90,
  max_lng DECIMAL(10, 7) NOT NULL DEFAULT 180,
  
  -- Zoom restrictions
  min_zoom INTEGER NOT NULL DEFAULT 3,
  max_zoom INTEGER NOT NULL DEFAULT 18,
  default_zoom INTEGER NOT NULL DEFAULT 6,
  
  -- Initial center view
  center_lat DECIMAL(10, 7) NOT NULL DEFAULT 0,
  center_lng DECIMAL(10, 7) NOT NULL DEFAULT 0,
  
  -- Lock player view to bounds
  lock_bounds BOOLEAN DEFAULT true,
  
  -- Custom tile layer URL (for custom map tiles)
  tile_url TEXT DEFAULT 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
  tile_attribution TEXT DEFAULT '&copy; CartoDB',
  
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Only one settings row should exist
  CONSTRAINT only_one_setting CHECK (id = '00000000-0000-0000-0000-000000000001'::uuid)
);

-- Locations table
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic info
  name VARCHAR(255) NOT NULL,
  description TEXT,
  lore TEXT, -- Extended lore/backstory
  
  -- Position on map
  lat DECIMAL(10, 7) NOT NULL,
  lng DECIMAL(10, 7) NOT NULL,
  
  -- Visual
  icon VARCHAR(50) DEFAULT 'marker', -- 'marker', 'city', 'dungeon', 'shop', 'quest', 'danger'
  color VARCHAR(20) DEFAULT 'cyan', -- 'cyan', 'purple', 'pink', 'green', 'orange', 'red'
  
  -- Tags for filtering
  tags TEXT[] DEFAULT '{}', -- Array of tags like ['city', 'shop', 'quest']
  
  -- Visibility
  is_visible BOOLEAN DEFAULT true, -- Can players see this location?
  is_discovered BOOLEAN DEFAULT false, -- Has party discovered this?
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT locations_lat_check CHECK (lat >= -90 AND lat <= 90),
  CONSTRAINT locations_lng_check CHECK (lng >= -180 AND lng <= 180),
  CONSTRAINT locations_icon_check CHECK (icon IN ('marker', 'city', 'dungeon', 'shop', 'quest', 'danger', 'safe-zone', 'region')),
  CONSTRAINT locations_color_check CHECK (color IN ('cyan', 'purple', 'pink', 'green', 'orange', 'red', 'blue', 'yellow'))
);

-- Indexes
CREATE INDEX idx_locations_visible ON locations(is_visible);
CREATE INDEX idx_locations_discovered ON locations(is_discovered);
CREATE INDEX idx_locations_tags ON locations USING GIN(tags);

-- Row Level Security

-- Map Settings: Everyone can read, only admins can modify
ALTER TABLE map_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view map settings"
  ON map_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage map settings"
  ON map_settings FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  ));

-- Locations: Everyone can read visible locations, only admins can manage
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view visible locations"
  ON locations FOR SELECT
  USING (is_visible = true OR EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  ));

CREATE POLICY "Admins can manage locations"
  ON locations FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  ));

-- Insert default map settings
INSERT INTO map_settings (
  id,
  min_lat, min_lng, max_lat, max_lng,
  min_zoom, max_zoom, default_zoom,
  center_lat, center_lng,
  lock_bounds,
  tile_url,
  tile_attribution
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  -60, -120, 60, 120,
  3, 18, 6,
  0, 0,
  true,
  'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
  '&copy; CartoDB'
) ON CONFLICT (id) DO NOTHING;

-- Sample locations (cyberpunk themed)
INSERT INTO locations (name, description, lore, lat, lng, icon, color, tags, is_visible, is_discovered) VALUES
  (
    'Neo Tokyo Central',
    'The sprawling megacity at the heart of the region. Neon lights, towering skyscrapers, and endless streets.',
    'Founded in 2045 after the Great Collapse, Neo Tokyo became the center of corporate power. The city never sleeps, powered by fusion reactors deep beneath the surface. Three mega-corporations control different districts: Arasaka Tower (West), Militech Complex (North), and NetWatch Citadel (East).',
    35.6762, 139.6503,
    'city',
    'cyan',
    ARRAY['city', 'corporate', 'major'],
    true,
    true
  ),
  (
    'The Undercity',
    'Dark tunnels beneath Neo Tokyo where the forgotten dwell. Dangerous but full of opportunities.',
    'When the city expanded upward, the lower levels were abandoned. Now it serves as home to those rejected by the surface world. Black markets thrive here, and the corporate security rarely ventures down. Rumors speak of old tech buried in the deepest levels, remnants of the world before.',
    35.6585, 139.7454,
    'dungeon',
    'red',
    ARRAY['dangerous', 'underground', 'black-market'],
    true,
    true
  ),
  (
    'Chrome Street Market',
    'The premier destination for cyberware and illicit upgrades. No questions asked.',
    'Operated by the Crimson Syndicate, this market has everything a runner needs. Military-grade implants, banned software, stolen corporate secrets. The Syndicate maintains a neutral zone - no violence inside the market. Outside? You''re on your own.',
    35.6895, 139.6917,
    'shop',
    'purple',
    ARRAY['shop', 'cyberware', 'black-market'],
    true,
    false
  ),
  (
    'Arasaka Tower',
    'Corporate headquarters of the Arasaka Corporation. Heavily guarded, impenetrable.',
    'The tallest structure in Neo Tokyo, Arasaka Tower reaches 2.5km into the sky. The top floors are CEO Yorinobu Arasaka''s domain. The building is a fortress - automated turrets, elite security, and netrunner countermeasures on every level. Many have tried to breach it. None have succeeded.',
    35.6812, 139.7671,
    'danger',
    'red',
    ARRAY['corporate', 'dangerous', 'restricted'],
    true,
    false
  ),
  (
    'The Neon Garden',
    'A rare green space in the concrete jungle. Surprisingly peaceful.',
    'Created by environmental activists in 2052, the Neon Garden uses hydroponic technology to maintain real plants in the polluted city. It''s become a meeting place for netrunners and fixers - neutral ground where deals are made. The garden''s creator, Dr. Yuki Tanaka, still tends it personally.',
    35.6950, 139.7142,
    'safe-zone',
    'green',
    ARRAY['safe', 'meeting-point', 'neutral'],
    true,
    false
  ),
  (
    'Data Fortress Alpha',
    'A mysterious structure in the outer districts. Purpose unknown.',
    'This location appears on no official maps. Satellites show only static. Those who investigate never return. Netrunners who try to scan it report their systems crashing instantly. Some say it''s a rogue AI. Others claim it''s a gateway to the Old Net. The corporations pretend it doesn''t exist.',
    35.7450, 139.6200,
    'quest',
    'pink',
    ARRAY['mysterious', 'dangerous', 'quest'],
    false,
    false
  );

-- Comments
COMMENT ON TABLE map_settings IS 'Configuration for the world map view and restrictions';
COMMENT ON TABLE locations IS 'Points of interest on the world map';
COMMENT ON COLUMN map_settings.lock_bounds IS 'If true, players cannot pan outside the defined bounds';
COMMENT ON COLUMN locations.is_visible IS 'Can players see this location on the map?';
COMMENT ON COLUMN locations.is_discovered IS 'Has the party discovered this location yet?';
COMMENT ON COLUMN locations.tags IS 'Array of tags for filtering (e.g., city, shop, quest)';
