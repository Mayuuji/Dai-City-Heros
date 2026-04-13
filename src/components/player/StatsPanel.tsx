import { CHARACTER_CLASSES, formatToHit } from '../../data/characterClasses';
import { useClassAliases } from '../../utils/useClassAliases';

interface Character {
  id: string;
  name: string;
  class: string;
  level: number;
  current_hp: number;
  max_hp: number;
  temp_hp: number;
  ac: number;
  cdd: string;
  usd: number;
  speed: number;
  initiative_modifier: number;
  implant_capacity: number;
  save_proficiencies: string[];
  tools: string[];
  str: number; dex: number; con: number; wis: number; int: number; cha: number;
  weapon_rank_unarmed: number;
  weapon_rank_melee: number;
  weapon_rank_sidearms: number;
  weapon_rank_longarms: number;
  weapon_rank_heavy: number;
  skill_acrobatics: number; skill_animal_handling: number; skill_athletics: number;
  skill_biology: number; skill_deception: number; skill_hacking: number;
  skill_history: number; skill_insight: number; skill_intimidation: number;
  skill_investigation: number; skill_medicine: number; skill_nature: number;
  skill_perception: number; skill_performance: number; skill_persuasion: number;
  skill_sleight_of_hand: number; skill_stealth: number; skill_survival: number;
}

interface ComputedStats {
  hp: number; ac: number;
  str: number; dex: number; con: number; wis: number; int: number; cha: number;
  speed: number; init: number; ic: number;
  skills: Record<string, number>;
  hasArmorPenalty: boolean;
  equippedArmorCount: number;
  equippedWeaponCount: number;
  icUsed: number;
  icRemaining: number;
}

interface StatsPanelProps {
  character: Character;
  computedStats: ComputedStats;
  campaignId: string | null;
}

// Convert stat to modifier (handles old 10+ format and new direct format)
const calculateStatModifier = (stat: number) => stat >= 8 ? stat - 10 : stat;
const formatModifier = (mod: number) => mod >= 0 ? `+${mod}` : `${mod}`;

// Color for stat modifiers
const getModColor = (mod: number) => mod > 0 ? 'var(--color-cyber-green)' : mod < 0 ? 'var(--color-cyber-magenta)' : 'var(--color-cyber-cyan)';

