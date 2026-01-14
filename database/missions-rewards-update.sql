-- Migration: Add credit rewards and reward mode to missions
-- This updates the mission system to support:
-- 1. Credit rewards (money)
-- 2. Reward distribution modes (each member vs single recipient)
-- 3. Draft status for missions

-- STEP 1: Add new enum value for draft status
-- This must be committed before it can be used in policies
ALTER TYPE mission_status ADD VALUE IF NOT EXISTS 'draft' BEFORE 'active';

-- Add new columns to missions table
ALTER TABLE missions 
  ADD COLUMN IF NOT EXISTS reward_credits INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_mode VARCHAR(10) DEFAULT 'each' CHECK (reward_mode IN ('single', 'each'));

-- Add credits_amount to mission_rewards_distributed for tracking credit distributions
ALTER TABLE mission_rewards_distributed 
  ADD COLUMN IF NOT EXISTS credits_amount INTEGER DEFAULT 0;

-- Comment on new columns
COMMENT ON COLUMN missions.reward_credits IS 'Amount of credits awarded for completing the mission';
COMMENT ON COLUMN missions.reward_mode IS 'How rewards are distributed: each = every member gets rewards, single = DM chooses recipient';
COMMENT ON COLUMN mission_rewards_distributed.credits_amount IS 'Amount of credits given to this character from the mission';

-- ============================================================
-- STEP 2: Run this AFTER committing STEP 1 above
-- ============================================================
-- Update RLS policy to hide draft missions from players
-- Uses explicit list of allowed statuses to avoid enum commit issue
DROP POLICY IF EXISTS "Players view assigned missions" ON missions;

CREATE POLICY "Players view assigned missions"
  ON missions
  FOR SELECT
  USING (
    -- Only show active/completed/failed missions to players (excludes draft)
    status IN ('active', 'completed', 'failed')
    AND
    (
      -- Mission is party-wide (assigned_to is NULL)
      assigned_to IS NULL
      OR
      -- Mission is assigned to a character owned by the user
      EXISTS (
        SELECT 1 FROM characters
        WHERE characters.id = ANY(missions.assigned_to)
        AND characters.user_id = auth.uid()
      )
    )
  );
