-- Enhanced Inventory and Abilities System
-- Items can have stat modifiers and grant abilities
-- Abilities can have infinite charges, or recharge on short/long rest

-- Drop existing tables if they exist (in reverse dependency order)
DROP TABLE IF EXISTS item_abilities CASCADE;
DROP TABLE IF EXISTS character_abilities CASCADE;
DROP TABLE IF EXISTS abilities CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS items CASCADE;

-- Items table with stat modifiers
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL, -- 'weapon', 'armor', 'consumable', 'cyberware', 'mission_item', 'item'
  rarity VARCHAR(50) DEFAULT 'Common', -- 'Common', 'Uncommon', 'Rare', 'Epic', 'Mythic', 'Ultra Rare', 'MISSION ITEM'
  price INTEGER DEFAULT 0, -- USD cost
  
  -- Stat modifiers (null = no modification)
  str_mod INTEGER DEFAULT 0,
  dex_mod INTEGER DEFAULT 0,
  con_mod INTEGER DEFAULT 0,
  wis_mod INTEGER DEFAULT 0,
  int_mod INTEGER DEFAULT 0,
  cha_mod INTEGER DEFAULT 0,
  
  hp_mod INTEGER DEFAULT 0,
  ac_mod INTEGER DEFAULT 0,
  
  -- Skill modifiers (stored as JSONB for flexibility)
  -- Example: {"Athletics": 2, "Hacking": 3}
  skill_mods JSONB DEFAULT '{}',
  
  -- Item properties
  is_consumable BOOLEAN DEFAULT false,
  is_equippable BOOLEAN DEFAULT true,
  stack_size INTEGER DEFAULT 1, -- How many can stack in one inventory slot
  
  -- Metadata
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  CONSTRAINT items_type_check CHECK (type IN ('weapon', 'armor', 'consumable', 'cyberware', 'mission_item', 'item'))
);

-- Abilities table (both class abilities and item-granted abilities)
CREATE TABLE abilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'action', 'bonus_action', 'reaction', 'passive', 'utility'
  
  -- Charge system
  charge_type VARCHAR(50) NOT NULL, -- 'infinite', 'short_rest', 'long_rest', 'uses'
  max_charges INTEGER DEFAULT 1, -- How many charges at full (null for infinite)
  charges_per_rest INTEGER DEFAULT NULL, -- How many charges restored per rest (for partial recharge)
  
  -- Effects (for display purposes)
  effects JSONB DEFAULT '[]', -- Array of effect strings
  
  -- Damage/healing info (optional)
  damage_dice VARCHAR(20), -- e.g., "2d6", "1d8+3"
  damage_type VARCHAR(50), -- e.g., "fire", "psychic", "healing"
  
  -- Range/area
  range_feet INTEGER,
  area_of_effect VARCHAR(100), -- e.g., "15ft cone", "30ft radius"
  duration VARCHAR(100), -- e.g., "1 minute", "Instantaneous", "1 hour"
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT abilities_charge_type_check CHECK (charge_type IN ('infinite', 'short_rest', 'long_rest', 'uses')),
  CONSTRAINT abilities_type_check CHECK (type IN ('action', 'bonus_action', 'reaction', 'passive', 'utility'))
);

-- Junction table: Items can grant abilities
CREATE TABLE item_abilities (
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  ability_id UUID REFERENCES abilities(id) ON DELETE CASCADE,
  
  -- Ability is granted while item is equipped (or consumed)
  requires_equipped BOOLEAN DEFAULT true,
  
  PRIMARY KEY (item_id, ability_id)
);

-- Inventory table (player items)
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  
  quantity INTEGER DEFAULT 1, -- For stackable items
  is_equipped BOOLEAN DEFAULT false,
  
  -- For consumables or items with limited uses
  current_uses INTEGER, -- null for non-consumable items
  
  acquired_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT inventory_quantity_positive CHECK (quantity > 0)
);

-- Character abilities (tracks current charges for abilities)
CREATE TABLE character_abilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  ability_id UUID NOT NULL REFERENCES abilities(id) ON DELETE CASCADE,
  
  current_charges INTEGER NOT NULL, -- Current charges remaining
  
  -- Source tracking (how did they get this ability?)
  source_type VARCHAR(50) NOT NULL, -- 'class', 'item', 'temporary'
  source_id UUID, -- Could be item_id or class feature identifier
  
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT character_abilities_charges_check CHECK (current_charges >= 0),
  CONSTRAINT character_abilities_source_check CHECK (source_type IN ('class', 'item', 'temporary')),
  
  UNIQUE (character_id, ability_id, source_type, source_id)
);

