import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { CHARACTER_CLASSES, ALL_SKILLS } from '../data/characterClasses';
import { useAuth } from '../contexts/AuthContext';

interface Character {
  id: string;
  user_id: string;
  name: string;
  class: string;
  level: number;
  current_hp: number;
  max_hp: number;
  ac: number;
  cdd: string;
  str: number;
  dex: number;
  con: number;
  wis: number;
  int: number;
  cha: number;
  usd: number;
  skill_acrobatics: number;
  skill_animal_handling: number;
  skill_athletics: number;
  skill_biology: number;
  skill_deception: number;
  skill_hacking: number;
  skill_history: number;
  skill_insight: number;
  skill_intimidation: number;
  skill_investigation: number;
  skill_medicine: number;
  skill_nature: number;
  skill_perception: number;
  skill_performance: number;
  skill_persuasion: number;
  skill_sleight_of_hand: number;
  skill_stealth: number;
  skill_survival: number;
  save_proficiencies: string[];
  tools: string[];
  class_features: any[];
}

export default function CharacterSheet() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id && user) {
      fetchCharacter();
    }
  }, [id, user]);

  // Real-time subscription for character updates from DM
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`character-sheet-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'characters',
          filter: `id=eq.${id}`
        },
        (payload) => {
          setCharacter(prev => prev ? { ...prev, ...payload.new } : null);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const fetchCharacter = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('characters')
        .select('*')
        .eq('id', id)
        .eq('user_id', user?.id)
        .single();

      if (fetchError) throw fetchError;
      setCharacter(data);
    } catch (err: any) {
      console.error('Error fetching character:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getClassInfo = (classId: string) => {
    return CHARACTER_CLASSES.find(c => c.id === classId);
  };

  const calculateStatModifier = (stat: number) => {
    return Math.floor((stat - 10) / 2);
  };

  const formatModifier = (modifier: number) => {
    return modifier >= 0 ? `+${modifier}` : `${modifier}`;
  };

  const getSkillModifier = (skillName: string, character: Character) => {
    const skillKey = `skill_${skillName.toLowerCase().replace(/ /g, '_')}` as keyof Character;
    const proficiency = (character[skillKey] as number) || 0;
    
    // Determine which stat modifier to use based on skill
    let statModifier = 0;
    const skillStatMap: { [key: string]: keyof Pick<Character, 'str' | 'dex' | 'con' | 'wis' | 'int' | 'cha'> } = {
      'Acrobatics': 'dex',
      'Animal Handling': 'wis',
      'Athletics': 'str',
      'Biology': 'int',
      'Deception': 'cha',
      'Hacking': 'int',
      'History': 'int',
      'Insight': 'wis',
      'Intimidation': 'cha',
      'Investigation': 'int',
      'Medicine': 'wis',
      'Nature': 'int',
      'Perception': 'wis',
      'Performance': 'cha',
      'Persuasion': 'cha',
      'Sleight of Hand': 'dex',
      'Stealth': 'dex',
      'Survival': 'wis'
    };
    
    const stat = skillStatMap[skillName];
    if (stat) {
      statModifier = calculateStatModifier(character[stat]);
    }
    
    return statModifier + proficiency;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center grid-bg" style={{ backgroundColor: 'var(--color-cyber-darker)' }}>
        <div className="glass-panel p-8 text-center">
          <div className="animate-spin w-12 h-12 border-4 rounded-full mx-auto mb-4" 
               style={{ 
                 borderColor: 'color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)',
                 borderTopColor: 'var(--color-cyber-cyan)'
               }}>
          </div>
          <p style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
            Loading character...
          </p>
        </div>
      </div>
    );
  }

  if (error || !character) {
    return (
      <div className="min-h-screen flex items-center justify-center grid-bg" style={{ backgroundColor: 'var(--color-cyber-darker)' }}>
        <div className="glass-panel p-8 text-center" style={{ border: '1px solid var(--color-cyber-pink)' }}>
          <p className="mb-4" style={{ color: 'var(--color-cyber-pink)', fontFamily: 'var(--font-mono)' }}>
            {error || 'Character not found'}
          </p>
          <button onClick={() => navigate('/dashboard')} className="neon-button">
            BACK TO DASHBOARD
          </button>
        </div>
      </div>
    );
  }

  const classInfo = getClassInfo(character.class);

  return (
    <div className="min-h-screen grid-bg" style={{ backgroundColor: 'var(--color-cyber-darker)' }}>
      {/* Header */}
      <div className="glass-panel neon-border" style={{ borderRadius: 0 }}>
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <button onClick={() => navigate('/dashboard')} className="neon-button text-sm">
            ← BACK
          </button>
          <h1 className="text-2xl neon-text" style={{ fontFamily: 'var(--font-cyber)' }}>
            CHARACTER SHEET
          </h1>
          <div className="w-20"></div> {/* Spacer for centering */}
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Character Header */}
        <div className="glass-panel neon-border p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-3xl mb-2" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
                {character.name.toUpperCase()}
              </h2>
              <p className="text-lg" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>
                Level {character.level} {classInfo?.name}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>
                ${character.usd.toLocaleString()}
              </div>
              <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                USD
              </div>
            </div>
          </div>
        </div>

        {/* Main Stats Grid */}
        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          {/* Ability Scores */}
          <div className="glass-panel p-6" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)' }}>
            <h3 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
              ABILITY SCORES
            </h3>
            <div className="space-y-3">
              {[
                { name: 'STRENGTH', short: 'STR', value: character.str },
                { name: 'DEXTERITY', short: 'DEX', value: character.dex },
                { name: 'CONSTITUTION', short: 'CON', value: character.con },
                { name: 'WISDOM', short: 'WIS', value: character.wis },
                { name: 'INTELLIGENCE', short: 'INT', value: character.int },
                { name: 'CHARISMA', short: 'CHA', value: character.cha }
              ].map(stat => (
                <div key={stat.short} className="flex justify-between items-center p-3 rounded" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)' }}>
                  <div>
                    <div className="text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                      {stat.name}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                      {stat.short}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                      {stat.value}
                    </div>
                    <div className="text-sm" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>
                      {formatModifier(calculateStatModifier(stat.value))}
                    </div>
                  </div>
                  {character.save_proficiencies.includes(stat.short) && (
                    <div className="ml-2 px-2 py-1 rounded text-xs" style={{ backgroundColor: 'var(--color-cyber-green)', color: 'var(--color-cyber-darker)' }}>
                      SAVE
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Combat Stats */}
          <div className="glass-panel p-6" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-pink) 30%, transparent)' }}>
            <h3 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-pink)' }}>
              COMBAT STATS
            </h3>
            
            {/* HP */}
            <div className="mb-6">
              <div className="text-sm mb-2" style={{ color: 'var(--color-cyber-pink)', fontFamily: 'var(--font-mono)' }}>
                HIT POINTS
              </div>
              <div className="flex items-end gap-2 mb-2">
                <div className="text-4xl" style={{ color: 'var(--color-cyber-pink)', fontFamily: 'var(--font-mono)' }}>
                  {character.current_hp}
                </div>
                <div className="text-2xl mb-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                  / {character.max_hp}
                </div>
              </div>
              <div className="h-3 rounded" style={{ backgroundColor: 'color-mix(in srgb, var(--color-cyber-pink) 20%, transparent)' }}>
                <div
                  className="h-full rounded transition-all"
                  style={{
                    width: `${(character.current_hp / character.max_hp) * 100}%`,
                    backgroundColor: 'var(--color-cyber-pink)'
                  }}
                ></div>
              </div>
            </div>

            {/* AC & CDD */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded text-center" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)' }}>
                <div className="text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                  ARMOR CLASS
                </div>
                <div className="text-3xl" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                  {character.ac}
                </div>
              </div>
              <div className="p-4 rounded text-center" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-magenta) 30%, transparent)' }}>
                <div className="text-xs mb-1" style={{ color: 'var(--color-cyber-magenta)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                  COMBAT DIE
                </div>
                <div className="text-3xl" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>
                  {character.cdd}
                </div>
              </div>
            </div>
          </div>

          {/* Class Features */}
          <div className="glass-panel p-6" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-purple) 30%, transparent)' }}>
            <h3 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-purple)' }}>
              CLASS FEATURES
            </h3>
            <div className="space-y-3">
              {character.class_features && character.class_features.length > 0 ? (
                character.class_features.map((feature: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-4 rounded"
                    style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-purple) 30%, transparent)' }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="text-sm mb-1" style={{ color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-cyber)' }}>
                          {feature.name}
                        </div>
                        <div
                          className="text-xs px-2 py-1 rounded inline-block"
                          style={{ backgroundColor: 'color-mix(in srgb, var(--color-cyber-purple) 30%, transparent)', color: 'var(--color-cyber-purple)' }}
                        >
                          {feature.type}
                        </div>
                      </div>
                      {feature.charges && (
                        <div
                          className="text-xs px-3 py-1 rounded"
                          style={{ backgroundColor: 'var(--color-cyber-purple)', color: 'var(--color-cyber-darker)', fontFamily: 'var(--font-mono)' }}
                        >
                          {feature.charges} ⚡
                        </div>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                      {feature.description}
                    </p>
                    {feature.effects && feature.effects.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {feature.effects.map((effect: string, eIdx: number) => (
                          <div key={eIdx} className="text-xs" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>
                            • {effect}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-center" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                  No class features yet
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Skills */}
        <div className="glass-panel p-6 mb-6" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)' }}>
          <h3 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
            SKILLS
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {ALL_SKILLS.map(skill => {
              const modifier = getSkillModifier(skill, character);
              const skillKey = `skill_${skill.toLowerCase().replace(/ /g, '_')}` as keyof Character;
              const proficiency = (character[skillKey] as number) || 0;
              const isProficient = proficiency > 0;

              return (
                <div
                  key={skill}
                  className="flex justify-between items-center p-3 rounded"
                  style={{ 
                    border: isProficient 
                      ? '1px solid var(--color-cyber-cyan)' 
                      : '1px solid color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)',
                    backgroundColor: isProficient 
                      ? 'color-mix(in srgb, var(--color-cyber-cyan) 5%, transparent)' 
                      : 'transparent'
                  }}
                >
                  <div className="flex items-center gap-2">
                    {isProficient && (
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-cyber-cyan)' }}></div>
                    )}
                    <span className="text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                      {skill}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isProficient && (
                      <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-cyber-cyan)', color: 'var(--color-cyber-darker)' }}>
                        +{proficiency}
                      </span>
                    )}
                    <span className="text-lg" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>
                      {formatModifier(modifier)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tools & Equipment */}
        <div className="glass-panel p-6" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-magenta) 30%, transparent)' }}>
          <h3 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-magenta)' }}>
            TOOLS & EQUIPMENT
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            {character.tools && character.tools.length > 0 ? (
              character.tools.map((tool, idx) => {
                const toolInfo = classInfo?.tools.find(t => t.name === tool);
                return (
                  <div
                    key={idx}
                    className="p-4 rounded"
                    style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-magenta) 30%, transparent)' }}
                  >
                    <div className="text-sm mb-2" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-cyber)' }}>
                      {tool}
                    </div>
                    {toolInfo && (
                      <p className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                        {toolInfo.description}
                      </p>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-sm col-span-2 text-center" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                No tools equipped
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
