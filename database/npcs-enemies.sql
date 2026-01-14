-- NPCs and Enemies System for Cyberpunk TTRPG
-- Handles both friendly NPCs and hostile enemies with rich character details

-- Drop existing tables and types if they exist
DROP TABLE IF EXISTS npcs CASCADE;
DROP TYPE IF EXISTS npc_type CASCADE;
DROP TYPE IF EXISTS npc_disposition CASCADE;

-- NPC/Enemy type enum
CREATE TYPE npc_type AS ENUM (
  'Enemy',
  'Friendly NPC',
  'Neutral NPC',
  'Vendor',
  'Quest Giver',
  'Boss',
  'Mini-Boss',
  'Civilian'
);

-- NPC disposition (how they feel about the party)
CREATE TYPE npc_disposition AS ENUM (
  'Hostile',
  'Unfriendly',
  'Neutral',
  'Friendly',
  'Allied'
);

-- NPCs and Enemies table
CREATE TABLE npcs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic Info
  name VARCHAR(255) NOT NULL,
  type npc_type NOT NULL,
  disposition npc_disposition DEFAULT 'Neutral',
  description TEXT, -- Physical appearance and general description
  
  -- Combat Stats
  max_hp INTEGER NOT NULL DEFAULT 10,
  current_hp INTEGER NOT NULL DEFAULT 10,
  ac INTEGER NOT NULL DEFAULT 10, -- Armor Class
  
  -- Core Stats (same as player characters)
  str INTEGER DEFAULT 10,
  dex INTEGER DEFAULT 10,
  con INTEGER DEFAULT 10,
  wis INTEGER DEFAULT 10,
  int INTEGER DEFAULT 10,
  cha INTEGER DEFAULT 10,
  
  -- Roleplay Details
  unique_details TEXT, -- Special features, scars, cybernetics, clothing
  speech_pattern TEXT, -- How they talk (accent, slang, formal, etc.)
  mannerisms TEXT, -- Body language, habits, quirks
  
  -- Story/Plot Details
  current_problem TEXT, -- What's bothering them right now
  problem_involves TEXT, -- Who or what is related to their problem
  their_approach TEXT, -- How they handle situations (aggressive, cautious, diplomatic, etc.)
  secret TEXT, -- Hidden information they're keeping
  
  -- Quick Reference
  three_words VARCHAR(255), -- Three words to sum them up (e.g., "Gruff, Loyal, Paranoid")
  voice_direction TEXT, -- How to voice them (e.g., "Deep and gravelly, Brooklyn accent")
  remember_by TEXT, -- A memorable hook (e.g., "The guy with the chrome arm who owes you")
  
  -- Combat Abilities (JSONB for flexibility)
  abilities JSONB DEFAULT '[]', -- Array of {name, description, damage, effect}
  -- Example: [{"name": "Cyber Blade", "damage": "2d6", "effect": "On hit, target bleeds 1d4/round"}]
  
  -- Inventory/Loot (for enemies)
  drops_on_defeat JSONB DEFAULT '{"usd": 0, "items": []}', -- What they drop when defeated
  
  -- Location & Availability
  location_id UUID REFERENCES locations(id), -- Where they can be found
  is_alive BOOLEAN DEFAULT true, -- Have they been killed?
  is_active BOOLEAN DEFAULT true, -- Are they currently in play?
  
  -- DM Notes
  dm_notes TEXT, -- Private notes for the DM
  
  -- Metadata
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_npcs_type ON npcs(type);
CREATE INDEX idx_npcs_disposition ON npcs(disposition);
CREATE INDEX idx_npcs_location ON npcs(location_id);
CREATE INDEX idx_npcs_is_alive ON npcs(is_alive);
CREATE INDEX idx_npcs_is_active ON npcs(is_active);

-- Enable Row Level Security
ALTER TABLE npcs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for NPCs

-- Players can view active, alive NPCs (but not DM notes or secrets)
CREATE POLICY "Players view active NPCs"
  ON npcs
  FOR SELECT
  USING (is_active = true AND is_alive = true);

