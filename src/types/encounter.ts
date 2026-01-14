// =====================================================
// CYBERPUNK TTRPG: ENCOUNTER SYSTEM TYPES
// =====================================================

import type { NPC as NPCType } from './npc';

export type EncounterStatus = 'draft' | 'active' | 'completed' | 'archived';
export type ParticipantType = 'player' | 'npc' | 'enemy';

export interface Encounter {
  id: string;
  name: string;
  description: string | null;
  status: EncounterStatus;
  current_turn: number;
  round_number: number;
  created_by: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  location_id: string | null;
}

export interface EncounterParticipant {
  id: string;
  encounter_id: string;
  character_id: string | null;
  npc_id: string | null;
  initiative_roll: number | null;
  initiative_order: number | null;
  current_hp: number | null;
  max_hp: number | null;
  is_active: boolean;
  participant_type: ParticipantType;
  notes: string | null;
  added_at: string;
}

export interface PlayerEncounterNote {
  id: string;
  encounter_id: string;
  player_id: string;
  turn_number: number;
  round_number: number;
  note_text: string;
  created_at: string;
  updated_at: string;
}

// =====================================================
// Extended types with joined data
// =====================================================

export interface Character {
  id: string;
  user_id: string;
  name: string;
  class: string;
  level: number;
  current_hp: number;
  max_hp: number;
  ac: number;
  initiative_modifier: number;
  str: number;
  dex: number;
  con: number;
  wis: number;
  int: number;
  cha: number;
}

// Participant with full character/NPC data
export interface EncounterParticipantWithDetails extends EncounterParticipant {
  character?: Character;
  npc?: NPCType;
  display_name: string;
  display_hp: number;
  display_max_hp: number;
  display_ac: number;
  display_initiative_modifier: number;
}

// Full encounter with all participants
export interface EncounterWithParticipants extends Encounter {
  participants: EncounterParticipantWithDetails[];
}

// For player view - hides enemy stats
export interface PlayerEncounterView {
  encounter: Encounter;
  participants: PlayerParticipantView[];
  my_notes: PlayerEncounterNote[];
}

export interface PlayerParticipantView {
  id: string;
  display_name: string;
  participant_type: ParticipantType;
  initiative_order: number | null;
  is_active: boolean;
  is_current_turn: boolean;
  
  // Only visible for player characters
  current_hp?: number;
  max_hp?: number;
  armor_class?: number;
}

// =====================================================
// Form/Create types
// =====================================================

export interface CreateEncounterData {
  name: string;
  description?: string;
  location_id?: string;
}

export interface AddParticipantData {
  encounter_id: string;
  character_id?: string;
  npc_id?: string;
  participant_type: ParticipantType;
}

export interface SetInitiativeData {
  participant_id: string;
  initiative_roll: number;
}

export interface UpdateParticipantHPData {
  participant_id: string;
  new_hp: number;
}

export interface CreateNoteData {
  encounter_id: string;
  turn_number: number;
  round_number: number;
  note_text: string;
}
