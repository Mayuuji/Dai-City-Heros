-- =====================================================
-- CHARACTER STATS MIGRATION
-- =====================================================
-- Adds speed, initiative_modifier, and implant_capacity to characters
-- Also adds corresponding modifiers to items table
-- Run this in your Supabase SQL Editor

-- =====================================================
-- STEP 1: Add new columns to characters table
-- =====================================================
ALTER TABLE characters
ADD COLUMN IF NOT EXISTS speed INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS initiative_modifier INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS implant_capacity INTEGER DEFAULT 3;

COMMENT ON COLUMN characters.speed IS 'Base movement speed in feet';
COMMENT ON COLUMN characters.initiative_modifier IS 'Bonus to initiative rolls';
COMMENT ON COLUMN characters.implant_capacity IS 'Maximum number of cyberware implant slots';

-- =====================================================
-- STEP 1B: Add weapon proficiency ranks to characters
-- =====================================================
-- Rank 0 = Not proficient (-2 to hit)
-- Rank 1-5 = Proficient (+0 to +4 to hit)
ALTER TABLE characters
ADD COLUMN IF NOT EXISTS weapon_rank_unarmed INTEGER DEFAULT 0 CHECK (weapon_rank_unarmed >= 0 AND weapon_rank_unarmed <= 5),
ADD COLUMN IF NOT EXISTS weapon_rank_melee INTEGER DEFAULT 0 CHECK (weapon_rank_melee >= 0 AND weapon_rank_melee <= 5),
ADD COLUMN IF NOT EXISTS weapon_rank_sidearms INTEGER DEFAULT 0 CHECK (weapon_rank_sidearms >= 0 AND weapon_rank_sidearms <= 5),
ADD COLUMN IF NOT EXISTS weapon_rank_longarms INTEGER DEFAULT 0 CHECK (weapon_rank_longarms >= 0 AND weapon_rank_longarms <= 5),
ADD COLUMN IF NOT EXISTS weapon_rank_heavy INTEGER DEFAULT 0 CHECK (weapon_rank_heavy >= 0 AND weapon_rank_heavy <= 5);

COMMENT ON COLUMN characters.weapon_rank_unarmed IS 'Proficiency rank for unarmed weapons (0-5)';
COMMENT ON COLUMN characters.weapon_rank_melee IS 'Proficiency rank for melee weapons (0-5)';
COMMENT ON COLUMN characters.weapon_rank_sidearms IS 'Proficiency rank for sidearms (0-5)';
COMMENT ON COLUMN characters.weapon_rank_longarms IS 'Proficiency rank for longarms (0-5)';
COMMENT ON COLUMN characters.weapon_rank_heavy IS 'Proficiency rank for heavy weapons (0-5)';

-- =====================================================
-- STEP 2: Add modifier columns to items table
-- =====================================================
ALTER TABLE items
ADD COLUMN IF NOT EXISTS speed_mod INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS init_mod INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ic_mod INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS hp_mod_type TEXT DEFAULT 'heal' CHECK (hp_mod_type IN ('heal', 'max_hp')),
ADD COLUMN IF NOT EXISTS armor_subtype TEXT CHECK (armor_subtype IN ('clothes', 'light', 'medium', 'heavy', 'shield')),
ADD COLUMN IF NOT EXISTS weapon_subtype TEXT CHECK (weapon_subtype IN ('unarmed', 'melee', 'sidearms', 'longarms', 'heavy')),
ADD COLUMN IF NOT EXISTS ic_cost INTEGER DEFAULT 0;

COMMENT ON COLUMN items.speed_mod IS 'Modifier to movement speed when equipped';
COMMENT ON COLUMN items.init_mod IS 'Modifier to initiative when equipped';
COMMENT ON COLUMN items.ic_mod IS 'Modifier to implant capacity when equipped';
COMMENT ON COLUMN items.hp_mod_type IS 'For consumables: heal restores HP, max_hp permanently increases max HP';
COMMENT ON COLUMN items.armor_subtype IS 'Armor type: clothes, light, medium, heavy, shield';
COMMENT ON COLUMN items.weapon_subtype IS 'Weapon type: unarmed, melee, sidearms, longarms, heavy';
COMMENT ON COLUMN items.ic_cost IS 'Implant capacity cost for cyberware';

-- =====================================================
-- STEP 3: Update existing characters with class-based defaults
-- =====================================================
-- Bruiser: 25 ft, +0, IC 6
UPDATE characters SET speed = 25, initiative_modifier = 0, implant_capacity = 6
WHERE class = 'bruiser' AND speed = 30 AND initiative_modifier = 0 AND implant_capacity = 3;

-- Icon: 30 ft, +1, IC 3
UPDATE characters SET speed = 30, initiative_modifier = 1, implant_capacity = 3
WHERE class = 'icon' AND initiative_modifier = 0;

-- Hexer: 30 ft, +1, IC 4
UPDATE characters SET speed = 30, initiative_modifier = 1, implant_capacity = 4
WHERE class = 'hexer' AND initiative_modifier = 0;

-- Apostle: 30 ft, +0, IC 2
UPDATE characters SET speed = 30, initiative_modifier = 0, implant_capacity = 2
WHERE class = 'apostle' AND implant_capacity = 3;

