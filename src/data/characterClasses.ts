// Character classes for Cyberpunk RED system
// Based on the images provided with stats, skills, tools, and special abilities

// Weapon proficiency types
export type WeaponType = 'unarmed' | 'melee' | 'sidearms' | 'longarms' | 'heavy';

// Convert weapon rank (0-5) to to-hit modifier
// Rank 0: -2 (not proficient)
// Rank 1: +0, Rank 2: +1, Rank 3: +2, Rank 4: +3, Rank 5: +4
export const getWeaponToHitModifier = (rank: number): number => {
  if (rank === 0) return -2; // Not proficient
  return rank - 1; // Rank 1 = +0, Rank 2 = +1, etc.
};

// Format to-hit modifier for display
export const formatToHit = (rank: number): string => {
  const mod = getWeaponToHitModifier(rank);
  if (mod >= 0) return `+${mod}`;
  return `${mod}`;
};

export interface ClassFeature {
  name: string;
  description: string;
  type: 'ACTION' | 'BONUS' | 'HIT/STEALTH' | 'ON HIT' | 'passive';
  charges?: number;
  effects?: string[];
}

export interface CharacterClass {
  id: string;
  name: string;
  description: string;
  hp: number;
  ac: number;
  cdd: string; // Combat Damage Die
  speed: number; // Base movement speed in feet
  initiative_modifier: number; // Bonus to initiative rolls
  implant_capacity: number; // Number of cyberware implant slots
  armorProficiencies: ('clothes' | 'light' | 'medium' | 'heavy' | 'shield')[]; // Armor types this class can use
  weaponProficiencies: ('unarmed' | 'melee' | 'sidearms' | 'longarms' | 'heavy')[]; // Weapon types this class starts proficient with
  statBonuses: {
    primary: string; // +2
    secondary: string; // +1
  };
  skills: string[]; // Skills with proficiency
  skillBonuses: { [key: string]: number };
  saves: string[];
  tools: Array<{
    name: string;
    description: string;
  }>;
  classFeatures: ClassFeature[];
}

