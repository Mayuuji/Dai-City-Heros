-- Phase 1: Weapon To-Hit & Damage System
-- Adds structured combat stats to weapons: to-hit modifier and damage formula

-- To-hit modifier type: static flat bonus, or based on a stat/skill/custom modifier
ALTER TABLE items ADD COLUMN IF NOT EXISTS to_hit_type TEXT DEFAULT 'static'
  CHECK (to_hit_type IN ('static', 'stat', 'skill', 'modifier'));
ALTER TABLE items ADD COLUMN IF NOT EXISTS to_hit_static INTEGER DEFAULT 0;
ALTER TABLE items ADD COLUMN IF NOT EXISTS to_hit_reference TEXT;
  -- References a stat name (e.g. 'DEX'), a skill name (e.g. 'Hacking'),
  -- or a custom modifier key. NULL if to_hit_type = 'static'.

-- Damage formula: dice notation + static bonus + optional stat/skill/modifier bonus
ALTER TABLE items ADD COLUMN IF NOT EXISTS damage_dice TEXT;
  -- Dice notation string, e.g. '2d6', '1d8', '3d4'
ALTER TABLE items ADD COLUMN IF NOT EXISTS damage_static_bonus INTEGER DEFAULT 0;
  -- Static additive bonus, e.g. +4
ALTER TABLE items ADD COLUMN IF NOT EXISTS damage_bonus_type TEXT DEFAULT 'none'
  CHECK (damage_bonus_type IN ('none', 'stat', 'skill', 'modifier'));
ALTER TABLE items ADD COLUMN IF NOT EXISTS damage_bonus_reference TEXT;
  -- Same logic as to_hit_reference. NULL if damage_bonus_type = 'none'.
ALTER TABLE items ADD COLUMN IF NOT EXISTS damage_type TEXT;
  -- Damage type label, e.g. 'slashing', 'fire', 'piercing', 'energy'
