-- Phase 4: Equipment Slots Migration
-- Adds equipment slot system + weapon modifications + portrait

-- Add equipment slot to inventory (which slot is this item equipped in?)
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS equipped_slot TEXT 
  CHECK (equipped_slot IN (
    'head', 'chest', 'legs', 'eyewear', 'gloves', 'shoes', 
    'accessory_1', 'accessory_2',
    'weapon_primary', 'weapon_secondary'
  ));

-- Add equipment slot type to items (what slot can this item go in?)
ALTER TABLE items ADD COLUMN IF NOT EXISTS slot_type TEXT 
  CHECK (slot_type IN (
    'head', 'chest', 'legs', 'eyewear', 'gloves', 'shoes', 
    'accessory', 'weapon', 'backpack', 'weapon_mod'
  ));

-- Weapon modifications table
CREATE TABLE IF NOT EXISTS weapon_modifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id),
  inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE, 
  mod_item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  slot_order INTEGER DEFAULT 1,
  attached_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(inventory_id, mod_item_id)
);

ALTER TABLE weapon_modifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weapon_mods_all" ON weapon_modifications FOR ALL USING (true) WITH CHECK (true);

-- Character portrait/model image
ALTER TABLE characters ADD COLUMN IF NOT EXISTS portrait_url TEXT;
