-- Fix RLS Policies for character_abilities table
-- Run this in the Supabase SQL Editor

-- First, drop existing policies if any
DROP POLICY IF EXISTS "Users can view own abilities" ON character_abilities;
DROP POLICY IF EXISTS "Users can use own abilities" ON character_abilities;
DROP POLICY IF EXISTS "Admins can manage all character abilities" ON character_abilities;

-- Ensure RLS is enabled
ALTER TABLE character_abilities ENABLE ROW LEVEL SECURITY;

-- Players can view their own character's abilities
CREATE POLICY "Users can view own abilities"
  ON character_abilities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.id = character_abilities.character_id
      AND characters.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Players can update their own abilities (for charge tracking)
CREATE POLICY "Users can update own abilities"
  ON character_abilities FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.id = character_abilities.character_id
      AND characters.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Admins can insert abilities for any character
CREATE POLICY "Admins can insert character abilities"
  ON character_abilities FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Admins can delete abilities for any character
CREATE POLICY "Admins can delete character abilities"
  ON character_abilities FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Verify the policies were created
SELECT schemaname, tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'character_abilities';
