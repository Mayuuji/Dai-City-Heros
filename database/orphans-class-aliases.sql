-- Seed class aliases for "The Orphans" campaign
-- This sets custom D&D-flavored display names for each class
-- Run this AFTER identifying the campaign ID for "The Orphans"

-- Step 1: Find the campaign ID (uncomment and run to look up)
-- SELECT id, name FROM campaigns WHERE name ILIKE '%orphan%';

-- Step 2: Insert/upsert the class aliases into game_settings
-- Replace 'YOUR_CAMPAIGN_ID_HERE' with the actual UUID from step 1

DO $$
DECLARE
  campaign_uuid UUID;
BEGIN
  -- Try to find The Orphans campaign automatically
  SELECT id INTO campaign_uuid FROM campaigns WHERE name ILIKE '%orphan%' LIMIT 1;
  
  IF campaign_uuid IS NULL THEN
    RAISE NOTICE 'No campaign matching "orphan" found. Please insert manually with the correct campaign_id.';
    RETURN;
  END IF;

  RAISE NOTICE 'Found campaign ID: %', campaign_uuid;

  -- Upsert class aliases
  INSERT INTO game_settings (campaign_id, key, value)
  VALUES (
    campaign_uuid,
    'class_aliases',
    jsonb_build_object(
      'bruiser', jsonb_build_object(
        'display_name', 'Tank',
        'description', 'A steadfast protector who absorbs punishment and holds the line. Fueled by rage and resilience, the Tank charges headlong into danger so others don''t have to.'
      ),
      'icon', jsonb_build_object(
        'display_name', 'Star',
        'description', 'A captivating performer whose words and presence inspire allies and confound enemies. The Star lights up every room and bends the crowd to their will.'
      ),
      'hexer', jsonb_build_object(
        'display_name', 'Hexer',
        'description', 'A mysterious wielder of dark enchantments and curses. The Hexer twists fate and unravels the minds of those who stand against them.'
      ),
      'apostle', jsonb_build_object(
        'display_name', 'Hope',
        'description', 'A devoted healer and spiritual guide who channels divine power to mend wounds, cure afflictions, and shield the faithful from harm.'
      ),
      'biohack', jsonb_build_object(
        'display_name', 'Leaf',
        'description', 'A guardian of the natural world who shapeshifts, commands beasts, and calls upon primal forces. The Leaf draws power from the living earth itself.'
      ),
      'solo', jsonb_build_object(
        'display_name', 'Guard',
        'description', 'A disciplined warrior trained in arms and tactics. The Guard is a reliable frontline combatant equally skilled with blade, bow, or bare fists.'
      ),
      'striker', jsonb_build_object(
        'display_name', 'Strike',
        'description', 'A martial artist who channels inner energy into devastating unarmed attacks. The Strike moves like the wind — fast, precise, and deadly.'
      ),
      'vow', jsonb_build_object(
        'display_name', 'Shield',
        'description', 'A holy warrior bound by a sacred oath of justice and protection. The Shield stands between the innocent and evil, radiating courage and divine wrath.'
      ),
      'tracker', jsonb_build_object(
        'display_name', 'Scout',
        'description', 'A wilderness expert and skilled hunter who tracks prey across any terrain. The Scout is at home in the wilds, picking off threats from the shadows.'
      ),
      'ghost', jsonb_build_object(
        'display_name', 'Shade',
        'description', 'A cunning operative who strikes from the shadows with precision. The Shade excels at infiltration, lockpicking, and landing devastating sneak attacks.'
      ),
      'spark', jsonb_build_object(
        'display_name', 'Spark',
        'description', 'A born spellcaster whose innate magical talent erupts in raw elemental power. The Spark bends arcane forces by instinct, not study.'
      ),
      'pact', jsonb_build_object(
        'display_name', 'Crow',
        'description', 'A seeker of forbidden knowledge who bargained with a dark patron for eldritch power. The Crow wields otherworldly magic at a mysterious cost.'
      ),
      'coder', jsonb_build_object(
        'display_name', 'Brain',
        'description', 'A brilliant scholar who has mastered the arcane arts through rigorous study. The Brain''s spellbook holds the key to reality-bending power.'
      )
    )
  )
  ON CONFLICT (campaign_id, key)
  DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

  RAISE NOTICE 'Class aliases seeded successfully for The Orphans campaign.';
END $$;