-- Indexes for performance
CREATE INDEX idx_items_type ON items(type);
CREATE INDEX idx_items_rarity ON items(rarity);
CREATE INDEX idx_inventory_character ON inventory(character_id);
CREATE INDEX idx_inventory_item ON inventory(item_id);
CREATE INDEX idx_inventory_equipped ON inventory(character_id, is_equipped);
CREATE INDEX idx_character_abilities_character ON character_abilities(character_id);
CREATE INDEX idx_character_abilities_ability ON character_abilities(ability_id);
CREATE INDEX idx_item_abilities_item ON item_abilities(item_id);

-- Row Level Security Policies

-- Items: Everyone can read, only admins can create/modify
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view items"
  ON items FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage items"
  ON items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  ));

-- Abilities: Everyone can read, only admins can create/modify
ALTER TABLE abilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view abilities"
  ON abilities FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage abilities"
  ON abilities FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  ));

-- Item Abilities: Everyone can read, only admins can modify
ALTER TABLE item_abilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view item abilities"
  ON item_abilities FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage item abilities"
  ON item_abilities FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  ));

-- Inventory: Users can only see/modify their own character's inventory
-- Admins can see/modify all inventories
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own inventory"
  ON inventory FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.id = inventory.character_id
      AND characters.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can modify own inventory"
  ON inventory FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.id = inventory.character_id
      AND characters.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own inventory"
  ON inventory FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.id = inventory.character_id
      AND characters.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own inventory"
  ON inventory FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.id = inventory.character_id
      AND characters.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all inventory"
  ON inventory FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  ));

-- Character Abilities: Users can view/use their own abilities
-- Admins can manage all
ALTER TABLE character_abilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own abilities"
  ON character_abilities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.id = character_abilities.character_id
      AND characters.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can use own abilities"
  ON character_abilities FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.id = character_abilities.character_id
      AND characters.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all character abilities"
  ON character_abilities FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  ));

-- Sample Items
INSERT INTO items (name, description, type, rarity, price, str_mod, ac_mod, is_consumable) VALUES
  ('Reinforced Kevlar Vest', 'Military-grade armor plating. Adds +3 AC.', 'armor', 'Uncommon', 500, 0, 3, false),
  ('Cybernetic Strength Enhancer', 'Increases STR by +2.', 'cyberware', 'Rare', 1200, 2, 0, false),
  ('Stim Pack', 'Restores 2d6+2 HP instantly.', 'consumable', 'Common', 50, 0, 0, true),
  ('Neural Interface Headset', 'Grants +3 to Hacking skill.', 'cyberware', 'Uncommon', 800, 0, 0, false);

-- Update the Neural Interface with skill modifier
UPDATE items 
SET skill_mods = '{"Hacking": 3}'::jsonb
WHERE name = 'Neural Interface Headset';

-- Sample Abilities
INSERT INTO abilities (name, description, type, charge_type, max_charges, effects) VALUES
  ('Second Wind', 'Recover 1d10 + level HP as a bonus action.', 'bonus_action', 'short_rest', 1, '["Healing: 1d10 + level"]'),
  ('Action Surge', 'Take an additional action on your turn.', 'bonus_action', 'short_rest', 1, '["Gain 1 extra action"]'),
  ('Healing Hands', 'Touch a creature to restore 2d8 HP.', 'action', 'long_rest', 3, '["Healing: 2d8 HP"]'),
  ('Fireball', 'Launch a ball of fire dealing 8d6 damage in 20ft radius.', 'action', 'long_rest', 2, '["Damage: 8d6 fire", "Area: 20ft radius", "DEX save for half"]'),
  ('Sprint Boost', 'Double your movement speed this turn.', 'bonus_action', 'infinite', NULL, '["Movement: x2"]');

-- Link the Sprint Boost ability to an item (we'll create the item)
INSERT INTO items (name, description, type, rarity, price, dex_mod, is_consumable) VALUES
  ('Turbo Leg Implants', 'Cybernetic leg enhancements. +1 DEX and grants Sprint Boost ability.', 'cyberware', 'Rare', 1500, 1, false);

-- Link ability to item
INSERT INTO item_abilities (item_id, ability_id, requires_equipped) 
SELECT 
  (SELECT id FROM items WHERE name = 'Turbo Leg Implants'),
  (SELECT id FROM abilities WHERE name = 'Sprint Boost'),
  true;

-- Comments for documentation
COMMENT ON TABLE items IS 'All items in the game that can be owned by characters';
COMMENT ON TABLE abilities IS 'All abilities that characters can have, from class features or items';
COMMENT ON TABLE inventory IS 'Junction table linking characters to items they own';
COMMENT ON TABLE character_abilities IS 'Tracks current charges for each ability a character has';
COMMENT ON TABLE item_abilities IS 'Junction table linking items to abilities they grant';
COMMENT ON COLUMN abilities.charge_type IS 'infinite: no limit, short_rest: recharges on short rest, long_rest: recharges on long rest, uses: limited total uses';
COMMENT ON COLUMN items.skill_mods IS 'JSONB object with skill names as keys and modifier values';