export default function StatsPanel({ character, computedStats, campaignId }: StatsPanelProps) {
  const { getClassName } = useClassAliases(campaignId);

  const stats = [
    { name: 'STR', value: computedStats.str },
    { name: 'DEX', value: computedStats.dex },
    { name: 'CON', value: computedStats.con },
    { name: 'WIS', value: computedStats.wis },
    { name: 'INT', value: computedStats.int },
    { name: 'CHA', value: computedStats.cha }
  ];

  const skills = [
    { name: 'Acrobatics', key: 'skill_acrobatics', stat: 'DEX', value: character.skill_acrobatics },
    { name: 'Animal Handling', key: 'skill_animal_handling', stat: 'WIS', value: character.skill_animal_handling },
    { name: 'Athletics', key: 'skill_athletics', stat: 'STR', value: character.skill_athletics },
    { name: 'Biology', key: 'skill_biology', stat: 'INT', value: character.skill_biology },
    { name: 'Deception', key: 'skill_deception', stat: 'CHA', value: character.skill_deception },
    { name: 'Hacking', key: 'skill_hacking', stat: 'INT', value: character.skill_hacking },
    { name: 'History', key: 'skill_history', stat: 'INT', value: character.skill_history },
    { name: 'Insight', key: 'skill_insight', stat: 'WIS', value: character.skill_insight },
    { name: 'Intimidation', key: 'skill_intimidation', stat: 'CHA', value: character.skill_intimidation },
    { name: 'Investigation', key: 'skill_investigation', stat: 'INT', value: character.skill_investigation },
    { name: 'Medicine', key: 'skill_medicine', stat: 'WIS', value: character.skill_medicine },
    { name: 'Nature', key: 'skill_nature', stat: 'INT', value: character.skill_nature },
    { name: 'Perception', key: 'skill_perception', stat: 'WIS', value: character.skill_perception },
    { name: 'Performance', key: 'skill_performance', stat: 'CHA', value: character.skill_performance },
    { name: 'Persuasion', key: 'skill_persuasion', stat: 'CHA', value: character.skill_persuasion },
    { name: 'Sleight of Hand', key: 'skill_sleight_of_hand', stat: 'DEX', value: character.skill_sleight_of_hand },
    { name: 'Stealth', key: 'skill_stealth', stat: 'DEX', value: character.skill_stealth },
    { name: 'Survival', key: 'skill_survival', stat: 'WIS', value: character.skill_survival }
  ];

  const weaponRanks = [
    { type: 'Unarmed', rank: character.weapon_rank_unarmed },
    { type: 'Melee', rank: character.weapon_rank_melee },
    { type: 'Sidearms', rank: character.weapon_rank_sidearms },
    { type: 'Longarms', rank: character.weapon_rank_longarms },
    { type: 'Heavy', rank: character.weapon_rank_heavy },
  ];

  const classInfo = CHARACTER_CLASSES.find(c => c.id === character.class);

  return (
    <div className="h-full overflow-y-auto space-y-3 pr-1" style={{ scrollbarWidth: 'thin' }}>
      {/* Character Name & Class */}
      <div className="p-3 rounded" style={{ border: '1px solid var(--color-cyber-green)', background: 'color-mix(in srgb, var(--color-cyber-green) 5%, transparent)' }}>
        <h2 className="text-lg mb-0.5" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-yellow)' }}>
          {character.name.toUpperCase()}
        </h2>
        <p className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
          Level <span style={{ color: 'var(--color-cyber-yellow)' }}>{character.level}</span> {getClassName(character.class)}
        </p>
      </div>

      {/* HP Bar */}
      <div className="p-3 rounded" style={{ border: '1px solid var(--color-cyber-green)' }}>
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>HP</span>
          <span className="text-sm font-bold" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
            {Math.min(character.current_hp, computedStats.hp)}/{computedStats.hp}
            {computedStats.hp !== character.max_hp && (
              <span className="text-xs ml-1" style={{ color: 'var(--color-cyber-green)' }}>
                ({computedStats.hp > character.max_hp ? '+' : ''}{computedStats.hp - character.max_hp})
              </span>
            )}
          </span>
        </div>
        <div className="h-2 rounded relative" style={{ backgroundColor: 'color-mix(in srgb, var(--color-cyber-magenta) 20%, transparent)' }}>
          <div className="h-full rounded" style={{
            width: `${(Math.min(character.current_hp, computedStats.hp) / (computedStats.hp + (character.temp_hp || 0))) * 100}%`,
            backgroundColor: 'var(--color-cyber-magenta)'
          }} />
          {(character.temp_hp || 0) > 0 && (
            <div className="h-full rounded absolute top-0" style={{
              left: `${(Math.min(character.current_hp, computedStats.hp) / (computedStats.hp + character.temp_hp)) * 100}%`,
              width: `${(character.temp_hp / (computedStats.hp + character.temp_hp)) * 100}%`,
              backgroundColor: 'var(--color-cyber-yellow)', opacity: 0.7
            }} />
          )}
        </div>
        {(character.temp_hp || 0) > 0 && (
          <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)' }}>
            🛡️ +{character.temp_hp} OVERSHIELD
          </div>
        )}
      </div>

      {/* AC / CDD / Credits / INIT / Speed / IC */}
      <div className="p-3 rounded" style={{ border: '1px solid var(--color-cyber-green)' }}>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-[10px]" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>AC</div>
            <div className="text-lg font-bold" style={{ color: computedStats.hasArmorPenalty ? 'var(--color-cyber-magenta)' : 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
              {computedStats.ac}{computedStats.hasArmorPenalty && <span className="text-xs ml-0.5">⚠️</span>}
            </div>
          </div>
          <div>
            <div className="text-[10px]" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>CDD</div>
            <div className="text-lg font-bold" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{character.cdd}</div>
          </div>
          <div>
            <div className="text-[10px]" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>CREDITS</div>
            <div className="text-sm font-bold" style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)' }}>${character.usd.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[10px]" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>INIT</div>
            <div className="text-lg font-bold" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
              {computedStats.init >= 0 ? `+${computedStats.init}` : computedStats.init}
            </div>
          </div>
          <div>
            <div className="text-[10px]" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>SPEED</div>
            <div className="text-lg font-bold" style={{ color: computedStats.hasArmorPenalty ? 'var(--color-cyber-magenta)' : 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
              {computedStats.speed}
            </div>
          </div>
          <div>
            <div className="text-[10px]" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>IC</div>
            <div className="text-lg font-bold" style={{ color: computedStats.icRemaining <= 0 ? 'var(--color-cyber-magenta)' : 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
              {computedStats.icRemaining}/{computedStats.ic}
            </div>
          </div>
        </div>
        {computedStats.hasArmorPenalty && (
          <div className="text-[10px] text-center mt-1 px-1 py-0.5 rounded" style={{ background: 'rgba(255, 0, 127, 0.2)', color: 'var(--color-cyber-magenta)' }}>
            ⚠️ Non-proficient armor: −2 AC, −10 speed
          </div>
        )}
      </div>

      {/* Ability Scores */}
      <div className="p-3 rounded" style={{ border: '1px solid var(--color-cyber-green)' }}>
        <div className="text-[10px] mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
          ABILITY SCORES <span style={{ opacity: 0.5 }}>(⭐ Save Prof.)</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {stats.map(stat => {
            const modifier = calculateStatModifier(stat.value);
            const hasSave = character.save_proficiencies?.includes(stat.name);
            return (
              <div
                key={stat.name}
                className="text-center p-1.5 rounded relative"
                style={{
                  border: `1px solid ${hasSave ? 'var(--color-cyber-green)' : 'color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)'}`,
                  background: hasSave ? 'color-mix(in srgb, var(--color-cyber-green) 10%, transparent)' : 'transparent'
                }}
              >
                {hasSave && <span className="absolute top-0.5 right-0.5 text-[8px]" title="Save Proficiency">⭐</span>}
                <div className="text-[10px]" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{stat.name}</div>
                <div className="text-xl font-bold" style={{ color: getModColor(modifier), fontFamily: 'var(--font-mono)' }}>
                  {formatModifier(modifier)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Skills */}
      <div className="p-3 rounded" style={{ border: '1px solid var(--color-cyber-green)' }}>
        <div className="text-[10px] mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
          SKILLS
        </div>
        <div className="space-y-1">
          {skills.map(skill => {
            const statKey = skill.stat.toLowerCase() as keyof typeof computedStats;
            const rawStatValue = computedStats[statKey] as number;
            const statModifier = calculateStatModifier(rawStatValue);
            const itemSkillBonus = computedStats.skills[skill.name] || 0;
            const totalBonus = statModifier + skill.value + itemSkillBonus;

            return (
              <div key={skill.key} className="flex items-center justify-between px-1 py-0.5 rounded hover:bg-white/5">
                <div className="flex items-center gap-1">
                  <span className="text-[10px]" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)', width: '24px', display: 'inline-block' }}>
                    {skill.stat}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                    {skill.name}
                  </span>
                  {itemSkillBonus > 0 && <span className="text-[8px]" title={`Item +${itemSkillBonus}`}>📦</span>}
                </div>
                <span className="text-sm font-bold" style={{ color: getModColor(totalBonus), fontFamily: 'var(--font-mono)' }}>
                  {formatModifier(totalBonus)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Weapon Ranks */}
      <div className="p-3 rounded" style={{ border: '1px solid var(--color-cyber-green)' }}>
        <div className="text-[10px] mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
          WEAPON RANKS
        </div>
        <div className="space-y-1.5">
          {weaponRanks.map(w => (
            <div key={w.type} className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{w.type}</span>
              <div className="flex items-center gap-1">
                {/* Rank pips */}
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(i => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full"
                      style={{ background: i <= w.rank ? 'var(--color-cyber-yellow)' : 'color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)' }}
                    />
                  ))}
                </div>
                <span className="text-[10px] ml-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6, fontFamily: 'var(--font-mono)' }}>
                  {formatToHit(w.rank)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Armor Proficiencies */}
      {classInfo?.armorProficiencies && classInfo.armorProficiencies.length > 0 && (
        <div className="p-3 rounded" style={{ border: '1px solid var(--color-cyber-green)' }}>
          <div className="text-[10px] mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
            🛡️ ARMOR PROFICIENCIES
          </div>
          <div className="flex flex-wrap gap-1">
            {classInfo.armorProficiencies.map((armor: string) => (
              <span key={armor} className="px-1.5 py-0.5 text-[10px] rounded" style={{
                background: 'color-mix(in srgb, var(--color-cyber-green) 20%, transparent)',
                color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)', textTransform: 'capitalize'
              }}>
                {armor}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tools */}
      {character.tools && character.tools.length > 0 && (
        <div className="p-3 rounded" style={{ border: '1px solid var(--color-cyber-green)' }}>
          <div className="text-[10px] mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
            🔧 TOOLS
          </div>
          <div className="flex flex-wrap gap-1">
            {character.tools.map((tool: string) => (
              <span key={tool} className="px-1.5 py-0.5 text-[10px] rounded" style={{
                background: 'color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)',
                color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)'
              }}>
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
