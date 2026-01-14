-- Migration: Add class abilities support to abilities table
-- This allows class abilities to be stored in the database alongside custom abilities
-- Class abilities can be created, edited, and assigned to characters just like custom abilities

-- ============================================================
-- STEP 1: Add source and class columns to abilities table
-- ============================================================

-- Add source column to distinguish ability origin
ALTER TABLE abilities 
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'custom' 
    CHECK (source IN ('custom', 'class', 'item'));

-- Add class_name column for class abilities
ALTER TABLE abilities 
  ADD COLUMN IF NOT EXISTS class_name VARCHAR(50) DEFAULT NULL;

-- Add comments
COMMENT ON COLUMN abilities.source IS 'Where the ability comes from: custom (DM created), class (class feature), item (item-granted)';
COMMENT ON COLUMN abilities.class_name IS 'For class abilities, which class this ability belongs to (e.g., BRUISER, ICON)';

-- Create index for faster filtering by source
CREATE INDEX IF NOT EXISTS idx_abilities_source ON abilities(source);
CREATE INDEX IF NOT EXISTS idx_abilities_class_name ON abilities(class_name);

-- ============================================================
-- STEP 2: Seed existing class abilities from characterClasses.ts
-- These are the base class abilities that come with each class
-- ============================================================

-- BRUISER - OVERDRIVE
INSERT INTO abilities (name, description, type, charge_type, max_charges, charges_per_rest, effects, source, class_name)
VALUES (
  'OVERDRIVE',
  '1 Charge. For 3 rounds: deal +2 damage on melee hits and reduce incoming physical damage by 2.',
  'bonus_action',
  'long_rest',
  1,
  1,
  '["Deal +2 damage on melee hits", "Reduce incoming physical damage by 2", "Duration: 3 rounds"]',
  'class',
  'BRUISER'
) ON CONFLICT DO NOTHING;

-- ICON - SPOTLIGHT
INSERT INTO abilities (name, description, type, charge_type, max_charges, charges_per_rest, effects, source, class_name)
VALUES (
  'SPOTLIGHT',
  '1 Charge. Pick visible target. They make WIS save. Fail: Shaken for 2 rounds (-2 to attack rolls).',
  'action',
  'long_rest',
  1,
  1,
  '["Shaken for 2 rounds (-2 to attack rolls)"]',
  'class',
  'ICON'
) ON CONFLICT DO NOTHING;

-- HEXER - CURSE
INSERT INTO abilities (name, description, type, charge_type, max_charges, charges_per_rest, effects, source, class_name)
VALUES (
  'CURSE',
  '1 Charge. Mark target for 1 min. The first time each round you hit them, deal +1d8 extra damage (viral/rot).',
  'action',
  'long_rest',
  1,
  1,
  '["+1d8 extra damage per round"]',
  'class',
  'HEXER'
) ON CONFLICT DO NOTHING;

-- APOSTLE - PATCH
INSERT INTO abilities (name, description, type, charge_type, max_charges, charges_per_rest, effects, source, class_name)
VALUES (
  'PATCH',
  '1 Charge. Touch ally within 5 ft. They heal 1d6 + 4 HP and stop bleeding/ongoing damage.',
  'action',
  'long_rest',
  1,
  1,
  '["Heal 1d6+4 HP", "Stop bleeding"]',
  'class',
  'APOSTLE'
) ON CONFLICT DO NOTHING;

-- BIOHACK - ADAPT
INSERT INTO abilities (name, description, type, charge_type, max_charges, charges_per_rest, effects, source, class_name)
VALUES (
  'ADAPT',
  '1 Charge. Choose for 10 mins: Armor Skin (AC +2), Claws (melee hits +2 dmg), or Gills (ignore gas, Adv vs toxins).',
  'bonus_action',
  'long_rest',
  1,
  1,
  '["Armor Skin: AC +2", "Claws: melee +2 dmg", "Gills: ignore gas, Adv vs toxins"]',
  'class',
  'BIOHACK'
) ON CONFLICT DO NOTHING;

-- SOLO - MARK
INSERT INTO abilities (name, description, type, charge_type, max_charges, charges_per_rest, effects, source, class_name)
VALUES (
  'MARK',
  '1 Charge. Mark target (3 rds): 1. +2 to hit them 2. If they attack ally, Reaction to give -2 to attack.',
  'bonus_action',
  'long_rest',
  1,
  1,
  '["+2 to hit", "Reaction: -2 to their attack"]',
  'class',
  'SOLO'
) ON CONFLICT DO NOTHING;

