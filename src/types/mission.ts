// Mission system types

export type MissionType = 
  | 'Character Mission'
  | 'Past Time'
  | 'Encounter'
  | 'Side Mission'
  | 'MAIN MISSION';

export type MissionDifficulty = 
  | 'Low'
  | 'Easy'
  | 'Moderate'
  | 'Difficult'
  | 'Dangerous'
  | 'Extreme'
  | 'Suicide Mission';

export type MissionStatus = 
  | 'draft'
  | 'active'
  | 'completed'
  | 'failed';

export type RewardMode = 'single' | 'each';

export interface Mission {
  id: string;
  title: string;
  description: string | null;
  objectives: string[]; // Array of objective descriptions
  type: MissionType;
  difficulty: MissionDifficulty;
  status: MissionStatus;
  assigned_to: string[] | null; // character_id array, null = party-wide
  reward_item_ids: string[] | null; // item_id array
  reward_credits: number; // Credit reward amount
  reward_mode: RewardMode; // 'single' = one pool to distribute, 'each' = each player gets it
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
  updated_at: string;
}

export interface MissionRewardDistributed {
  id: string;
  mission_id: string;
  character_id: string;
  item_id: string | null;
  credits_amount: number;
  distributed_at: string;
  distributed_by: string | null;
}

// Extended mission with character and item details
export interface MissionWithDetails extends Mission {
  assigned_characters?: {
    id: string;
    name: string;
    class: string;
  }[];
  reward_items?: {
    id: string;
    name: string;
    rarity: string;
    type: string;
  }[];
  distributed_rewards?: MissionRewardDistributed[];
}

// For reward distribution UI
export interface RewardDistribution {
  item_id: string;
  item_name: string;
  assigned_character_id: string | null;
}
