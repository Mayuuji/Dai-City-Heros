// TypeScript interfaces for inventory and abilities system

export type ItemType = 'weapon' | 'armor' | 'consumable' | 'cyberware' | 'item' | 'mission_item';
export type ItemRarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Mythic' | 'Ultra Rare' | 'MISSION ITEM';
export type ChargeType = 'infinite' | 'short_rest' | 'long_rest' | 'uses';
export type AbilityType = 'action' | 'bonus_action' | 'reaction' | 'passive' | 'utility';
export type SourceType = 'class' | 'item' | 'temporary';
export type HpModType = 'heal' | 'max_hp';

// Subtypes for weapons and armor
export type ArmorSubtype = 'clothes' | 'light' | 'medium' | 'heavy' | 'shield';
export type WeaponSubtype = 'unarmed' | 'melee' | 'sidearms' | 'longarms' | 'heavy';

export interface StatModifiers {
  str_mod: number;
  dex_mod: number;
  con_mod: number;
  wis_mod: number;
  int_mod: number;
  cha_mod: number;
  hp_mod: number;
  ac_mod: number;
  speed_mod: number;
  init_mod: number;
  ic_mod: number;
}

export interface Item {
  id: string;
  name: string;
  description: string | null;
  type: ItemType;
  rarity: ItemRarity;
  price: number;
  
  // Subtypes for specific item types
  armor_subtype: ArmorSubtype | null;  // For armor: clothes, light, medium, heavy, shield
  weapon_subtype: WeaponSubtype | null; // For weapons: unarmed, melee, sidearms, longarms, heavy
  ic_cost: number; // For cyberware: implant capacity cost
  
  // Stat modifiers
  str_mod: number;
  dex_mod: number;
  con_mod: number;
  wis_mod: number;
  int_mod: number;
  cha_mod: number;
  hp_mod: number;
  hp_mod_type: HpModType; // Whether HP mod heals or increases max HP
  ac_mod: number;
  speed_mod: number;
  init_mod: number;
  ic_mod: number;
  
  // Skill modifiers (e.g., {"Hacking": 3, "Athletics": 2})
  skill_mods: { [skillName: string]: number };
  
  // Item properties
  is_consumable: boolean;
  is_equippable: boolean;
  stack_size: number;
  
  // Metadata
  image_url: string | null;
  created_at: string;
  created_by: string | null;
  
  // Joined data (when querying with abilities)
  abilities?: ItemAbility[];
}

export interface Ability {
  id: string;
  name: string;
  description: string;
  type: AbilityType;
  
  // Charge system
  charge_type: ChargeType;
  max_charges: number | null; // null for infinite
  charges_per_rest: number | null; // How many charges restored per rest
  
  // Effects (array of effect descriptions)
  effects: string[];
  
  // Combat info
  damage_dice: string | null; // e.g., "2d6", "1d8+3"
  damage_type: string | null; // e.g., "fire", "psychic", "healing"
  range_feet: number | null;
  area_of_effect: string | null; // e.g., "15ft cone"
  duration: string | null; // e.g., "1 minute", "Instantaneous"
  
  created_at: string;
  
  // Current charges (when joined with character_abilities)
  current_charges?: number;
  
  // Source tracking (stored in DB)
  source?: 'custom' | 'class' | 'item';
  class_name?: string | null; // For class abilities, which class this belongs to
  
  // Runtime source tracking (when joined with character data)
  item_name?: string;
}

export interface ItemAbility {
  item_id: string;
  ability_id: string;
  requires_equipped: boolean;
  
  // Joined data
  ability?: Ability;
}

export interface InventoryItem {
  id: string;
  character_id: string;
  item_id: string;
  quantity: number;
  is_equipped: boolean;
  current_uses: number | null; // For consumables
  acquired_at: string;
  
  // Joined data
  item?: Item;
}

export interface CharacterAbility {
  id: string;
  character_id: string;
  ability_id: string;
  current_charges: number;
  source_type: SourceType;
  source_id: string | null; // Item ID or class feature identifier
  granted_at: string;
  
  // Joined data
  ability?: Ability;
}

// Helper interface for calculating total character stats
export interface CharacterStats extends StatModifiers {
  // Base stats
  base_str: number;
  base_dex: number;
  base_con: number;
  base_wis: number;
  base_int: number;
  base_cha: number;
  base_hp: number;
  base_ac: number;
  
  // Total stats (base + modifiers)
  total_str: number;
  total_dex: number;
  total_con: number;
  total_wis: number;
  total_int: number;
  total_cha: number;
  total_hp: number;
  total_ac: number;
  
  // Skill modifiers from items
  skill_bonuses: { [skillName: string]: number };
}

// Helper type for rest actions
export interface RestAction {
  type: 'short_rest' | 'long_rest';
  affected_characters: string[]; // Character IDs
  timestamp: string;
}

// Item creation form data
export interface CreateItemInput {
  name: string;
  description: string;
  type: ItemType;
  rarity: ItemRarity;
  price: number;
  
  str_mod: number;
  dex_mod: number;
  con_mod: number;
  wis_mod: number;
  int_mod: number;
  cha_mod: number;
  hp_mod: number;
  ac_mod: number;
  
  skill_mods: { [skillName: string]: number };
  
  is_consumable: boolean;
  is_equippable: boolean;
  stack_size: number;
  
  // Abilities to grant
  ability_ids?: string[];
}

// Ability creation form data
export interface CreateAbilityInput {
  name: string;
  description: string;
  type: AbilityType;
  charge_type: ChargeType;
  max_charges: number | null;
  charges_per_rest: number | null;
  effects: string[];
  damage_dice: string | null;
  damage_type: string | null;
  range_feet: number | null;
  area_of_effect: string | null;
  source_type: SourceType;
}