-- STRIKER - FLOW
INSERT INTO abilities (name, description, type, charge_type, max_charges, charges_per_rest, effects, source, class_name)
VALUES (
  'FLOW',
  '1 Charge. This turn get +20 ft movement and make one extra Strike (1d8 damage) as a Bonus Action.',
  'bonus_action',
  'long_rest',
  1,
  1,
  '["+20 ft movement", "Extra 1d8 strike"]',
  'class',
  'STRIKER'
) ON CONFLICT DO NOTHING;

-- VOW - JUDGMENT
INSERT INTO abilities (name, description, type, charge_type, max_charges, charges_per_rest, effects, source, class_name)
VALUES (
  'JUDGMENT',
  '1 Charge. Add +1d10 extra damage. Target makes WIS save or is Frightened for 1 round (can''t move closer).',
  'action',
  'long_rest',
  1,
  1,
  '["+1d10 damage", "Frightened (WIS save)"]',
  'class',
  'VOW'
) ON CONFLICT DO NOTHING;

-- TRACKER - TRACE
INSERT INTO abilities (name, description, type, charge_type, max_charges, charges_per_rest, effects, source, class_name)
VALUES (
  'TRACE',
  '1 Charge. Mark target (24h). For 10 min: 1. +4 to track/spot them 2. First hit deals +1d8 damage',
  'action',
  'long_rest',
  1,
  1,
  '["+4 to track", "First hit +1d8 damage"]',
  'class',
  'TRACKER'
) ON CONFLICT DO NOTHING;

-- GHOST - AMBUSH
INSERT INTO abilities (name, description, type, charge_type, max_charges, charges_per_rest, effects, source, class_name)
VALUES (
  'AMBUSH',
  '1 Charge. If hit while hidden/surprise: add +1d8 damage, target DEX save. Fail: lose Reaction until next turn.',
  'action',
  'long_rest',
  1,
  1,
  '["+1d8 damage", "Remove reaction (DEX save)"]',
  'class',
  'GHOST'
) ON CONFLICT DO NOTHING;

-- SPARK - SURGE
INSERT INTO abilities (name, description, type, charge_type, max_charges, charges_per_rest, effects, source, class_name)
VALUES (
  'SURGE',
  '1 Charge. Choose one: Blast (ranged hit 1d10 dmg 30 ft), Push (target STR save or shoved 10 ft), Shield (gain AC +2 for 2 rounds)',
  'action',
  'long_rest',
  1,
  1,
  '["Blast: 1d10 dmg (30 ft)", "Push: 10 ft (STR save)", "Shield: AC +2 (2 rds)"]',
  'class',
  'SPARK'
) ON CONFLICT DO NOTHING;

-- PACT - BOON
INSERT INTO abilities (name, description, type, charge_type, max_charges, charges_per_rest, effects, source, class_name)
VALUES (
  'BOON',
  '1 Charge. Choose one: Curse (target -2 to saves for 2 rds), Buffer (8 temp HP for 10 min), Blink (teleport 15 ft to visible spot)',
  'action',
  'long_rest',
  1,
  1,
  '["Curse: -2 saves (2 rds)", "Buffer: 8 temp HP (10 min)", "Blink: teleport 15 ft"]',
  'class',
  'PACT'
) ON CONFLICT DO NOTHING;

-- CODER - OVERRIDE
INSERT INTO abilities (name, description, type, charge_type, max_charges, charges_per_rest, effects, source, class_name)
VALUES (
  'OVERRIDE',
  '1 Charge. Hack vs WIS save. Success choose (1 rd): Jam (no ranged weapons), Blind (-2 to hit), Shock (deal 1d8 damage)',
  'action',
  'long_rest',
  1,
  1,
  '["Jam: no ranged weapons", "Blind: -2 to hit", "Shock: 1d8 damage"]',
  'class',
  'CODER'
) ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 3: Verify migration
-- ============================================================
-- Run this to verify the class abilities were inserted:
-- SELECT name, class_name, source, type FROM abilities WHERE source = 'class' ORDER BY class_name;