-- Admins can manage all NPCs
CREATE POLICY "Admins manage NPCs"
  ON npcs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Add comments
COMMENT ON TABLE npcs IS 'NPCs and enemies with combat stats and roleplay details';
COMMENT ON COLUMN npcs.type IS 'Category: Enemy, Friendly NPC, Neutral NPC, Vendor, Quest Giver, Boss, Mini-Boss, Civilian';
COMMENT ON COLUMN npcs.disposition IS 'How they feel about the party: Hostile, Unfriendly, Neutral, Friendly, Allied';
COMMENT ON COLUMN npcs.unique_details IS 'Physical features, scars, cybernetics, clothing, memorable appearance';
COMMENT ON COLUMN npcs.speech_pattern IS 'How they talk: accent, slang, formal, stutters, etc.';
COMMENT ON COLUMN npcs.mannerisms IS 'Body language, habits, quirks, nervous ticks';
COMMENT ON COLUMN npcs.current_problem IS 'What is bothering them or what they need';
COMMENT ON COLUMN npcs.problem_involves IS 'Who or what is related to their current problem';
COMMENT ON COLUMN npcs.their_approach IS 'How they handle situations: aggressive, cautious, diplomatic, sneaky, etc.';
COMMENT ON COLUMN npcs.secret IS 'Hidden information, lies they tell, what they are hiding';
COMMENT ON COLUMN npcs.three_words IS 'Three adjectives to describe them quickly';
COMMENT ON COLUMN npcs.voice_direction IS 'Voice acting guidance: tone, accent, pitch, etc.';
COMMENT ON COLUMN npcs.remember_by IS 'A memorable hook or identifier for quick recall';
COMMENT ON COLUMN npcs.abilities IS 'Combat abilities as JSONB array';
COMMENT ON COLUMN npcs.drops_on_defeat IS 'Loot dropped when defeated: {usd, items}';
COMMENT ON COLUMN npcs.is_alive IS 'False if permanently killed';
COMMENT ON COLUMN npcs.is_active IS 'False if retired from active play';

-- Sample NPC data
DO $$
DECLARE
  sample_location_id UUID;
