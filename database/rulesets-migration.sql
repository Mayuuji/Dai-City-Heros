-- ============================================
-- Phase 8: RULESETS — Core Tables
-- Run AFTER all prior migrations
-- ============================================

-- A ruleset is a collection of game rules
CREATE TABLE IF NOT EXISTS rulesets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  is_template BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Stat definitions (replaces hardcoded STR/DEX/CON/WIS/INT/CHA)
CREATE TABLE IF NOT EXISTS ruleset_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ruleset_id UUID NOT NULL REFERENCES rulesets(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  UNIQUE(ruleset_id, key)
);

-- Skill definitions (replaces hardcoded ALL_SKILLS)
CREATE TABLE IF NOT EXISTS ruleset_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ruleset_id UUID NOT NULL REFERENCES rulesets(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  linked_stat_key TEXT,
  sort_order INTEGER DEFAULT 0,
  UNIQUE(ruleset_id, key)
);

-- Custom modifiers (e.g. "Hunger", "Radiation", "Sanity")
CREATE TABLE IF NOT EXISTS ruleset_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ruleset_id UUID NOT NULL REFERENCES rulesets(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  min_value INTEGER DEFAULT 0,
  max_value INTEGER DEFAULT 100,
  default_value INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  UNIQUE(ruleset_id, key)
);

-- Class definitions (replaces hardcoded CHARACTER_CLASSES)
CREATE TABLE IF NOT EXISTS ruleset_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ruleset_id UUID NOT NULL REFERENCES rulesets(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  hp INTEGER NOT NULL DEFAULT 20,
  ac INTEGER NOT NULL DEFAULT 14,
  cdd TEXT DEFAULT 'd8',
  speed INTEGER DEFAULT 30,
  initiative_modifier INTEGER DEFAULT 0,
  implant_capacity INTEGER DEFAULT 3,
  stat_bonuses JSONB DEFAULT '{}',
  skill_bonuses JSONB DEFAULT '{}',
  save_proficiencies TEXT[] DEFAULT '{}',
  weapon_proficiencies TEXT[] DEFAULT '{}',
  armor_proficiencies TEXT[] DEFAULT '{}',
  tools JSONB DEFAULT '[]',
  sort_order INTEGER DEFAULT 0,
  UNIQUE(ruleset_id, key)
);

-- Class starter items
CREATE TABLE IF NOT EXISTS ruleset_class_starter_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES ruleset_classes(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  item_type TEXT DEFAULT 'item',
  item_description TEXT,
  sort_order INTEGER DEFAULT 0
);

-- Class starter abilities
CREATE TABLE IF NOT EXISTS ruleset_class_abilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES ruleset_classes(id) ON DELETE CASCADE,
  ability_name TEXT NOT NULL,
  ability_description TEXT,
  ability_type TEXT DEFAULT 'action',
  charge_type TEXT DEFAULT 'infinite',
  max_charges INTEGER DEFAULT 1,
  granted_at_level INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);

-- Subclass definitions
CREATE TABLE IF NOT EXISTS ruleset_subclasses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES ruleset_classes(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  unlock_level INTEGER NOT NULL DEFAULT 3,
  stat_bonuses JSONB DEFAULT '{}',
  skill_bonuses JSONB DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  UNIQUE(class_id, key)
);

-- Subclass abilities
CREATE TABLE IF NOT EXISTS ruleset_subclass_abilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subclass_id UUID NOT NULL REFERENCES ruleset_subclasses(id) ON DELETE CASCADE,
  ability_name TEXT NOT NULL,
  ability_description TEXT,
  ability_type TEXT DEFAULT 'action',
  charge_type TEXT DEFAULT 'infinite',
  max_charges INTEGER DEFAULT 1,
  granted_at_level INTEGER NOT NULL,
  sort_order INTEGER DEFAULT 0
);

