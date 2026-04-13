-- ============================================
-- Phase 8: Seed Default Cyberpunk Ruleset
-- Run AFTER rulesets-migration.sql
-- ============================================

-- Use a DO block so we can reference the generated IDs
DO $$
DECLARE
  v_ruleset_id UUID;
  v_class_id UUID;
  -- We need a valid user to own the template ruleset.
  -- Use the first admin user found, or create a system placeholder.
  v_owner_id UUID;
BEGIN

  -- Pick first existing user as owner for the template ruleset
  SELECT id INTO v_owner_id FROM auth.users LIMIT 1;
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'No users exist yet. Create at least one user before seeding.';
  END IF;

  -- =========================================
  -- 1. Create the ruleset
  -- =========================================
  INSERT INTO rulesets (name, description, owner_id, is_template)
  VALUES ('Cyberpunk (Default)', 'Default cyberpunk TTRPG ruleset with 6 stats, 18 skills, and 13 classes.', v_owner_id, true)
  RETURNING id INTO v_ruleset_id;

  -- =========================================
  -- 2. Stats (6 core stats)
  -- =========================================
  INSERT INTO ruleset_stats (ruleset_id, key, name, abbreviation, sort_order) VALUES
    (v_ruleset_id, 'str', 'Strength',     'STR', 1),
    (v_ruleset_id, 'dex', 'Dexterity',    'DEX', 2),
    (v_ruleset_id, 'con', 'Constitution',  'CON', 3),
    (v_ruleset_id, 'wis', 'Wisdom',       'WIS', 4),
    (v_ruleset_id, 'int', 'Intelligence',  'INT', 5),
    (v_ruleset_id, 'cha', 'Charisma',     'CHA', 6);

  -- =========================================
  -- 3. Skills (18 skills with linked stats)
  -- =========================================
  INSERT INTO ruleset_skills (ruleset_id, key, name, linked_stat_key, sort_order) VALUES
    (v_ruleset_id, 'acrobatics',      'Acrobatics',      'dex', 1),
    (v_ruleset_id, 'animal_handling', 'Animal Handling', 'wis', 2),
    (v_ruleset_id, 'athletics',       'Athletics',       'str', 3),
    (v_ruleset_id, 'biology',         'Biology',         'int', 4),
    (v_ruleset_id, 'deception',       'Deception',       'cha', 5),
    (v_ruleset_id, 'hacking',         'Hacking',         'int', 6),
    (v_ruleset_id, 'history',         'History',         'int', 7),
    (v_ruleset_id, 'insight',         'Insight',         'wis', 8),
    (v_ruleset_id, 'intimidation',    'Intimidation',    'cha', 9),
    (v_ruleset_id, 'investigation',   'Investigation',   'int', 10),
    (v_ruleset_id, 'medicine',        'Medicine',        'wis', 11),
    (v_ruleset_id, 'nature',          'Nature',          'int', 12),
    (v_ruleset_id, 'perception',      'Perception',      'wis', 13),
    (v_ruleset_id, 'performance',     'Performance',     'cha', 14),
    (v_ruleset_id, 'persuasion',      'Persuasion',      'cha', 15),
    (v_ruleset_id, 'sleight_of_hand', 'Sleight of Hand', 'dex', 16),
    (v_ruleset_id, 'stealth',         'Stealth',         'dex', 17),
    (v_ruleset_id, 'survival',        'Survival',        'wis', 18);

  -- =========================================
  -- 4. Classes (13 classes)
  -- =========================================

  -- BRUISER
  INSERT INTO ruleset_classes (ruleset_id, key, name, description, hp, ac, cdd, speed, initiative_modifier, implant_capacity,
    stat_bonuses, skill_bonuses, save_proficiencies, weapon_proficiencies, armor_proficiencies, tools, sort_order)
  VALUES (v_ruleset_id, 'bruiser', 'BRUISER', 'You''re beefy and you hit things really hard, usually while running on combat stims.',
    24, 16, 'd12', 25, 0, 6,
    '{"str": 2, "con": 1}'::jsonb, '{"athletics": 3, "intimidation": 2}'::jsonb,
    ARRAY['STR','CON'], ARRAY['unarmed','melee','longarms'], ARRAY['light','medium','heavy','shield'],
    '[{"name":"Driver Rig","description":"keys/jammers, mount clamp, flares, jump pack. Hotwire, chase stunts."},{"name":"Gunsmith Kit","description":"cleaning tools, punch set, springs. Clear jams, maintain guns."}]'::jsonb, 1)
  RETURNING id INTO v_class_id;
  INSERT INTO ruleset_class_abilities (class_id, ability_name, ability_description, ability_type, charge_type, max_charges, granted_at_level)
  VALUES (v_class_id, 'OVERDRIVE', '1 Charge. For 3 rounds: deal +2 damage on melee hits and reduce incoming physical damage by 2.', 'bonus', 'uses', 1, 1);

  -- ICON
  INSERT INTO ruleset_classes (ruleset_id, key, name, description, hp, ac, cdd, speed, initiative_modifier, implant_capacity,
    stat_bonuses, skill_bonuses, save_proficiencies, weapon_proficiencies, armor_proficiencies, tools, sort_order)
  VALUES (v_ruleset_id, 'icon', 'ICON', 'You''re charismatic and dangerous with attention. You steer people, crowds, and feeds.',
    16, 13, 'd6', 30, 1, 3,
    '{"cha": 2, "int": 1}'::jsonb, '{"persuasion": 3, "performance": 2}'::jsonb,
    ARRAY['CHA','DEX'], ARRAY['sidearms'], ARRAY['clothes','light'],
    '[{"name":"Disguise Kit","description":"makeup, hair pieces, voice mod. Build a look, pass inspection."},{"name":"Broadcast Rig","description":"cam, uplink, editing app. Stream, edit, fabricate proof."}]'::jsonb, 2)
  RETURNING id INTO v_class_id;
  INSERT INTO ruleset_class_abilities (class_id, ability_name, ability_description, ability_type, charge_type, max_charges, granted_at_level)
  VALUES (v_class_id, 'SPOTLIGHT', '1 Charge. Pick visible target. They make WIS save. Fail: Shaken for 2 rounds (-2 to attack rolls).', 'action', 'uses', 1, 1);

  -- HEXER
  INSERT INTO ruleset_classes (ruleset_id, key, name, description, hp, ac, cdd, speed, initiative_modifier, implant_capacity,
    stat_bonuses, skill_bonuses, save_proficiencies, weapon_proficiencies, armor_proficiencies, tools, sort_order)
  VALUES (v_ruleset_id, 'hexer', 'HEXER', 'You''re cursed (bad firmware, virus) and you weaponize it.',
    20, 14, 'd8', 30, 1, 4,
    '{"dex": 2, "con": 1}'::jsonb, '{"investigation": 3, "survival": 2}'::jsonb,
    ARRAY['CON','WIS'], ARRAY['melee','sidearms','longarms'], ARRAY['clothes','light','medium'],
    '[{"name":"Toxin Case","description":"reagents, droppers, neutralizer. ID poisons, make simple toxins."},{"name":"Evidence Kit","description":"swabs, UV light, tags. Collect evidence, reconstruct scenes."}]'::jsonb, 3)
  RETURNING id INTO v_class_id;
  INSERT INTO ruleset_class_abilities (class_id, ability_name, ability_description, ability_type, charge_type, max_charges, granted_at_level)
  VALUES (v_class_id, 'CURSE', '1 Charge. Mark target for 1 min. The first time each round you hit them, deal +1d8 extra damage (viral/rot).', 'action', 'uses', 1, 1);

  -- APOSTLE
  INSERT INTO ruleset_classes (ruleset_id, key, name, description, hp, ac, cdd, speed, initiative_modifier, implant_capacity,
    stat_bonuses, skill_bonuses, save_proficiencies, weapon_proficiencies, armor_proficiencies, tools, sort_order)
  VALUES (v_ruleset_id, 'apostle', 'APOSTLE', 'You''re a higher power''s favorite employee. You keep people alive.',
    20, 14, 'd6', 30, 0, 2,
    '{"wis": 2, "cha": 1}'::jsonb, '{"medicine": 3, "insight": 2}'::jsonb,
    ARRAY['WIS','CHA'], ARRAY['sidearms','longarms'], ARRAY['clothes','light','medium','shield'],
    '[{"name":"Trauma Kit","description":"clot spray, stapler, injectors. Stabilize, stop bleeding."},{"name":"Breach Kit","description":"lock shims, keypad probe. Slip basic locks and doors."}]'::jsonb, 4)
  RETURNING id INTO v_class_id;
  INSERT INTO ruleset_class_abilities (class_id, ability_name, ability_description, ability_type, charge_type, max_charges, granted_at_level)
  VALUES (v_class_id, 'PATCH', '1 Charge. Touch ally within 5 ft. They heal 1d6 + 4 HP and stop bleeding/ongoing damage.', 'action', 'uses', 1, 1);

  -- BIOHACK
  INSERT INTO ruleset_classes (ruleset_id, key, name, description, hp, ac, cdd, speed, initiative_modifier, implant_capacity,
    stat_bonuses, skill_bonuses, save_proficiencies, weapon_proficiencies, armor_proficiencies, tools, sort_order)
  VALUES (v_ruleset_id, 'biohack', 'BIOHACK', 'Living mods, symbiotes, gene edits — nature, but weaponized.',
    20, 14, 'd8', 30, 0, 4,
    '{"con": 2, "wis": 1}'::jsonb, '{"biology": 3, "nature": 2}'::jsonb,
    ARRAY['CON','INT'], ARRAY['unarmed','melee'], ARRAY['clothes','light','medium'],
    '[{"name":"Bio Sampler","description":"swabs, scanner, culture card. Scan bio, handle living mods."},{"name":"Trauma Kit","description":"tourniquets, injectors. Stabilize, stop bleeding fast."}]'::jsonb, 5)
  RETURNING id INTO v_class_id;
  INSERT INTO ruleset_class_abilities (class_id, ability_name, ability_description, ability_type, charge_type, max_charges, granted_at_level)
  VALUES (v_class_id, 'ADAPT', '1 Charge. Choose for 10 mins: Armor Skin (AC +2), Claws (melee hits +2 dmg), or Gills (ignore gas, Adv vs toxins).', 'bonus', 'uses', 1, 1);

  -- SOLO
  INSERT INTO ruleset_classes (ruleset_id, key, name, description, hp, ac, cdd, speed, initiative_modifier, implant_capacity,
    stat_bonuses, skill_bonuses, save_proficiencies, weapon_proficiencies, armor_proficiencies, tools, sort_order)
  VALUES (v_ruleset_id, 'solo', 'SOLO', 'Professional violence. Clean, efficient, hard to kill.',
    20, 15, 'd10', 30, 1, 5,
    '{"dex": 2, "str": 1}'::jsonb, '{"perception": 3, "athletics": 2}'::jsonb,
    ARRAY['DEX','CON'], ARRAY['melee','sidearms','longarms','heavy'], ARRAY['clothes','light','medium','heavy','shield'],
    '[{"name":"Gunsmith Kit","description":"cleaning tools, sight tool. Weapon upkeep, jam-clears."},{"name":"Driver Rig","description":"keys, tire plugs, jump pack. Pursuit driving."}]'::jsonb, 6)
  RETURNING id INTO v_class_id;
  INSERT INTO ruleset_class_abilities (class_id, ability_name, ability_description, ability_type, charge_type, max_charges, granted_at_level)
  VALUES (v_class_id, 'MARK', '1 Charge. Mark target (3 rds): 1. +2 to hit them 2. If they attack ally, Reaction to give -2 to attack.', 'bonus', 'uses', 1, 1);

  -- STRIKER
  INSERT INTO ruleset_classes (ruleset_id, key, name, description, hp, ac, cdd, speed, initiative_modifier, implant_capacity,
    stat_bonuses, skill_bonuses, save_proficiencies, weapon_proficiencies, armor_proficiencies, tools, sort_order)
  VALUES (v_ruleset_id, 'striker', 'STRIKER', 'You punch real good. Fast, clean, brutal.',
    16, 13, 'd8', 35, 2, 3,
    '{"dex": 2, "con": 1}'::jsonb, '{"acrobatics": 3, "sleight_of_hand": 2}'::jsonb,
    ARRAY['DEX','WIS'], ARRAY['unarmed','melee'], ARRAY['clothes','light'],
    '[{"name":"Parkour Rig","description":"grip gloves, tape, spikes. Vaults/climbs/landings."},{"name":"Silent Kit","description":"soft soles, black tape. Reduce noise, move unseen."}]'::jsonb, 7)
  RETURNING id INTO v_class_id;
  INSERT INTO ruleset_class_abilities (class_id, ability_name, ability_description, ability_type, charge_type, max_charges, granted_at_level)
  VALUES (v_class_id, 'FLOW', '1 Charge. This turn get +20 ft movement and make one extra Strike (1d8 damage) as a Bonus Action.', 'bonus', 'uses', 1, 1);

  -- VOW
  INSERT INTO ruleset_classes (ruleset_id, key, name, description, hp, ac, cdd, speed, initiative_modifier, implant_capacity,
    stat_bonuses, skill_bonuses, save_proficiencies, weapon_proficiencies, armor_proficiencies, tools, sort_order)
  VALUES (v_ruleset_id, 'vow', 'VOW', 'Your code/cause/contract makes you dangerous. You hit like judgment.',
    20, 16, 'd10', 25, 0, 5,
    '{"cha": 2, "str": 1}'::jsonb, '{"intimidation": 3, "insight": 2}'::jsonb,
    ARRAY['CHA','WIS'], ARRAY['melee','sidearms','longarms'], ARRAY['clothes','medium','heavy','shield'],
    '[{"name":"Interrogation Kit","description":"cuffs, recorder, leverage notes. Questioning, pressure."},{"name":"Restraint Kit","description":"zipcuffs, chain, shock cuffs. Detain targets, stop escapes."}]'::jsonb, 8)
  RETURNING id INTO v_class_id;
  INSERT INTO ruleset_class_abilities (class_id, ability_name, ability_description, ability_type, charge_type, max_charges, granted_at_level)
  VALUES (v_class_id, 'JUDGMENT', 'On Hit: 1 Charge. Add +1d10 extra damage. Target makes WIS save or is Frightened for 1 round.', 'action', 'uses', 1, 1);

  -- TRACKER
  INSERT INTO ruleset_classes (ruleset_id, key, name, description, hp, ac, cdd, speed, initiative_modifier, implant_capacity,
    stat_bonuses, skill_bonuses, save_proficiencies, weapon_proficiencies, armor_proficiencies, tools, sort_order)
  VALUES (v_ruleset_id, 'tracker', 'TRACKER', 'You live in the edges — rooftops, alleys, wastelands — and always find the target.',
    20, 14, 'd8', 30, 1, 4,
    '{"wis": 2, "dex": 1}'::jsonb, '{"survival": 3, "perception": 2}'::jsonb,
    ARRAY['WIS','DEX'], ARRAY['melee','sidearms','longarms'], ARRAY['clothes','light','medium'],
    '[{"name":"Nav Rig","description":"offline map, compass, mono. Route planning, spotting trails."},{"name":"Tripwire Kit","description":"wire spool, anchors, noise makers. Set/spot/disarm traps."}]'::jsonb, 9)
  RETURNING id INTO v_class_id;
  INSERT INTO ruleset_class_abilities (class_id, ability_name, ability_description, ability_type, charge_type, max_charges, granted_at_level)
  VALUES (v_class_id, 'TRACE', '1 Charge. Mark target (24h). For 10 min: +4 to track/spot them. First hit deals +1d8 damage.', 'action', 'uses', 1, 1);

  -- GHOST
  INSERT INTO ruleset_classes (ruleset_id, key, name, description, hp, ac, cdd, speed, initiative_modifier, implant_capacity,
    stat_bonuses, skill_bonuses, save_proficiencies, weapon_proficiencies, armor_proficiencies, tools, sort_order)
  VALUES (v_ruleset_id, 'ghost', 'GHOST', 'You''re sneaky, you bypass locks and cameras, and you leave no proof.',
    16, 13, 'd8', 35, 2, 3,
    '{"dex": 2, "int": 1}'::jsonb, '{"stealth": 3, "sleight_of_hand": 2}'::jsonb,
    ARRAY['DEX','INT'], ARRAY['melee','sidearms'], ARRAY['clothes','light'],
    '[{"name":"Lockpick Set","description":"picks, shims, mini pry. Silent entry, small safes."},{"name":"Disguise Kit","description":"makeup, voice mod, uniform bits. Blend in, pass checkpoints."}]'::jsonb, 10)
  RETURNING id INTO v_class_id;
  INSERT INTO ruleset_class_abilities (class_id, ability_name, ability_description, ability_type, charge_type, max_charges, granted_at_level)
  VALUES (v_class_id, 'AMBUSH', '1 Charge. If hit while hidden/surprise: add +1d8 damage, target DEX save. Fail: lose Reaction until next turn.', 'action', 'uses', 1, 1);

  -- SPARK
  INSERT INTO ruleset_classes (ruleset_id, key, name, description, hp, ac, cdd, speed, initiative_modifier, implant_capacity,
    stat_bonuses, skill_bonuses, save_proficiencies, weapon_proficiencies, armor_proficiencies, tools, sort_order)
  VALUES (v_ruleset_id, 'spark', 'SPARK', 'You''ve got something in you that shouldn''t exist — psionics, prototype aug, power.',
    16, 13, 'd10', 30, 1, 3,
    '{"cha": 2, "con": 1}'::jsonb, '{"insight": 3, "intimidation": 2}'::jsonb,
    ARRAY['CHA','CON'], ARRAY['sidearms'], ARRAY['clothes','light'],
    '[{"name":"Focus Kit","description":"grounding tags, stim-doser, noise-cancel. Prevent overload, stabilize."},{"name":"Trauma Kit","description":"tourniquets, clot spray. Keep people alive."}]'::jsonb, 11)
  RETURNING id INTO v_class_id;
  INSERT INTO ruleset_class_abilities (class_id, ability_name, ability_description, ability_type, charge_type, max_charges, granted_at_level)
  VALUES (v_class_id, 'SURGE', '1 Charge. Choose one: Blast (ranged hit 1d10 dmg 30 ft), Push (target STR save or shoved 10 ft), Shield (gain AC +2 for 2 rounds).', 'action', 'uses', 1, 1);

  -- PACT
  INSERT INTO ruleset_classes (ruleset_id, key, name, description, hp, ac, cdd, speed, initiative_modifier, implant_capacity,
    stat_bonuses, skill_bonuses, save_proficiencies, weapon_proficiencies, armor_proficiencies, tools, sort_order)
  VALUES (v_ruleset_id, 'pact', 'PACT', 'You''re borrowing power from something bigger (AI, cartel, corp). Nothing is free.',
    16, 14, 'd8', 30, 1, 3,
    '{"cha": 2, "int": 1}'::jsonb, '{"deception": 3, "persuasion": 2}'::jsonb,
    ARRAY['CHA','WIS'], ARRAY['sidearms','longarms'], ARRAY['clothes','light','medium'],
    '[{"name":"Cyberdeck","description":"portable deck + cables. Crack access, spoof IDs, fight ICE."},{"name":"Forgery Kit","description":"blank cards, stamps, holos. Fake IDs, alter documents."}]'::jsonb, 12)
  RETURNING id INTO v_class_id;
  INSERT INTO ruleset_class_abilities (class_id, ability_name, ability_description, ability_type, charge_type, max_charges, granted_at_level)
  VALUES (v_class_id, 'BOON', '1 Charge. Choose one: Curse (target -2 to saves for 2 rds), Buffer (8 temp HP for 10 min), Blink (teleport 15 ft to visible spot).', 'action', 'uses', 1, 1);

  -- CODER
  INSERT INTO ruleset_classes (ruleset_id, key, name, description, hp, ac, cdd, speed, initiative_modifier, implant_capacity,
    stat_bonuses, skill_bonuses, save_proficiencies, weapon_proficiencies, armor_proficiencies, tools, sort_order)
  VALUES (v_ruleset_id, 'coder', 'CODER', 'You studied your way into power: exploits, systems, gadgets. Squishy but scary.',
    12, 12, 'd8', 30, 0, 2,
    '{"int": 2, "wis": 1}'::jsonb, '{"hacking": 3, "investigation": 2}'::jsonb,
    ARRAY['INT','WIS'], ARRAY['sidearms'], ARRAY['clothes','light'],
    '[{"name":"Cyberdeck","description":"deck + cables. Hack networks, seize devices, run daemons."},{"name":"Electronics Kit","description":"solder pen, multimeter. Repair/disable tech, build gadgets."}]'::jsonb, 13)
  RETURNING id INTO v_class_id;
  INSERT INTO ruleset_class_abilities (class_id, ability_name, ability_description, ability_type, charge_type, max_charges, granted_at_level)
  VALUES (v_class_id, 'OVERRIDE', '1 Charge. Hack vs WIS save. Success choose (1 rd): Jam (no ranged weapons), Blind (-2 to hit), Shock (deal 1d8 damage).', 'action', 'uses', 1, 1);

  RAISE NOTICE 'Default Cyberpunk ruleset seeded with ID: %', v_ruleset_id;
END $$;
