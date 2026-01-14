// NPC and Enemy system types

export type NPCType = 
  | 'Enemy'
  | 'Friendly NPC'
  | 'Neutral NPC'
  | 'Vendor'
  | 'Quest Giver'
  | 'Boss'
  | 'Mini-Boss'
  | 'Civilian';

export type NPCDisposition = 
  | 'Hostile'
  | 'Unfriendly'
  | 'Neutral'
  | 'Friendly'
  | 'Allied';

export interface NPCAbility {
  name: string;
  damage?: string | null;
  effect: string;
}

export interface NPCDrops {
  usd: number;
  items: string[]; // Item names or IDs
}

export interface NPC {
  id: string;
  
  // Basic Info
  name: string;
  type: NPCType;
  disposition: NPCDisposition;
  description: string | null;
  
  // Combat Stats
  max_hp: number;
  current_hp: number;
  ac: number;
  initiative_modifier: number;
  
  // Core Stats
  str: number;
  dex: number;
  con: number;
  wis: number;
  int: number;
  cha: number;
  
  // Roleplay Details
  unique_details: string | null;
  speech_pattern: string | null;
  mannerisms: string | null;
  
  // Story/Plot Details
  current_problem: string | null;
  problem_involves: string | null;
  their_approach: string | null;
  secret: string | null;
  
  // Quick Reference
  three_words: string | null;
  voice_direction: string | null;
  remember_by: string | null;
  
  // Combat & Loot
  abilities: NPCAbility[];
  drops_on_defeat: NPCDrops;
  
  // Location & Status
  location_id: string | null;
  is_alive: boolean;
  is_active: boolean;
  
  // DM Notes
  dm_notes: string | null;
  
  // Metadata
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Extended NPC with location details
export interface NPCWithLocation extends NPC {
  location?: {
    id: string;
    name: string;
    x: number;
    y: number;
  };
}
