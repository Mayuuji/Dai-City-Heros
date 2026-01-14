-- =====================================================
-- CYBERPUNK TTRPG DATABASE SCHEMA
-- =====================================================
-- Run this SQL in your Supabase SQL Editor
-- This will create all tables and Row Level Security policies

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. PROFILES TABLE
-- =====================================================
-- Extends auth.users with role and username
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- 2. CHARACTERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.characters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  class TEXT,
  level INTEGER DEFAULT 1,
  
  -- Core Stats (JSONB for flexibility)
  stats JSONB DEFAULT '{
    "strength": 10,
    "dexterity": 10,
    "intelligence": 10,
    "constitution": 10,
    "wisdom": 10,
    "charisma": 10
  }'::jsonb,
  
  -- Health and Resources
  current_hp INTEGER DEFAULT 100,
  max_hp INTEGER DEFAULT 100,
  gold INTEGER DEFAULT 0,
  
  -- 3D Model
  stl_url TEXT,
  
  -- Inventory Management
  inventory_slots INTEGER DEFAULT 20,
  
  -- Position on battle map (nullable until placed)
  battle_position_x INTEGER,
  battle_position_y INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS characters_user_id_idx ON public.characters(user_id);

-- RLS Policies for characters
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own characters"
  ON public.characters FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own characters"
  ON public.characters FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own characters"
  ON public.characters FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all characters"
  ON public.characters FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update all characters"
  ON public.characters FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete characters"
  ON public.characters FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- 3. ITEMS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  item_type TEXT NOT NULL CHECK (item_type IN ('consumable', 'weapon', 'armor', 'accessory', 'quest')),
  
  -- Stat modifiers when equipped (JSONB)
  stat_modifiers JSONB DEFAULT '{}'::jsonb,
  -- Example: {"strength": 2, "dexterity": -1, "max_hp": 10}
  
  -- Cost in gold
  cost INTEGER DEFAULT 0,
  
  -- Rarity/tier
  rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  
  -- Can it be equipped or only consumed?
  is_equippable BOOLEAN DEFAULT false,
  is_consumable BOOLEAN DEFAULT false,
  
  -- Effect description for consumables
  consumable_effect TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies for items
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view items"
  ON public.items FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert items"
  ON public.items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update items"
  ON public.items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete items"
  ON public.items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- 4. INVENTORY TABLE
-- =====================================================
-- Links characters to items
CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  
  quantity INTEGER DEFAULT 1,
  is_equipped BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Prevent duplicate entries for the same item
  UNIQUE(character_id, item_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS inventory_character_id_idx ON public.inventory(character_id);
CREATE INDEX IF NOT EXISTS inventory_item_id_idx ON public.inventory(item_id);

-- RLS Policies for inventory
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their character's inventory"
  ON public.inventory FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.characters
      WHERE id = inventory.character_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their character's inventory"
  ON public.inventory FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.characters
      WHERE id = inventory.character_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all inventory"
  ON public.inventory FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can manage all inventory"
  ON public.inventory FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- 5. LOCATIONS TABLE
-- =====================================================
-- Map markers and shops
CREATE TABLE IF NOT EXISTS public.locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  
  -- Coordinates on the custom map (CRS.Simple)
  map_x FLOAT NOT NULL,
  map_y FLOAT NOT NULL,
  
  -- Location type
  location_type TEXT DEFAULT 'poi' CHECK (location_type IN ('poi', 'shop', 'quest', 'danger')),
  
  -- If it's a shop, which items are available? (Array of item IDs)
  shop_inventory UUID[],
  
  -- Is this location currently visible to players?
  is_visible BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies for locations
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view visible locations"
  ON public.locations FOR SELECT
  USING (is_visible = true);

CREATE POLICY "Admins can view all locations"
  ON public.locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can manage locations"
  ON public.locations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- 6. MISSIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.missions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  
  -- Mission status
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'active', 'completed', 'failed')),
  
  -- Rewards (JSONB for flexibility)
  rewards JSONB DEFAULT '{
    "gold": 0,
    "experience": 0,
    "items": []
  }'::jsonb,
  
  -- Which character(s) accepted this mission
  assigned_character_ids UUID[],
  
  -- DM notes (not visible to players)
  dm_notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies for missions
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view non-DM mission content"
  ON public.missions FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage missions"
  ON public.missions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- 7. ENCOUNTERS TABLE
-- =====================================================
-- DM-only table for managing combat encounters
CREATE TABLE IF NOT EXISTS public.encounters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  
  -- List of enemies (JSONB)
  enemy_list JSONB DEFAULT '[]'::jsonb,
  -- Example: [{"name": "CyberThug", "hp": 30, "ac": 12, "position": [5, 5]}]
  
  -- Is this encounter currently active?
  is_active BOOLEAN DEFAULT false,
  
  -- DM's private notes
  dm_notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies for encounters (DM only)
ALTER TABLE public.encounters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view encounters"
  ON public.encounters FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can manage encounters"
  ON public.encounters FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- 8. SESSION_NOTES TABLE
-- =====================================================
-- DM's session notes
CREATE TABLE IF NOT EXISTS public.session_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_title TEXT,
  notes TEXT,
  session_date DATE DEFAULT CURRENT_DATE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies for session_notes (DM only)
ALTER TABLE public.session_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can manage session notes"
  ON public.session_notes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_characters_updated_at BEFORE UPDATE ON public.characters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_missions_updated_at BEFORE UPDATE ON public.missions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_encounters_updated_at BEFORE UPDATE ON public.encounters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_session_notes_updated_at BEFORE UPDATE ON public.session_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- FUNCTION: Auto-create profile on user signup
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
    'player'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- STORAGE BUCKETS (Run separately or via Dashboard)
-- =====================================================
-- You'll need to create these buckets in the Supabase Dashboard:
-- 1. 'stl-models' - for character STL files
-- 2. 'map-images' - for custom world map images

-- Storage policies example (adjust as needed):
-- 
-- INSERT POLICY for stl-models:
-- Allow authenticated users to upload
-- 
-- SELECT POLICY for stl-models:
-- Allow authenticated users to view
--
-- Same for map-images bucket

-- =====================================================
-- SEED DATA (Optional)
-- =====================================================
-- Insert some starter items

INSERT INTO public.items (name, description, item_type, stat_modifiers, cost, rarity, is_equippable, is_consumable) VALUES
  ('Neural Stim Pack', 'Restores 50 HP instantly', 'consumable', '{"healing": 50}'::jsonb, 25, 'common', false, true),
  ('Plasma Blade', 'A glowing energy sword', 'weapon', '{"strength": 3, "dexterity": 1}'::jsonb, 200, 'uncommon', true, false),
  ('Kevlar Vest', 'Basic body armor', 'armor', '{"constitution": 2, "max_hp": 15}'::jsonb, 150, 'common', true, false),
  ('Cyberware Implant', 'Increases reflex speed', 'accessory', '{"dexterity": 4, "intelligence": 1}'::jsonb, 500, 'rare', true, false),
  ('Data Chip', 'Contains encrypted mission data', 'quest', '{}'::jsonb, 0, 'common', false, false);

-- =====================================================
-- COMPLETE! 
-- =====================================================
-- Your database is now ready. Next steps:
-- 1. Add your Supabase URL and anon key to .env
-- 2. Create storage buckets for 'stl-models' and 'map-images'
-- 3. Set up storage policies for authenticated access
