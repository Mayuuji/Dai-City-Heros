-- UPDATE CHARACTER SCHEMA FOR CYBERPUNK RED SYSTEM
-- Run this in Supabase SQL Editor to add stats, skills, and class system

-- Drop the old characters table (WARNING: This deletes existing data!)
DROP TABLE IF EXISTS public.inventory CASCADE;
DROP TABLE IF EXISTS public.characters CASCADE;

-- Create new characters table with Cyberpunk RED stats
CREATE TABLE IF NOT EXISTS public.characters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  class TEXT NOT NULL, -- Bruiser, Icon, Hexer, Apostle, Biohack, Solo, Striker, Vow, Tracker, Ghost, Spark, Pact, Coder
  level INTEGER DEFAULT 1,
  
  -- Core Stats
  current_hp INTEGER DEFAULT 20,
  max_hp INTEGER DEFAULT 20,
  ac INTEGER DEFAULT 13,
  cdd TEXT DEFAULT 'd8', -- Combat Damage Die
  
  -- Ability Scores
  str INTEGER DEFAULT 10,
  dex INTEGER DEFAULT 10,
  con INTEGER DEFAULT 10,
  wis INTEGER DEFAULT 10,
  int INTEGER DEFAULT 10,
  cha INTEGER DEFAULT 10,
  
  -- Currency (USD instead of gold)
  usd INTEGER DEFAULT 0,
  
  -- Skills (18 skills, stored as proficiency bonus 0-5)
  skill_acrobatics INTEGER DEFAULT 0,
  skill_animal_handling INTEGER DEFAULT 0,
  skill_athletics INTEGER DEFAULT 0,
  skill_biology INTEGER DEFAULT 0,
  skill_deception INTEGER DEFAULT 0,
  skill_hacking INTEGER DEFAULT 0,
  skill_history INTEGER DEFAULT 0,
  skill_insight INTEGER DEFAULT 0,
  skill_intimidation INTEGER DEFAULT 0,
  skill_investigation INTEGER DEFAULT 0,
  skill_medicine INTEGER DEFAULT 0,
  skill_nature INTEGER DEFAULT 0,
  skill_perception INTEGER DEFAULT 0,
  skill_performance INTEGER DEFAULT 0,
  skill_persuasion INTEGER DEFAULT 0,
  skill_sleight_of_hand INTEGER DEFAULT 0,
  skill_stealth INTEGER DEFAULT 0,
  skill_survival INTEGER DEFAULT 0,
  
  -- Saving Throws (primary saves for the class)
  save_proficiencies TEXT[] DEFAULT '{}', -- e.g. ['STR', 'CON']
  
  -- Class Features
  class_features JSONB DEFAULT '[]', -- Array of {name, description, type, charges}
  tools TEXT[] DEFAULT '{}', -- e.g. ['DriverRig', 'GunsmithKit']
  
  -- 3D Model
  stl_model_url TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Characters
CREATE POLICY "Users can view their own characters"
  ON public.characters FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own characters"
  ON public.characters FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own characters"
  ON public.characters FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own characters"
  ON public.characters FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all characters"
  ON public.characters FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can update all characters"
  ON public.characters FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete all characters"
  ON public.characters FOR DELETE
  USING (public.is_admin());

-- Recreate inventory table
CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  equipped BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on inventory
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own inventory"
  ON public.inventory FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.characters
      WHERE characters.id = inventory.character_id
      AND characters.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own inventory"
  ON public.inventory FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.characters
      WHERE characters.id = inventory.character_id
      AND characters.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all inventory"
  ON public.inventory FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can manage all inventory"
  ON public.inventory FOR ALL
  USING (public.is_admin());

-- Create index for faster queries
CREATE INDEX idx_characters_user_id ON public.characters(user_id);
CREATE INDEX idx_inventory_character_id ON public.inventory(character_id);
