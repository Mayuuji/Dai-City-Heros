-- Mission System for Cyberpunk TTRPG
-- Handles mission assignments, tracking, and reward distribution

-- Drop existing tables and types if they exist
DROP TABLE IF EXISTS mission_rewards_distributed CASCADE;
DROP TABLE IF EXISTS missions CASCADE;
DROP TYPE IF EXISTS mission_type CASCADE;
DROP TYPE IF EXISTS mission_difficulty CASCADE;
DROP TYPE IF EXISTS mission_status CASCADE;

-- Mission types enum
-- Character Mission: Personal story missions for specific characters
-- Past Time: Side activities and downtime missions
-- Encounter: Combat-focused missions
-- Side Mission: Optional side quests
-- MAIN MISSION: Critical story missions
CREATE TYPE mission_type AS ENUM (
  'Character Mission',
  'Past Time', 
  'Encounter',
  'Side Mission',
  'MAIN MISSION'
);

-- Mission difficulty levels
CREATE TYPE mission_difficulty AS ENUM (
  'Low',
  'Easy',
  'Moderate',
  'Difficult',
  'Dangerous',
  'Extreme',
  'Suicide Mission'
);

-- Mission status
CREATE TYPE mission_status AS ENUM (
  'active',
  'completed',
  'failed'
);

-- Missions table
CREATE TABLE missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Mission details
  title VARCHAR(255) NOT NULL,
  description TEXT,
  objectives TEXT[], -- Array of objective descriptions
  
  -- Mission metadata
  type mission_type NOT NULL,
  difficulty mission_difficulty NOT NULL,
  status mission_status DEFAULT 'active',
  
  -- Assignment
  -- NULL = party-wide (assigned to everyone)
  -- Array of character IDs = assigned to specific characters
  assigned_to UUID[], -- character_id array
  
  -- Rewards (array of item IDs)
  reward_item_ids UUID[], -- References items table
  
  -- Tracking
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reward distribution tracking
-- Tracks which reward items were given to which characters when mission completed
CREATE TABLE mission_rewards_distributed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  distributed_at TIMESTAMPTZ DEFAULT NOW(),
  distributed_by UUID REFERENCES profiles(id),
  
  UNIQUE(mission_id, item_id) -- Each reward item can only be given once per mission
);

-- Create indexes
CREATE INDEX idx_missions_status ON missions(status);
CREATE INDEX idx_missions_type ON missions(type);
CREATE INDEX idx_missions_assigned_to ON missions USING GIN(assigned_to);
CREATE INDEX idx_mission_rewards_mission ON mission_rewards_distributed(mission_id);
CREATE INDEX idx_mission_rewards_character ON mission_rewards_distributed(character_id);

-- Enable Row Level Security
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_rewards_distributed ENABLE ROW LEVEL SECURITY;

-- RLS Policies for missions

-- Players can view missions assigned to them or party-wide missions
CREATE POLICY "Players view assigned missions"
  ON missions
  FOR SELECT
  USING (
    -- Mission is party-wide (assigned_to is NULL)
    assigned_to IS NULL
    OR
    -- Mission is assigned to a character owned by the user
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.id = ANY(missions.assigned_to)
      AND characters.user_id = auth.uid()
    )
  );

-- Admins can manage all missions
CREATE POLICY "Admins manage missions"
  ON missions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for reward distribution

-- Players can view their own reward distributions
CREATE POLICY "Players view own rewards"
  ON mission_rewards_distributed
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.id = mission_rewards_distributed.character_id
      AND characters.user_id = auth.uid()
    )
  );

-- Admins can manage all reward distributions
CREATE POLICY "Admins manage rewards"
  ON mission_rewards_distributed
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Add comments
COMMENT ON TABLE missions IS 'Mission assignments with type, difficulty, and rewards';
COMMENT ON TABLE mission_rewards_distributed IS 'Tracks which reward items were given to which characters';
COMMENT ON COLUMN missions.assigned_to IS 'NULL for party-wide missions, array of character IDs for specific assignments';
COMMENT ON COLUMN missions.reward_item_ids IS 'Array of item IDs that can be distributed as rewards';
COMMENT ON COLUMN missions.objectives IS 'Array of mission objective descriptions';

-- Sample mission data (optional - remove in production)
DO $$
DECLARE
  sample_mission_id UUID;
  sample_character_id UUID;
  sample_item_id UUID;
BEGIN
  -- Only insert if we have some items and characters
  SELECT id INTO sample_item_id FROM items LIMIT 1;
  SELECT id INTO sample_character_id FROM characters LIMIT 1;
  
  IF sample_item_id IS NOT NULL AND sample_character_id IS NOT NULL THEN
    -- Create a sample main mission
    INSERT INTO missions (
      title,
      description,
      objectives,
      type,
      difficulty,
      status,
      assigned_to,
      reward_item_ids
    ) VALUES (
      'Infiltrate Arasaka Tower',
      'Break into the secure Arasaka Tower and retrieve the stolen data chip containing vital corporate secrets.',
      ARRAY[
        'Gather intel on tower security systems',
        'Acquire access keycard from security chief',
        'Bypass electronic locks on 42nd floor',
        'Locate and extract the data chip',
        'Escape without raising alarms'
      ],
      'MAIN MISSION',
      'Dangerous',
      'active',
      NULL, -- Party-wide mission
      ARRAY[sample_item_id] -- Add sample reward
    ) RETURNING id INTO sample_mission_id;
    
    -- Create a character-specific mission
    INSERT INTO missions (
      title,
      description,
      objectives,
      type,
      difficulty,
      status,
      assigned_to,
      reward_item_ids
    ) VALUES (
      'Ghost from the Past',
      'An old contact has surfaced with information about your past. Meet them at the Night Market.',
      ARRAY[
        'Travel to Night Market at midnight',
        'Find contact near the ramen stand',
        'Listen to their story',
        'Decide how to respond'
      ],
      'Character Mission',
      'Easy',
      'active',
      ARRAY[sample_character_id], -- Assigned to specific character
      ARRAY[sample_item_id]
    );
  END IF;
END $$;