BEGIN
  -- Get a sample location if available
  SELECT id INTO sample_location_id FROM locations LIMIT 1;
  
  -- Create a sample enemy
  INSERT INTO npcs (
    name,
    type,
    disposition,
    description,
    max_hp,
    current_hp,
    ac,
    str, dex, con, wis, int, cha,
    unique_details,
    speech_pattern,
    mannerisms,
    current_problem,
    problem_involves,
    their_approach,
    secret,
    three_words,
    voice_direction,
    remember_by,
    abilities,
    drops_on_defeat,
    location_id,
    dm_notes
  ) VALUES (
    'Razor Eddie',
    'Enemy',
    'Hostile',
    'A wiry street samurai with chrome mantis blades and a bad attitude. Scar tissue covers most of his visible skin.',
    45,
    45,
    14,
    12, 16, 14, 10, 8, 11,
    'Chrome mantis blades, burn scars on left side of face, always wearing a red bandana',
    'Short, clipped sentences. Lots of street slang. "Choom", "Nova", "Preem"',
    'Constantly flexing his blade fingers, never makes eye contact, spits when he talks',
    'His gang leader is holding his sister hostage to ensure loyalty',
    'Tyger Claws gang and his younger sister Maya',
    'Strike first, ask questions never. Pure aggression.',
    'He is secretly working with the NCPD to bring down his gang from the inside',
    'Violent, Conflicted, Desperate',
    'Raspy smoker voice, speaks fast, Brooklyn meets Neo-Tokyo',
    'The mantis blade guy with the red bandana and burn scars',
    '[
      {"name": "Mantis Blade Slash", "damage": "2d6+3", "effect": "On crit, target bleeds 1d6/round"},
      {"name": "Cyber Sprint", "damage": null, "effect": "Move 40ft as bonus action, cannot be opportunity attacked"}
    ]'::jsonb,
    '{"usd": 250, "items": ["Mantis Blade Shard", "Red Bandana"]}'::jsonb,
    sample_location_id,
    'Will surrender if party mentions his sister. Has intel on Tyger Claw safehouses.'
  );
  
  -- Create a sample friendly NPC
  INSERT INTO npcs (
    name,
    type,
    disposition,
    description,
    max_hp,
    current_hp,
    ac,
    str, dex, con, wis, int, cha,
    unique_details,
    speech_pattern,
    mannerisms,
    current_problem,
    problem_involves,
    their_approach,
    secret,
    three_words,
    voice_direction,
    remember_by,
    abilities,
    drops_on_defeat,
    location_id,
    dm_notes
  ) VALUES (
    'Doc Rivera',
    'Friendly NPC',
    'Friendly',
    'An elderly ripperdoc with steady hands despite her age. Wears old-fashioned glasses and keeps her gray hair in a tight bun.',
    20,
    20,
    12,
    8, 14, 12, 16, 15, 13,
    'Always wears surgical gloves, has a prosthetic right leg, small clinic filled with vintage medical posters',
    'Motherly but no-nonsense. Uses medical jargon. Calls everyone "dear" or "hon"',
    'Adjusts her glasses constantly, hums old songs while working, offers everyone tea',
    'A corpo hit squad is looking for one of her patients who stole sensitive data',
    'Arasaka Corporation and a netrunner patient named "Ghost"',
    'Protect her patients at all costs, even if it means lying to dangerous people',
    'She used to work for Militech and has access to their experimental cyberware specs',
    'Caring, Professional, Secretive',
    'Warm grandmother voice with a slight Spanish accent, soothing but firm',
    'The ripperdoc with the glasses who always offers tea',
    '[]'::jsonb,
    '{}'::jsonb,
    sample_location_id,
    'Will provide free healing to party if they protect Ghost. Can install rare cyberware at discount.'
  );
  
  -- Create a sample boss
  INSERT INTO npcs (
    name,
    type,
    disposition,
    description,
    max_hp,
    current_hp,
    ac,
    str, dex, con, wis, int, cha,
    unique_details,
    speech_pattern,
    mannerisms,
    current_problem,
    problem_involves,
    their_approach,
    secret,
    three_words,
    voice_direction,
    remember_by,
    abilities,
    drops_on_defeat,
    dm_notes
  ) VALUES (
    'Takashi "The Viper" Yamada',
    'Boss',
    'Hostile',
    'A Tyger Claw lieutenant draped in bioluminescent tattoos that pulse with his heartbeat. His cybernetic eyes glow gold.',
    120,
    120,
    16,
    14, 18, 16, 12, 14, 16,
    'Glowing gold cybereyes, full body tattoo that pulses with light, expensive designer suit, katana with monomolecular edge',
    'Speaks perfect English with no accent. Uses formal, poetic language. Quotes ancient texts.',
    'Perfectly still when not moving. Smiles coldly. Slowly unsheathes katana during conversation.',
    'Someone is killing his lieutenants one by one and he cannot figure out who',
    'A mysterious assassin and his own paranoid crew members',
    'Methodical and patient. Studies opponents. Strikes when they show weakness.',
    'He is dying from a cyberware rejection disease and has 6 months to live',
    'Honorable, Deadly, Doomed',
    'Smooth, cultured voice. Very calm. Think Mads Mikkelsen in Death Stranding.',
    'The Tyger Claw boss with glowing tattoos and gold eyes',
    '[
      {"name": "Monomolecular Slash", "damage": "4d8+4", "effect": "Ignores armor, on crit severs limb"},
      {"name": "Sandevistan Dash", "damage": null, "effect": "Take 3 actions this turn instead of 1"},
      {"name": "EMP Burst", "damage": "3d6", "effect": "All cyberware within 20ft shuts down for 1 round"}
    ]'::jsonb,
    '{"usd": 5000, "items": ["Monomolecular Katana", "Sandevistan Implant", "Encrypted Shard"]}'::jsonb,
    'Phase 2: At 50% HP, activates Sandevistan permanently (3 actions per turn). Phase 3: At 25% HP, tattoos explode with light (all within 30ft make DEX save or blinded).'
  );
END $$;
