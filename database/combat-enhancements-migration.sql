-- Phase 3: Combat Enhancements Migration
-- Per-turn status effects on encounter participants

CREATE TABLE IF NOT EXISTS encounter_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id),
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES encounter_participants(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  remaining_rounds INTEGER NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS - open policy like encounter_participants
ALTER TABLE encounter_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "encounter_statuses_all" ON encounter_statuses FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE encounter_statuses;

-- RPC function to decrement statuses at round end
CREATE OR REPLACE FUNCTION decrement_encounter_statuses(p_encounter_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE encounter_statuses 
  SET remaining_rounds = remaining_rounds - 1 
  WHERE encounter_id = p_encounter_id;
  
  DELETE FROM encounter_statuses 
  WHERE encounter_id = p_encounter_id AND remaining_rounds <= 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