export const CHARACTER_CLASSES: CharacterClass[] = [
  {
    id: 'bruiser',
    name: 'BRUISER',
    description: "You're beefy and you hit things really hard, usually while running on combat stims.",
    hp: 24,
    ac: 16,
    cdd: 'd12',
    speed: 25,
    initiative_modifier: 0,
    implant_capacity: 6,
    armorProficiencies: ['light', 'medium', 'heavy', 'shield'],
    weaponProficiencies: ['unarmed', 'melee', 'longarms'],
    statBonuses: { primary: 'STR', secondary: 'CON' },
    skills: ['Athletics', 'Intimidation'],
    skillBonuses: { Athletics: 3, Intimidation: 2 },
    saves: ['STR', 'CON'],
    tools: [
      { name: 'Driver Rig', description: 'keys/jammers, mount clamp, flares, jump pack. Hotwire, chase stunts.' },
      { name: 'Gunsmith Kit', description: 'cleaning tools, punch set, springs. Clear jams, maintain guns.' }
    ],
    classFeatures: [
      {
        name: 'OVERDRIVE',
        description: '1 Charge. For 3 rounds: deal +2 damage on melee hits and reduce incoming physical damage by 2.',
        type: 'BONUS',
        charges: 1
      }
    ]
  },
  {
    id: 'icon',
    name: 'ICON',
    description: "You're charismatic and dangerous with attention. You steer people, crowds, and feeds.",
    hp: 16,
    ac: 13,
    cdd: 'd6',
    speed: 30,
    initiative_modifier: 1,
    implant_capacity: 3,
    armorProficiencies: ['clothes', 'light'],
    weaponProficiencies: ['sidearms'],
    statBonuses: { primary: 'CHA', secondary: 'INT' },
    skills: ['Persuasion', 'Performance'],
    skillBonuses: { Persuasion: 3, Performance: 2 },
    saves: ['CHA', 'DEX'],
    tools: [
      { name: 'Disguise Kit', description: 'makeup, hair pieces, voice mod. Build a look, pass inspection.' },
      { name: 'Broadcast Rig', description: 'cam, uplink, editing app. Stream, edit, fabricate "proof."' }
    ],
    classFeatures: [
      {
        name: 'SPOTLIGHT',
        description: '1 Charge. Pick visible target. They make WIS save. Fail: Shaken for 2 rounds (-2 to attack rolls).',
        type: 'ACTION',
        charges: 1,
        effects: ['Shaken for 2 rounds (-2 to attack rolls)']
      }
    ]
  },
  {
    id: 'hexer',
    name: 'HEXER',
    description: "You're cursed (bad firmware, virus) and you weaponize it.",
    hp: 20,
    ac: 14,
    cdd: 'd8',
    speed: 30,
    initiative_modifier: 1,
    implant_capacity: 4,
    armorProficiencies: ['clothes', 'light', 'medium'],
    weaponProficiencies: ['melee', 'sidearms', 'longarms'],
    statBonuses: { primary: 'DEX', secondary: 'CON' },
    skills: ['Investigation', 'Survival'],
    skillBonuses: { Investigation: 3, Survival: 2 },
    saves: ['CON', 'WIS'],
    tools: [
      { name: 'Toxin Case', description: 'reagents, droppers, neutralizer. ID poisons, make simple toxins.' },
      { name: 'Evidence Kit', description: 'swabs, UV light, tags. Collect evidence, reconstruct scenes.' }
    ],
    classFeatures: [
      {
        name: 'CURSE',
        description: '1 Charge. Mark target for 1 min. The first time each round you hit them, deal +1d8 extra damage (viral/rot).',
        type: 'ACTION',
        charges: 1,
        effects: ['+1d8 extra damage per round']
      }
    ]
  },
  {
    id: 'apostle',
    name: 'APOSTLE',
    description: "You're a higher power's favorite employee. You keep people alive.",
    hp: 20,
    ac: 14,
    cdd: 'd6',
    speed: 30,
    initiative_modifier: 0,
    implant_capacity: 2,
    armorProficiencies: ['clothes', 'light', 'medium', 'shield'],
    weaponProficiencies: ['sidearms', 'longarms'],
    statBonuses: { primary: 'WIS', secondary: 'CHA' },
    skills: ['Medicine', 'Insight'],
    skillBonuses: { Medicine: 3, Insight: 2 },
    saves: ['WIS', 'CHA'],
    tools: [
      { name: 'Trauma Kit', description: 'clot spray, stapler, injectors. Stabilize, stop bleeding.' },
      { name: 'Breach Kit', description: 'lock shims, keypad probe. Slip basic locks and doors.' }
    ],
    classFeatures: [
      {
        name: 'PATCH',
        description: '1 Charge. Touch ally within 5 ft. They heal 1d6 + 4 HP and stop bleeding/ongoing damage.',
        type: 'ACTION',
        charges: 1,
        effects: ['Heal 1d6+4 HP', 'Stop bleeding']
      }
    ]
  },
  {
    id: 'biohack',
    name: 'BIOHACK',
    description: 'Living mods, symbiotes, gene edits — nature, but weaponized.',
    hp: 20,
    ac: 14,
    cdd: 'd8',
    speed: 30,
    initiative_modifier: 0,
    implant_capacity: 4,
    armorProficiencies: ['clothes', 'light', 'medium'],
    weaponProficiencies: ['unarmed', 'melee'],
    statBonuses: { primary: 'CON', secondary: 'WIS' },
    skills: ['Biology', 'Nature'],
    skillBonuses: { Biology: 3, Nature: 2 },
    saves: ['CON', 'INT'],
    tools: [
      { name: 'Bio Sampler', description: 'swabs, scanner, culture card. Scan bio, handle living mods.' },
      { name: 'Trauma Kit', description: 'tourniquets, injectors. Stabilize, stop bleeding fast.' }
    ],
    classFeatures: [
      {
        name: 'ADAPT',
        description: '1 Charge. Choose for 10 mins: Armor Skin (AC +2), Claws (melee hits +2 dmg), or Gills (ignore gas, Adv vs toxins).',
        type: 'BONUS',
        charges: 1,
        effects: ['Armor Skin: AC +2', 'Claws: melee +2 dmg', 'Gills: ignore gas, Adv vs toxins']
      }
    ]
  },
  {
    id: 'solo',
    name: 'SOLO',
    description: 'Professional violence. Clean, efficient, hard to kill.',
    hp: 20,
    ac: 15,
    cdd: 'd10',
    speed: 30,
    initiative_modifier: 1,
    implant_capacity: 5,
    armorProficiencies: ['clothes', 'light', 'medium', 'heavy', 'shield'],
    weaponProficiencies: ['melee', 'sidearms', 'longarms', 'heavy'],
    statBonuses: { primary: 'DEX', secondary: 'STR' },
    skills: ['Perception', 'Athletics'],
    skillBonuses: { Perception: 3, Athletics: 2 },
    saves: ['DEX', 'CON'],
    tools: [
      { name: 'Gunsmith Kit', description: 'cleaning tools, sight tool. Weapon upkeep, jam-clears.' },
      { name: 'Driver Rig', description: 'keys, tire plugs, jump pack. Pursuit driving.' }
    ],
    classFeatures: [
      {
        name: 'MARK',
        description: '1 Charge. Mark target (3 rds): 1. +2 to hit them 2. If they attack ally, Reaction to give -2 to attack.',
        type: 'BONUS',
        charges: 1,
        effects: ['+2 to hit', 'Reaction: -2 to their attack']
      }
    ]
  },
  {
    id: 'striker',
    name: 'STRIKER',
    description: 'You punch real good. Fast, clean, brutal.',
    hp: 16,
    ac: 13,
    cdd: 'd8',
    speed: 35,
    initiative_modifier: 2,
    implant_capacity: 3,
    armorProficiencies: ['clothes', 'light'],
    weaponProficiencies: ['unarmed', 'melee'],
    statBonuses: { primary: 'DEX', secondary: 'CON' },
    skills: ['Acrobatics', 'Sleight of Hand'],
    skillBonuses: { Acrobatics: 3, 'Sleight of Hand': 2 },
    saves: ['DEX', 'WIS'],
    tools: [
      { name: 'Parkour Rig', description: 'grip gloves, tape, spikes. Vaults/climbs/landings.' },
      { name: 'Silent Kit', description: 'soft soles, black tape. Reduce noise, move unseen.' }
    ],
    classFeatures: [
      {
        name: 'FLOW',
        description: '1 Charge. This turn get +20 ft movement and make one extra Strike (1d8 damage) as a Bonus Action.',
        type: 'BONUS',
        charges: 1,
        effects: ['+20 ft movement', 'Extra 1d8 strike']
      }
    ]
  },
  {
    id: 'vow',
    name: 'VOW',
    description: 'Your code/cause/contract makes you dangerous. You hit like judgment.',
    hp: 20,
    ac: 16,
    cdd: 'd10',
    speed: 25,
    initiative_modifier: 0,
    implant_capacity: 5,
    armorProficiencies: ['clothes', 'medium', 'heavy', 'shield'],
    weaponProficiencies: ['melee', 'sidearms', 'longarms'],
    statBonuses: { primary: 'CHA', secondary: 'STR' },
    skills: ['Intimidation', 'Insight'],
    skillBonuses: { Intimidation: 3, Insight: 2 },
    saves: ['CHA', 'WIS'],
    tools: [
      { name: 'Interrogation Kit', description: 'cuffs, recorder, leverage notes. Questioning, pressure.' },
      { name: 'Restraint Kit', description: 'zipcuffs, chain, shock cuffs. Detain targets, stop escapes.' }
    ],
    classFeatures: [
      {
        name: 'JUDGMENT',
        description: "1 Charge. Add +1d10 extra damage. Target makes WIS save or is Frightened for 1 round (can't move closer).",
        type: 'ON HIT',
        charges: 1,
        effects: ['+1d10 damage', 'Frightened (WIS save)']
      }
    ]
  },
  {
    id: 'tracker',
    name: 'TRACKER',
    description: 'You live in the edges — rooftops, alleys, wastelands — and always find the target.',
    hp: 20,
    ac: 14,
    cdd: 'd8',
    speed: 30,
    initiative_modifier: 1,
    implant_capacity: 4,
    armorProficiencies: ['clothes', 'light', 'medium'],
    weaponProficiencies: ['melee', 'sidearms', 'longarms'],
    statBonuses: { primary: 'WIS', secondary: 'DEX' },
    skills: ['Survival', 'Perception'],
    skillBonuses: { Survival: 3, Perception: 2 },
    saves: ['WIS', 'DEX'],
    tools: [
      { name: 'Nav Rig', description: 'offline map, compass, mono. Route planning, spotting trails.' },
      { name: 'Tripwire Kit', description: 'wire spool, anchors, noise makers. Set/spot/disarm traps.' }
    ],
    classFeatures: [
      {
        name: 'TRACE',
        description: '1 Charge. Mark target (24h). For 10 min: 1. +4 to track/spot them 2. First hit deals +1d8 damage',
        type: 'ACTION',
        charges: 1,
        effects: ['+4 to track', 'First hit +1d8 damage']
      }
    ]
  },
  {
    id: 'ghost',
    name: 'GHOST',
    description: "You're sneaky, you bypass locks and cameras, and you leave no proof.",
    hp: 16,
    ac: 13,
    cdd: 'd8',
    speed: 35,
    initiative_modifier: 2,
    implant_capacity: 3,
    armorProficiencies: ['clothes', 'light'],
    weaponProficiencies: ['melee', 'sidearms'],
    statBonuses: { primary: 'DEX', secondary: 'INT' },
    skills: ['Stealth', 'Sleight of Hand'],
    skillBonuses: { Stealth: 3, 'Sleight of Hand': 2 },
    saves: ['DEX', 'INT'],
    tools: [
      { name: 'Lockpick Set', description: 'picks, shims, mini pry. Silent entry, small safes.' },
      { name: 'Disguise Kit', description: 'makeup, voice mod, uniform bits. Blend in, pass checkpoints.' }
    ],
    classFeatures: [
      {
        name: 'AMBUSH',
        description: '1 Charge. If hit while hidden/surprise: add +1d8 damage, target DEX save. Fail: lose Reaction until next turn.',
        type: 'HIT/STEALTH',
        charges: 1,
        effects: ['+1d8 damage', 'Remove reaction (DEX save)']
      }
    ]
  },
  {
    id: 'spark',
    name: 'SPARK',
    description: "You've got something in you that shouldn't exist — psionics, prototype aug, power.",
    hp: 16,
    ac: 13,
    cdd: 'd10',
    speed: 30,
    initiative_modifier: 1,
    implant_capacity: 3,
    armorProficiencies: ['clothes', 'light'],
    weaponProficiencies: ['sidearms'],
    statBonuses: { primary: 'CHA', secondary: 'CON' },
    skills: ['Insight', 'Intimidation'],
    skillBonuses: { Insight: 3, Intimidation: 2 },
    saves: ['CHA', 'CON'],
    tools: [
      { name: 'Focus Kit', description: 'grounding tags, stim-doser, noise-cancel. Prevent overload, stabilize.' },
      { name: 'Trauma Kit', description: 'tourniquets, clot spray. Keep people alive.' }
    ],
    classFeatures: [
      {
        name: 'SURGE',
        description: '1 Charge. Choose one: Blast (ranged hit 1d10 dmg 30 ft), Push (target STR save or shoved 10 ft), Shield (gain AC +2 for 2 rounds)',
        type: 'ACTION',
        charges: 1,
        effects: ['Blast: 1d10 dmg (30 ft)', 'Push: 10 ft (STR save)', 'Shield: AC +2 (2 rds)']
      }
    ]
  },
  {
    id: 'pact',
    name: 'PACT',
    description: "You're borrowing power from something bigger (AI, cartel, corp). Nothing is free.",
    hp: 16,
    ac: 14,
    cdd: 'd8',
    speed: 30,
    initiative_modifier: 1,
    implant_capacity: 3,
    armorProficiencies: ['clothes', 'light', 'medium'],
    weaponProficiencies: ['sidearms', 'longarms'],
    statBonuses: { primary: 'CHA', secondary: 'INT' },
    skills: ['Deception', 'Persuasion'],
    skillBonuses: { Deception: 3, Persuasion: 2 },
    saves: ['CHA', 'WIS'],
    tools: [
      { name: 'Cyberdeck', description: 'portable deck + cables. Crack access, spoof IDs, fight ICE.' },
      { name: 'Forgery Kit', description: 'blank cards, stamps, holos. Fake IDs, alter documents.' }
    ],
    classFeatures: [
      {
        name: 'BOON',
        description: '1 Charge. Choose one: Curse (target -2 to saves for 2 rds), Buffer (8 temp HP for 10 min), Blink (teleport 15 ft to visible spot)',
        type: 'ACTION',
        charges: 1,
        effects: ['Curse: -2 saves (2 rds)', 'Buffer: 8 temp HP (10 min)', 'Blink: teleport 15 ft']
      }
    ]
  },
  {
    id: 'coder',
    name: 'CODER',
    description: 'You studied your way into power: exploits, systems, gadgets. Squishy but scary.',
    hp: 12,
    ac: 12,
    cdd: 'd8',
    speed: 30,
    initiative_modifier: 0,
    implant_capacity: 2,
    armorProficiencies: ['clothes', 'light'],
    weaponProficiencies: ['sidearms'],
    statBonuses: { primary: 'INT', secondary: 'WIS' },
    skills: ['Hacking', 'Investigation'],
    skillBonuses: { Hacking: 3, Investigation: 2 },
    saves: ['INT', 'WIS'],
    tools: [
      { name: 'Cyberdeck', description: 'deck + cables. Hack networks, seize devices, run daemons.' },
      { name: 'Electronics Kit', description: 'solder pen, multimeter. Repair/disable tech, build gadgets.' }
    ],
    classFeatures: [
      {
        name: 'OVERRIDE',
        description: '1 Charge. Hack vs WIS save. Success choose (1 rd): Jam (no ranged weapons), Blind (-2 to hit), Shock (deal 1d8 damage)',
        type: 'ACTION',
        charges: 1,
        effects: ['Jam: no ranged weapons', 'Blind: -2 to hit', 'Shock: 1d8 damage']
      }
    ]
  }
];

// All 18 skills
export const ALL_SKILLS = [
  'Acrobatics',
  'Animal Handling',
  'Athletics',
  'Biology',
  'Deception',
  'Hacking',
  'History',
  'Insight',
  'Intimidation',
  'Investigation',
  'Medicine',
  'Nature',
  'Perception',
  'Performance',
  'Persuasion',
  'Sleight of Hand',
  'Stealth',
  'Survival'
];

// Stat abbreviations
export const STATS = ['STR', 'DEX', 'CON', 'WIS', 'INT', 'CHA'];