-- Level-up rewards (class-specific)
CREATE TABLE IF NOT EXISTS ruleset_level_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES ruleset_classes(id) ON DELETE CASCADE,
  level INTEGER NOT NULL,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('ability', 'stat_boost', 'skill_boost', 'hp_increase', 'feature', 'subclass_choice')),
  ability_name TEXT,
  ability_description TEXT,
  stat_key TEXT,
  boost_amount INTEGER,
  skill_key TEXT,
  feature_text TEXT,
  sort_order INTEGER DEFAULT 0,
  UNIQUE(class_id, level, sort_order)
);

-- Link campaigns to rulesets
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS ruleset_id UUID REFERENCES rulesets(id);

-- Character custom modifier values
CREATE TABLE IF NOT EXISTS character_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  modifier_key TEXT NOT NULL,
  current_value INTEGER NOT NULL DEFAULT 0,
  UNIQUE(character_id, modifier_key)
);

-- Character subclass/class linkage
ALTER TABLE characters ADD COLUMN IF NOT EXISTS subclass_id UUID REFERENCES ruleset_subclasses(id);
ALTER TABLE characters ADD COLUMN IF NOT EXISTS ruleset_class_id UUID REFERENCES ruleset_classes(id);

-- Dynamic stats/skills JSONB
ALTER TABLE characters ADD COLUMN IF NOT EXISTS custom_stats JSONB DEFAULT '{}';
ALTER TABLE characters ADD COLUMN IF NOT EXISTS custom_skills JSONB DEFAULT '{}';

-- Item custom modifier effects
CREATE TABLE IF NOT EXISTS item_modifier_effects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  modifier_key TEXT NOT NULL,
  modifier_value INTEGER NOT NULL DEFAULT 0,
  UNIQUE(item_id, modifier_key)
);

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE rulesets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rulesets_read" ON rulesets;
DROP POLICY IF EXISTS "rulesets_write" ON rulesets;
CREATE POLICY "rulesets_read" ON rulesets FOR SELECT USING (true);
CREATE POLICY "rulesets_write" ON rulesets FOR ALL USING (owner_id = auth.uid());

ALTER TABLE ruleset_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ruleset_stats_all" ON ruleset_stats;
CREATE POLICY "ruleset_stats_all" ON ruleset_stats FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE ruleset_skills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ruleset_skills_all" ON ruleset_skills;
CREATE POLICY "ruleset_skills_all" ON ruleset_skills FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE ruleset_modifiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ruleset_modifiers_all" ON ruleset_modifiers;
CREATE POLICY "ruleset_modifiers_all" ON ruleset_modifiers FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE ruleset_classes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ruleset_classes_all" ON ruleset_classes;
CREATE POLICY "ruleset_classes_all" ON ruleset_classes FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE ruleset_class_starter_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ruleset_starter_items_all" ON ruleset_class_starter_items;
CREATE POLICY "ruleset_starter_items_all" ON ruleset_class_starter_items FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE ruleset_class_abilities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ruleset_class_abilities_all" ON ruleset_class_abilities;
CREATE POLICY "ruleset_class_abilities_all" ON ruleset_class_abilities FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE ruleset_subclasses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ruleset_subclasses_all" ON ruleset_subclasses;
CREATE POLICY "ruleset_subclasses_all" ON ruleset_subclasses FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE ruleset_subclass_abilities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ruleset_subclass_abilities_all" ON ruleset_subclass_abilities;
CREATE POLICY "ruleset_subclass_abilities_all" ON ruleset_subclass_abilities FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE ruleset_level_rewards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ruleset_level_rewards_all" ON ruleset_level_rewards;
CREATE POLICY "ruleset_level_rewards_all" ON ruleset_level_rewards FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE character_modifiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "character_modifiers_all" ON character_modifiers;
CREATE POLICY "character_modifiers_all" ON character_modifiers FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE item_modifier_effects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "item_modifier_effects_all" ON item_modifier_effects;
CREATE POLICY "item_modifier_effects_all" ON item_modifier_effects FOR ALL USING (true) WITH CHECK (true);
