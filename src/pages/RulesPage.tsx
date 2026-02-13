import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CHARACTER_CLASSES, ALL_SKILLS } from '../data/characterClasses';

type RulesSection = 'overview' | 'combat' | 'conditions' | 'damage-types' | 'skills' | 'classes' | 'equipment' | 'exploration';

export default function RulesPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [activeSection, setActiveSection] = useState<RulesSection>('overview');
  const [expandedCondition, setExpandedCondition] = useState<string | null>(null);
  const [expandedClass, setExpandedClass] = useState<string | null>(null);

  const sections: { id: RulesSection; label: string; icon: string }[] = [
    { id: 'overview', label: 'OVERVIEW', icon: '📖' },
    { id: 'combat', label: 'COMBAT', icon: '⚔️' },
    { id: 'conditions', label: 'CONDITIONS', icon: '🩹' },
    { id: 'damage-types', label: 'DAMAGE TYPES', icon: '💥' },
    { id: 'skills', label: 'SKILLS & STATS', icon: '🎯' },
    { id: 'classes', label: 'CLASSES', icon: '👤' },
    { id: 'equipment', label: 'EQUIPMENT', icon: '🔫' },
    { id: 'exploration', label: 'EXPLORATION', icon: '🌐' },
  ];

  // ── CONDITIONS DATA ──
  const conditions = [
    {
      name: 'Blinded',
      effects: "You can't see; you automatically fail any check that requires sight. Attack rolls against you have advantage; your attack rolls have disadvantage. You can't benefit from sight based abilities.",
      ends: 'Remove if your vision is restored. CON save throw ends if the cause is temporary.'
    },
    {
      name: 'Charmed',
      effects: "You can't attack the charmer or target them with harmful abilities. The charmer has advantage on social checks vs you. You treat the charmer as a \"good friend\".",
      ends: "If the charmer or their allies directly harm you; or Wisdom saving throw. Droids roll with advantage."
    },
    {
      name: 'Deafened',
      effects: "You can't hear and automatically fail any check that requires hearing. You have disadvantage to detect hidden foes by sound and to use abilities that require spoken codes/commands over open air.",
      ends: 'Remove if hearing is restored. CON saving throws ends for temporary ringing.'
    },
    {
      name: 'Exhausted / Overheating',
      effects: "Your body slowly starts to fail on you. Disadvantage on any role (attack, save, check).",
      ends: 'Remove if energy is restored. CON saving throws end for slight exhaustion.'
    },
    {
      name: 'Flying',
      effects: "You can move in 3D using your fly speed. If your speed is reduced to 0 roll a DEX saving throw. Failure results in prone + (1d6 Damage).",
      ends: 'Lose on shutdown, fuel out, system damage, or entering a no-fly zone.'
    },
    {
      name: 'Frightened',
      effects: "Disadvantage on ability checks and attack rolls while the source of fear is in sight. You can't willingly move closer to the source.",
      ends: "WIS saving throw ends. If you break line of sight for a full round, make the save with advantage."
    },
    {
      name: 'Grappled',
      effects: "Your speed becomes 0 and can't increase. Ends if the grappler is incapacitated or you're removed from their reach. The grappler's movement is halved when dragging you unless you are two sizes smaller.",
      ends: "Action to escape (STR (Athletics) or DEX (Acrobatics)) vs grappler (STR (Athletics) or DEX (Acrobatics))."
    },
    {
      name: 'Hacked',
      effects: 'Disadvantage on checks and attacks that use affected cyberware, drones, or vehicle subsystems.',
      ends: 'INT saving throw ends. Rebooting also ends (become incapacitated for 1d4 rounds).'
    },
    {
      name: 'Incapacitated',
      effects: "You can't take actions or reactions. You can still maintain posture and breathe.",
      ends: 'When the effect lifting it ends (stun wears off, sedative passes, reboot completes).'
    },
    {
      name: 'Invisible',
      effects: "You are unseen without special sensors. Attack rolls against you have disadvantage, and your attacks have advantage; you don't reveal your position unless you make sound, leave traces, or are detected by sensors.",
      ends: "Firing unsuppressed weapons, being splashed, scanned by thermal/LIDAR, or taking certain actions may reveal position (GM). Most invisibility ends if you attack, hack, or activate an offensive ability."
    },
    {
      name: 'Poisoned',
      effects: 'Disadvantage on attack rolls and ability checks. Take (1d4) damage at the start of turn.',
      ends: 'Save ends (CON). Antidote or detox medkit ends or grants advantage on saves.'
    },
    {
      name: 'Restrained',
      effects: "Speed 0; attack rolls against you have advantage; your attack rolls have disadvantage; you have disadvantage on DEX saves.",
      ends: "Escape check (as Grappled, usually harder vs restraints), destroying or unlocking the restraint, or the effect ends. Cyber restraints may require a hacking/tools check to release."
    },
    {
      name: 'Stunned',
      effects: "Incapacitated; can't move; can speak only falteringly; you automatically fail STR and DEX saves; attack rolls against you have advantage.",
      ends: "Save ends (CON) or when the stunning effect ends (flash charge, shock baton, sonic concussion)."
    },
    {
      name: 'Unconscious',
      effects: "Incapacitated; you drop prone; can't move or speak; unaware of surroundings; you drop held items; you automatically fail STR and DEX saves; attack rolls against you have advantage, and any hit within 5 ft is a critical hit.",
      ends: "Regain HP, are stabilized and roused (action by an adjacent creature), or the effect ends (sedative wears off). Loud damage/pain doesn't grant a save unless the GM rules it does."
    }
  ];

  // ── DAMAGE TYPES DATA ──
  const damageTypes = [
    { name: 'Slashing', description: 'Caused by weapons with a sharpened blade such as a sword or dagger.', color: '#FF6B6B' },
    { name: 'Bludgeoning', description: 'Caused by weapons with a blunt surface such as a hammer or hilt of a gun.', color: '#A0522D' },
    { name: 'Piercing', description: 'Typically caused by ammunition based weapons or pointed melee weapons.', color: '#87CEEB' },
    { name: 'Cryptic', description: 'Caused hacking/malfunctions inflicted by the user. If cryptic damage is inflicted, roll a INT saving throw to avoid being "Hacked".', color: '#00FF88' },
    { name: 'Cold', description: 'Caused by weapons/abilities that emitting freezing cold temperatures. If cold damage is inflicted, roll saving throw (DM Choice) to avoid Frostburn damage (1d4).', color: '#00D4FF' },
    { name: 'Fire', description: 'Caused by weapons/abilities that emitting scorching temperatures. If fire damage is inflicted, roll a saving throw (DM Choice) to avoid Burn damage (1d4).', color: '#FF4500' },
    { name: 'Physical', description: 'Caused by general melee attacks from fist/objects.', color: '#C0C0C0' },
    { name: 'Poison', description: 'Caused by poison/toxin based weapons/abilities inflicted by the user. If poison damage is inflicted, roll a CON saving throw to avoid being "Poisoned".', color: '#7CFC00' },
    { name: 'Psychic', description: 'Caused by mental attacks inflicted by the user. If psychic damage is inflicted, roll a INT saving throw to avoid being "Frightened".', color: '#BD00FF' },
    { name: 'Shock', description: 'Caused by shock inducing weapons. If shock damage is inflicted, deal additional shock damage (1d4) to all nearby entities near the target. Target rolls a CON saving throw to avoid being "Stunned".', color: '#FFD700' },
  ];

  // ── SKILL DESCRIPTIONS ──
  const skillDescriptions: Record<string, { stat: string; description: string }> = {
    'Acrobatics': { stat: 'DEX', description: 'Balance, flips, dodging through tight spaces, parkour stunts.' },
    'Animal Handling': { stat: 'WIS', description: 'Calming animals, controlling mounts or bio-drones.' },
    'Athletics': { stat: 'STR', description: 'Climbing, swimming, jumping, grappling, feats of raw strength.' },
    'Biology': { stat: 'INT', description: 'Knowledge of organisms, biotech, genetic modifications, toxins.' },
    'Deception': { stat: 'CHA', description: 'Lying convincingly, disguising intentions, running cons.' },
    'Hacking': { stat: 'INT', description: 'Breaking into systems, cracking ICE, hijacking drones and devices.' },
    'History': { stat: 'INT', description: 'Knowledge of past events, corps, factions, old-world lore.' },
    'Insight': { stat: 'WIS', description: 'Reading body language, detecting lies, sensing motives.' },
    'Intimidation': { stat: 'CHA', description: 'Threatening, menacing, forcing compliance through fear.' },
    'Investigation': { stat: 'INT', description: 'Searching for clues, analyzing evidence, logical deduction.' },
    'Medicine': { stat: 'WIS', description: 'First aid, diagnosing illness, stabilizing the dying, surgery.' },
    'Nature': { stat: 'WIS', description: 'Knowledge of the natural world, weather, plants, wasteland survival.' },
    'Perception': { stat: 'WIS', description: 'Spotting hidden things, hearing distant sounds, general awareness.' },
    'Performance': { stat: 'CHA', description: 'Acting, singing, playing instruments, working a crowd.' },
    'Persuasion': { stat: 'CHA', description: 'Convincing others through diplomacy, charm, or reasoned argument.' },
    'Sleight of Hand': { stat: 'DEX', description: 'Pickpocketing, planting items, card tricks, disabling small devices.' },
    'Stealth': { stat: 'DEX', description: 'Moving silently, hiding, tailing targets, blending into crowds.' },
    'Survival': { stat: 'WIS', description: 'Tracking, foraging, navigating, reading terrain and weather.' },
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0D1117 0%, #010409 50%, #0D1117 100%)', backgroundAttachment: 'fixed' }}>
      {/* Header */}
      <div className="glass-panel" style={{ borderRadius: 0, borderBottom: '2px solid var(--color-cyber-cyan)' }}>
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-sm px-3 py-1.5 rounded transition-all hover:opacity-80"
              style={{
                border: '1px solid var(--color-cyber-cyan)',
                color: 'var(--color-cyber-cyan)',
                fontFamily: 'var(--font-mono)',
                background: 'transparent'
              }}
            >
              ← BACK
            </button>
            <h1 className="text-2xl neon-text" style={{ fontFamily: 'var(--font-cyber)' }}>
              📜 SYSTEM RULES
            </h1>
          </div>
          <span className="text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.6 }}>
            {profile?.role === 'admin' ? '👑 DM' : '🎮 PLAYER'} // {profile?.username}
          </span>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Section Navigation */}
        <div className="glass-panel p-2 mb-6" style={{ border: '1px solid var(--color-cyber-cyan)' }}>
          <div className="flex gap-2 flex-wrap">
            {sections.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className="px-4 py-2 text-sm rounded transition-all"
                style={{
                  fontFamily: 'var(--font-mono)',
                  backgroundColor: activeSection === section.id ? 'var(--color-cyber-cyan)' : 'transparent',
                  color: activeSection === section.id ? '#0D1117' : 'var(--color-cyber-cyan)',
                  border: `1px solid ${activeSection === section.id ? 'var(--color-cyber-cyan)' : 'color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)'}`,
                  fontWeight: activeSection === section.id ? 'bold' : 'normal'
                }}
              >
                {section.icon} {section.label}
              </button>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════ OVERVIEW ═══════════════════════════════════════════ */}
        {activeSection === 'overview' && (
          <div className="space-y-6">
            {/* Welcome Panel */}
            <div className="glass-panel p-6" style={{ border: '2px solid var(--color-cyber-cyan)' }}>
              <h2 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
                DAI CITY HEROES — SYSTEM OVERVIEW
              </h2>
              <div className="space-y-3 text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.85, lineHeight: '1.7' }}>
                <p>This is a <span style={{ color: '#FFD700' }}>D20-based tabletop RPG</span> set in a cyberpunk world. It uses familiar D&D 5e mechanics adapted for a futuristic setting with hacking, cyberware, and corporate warfare.</p>
                <p>Players create characters by choosing a <span style={{ color: '#FF007F' }}>class</span>, which determines their base HP, AC, Combat Damage Die (CDD), speed, stat bonuses, skills, saves, tools, and a unique class feature.</p>
              </div>
            </div>

            {/* Core Mechanics Grid */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="glass-panel p-5" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 40%, transparent)' }}>
                <h3 className="text-lg mb-3" style={{ fontFamily: 'var(--font-cyber)', color: '#FFD700' }}>🎲 CORE DICE</h3>
                <div className="space-y-2 text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.85, lineHeight: '1.6' }}>
                  <p><span style={{ color: '#FF007F' }}>D20</span> — Used for attack rolls, saving throws, and ability checks.</p>
                  <p><span style={{ color: '#FF007F' }}>CDD (Class Damage Die)</span> — Your class determines your base damage die (d6, d8, d10, d12).</p>
                  <p><span style={{ color: '#FF007F' }}>Advantage</span> — Roll 2d20, take the higher.</p>
                  <p><span style={{ color: '#FF007F' }}>Disadvantage</span> — Roll 2d20, take the lower.</p>
                  <p><span style={{ color: '#FF007F' }}>Natural 20</span> — Automatic success / critical hit (double damage dice).</p>
                  <p><span style={{ color: '#FF007F' }}>Natural 1</span> — Automatic failure / critical miss.</p>
                </div>
              </div>

              <div className="glass-panel p-5" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 40%, transparent)' }}>
                <h3 className="text-lg mb-3" style={{ fontFamily: 'var(--font-cyber)', color: '#FFD700' }}>📊 SIX STATS</h3>
                <div className="space-y-2 text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.85, lineHeight: '1.6' }}>
                  <p><span style={{ color: '#00FF88' }}>STR (Strength)</span> — Physical power. Melee attacks, grappling, lifting.</p>
                  <p><span style={{ color: '#00FF88' }}>DEX (Dexterity)</span> — Agility & reflexes. Ranged attacks, AC, dodging.</p>
                  <p><span style={{ color: '#00FF88' }}>CON (Constitution)</span> — Endurance & toughness. HP, poison resistance.</p>
                  <p><span style={{ color: '#00FF88' }}>WIS (Wisdom)</span> — Awareness & willpower. Perception, insight, medicine.</p>
                  <p><span style={{ color: '#00FF88' }}>INT (Intelligence)</span> — Knowledge & logic. Hacking, investigation, biology.</p>
                  <p><span style={{ color: '#00FF88' }}>CHA (Charisma)</span> — Force of personality. Persuasion, deception, intimidation.</p>
                </div>
              </div>

              <div className="glass-panel p-5" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 40%, transparent)' }}>
                <h3 className="text-lg mb-3" style={{ fontFamily: 'var(--font-cyber)', color: '#FFD700' }}>🛡️ CORE DEFENSES</h3>
                <div className="space-y-2 text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.85, lineHeight: '1.6' }}>
                  <p><span style={{ color: '#00D4FF' }}>AC (Armor Class)</span> — The number an attack roll must meet or beat to hit you. Determined by class + armor + mods.</p>
                  <p><span style={{ color: '#00D4FF' }}>HP (Hit Points)</span> — Your health pool. At 0 HP you fall unconscious and begin death saves.</p>
                  <p><span style={{ color: '#00D4FF' }}>Saving Throws</span> — Roll d20 + stat mod vs a DC to resist effects. Each class is proficient in 2 saves.</p>
                  <p><span style={{ color: '#00D4FF' }}>Death Saves</span> — At 0 HP, roll d20 each turn. 10+ = success, 9- = fail. 3 successes = stabilize. 3 fails = death. Nat 20 = regain 1 HP. Nat 1 = 2 fails.</p>
                </div>
              </div>

              <div className="glass-panel p-5" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 40%, transparent)' }}>
                <h3 className="text-lg mb-3" style={{ fontFamily: 'var(--font-cyber)', color: '#FFD700' }}>⏳ RESTS</h3>
                <div className="space-y-2 text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.85, lineHeight: '1.6' }}>
                  <p><span style={{ color: '#BD00FF' }}>Short Rest (1 hour)</span> — Spend hit dice to heal. Restore short rest ability charges. Patch up light wounds.</p>
                  <p><span style={{ color: '#BD00FF' }}>Long Rest (8 hours)</span> — Restore all HP. Restore all ability charges (short & long rest). Reset conditions. Must complete without combat interruption.</p>
                  <p><span style={{ color: '#BD00FF' }}>Hit Dice</span> — Class-based recovery dice rolled during short rests. You have a pool equal to your level.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════ COMBAT ═══════════════════════════════════════════ */}
        {activeSection === 'combat' && (
          <div className="space-y-6">
            {/* Turn Structure */}
            <div className="glass-panel p-6" style={{ border: '2px solid #FF3366' }}>
              <h2 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: '#FF3366' }}>
                ⚔️ COMBAT — TURN STRUCTURE
              </h2>
              <div className="space-y-4 text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', lineHeight: '1.7' }}>
                <div className="p-3 rounded" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)', background: 'color-mix(in srgb, var(--color-cyber-darker) 80%, transparent)' }}>
                  <span style={{ color: '#FFD700', fontWeight: 'bold' }}>1. INITIATIVE</span>
                  <p className="mt-1 opacity-85">At the start of combat, everyone rolls d20 + Initiative Modifier. Highest goes first. Ties broken by DEX, then coin flip.</p>
                </div>
                <div className="p-3 rounded" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)', background: 'color-mix(in srgb, var(--color-cyber-darker) 80%, transparent)' }}>
                  <span style={{ color: '#FFD700', fontWeight: 'bold' }}>2. YOUR TURN</span>
                  <p className="mt-1 opacity-85">On your turn you get:</p>
                  <ul className="mt-2 ml-4 space-y-1 opacity-85">
                    <li>• <span style={{ color: '#00FF88' }}>1 Action</span> — Attack, Cast, Dash, Disengage, Dodge, Help, Hide, Use Object, Grapple, Shove</li>
                    <li>• <span style={{ color: '#00FF88' }}>1 Bonus Action</span> — Certain abilities only (class features, some items)</li>
                    <li>• <span style={{ color: '#00FF88' }}>Movement</span> — Up to your speed in feet. Can split before/after actions</li>
                    <li>• <span style={{ color: '#00FF88' }}>Free Interaction</span> — Open a door, draw a weapon, say a short sentence</li>
                  </ul>
                </div>
                <div className="p-3 rounded" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)', background: 'color-mix(in srgb, var(--color-cyber-darker) 80%, transparent)' }}>
                  <span style={{ color: '#FFD700', fontWeight: 'bold' }}>3. REACTIONS</span>
                  <p className="mt-1 opacity-85">1 per round, used outside your turn. Opportunity Attacks (enemy leaves your reach), or specific class/item abilities that trigger on certain events.</p>
                </div>
              </div>
            </div>

            {/* Attack Rolls */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="glass-panel p-5" style={{ border: '1px solid color-mix(in srgb, #FF3366 40%, transparent)' }}>
                <h3 className="text-lg mb-3" style={{ fontFamily: 'var(--font-cyber)', color: '#FF3366' }}>🎯 ATTACK ROLLS</h3>
                <div className="space-y-2 text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.85, lineHeight: '1.6' }}>
                  <p><span style={{ color: '#FFD700' }}>Formula:</span> d20 + Stat Mod + Proficiency (if proficient with weapon)</p>
                  <p><span style={{ color: '#FFD700' }}>Melee:</span> Usually STR-based (+DEX for finesse weapons)</p>
                  <p><span style={{ color: '#FFD700' }}>Ranged:</span> Usually DEX-based</p>
                  <p><span style={{ color: '#FFD700' }}>Result ≥ Target's AC:</span> Hit! Roll damage.</p>
                  <p><span style={{ color: '#FFD700' }}>Critical Hit (Nat 20):</span> Double all damage dice.</p>
                  <p><span style={{ color: '#FFD700' }}>Critical Miss (Nat 1):</span> Auto miss. DM may rule additional consequences.</p>
                </div>
              </div>

              <div className="glass-panel p-5" style={{ border: '1px solid color-mix(in srgb, #FF3366 40%, transparent)' }}>
                <h3 className="text-lg mb-3" style={{ fontFamily: 'var(--font-cyber)', color: '#FF3366' }}>💀 DAMAGE</h3>
                <div className="space-y-2 text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.85, lineHeight: '1.6' }}>
                  <p><span style={{ color: '#FFD700' }}>Base Damage:</span> Roll your weapon's damage die + relevant stat modifier.</p>
                  <p><span style={{ color: '#FFD700' }}>CDD (Class Damage Die):</span> Some attacks use your class damage die instead of a weapon die.</p>
                  <p><span style={{ color: '#FFD700' }}>Bonus Damage:</span> Some abilities add extra dice (e.g., +1d8 from CURSE).</p>
                  <p><span style={{ color: '#FFD700' }}>Damage Types:</span> Each source has a type (Slashing, Shock, etc.) which may trigger additional effects.</p>
                  <p><span style={{ color: '#FFD700' }}>Resistance:</span> Half damage from that type.</p>
                  <p><span style={{ color: '#FFD700' }}>Vulnerability:</span> Double damage from that type.</p>
                </div>
              </div>
            </div>

            {/* Combat Actions Reference */}
            <div className="glass-panel p-6" style={{ border: '1px solid color-mix(in srgb, #FF3366 40%, transparent)' }}>
              <h3 className="text-lg mb-4" style={{ fontFamily: 'var(--font-cyber)', color: '#FF3366' }}>📋 ACTION REFERENCE</h3>
              <div className="grid md:grid-cols-2 gap-3 text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', lineHeight: '1.5' }}>
                {[
                  { action: 'Attack', desc: 'Make one melee or ranged attack.' },
                  { action: 'Dash', desc: 'Double your movement speed this turn.' },
                  { action: 'Disengage', desc: 'Your movement doesn\'t provoke opportunity attacks this turn.' },
                  { action: 'Dodge', desc: 'Attacks against you have disadvantage; DEX saves have advantage (until your next turn).' },
                  { action: 'Help', desc: 'Give an ally advantage on their next ability check or attack roll.' },
                  { action: 'Hide', desc: 'Make a Stealth check to become hidden (unseen and unheard).' },
                  { action: 'Use Object', desc: 'Interact with an item - use a medkit, throw a grenade, activate a device.' },
                  { action: 'Grapple', desc: 'STR (Athletics) vs target\'s STR (Athletics) or DEX (Acrobatics). On success: target is Grappled.' },
                  { action: 'Shove', desc: 'STR (Athletics) vs target\'s STR (Athletics) or DEX (Acrobatics). On success: push 5ft or knock prone.' },
                  { action: 'Ready', desc: 'Prepare an action with a trigger condition. Uses your reaction when triggered.' },
                ].map(item => (
                  <div key={item.action} className="p-2 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-darker) 80%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)' }}>
                    <span style={{ color: '#FFD700' }}>{item.action}:</span>{' '}
                    <span className="opacity-85">{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Cover & Movement */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="glass-panel p-5" style={{ border: '1px solid color-mix(in srgb, #FF3366 40%, transparent)' }}>
                <h3 className="text-lg mb-3" style={{ fontFamily: 'var(--font-cyber)', color: '#FF3366' }}>🛡️ COVER</h3>
                <div className="space-y-2 text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.85, lineHeight: '1.6' }}>
                  <p><span style={{ color: '#00FF88' }}>Half Cover (+2 AC, +2 DEX saves)</span> — Low wall, furniture, another creature.</p>
                  <p><span style={{ color: '#00FF88' }}>Three-Quarters Cover (+5 AC, +5 DEX saves)</span> — Thick pillar, narrow doorway.</p>
                  <p><span style={{ color: '#00FF88' }}>Full Cover</span> — Can't be targeted directly (total concealment).</p>
                </div>
              </div>

              <div className="glass-panel p-5" style={{ border: '1px solid color-mix(in srgb, #FF3366 40%, transparent)' }}>
                <h3 className="text-lg mb-3" style={{ fontFamily: 'var(--font-cyber)', color: '#FF3366' }}>🏃 MOVEMENT</h3>
                <div className="space-y-2 text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.85, lineHeight: '1.6' }}>
                  <p><span style={{ color: '#00FF88' }}>Difficult Terrain</span> — Costs 2x movement (rubble, wreckage, crowds).</p>
                  <p><span style={{ color: '#00FF88' }}>Climbing / Swimming</span> — Costs 2x movement unless you have a climb/swim speed.</p>
                  <p><span style={{ color: '#00FF88' }}>Prone</span> — Costs half your speed to stand up. Melee attacks against you have advantage; ranged attacks have disadvantage.</p>
                  <p><span style={{ color: '#00FF88' }}>Opportunity Attack</span> — When an enemy leaves your melee reach, you can use your reaction to make one melee attack.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════ CONDITIONS ═══════════════════════════════════════════ */}
        {activeSection === 'conditions' && (
          <div className="space-y-4">
            <div className="glass-panel p-4 mb-2" style={{ border: '2px solid var(--color-cyber-purple)' }}>
              <h2 className="text-xl" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-purple)' }}>
                🩹 CONDITIONS
              </h2>
              <p className="text-xs mt-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.6 }}>
                Click a condition to expand details. Conditions modify what a character can do or how they are affected.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              {conditions.map(condition => (
                <div
                  key={condition.name}
                  onClick={() => setExpandedCondition(expandedCondition === condition.name ? null : condition.name)}
                  className="glass-panel p-4 cursor-pointer transition-all hover:brightness-110"
                  style={{
                    border: `1px solid ${expandedCondition === condition.name ? 'var(--color-cyber-purple)' : 'color-mix(in srgb, var(--color-cyber-cyan) 25%, transparent)'}`,
                    background: expandedCondition === condition.name ? 'color-mix(in srgb, var(--color-cyber-purple) 8%, transparent)' : 'transparent'
                  }}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold" style={{ fontFamily: 'var(--font-cyber)', color: expandedCondition === condition.name ? 'var(--color-cyber-purple)' : 'var(--color-cyber-cyan)' }}>
                      {condition.name.toUpperCase()}
                    </h3>
                    <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>
                      {expandedCondition === condition.name ? '▲' : '▼'}
                    </span>
                  </div>
                  {expandedCondition === condition.name && (
                    <div className="mt-3 space-y-2 text-xs" style={{ fontFamily: 'var(--font-mono)', lineHeight: '1.6' }}>
                      <div>
                        <span style={{ color: '#FF007F', fontWeight: 'bold' }}>Effects: </span>
                        <span style={{ color: 'var(--color-cyber-cyan)', opacity: 0.85 }}>{condition.effects}</span>
                      </div>
                      <div>
                        <span style={{ color: '#00FF88', fontWeight: 'bold' }}>Ends: </span>
                        <span style={{ color: 'var(--color-cyber-cyan)', opacity: 0.85 }}>{condition.ends}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════ DAMAGE TYPES ═══════════════════════════════════════════ */}
        {activeSection === 'damage-types' && (
          <div className="space-y-4">
            <div className="glass-panel p-4 mb-2" style={{ border: '2px solid #FF4500' }}>
              <h2 className="text-xl" style={{ fontFamily: 'var(--font-cyber)', color: '#FF4500' }}>
                💥 DAMAGE TYPES
              </h2>
              <p className="text-xs mt-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.6 }}>
                Each weapon and ability deals a specific type of damage. Some types can trigger additional effects.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              {damageTypes.map(dmgType => (
                <div
                  key={dmgType.name}
                  className="glass-panel p-4"
                  style={{ border: `1px solid ${dmgType.color}40` }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: dmgType.color, boxShadow: `0 0 8px ${dmgType.color}` }} />
                    <h3 className="text-sm font-bold" style={{ fontFamily: 'var(--font-cyber)', color: dmgType.color }}>
                      {dmgType.name.toUpperCase()}
                    </h3>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.85, lineHeight: '1.6' }}>
                    {dmgType.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════ SKILLS & STATS ═══════════════════════════════════════════ */}
        {activeSection === 'skills' && (
          <div className="space-y-6">
            <div className="glass-panel p-4 mb-2" style={{ border: '2px solid #00FF88' }}>
              <h2 className="text-xl" style={{ fontFamily: 'var(--font-cyber)', color: '#00FF88' }}>
                🎯 SKILLS & ABILITY CHECKS
              </h2>
              <p className="text-xs mt-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.6 }}>
                Roll d20 + Stat Modifier + Proficiency Bonus (if proficient). Meet or beat the DC set by the DM.
              </p>
            </div>

            {/* DC Reference */}
            <div className="glass-panel p-5" style={{ border: '1px solid color-mix(in srgb, #00FF88 40%, transparent)' }}>
              <h3 className="text-sm mb-3" style={{ fontFamily: 'var(--font-cyber)', color: '#FFD700' }}>DIFFICULTY CLASS (DC) REFERENCE</h3>
              <div className="flex flex-wrap gap-3 text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
                {[
                  { dc: 5, label: 'Very Easy', color: '#00FF88' },
                  { dc: 10, label: 'Easy', color: '#88FF00' },
                  { dc: 13, label: 'Medium', color: '#FFD700' },
                  { dc: 15, label: 'Hard', color: '#FF8800' },
                  { dc: 18, label: 'Very Hard', color: '#FF4400' },
                  { dc: 20, label: 'Nearly Impossible', color: '#FF0000' },
                  { dc: 25, label: 'Legendary', color: '#BD00FF' },
                ].map(dc => (
                  <div key={dc.dc} className="px-3 py-2 rounded text-center" style={{ border: `1px solid ${dc.color}40`, minWidth: '100px' }}>
                    <div className="text-lg font-bold" style={{ color: dc.color }}>{dc.dc}</div>
                    <div style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>{dc.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* All Skills */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {ALL_SKILLS.map(skillName => {
                const info = skillDescriptions[skillName];
                const statColor: Record<string, string> = {
                  'STR': '#FF3366', 'DEX': '#00FF88', 'CON': '#FF8800',
                  'WIS': '#00D4FF', 'INT': '#BD00FF', 'CHA': '#FFD700'
                };
                return (
                  <div key={skillName} className="glass-panel p-3" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)' }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
                        {skillName}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded" style={{ background: `${statColor[info?.stat] || '#fff'}20`, color: statColor[info?.stat] || '#fff', fontFamily: 'var(--font-mono)' }}>
                        {info?.stat}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.7, lineHeight: '1.5' }}>
                      {info?.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════ CLASSES ═══════════════════════════════════════════ */}
        {activeSection === 'classes' && (
          <div className="space-y-4">
            <div className="glass-panel p-4 mb-2" style={{ border: '2px solid #FF007F' }}>
              <h2 className="text-xl" style={{ fontFamily: 'var(--font-cyber)', color: '#FF007F' }}>
                👤 CHARACTER CLASSES
              </h2>
              <p className="text-xs mt-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.6 }}>
                {CHARACTER_CLASSES.length} classes available. Click to expand full details.
              </p>
            </div>

            <div className="space-y-3">
              {CHARACTER_CLASSES.map(cls => (
                <div
                  key={cls.id}
                  className="glass-panel overflow-hidden transition-all"
                  style={{ border: `1px solid ${expandedClass === cls.id ? '#FF007F' : 'color-mix(in srgb, var(--color-cyber-cyan) 25%, transparent)'}` }}
                >
                  {/* Header - always visible */}
                  <div
                    onClick={() => setExpandedClass(expandedClass === cls.id ? null : cls.id)}
                    className="p-4 cursor-pointer hover:brightness-110 transition-all flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-bold" style={{ fontFamily: 'var(--font-cyber)', color: '#FF007F' }}>
                        {cls.name}
                      </span>
                      <span className="text-xs opacity-70" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                        {cls.description}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
                      <span style={{ color: '#FF3366' }}>HP {cls.hp}</span>
                      <span style={{ color: '#00D4FF' }}>AC {cls.ac}</span>
                      <span style={{ color: '#FFD700' }}>{cls.cdd}</span>
                      <span style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>
                        {expandedClass === cls.id ? '▲' : '▼'}
                      </span>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {expandedClass === cls.id && (
                    <div className="p-4 pt-0">
                      <div className="border-t pt-4" style={{ borderColor: 'color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)' }}>
                        {/* Stats row */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
                          <div className="p-2 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-darker) 80%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)' }}>
                            <span style={{ color: '#FFD700' }}>Speed:</span> <span style={{ color: 'var(--color-cyber-cyan)' }}>{cls.speed} ft</span>
                          </div>
                          <div className="p-2 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-darker) 80%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)' }}>
                            <span style={{ color: '#FFD700' }}>Initiative:</span> <span style={{ color: 'var(--color-cyber-cyan)' }}>+{cls.initiative_modifier}</span>
                          </div>
                          <div className="p-2 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-darker) 80%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)' }}>
                            <span style={{ color: '#FFD700' }}>Implants:</span> <span style={{ color: 'var(--color-cyber-cyan)' }}>{cls.implant_capacity} slots</span>
                          </div>
                          <div className="p-2 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-darker) 80%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)' }}>
                            <span style={{ color: '#FFD700' }}>Bonuses:</span> <span style={{ color: 'var(--color-cyber-cyan)' }}>+2 {cls.statBonuses.primary}, +1 {cls.statBonuses.secondary}</span>
                          </div>
                        </div>

                        {/* Proficiencies */}
                        <div className="grid md:grid-cols-2 gap-3 mb-4 text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
                          <div>
                            <span style={{ color: '#00FF88', fontWeight: 'bold' }}>Armor: </span>
                            <span style={{ color: 'var(--color-cyber-cyan)', opacity: 0.85 }}>{cls.armorProficiencies.join(', ')}</span>
                          </div>
                          <div>
                            <span style={{ color: '#00FF88', fontWeight: 'bold' }}>Weapons: </span>
                            <span style={{ color: 'var(--color-cyber-cyan)', opacity: 0.85 }}>{cls.weaponProficiencies.join(', ')}</span>
                          </div>
                          <div>
                            <span style={{ color: '#00FF88', fontWeight: 'bold' }}>Skills: </span>
                            <span style={{ color: 'var(--color-cyber-cyan)', opacity: 0.85 }}>{cls.skills.join(', ')}</span>
                          </div>
                          <div>
                            <span style={{ color: '#00FF88', fontWeight: 'bold' }}>Saves: </span>
                            <span style={{ color: 'var(--color-cyber-cyan)', opacity: 0.85 }}>{cls.saves.join(', ')}</span>
                          </div>
                        </div>

                        {/* Tools */}
                        <div className="mb-4">
                          <span className="text-xs font-bold" style={{ color: '#BD00FF', fontFamily: 'var(--font-mono)' }}>Tools:</span>
                          <div className="mt-1 space-y-1">
                            {cls.tools.map(tool => (
                              <div key={tool.name} className="text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-cyber-cyan)', opacity: 0.85 }}>
                                <span style={{ color: '#BD00FF' }}>{tool.name}</span> — {tool.description}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Class Feature */}
                        {cls.classFeatures.map(feat => (
                          <div key={feat.name} className="p-3 rounded" style={{ border: '1px solid #FF007F40', background: 'color-mix(in srgb, #FF007F 5%, transparent)' }}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-bold" style={{ fontFamily: 'var(--font-cyber)', color: '#FF007F' }}>{feat.name}</span>
                              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#FFD70020', color: '#FFD700', fontFamily: 'var(--font-mono)' }}>
                                {feat.type}
                              </span>
                              {feat.charges && (
                                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#00FF8820', color: '#00FF88', fontFamily: 'var(--font-mono)' }}>
                                  {feat.charges} charge
                                </span>
                              )}
                            </div>
                            <p className="text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-cyber-cyan)', opacity: 0.85, lineHeight: '1.6' }}>
                              {feat.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════ EQUIPMENT ═══════════════════════════════════════════ */}
        {activeSection === 'equipment' && (
          <div className="space-y-6">
            <div className="glass-panel p-4 mb-2" style={{ border: '2px solid #FF8800' }}>
              <h2 className="text-xl" style={{ fontFamily: 'var(--font-cyber)', color: '#FF8800' }}>
                🔫 EQUIPMENT & GEAR
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Weapon Proficiency */}
              <div className="glass-panel p-5" style={{ border: '1px solid color-mix(in srgb, #FF8800 40%, transparent)' }}>
                <h3 className="text-lg mb-3" style={{ fontFamily: 'var(--font-cyber)', color: '#FF8800' }}>⚔️ WEAPON PROFICIENCY</h3>
                <div className="space-y-2 text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.85, lineHeight: '1.6' }}>
                  <p>Weapons have a <span style={{ color: '#FFD700' }}>proficiency rank (0-5)</span> which determines your to-hit modifier:</p>
                  <div className="mt-2 space-y-1 text-xs">
                    <p><span style={{ color: '#FF3366' }}>Rank 0:</span> -2 (not proficient)</p>
                    <p><span style={{ color: '#FFD700' }}>Rank 1:</span> +0</p>
                    <p><span style={{ color: '#FFD700' }}>Rank 2:</span> +1</p>
                    <p><span style={{ color: '#FFD700' }}>Rank 3:</span> +2</p>
                    <p><span style={{ color: '#00FF88' }}>Rank 4:</span> +3</p>
                    <p><span style={{ color: '#00FF88' }}>Rank 5:</span> +4 (master)</p>
                  </div>
                </div>
              </div>

              {/* Weapon Categories */}
              <div className="glass-panel p-5" style={{ border: '1px solid color-mix(in srgb, #FF8800 40%, transparent)' }}>
                <h3 className="text-lg mb-3" style={{ fontFamily: 'var(--font-cyber)', color: '#FF8800' }}>🗡️ WEAPON CATEGORIES</h3>
                <div className="space-y-2 text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.85, lineHeight: '1.6' }}>
                  <p><span style={{ color: '#FFD700' }}>Unarmed</span> — Fists, kicks, headbutts, cyber-fists.</p>
                  <p><span style={{ color: '#FFD700' }}>Melee</span> — Blades, bats, shock batons, mono-wire.</p>
                  <p><span style={{ color: '#FFD700' }}>Sidearms</span> — Pistols, revolvers, tasers, compact SMGs.</p>
                  <p><span style={{ color: '#FFD700' }}>Longarms</span> — Assault rifles, shotguns, sniper rifles.</p>
                  <p><span style={{ color: '#FFD700' }}>Heavy</span> — Rocket launchers, heavy MGs, mounted weapons.</p>
                </div>
              </div>

              {/* Armor Types */}
              <div className="glass-panel p-5" style={{ border: '1px solid color-mix(in srgb, #FF8800 40%, transparent)' }}>
                <h3 className="text-lg mb-3" style={{ fontFamily: 'var(--font-cyber)', color: '#FF8800' }}>🛡️ ARMOR TYPES</h3>
                <div className="space-y-2 text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.85, lineHeight: '1.6' }}>
                  <p><span style={{ color: '#FFD700' }}>Clothes</span> — No AC bonus. Can look stylish though.</p>
                  <p><span style={{ color: '#FFD700' }}>Light Armor</span> — Subtle protection. +DEX mod to AC.</p>
                  <p><span style={{ color: '#FFD700' }}>Medium Armor</span> — Balanced. +DEX mod (max +2) to AC.</p>
                  <p><span style={{ color: '#FFD700' }}>Heavy Armor</span> — Full protection. No DEX mod. Stealth disadvantage.</p>
                  <p><span style={{ color: '#FFD700' }}>Shield</span> — +2 AC. Requires one free hand.</p>
                </div>
              </div>

              {/* Item Rarity */}
              <div className="glass-panel p-5" style={{ border: '1px solid color-mix(in srgb, #FF8800 40%, transparent)' }}>
                <h3 className="text-lg mb-3" style={{ fontFamily: 'var(--font-cyber)', color: '#FF8800' }}>✨ ITEM RARITY</h3>
                <div className="space-y-2 text-sm" style={{ fontFamily: 'var(--font-mono)', lineHeight: '1.6' }}>
                  <p><span style={{ color: '#9CA3AF' }}>Common</span> — Standard issue gear, widely available.</p>
                  <p><span style={{ color: '#22C55E' }}>Uncommon</span> — Quality gear, slightly harder to find.</p>
                  <p><span style={{ color: '#3B82F6' }}>Rare</span> — Premium tech, limited supply.</p>
                  <p><span style={{ color: '#8B5CF6' }}>Epic</span> — Cutting edge, corp prototype level.</p>
                  <p><span style={{ color: '#F59E0B' }}>Legendary</span> — One-of-a-kind, world-altering gear.</p>
                </div>
              </div>
            </div>

            {/* Cyberware */}
            <div className="glass-panel p-5" style={{ border: '1px solid color-mix(in srgb, #FF8800 40%, transparent)' }}>
              <h3 className="text-lg mb-3" style={{ fontFamily: 'var(--font-cyber)', color: '#FF8800' }}>🦾 CYBERWARE & IMPLANTS</h3>
              <div className="space-y-2 text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.85, lineHeight: '1.6' }}>
                <p>Each class has an <span style={{ color: '#FFD700' }}>Implant Capacity</span> — the number of cyberware implant slots available.</p>
                <p>Cyberware augments your body with tech: enhanced optics, reflex boosters, subdermal armor, arm blades, etc.</p>
                <p>Installing/removing cyberware typically requires a ripperdoc and downtime. Some implants may have side effects or draw unwanted attention.</p>
                <p>Going over your implant capacity can cause <span style={{ color: '#FF3366' }}>cyberpsychosis</span> — DM may impose disadvantage on social checks, paranoia, or worse.</p>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════ EXPLORATION ═══════════════════════════════════════════ */}
        {activeSection === 'exploration' && (
          <div className="space-y-6">
            <div className="glass-panel p-4 mb-2" style={{ border: '2px solid #00D4FF' }}>
              <h2 className="text-xl" style={{ fontFamily: 'var(--font-cyber)', color: '#00D4FF' }}>
                🌐 EXPLORATION & SOCIAL
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="glass-panel p-5" style={{ border: '1px solid color-mix(in srgb, #00D4FF 40%, transparent)' }}>
                <h3 className="text-lg mb-3" style={{ fontFamily: 'var(--font-cyber)', color: '#00D4FF' }}>👁️ PERCEPTION & INVESTIGATION</h3>
                <div className="space-y-2 text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.85, lineHeight: '1.6' }}>
                  <p><span style={{ color: '#FFD700' }}>Passive Perception</span> — 10 + Perception modifier. The DM uses this to determine if you notice hidden things without rolling.</p>
                  <p><span style={{ color: '#FFD700' }}>Active Perception</span> — d20 + Perception modifier. Actively looking/listening for something specific.</p>
                  <p><span style={{ color: '#FFD700' }}>Investigation</span> — Deducing information from clues. Examining objects or scenes closely.</p>
                </div>
              </div>

              <div className="glass-panel p-5" style={{ border: '1px solid color-mix(in srgb, #00D4FF 40%, transparent)' }}>
                <h3 className="text-lg mb-3" style={{ fontFamily: 'var(--font-cyber)', color: '#00D4FF' }}>🤝 SOCIAL ENCOUNTERS</h3>
                <div className="space-y-2 text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.85, lineHeight: '1.6' }}>
                  <p><span style={{ color: '#FFD700' }}>Persuasion</span> — Convince through reason, charm, diplomacy.</p>
                  <p><span style={{ color: '#FFD700' }}>Deception</span> — Lie, mislead, bluff your way through.</p>
                  <p><span style={{ color: '#FFD700' }}>Intimidation</span> — Threaten, menace, coerce.</p>
                  <p><span style={{ color: '#FFD700' }}>Insight</span> — Read the NPC's true intentions. Contest vs their Deception.</p>
                  <p>The DM sets the DC based on the NPC's disposition (friendly, neutral, hostile) and the plausibility of your request.</p>
                </div>
              </div>

              <div className="glass-panel p-5" style={{ border: '1px solid color-mix(in srgb, #00D4FF 40%, transparent)' }}>
                <h3 className="text-lg mb-3" style={{ fontFamily: 'var(--font-cyber)', color: '#00D4FF' }}>🏪 SHOPPING & ECONOMY</h3>
                <div className="space-y-2 text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.85, lineHeight: '1.6' }}>
                  <p>Currency is in <span style={{ color: '#00FF88' }}>USD ($)</span>. Shops have inventory with set prices.</p>
                  <p><span style={{ color: '#FFD700' }}>Buying</span> — Pay the listed price at any shop that stocks the item.</p>
                  <p><span style={{ color: '#FFD700' }}>Selling</span> — Sell items back for a percentage of their value (varies by shop).</p>
                  <p><span style={{ color: '#FFD700' }}>Bartering</span> — Some shops accept trades. Persuasion checks may lower prices.</p>
                  <p>Illegal items may only be available at specific black market vendors.</p>
                </div>
              </div>

              <div className="glass-panel p-5" style={{ border: '1px solid color-mix(in srgb, #00D4FF 40%, transparent)' }}>
                <h3 className="text-lg mb-3" style={{ fontFamily: 'var(--font-cyber)', color: '#00D4FF' }}>🚗 TRAVEL & VEHICLES</h3>
                <div className="space-y-2 text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.85, lineHeight: '1.6' }}>
                  <p>Travel between regions may involve random encounters, fuel costs, or toll checkpoints.</p>
                  <p><span style={{ color: '#FFD700' }}>Vehicles</span> — Can be used in and out of combat. Driver makes DEX checks for maneuvers.</p>
                  <p><span style={{ color: '#FFD700' }}>Chases</span> — Contested DEX checks + vehicle bonuses. Special stunts require skill checks.</p>
                  <p>Vehicles have their own HP and can be damaged, disabled, or destroyed.</p>
                </div>
              </div>

              <div className="glass-panel p-5 md:col-span-2" style={{ border: '1px solid color-mix(in srgb, #00D4FF 40%, transparent)' }}>
                <h3 className="text-lg mb-3" style={{ fontFamily: 'var(--font-cyber)', color: '#00D4FF' }}>💻 HACKING & NETRUNNING</h3>
                <div className="space-y-2 text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.85, lineHeight: '1.6' }}>
                  <p>Hacking uses <span style={{ color: '#FFD700' }}>INT (Hacking) checks</span> against a system's DC. More secure systems have higher DCs.</p>
                  <p><span style={{ color: '#FFD700' }}>ICE (Intrusion Countermeasure Electronics)</span> — Digital defenses that protect systems. Must be defeated to access data.</p>
                  <p><span style={{ color: '#FFD700' }}>Daemons</span> — Programs that can be deployed during hacking. Some attack, some defend, some extract data.</p>
                  <p><span style={{ color: '#FFD700' }}>Consequences</span> — Failed hacks may trigger alarms, trace your location, fry your cyberdeck, or inflict cryptic damage.</p>
                  <p>Cyberdecks are required for hacking. Better decks provide bonuses to hacking checks.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer spacer */}
      <div className="h-12" />
    </div>
  );
}