-- Biohack: 30 ft, +0, IC 4
UPDATE characters SET speed = 30, initiative_modifier = 0, implant_capacity = 4
WHERE class = 'biohack' AND implant_capacity = 3;

-- Solo: 30 ft, +1, IC 5
UPDATE characters SET speed = 30, initiative_modifier = 1, implant_capacity = 5
WHERE class = 'solo' AND initiative_modifier = 0;

-- Striker: 35 ft, +2, IC 3
UPDATE characters SET speed = 35, initiative_modifier = 2, implant_capacity = 3
WHERE class = 'striker' AND speed = 30;

-- Vow: 25 ft, +0, IC 5
UPDATE characters SET speed = 25, initiative_modifier = 0, implant_capacity = 5
WHERE class = 'vow' AND speed = 30;

-- Tracker: 30 ft, +1, IC 4
UPDATE characters SET speed = 30, initiative_modifier = 1, implant_capacity = 4
WHERE class = 'tracker' AND initiative_modifier = 0;

-- Ghost: 35 ft, +2, IC 3
UPDATE characters SET speed = 35, initiative_modifier = 2, implant_capacity = 3
WHERE class = 'ghost' AND speed = 30;

-- Spark: 30 ft, +1, IC 3
UPDATE characters SET speed = 30, initiative_modifier = 1, implant_capacity = 3
WHERE class = 'spark' AND initiative_modifier = 0;

-- Pact: 30 ft, +1, IC 3
UPDATE characters SET speed = 30, initiative_modifier = 1, implant_capacity = 3
WHERE class = 'pact' AND initiative_modifier = 0;

-- Coder: 30 ft, +0, IC 2
UPDATE characters SET speed = 30, initiative_modifier = 0, implant_capacity = 2
WHERE class = 'coder' AND implant_capacity = 3;

-- =====================================================
-- STEP 4: Set initial weapon proficiency ranks by class
-- =====================================================
-- Bruiser: Unarmed, Melee, Longarms
UPDATE characters SET weapon_rank_unarmed = 1, weapon_rank_melee = 1, weapon_rank_longarms = 1
WHERE class = 'bruiser' AND weapon_rank_unarmed = 0;

-- Icon: Sidearms
UPDATE characters SET weapon_rank_sidearms = 1
WHERE class = 'icon' AND weapon_rank_sidearms = 0;

-- Hexer: Melee, Sidearms, Longarms
UPDATE characters SET weapon_rank_melee = 1, weapon_rank_sidearms = 1, weapon_rank_longarms = 1
WHERE class = 'hexer' AND weapon_rank_melee = 0;

-- Apostle: Sidearms, Longarms
UPDATE characters SET weapon_rank_sidearms = 1, weapon_rank_longarms = 1
WHERE class = 'apostle' AND weapon_rank_sidearms = 0;

-- Biohack: Unarmed, Melee
UPDATE characters SET weapon_rank_unarmed = 1, weapon_rank_melee = 1
WHERE class = 'biohack' AND weapon_rank_unarmed = 0;

-- Solo: Melee, Sidearms, Longarms, Heavy
UPDATE characters SET weapon_rank_melee = 1, weapon_rank_sidearms = 1, weapon_rank_longarms = 1, weapon_rank_heavy = 1
WHERE class = 'solo' AND weapon_rank_melee = 0;

-- Striker: Unarmed, Melee
UPDATE characters SET weapon_rank_unarmed = 1, weapon_rank_melee = 1
WHERE class = 'striker' AND weapon_rank_unarmed = 0;

-- Vow: Melee, Sidearms, Longarms
UPDATE characters SET weapon_rank_melee = 1, weapon_rank_sidearms = 1, weapon_rank_longarms = 1
WHERE class = 'vow' AND weapon_rank_melee = 0;

-- Tracker: Melee, Sidearms, Longarms
UPDATE characters SET weapon_rank_melee = 1, weapon_rank_sidearms = 1, weapon_rank_longarms = 1
WHERE class = 'tracker' AND weapon_rank_melee = 0;

-- Ghost: Melee, Sidearms
UPDATE characters SET weapon_rank_melee = 1, weapon_rank_sidearms = 1
WHERE class = 'ghost' AND weapon_rank_melee = 0;

-- Spark: Sidearms
UPDATE characters SET weapon_rank_sidearms = 1
WHERE class = 'spark' AND weapon_rank_sidearms = 0;

-- Pact: Sidearms, Longarms
UPDATE characters SET weapon_rank_sidearms = 1, weapon_rank_longarms = 1
WHERE class = 'pact' AND weapon_rank_sidearms = 0;

-- Coder: Sidearms
UPDATE characters SET weapon_rank_sidearms = 1
WHERE class = 'coder' AND weapon_rank_sidearms = 0;

-- =====================================================
-- VERIFICATION
-- =====================================================
SELECT 
  'Characters with new stats' as check_type,
  COUNT(*) as count
FROM characters;

SELECT 
  class,
  speed,
  initiative_modifier,
  implant_capacity,
  COUNT(*) as count
FROM characters
GROUP BY class, speed, initiative_modifier, implant_capacity
ORDER BY class;
