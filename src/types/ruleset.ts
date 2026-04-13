// ============================================
// Phase 8: Ruleset Types
// ============================================

export interface Ruleset {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  is_template: boolean;
  created_at: string;
  updated_at: string;
}

export interface RulesetStat {
  id: string;
  ruleset_id: string;
  key: string;
  name: string;
  abbreviation: string;
  sort_order: number;
}

export interface RulesetSkill {
  id: string;
  ruleset_id: string;
  key: string;
  name: string;
  linked_stat_key: string | null;
  sort_order: number;
}

export interface RulesetModifier {
  id: string;
  ruleset_id: string;
  key: string;
  name: string;
  min_value: number;
  max_value: number;
  default_value: number;
  sort_order: number;
}

export interface RulesetClass {
  id: string;
  ruleset_id: string;
  key: string;
  name: string;
  description: string | null;
  hp: number;
  ac: number;
  cdd: string;
  speed: number;
  initiative_modifier: number;
  implant_capacity: number;
  stat_bonuses: Record<string, number>;
  skill_bonuses: Record<string, number>;
  save_proficiencies: string[];
  weapon_proficiencies: string[];
  armor_proficiencies: string[];
  tools: Array<{ name: string; description: string }>;
  sort_order: number;
  // Joined data (optional)
  starter_items?: RulesetClassStarterItem[];
  abilities?: RulesetClassAbility[];
  subclasses?: RulesetSubclass[];
}

export interface RulesetClassStarterItem {
  id: string;
  class_id: string;
  item_name: string;
  item_type: string;
  item_description: string | null;
  sort_order: number;
}

export interface RulesetClassAbility {
  id: string;
  class_id: string;
  ability_name: string;
  ability_description: string | null;
  ability_type: string;
  charge_type: string;
  max_charges: number;
  granted_at_level: number;
  sort_order: number;
}

export interface RulesetSubclass {
  id: string;
  class_id: string;
  key: string;
  name: string;
  description: string | null;
  unlock_level: number;
  stat_bonuses: Record<string, number>;
  skill_bonuses: Record<string, number>;
  sort_order: number;
  abilities?: RulesetSubclassAbility[];
}

export interface RulesetSubclassAbility {
  id: string;
  subclass_id: string;
  ability_name: string;
  ability_description: string | null;
  ability_type: string;
  charge_type: string;
  max_charges: number;
  granted_at_level: number;
  sort_order: number;
}

export interface RulesetLevelReward {
  id: string;
  class_id: string;
  level: number;
  reward_type: 'ability' | 'stat_boost' | 'skill_boost' | 'hp_increase' | 'feature' | 'subclass_choice';
  ability_name: string | null;
  ability_description: string | null;
  stat_key: string | null;
  boost_amount: number | null;
  skill_key: string | null;
  feature_text: string | null;
  sort_order: number;
}

export interface CharacterModifier {
  id: string;
  character_id: string;
  modifier_key: string;
  current_value: number;
}

export interface ItemModifierEffect {
  id: string;
  item_id: string;
  modifier_key: string;
  modifier_value: number;
}
