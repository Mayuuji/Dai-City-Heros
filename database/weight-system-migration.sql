-- Phase 5: Weight & Carrying Capacity Migration

-- Add weight to items
ALTER TABLE items ADD COLUMN IF NOT EXISTS weight NUMERIC(8,2) DEFAULT 0;

-- Add carrying capacity to characters
ALTER TABLE characters ADD COLUMN IF NOT EXISTS carrying_capacity NUMERIC(8,2) DEFAULT 100;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS base_carrying_capacity NUMERIC(8,2) DEFAULT 100;
