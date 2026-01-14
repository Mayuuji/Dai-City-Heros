import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { CHARACTER_CLASSES, type CharacterClass } from '../data/characterClasses';

export default function CharacterCreation() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedClass, setSelectedClass] = useState<CharacterClass | null>(null);
  const [characterName, setCharacterName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreateCharacter = async () => {
    if (!selectedClass || !characterName.trim()) {
      setError('Please select a class and enter a character name');
      return;
    }

    if (!user) {
      setError('You must be logged in to create a character');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Calculate initial stats based on class
      // Stats are stored as direct modifiers (0, +1, +2) not D&D-style (10, 11, 12)
      const stats = {
        str: 0,
        dex: 0,
        con: 0,
        wis: 0,
        int: 0,
        cha: 0
      };

      // Apply stat bonuses from class
      stats[selectedClass.statBonuses.primary.toLowerCase() as keyof typeof stats] += 2;
      stats[selectedClass.statBonuses.secondary.toLowerCase() as keyof typeof stats] += 1;

      // Prepare skill proficiencies
      const skills: { [key: string]: number } = {};
      Object.entries(selectedClass.skillBonuses).forEach(([skill, bonus]) => {
        const skillKey = `skill_${skill.toLowerCase().replace(/ /g, '_')}`;
        skills[skillKey] = bonus;
      });

      // Prepare weapon proficiency ranks (1 if proficient, 0 if not)
      const weaponRanks = {
        weapon_rank_unarmed: selectedClass.weaponProficiencies.includes('unarmed') ? 1 : 0,
        weapon_rank_melee: selectedClass.weaponProficiencies.includes('melee') ? 1 : 0,
        weapon_rank_sidearms: selectedClass.weaponProficiencies.includes('sidearms') ? 1 : 0,
        weapon_rank_longarms: selectedClass.weaponProficiencies.includes('longarms') ? 1 : 0,
        weapon_rank_heavy: selectedClass.weaponProficiencies.includes('heavy') ? 1 : 0,
      };

      const { data, error: insertError } = await supabase
        .from('characters')
        .insert([
          {
            user_id: user.id,
            name: characterName.trim(),
            class: selectedClass.id,
            max_hp: selectedClass.hp,
            current_hp: selectedClass.hp,
            ac: selectedClass.ac,
            cdd: selectedClass.cdd,
            speed: selectedClass.speed,
            initiative_modifier: selectedClass.initiative_modifier,
            implant_capacity: selectedClass.implant_capacity,
            ...stats,
            ...skills,
            ...weaponRanks,
            save_proficiencies: selectedClass.saves,
            tools: selectedClass.tools.map(t => t.name),
            class_features: selectedClass.classFeatures
          }
        ])
        .select()
        .single();

      if (insertError) throw insertError;

      // Grant starting tools as inventory items
      for (const tool of selectedClass.tools) {
        // First, check if the item exists in the items table
        let { data: existingItem } = await supabase
          .from('items')
          .select('id')
          .eq('name', tool.name)
          .single();

        let itemId: string;

        if (!existingItem) {
          // Create the item if it doesn't exist
          const { data: newItem, error: itemError } = await supabase
            .from('items')
            .insert([
              {
                name: tool.name,
                description: tool.description,
                type: 'item',
                rarity: 'Common',
                price: 0,
                is_consumable: false,
                is_equippable: true,
                stack_size: 1,
                str_mod: 0,
                dex_mod: 0,
                con_mod: 0,
                wis_mod: 0,
                int_mod: 0,
                cha_mod: 0,
                hp_mod: 0,
                ac_mod: 0,
                skill_mods: {},
                created_by: user.id
              }
            ])
            .select('id')
            .single();

          if (itemError) {
            console.error('Error creating starting item:', itemError);
            continue;
          }
          itemId = newItem.id;
        } else {
          itemId = existingItem.id;
        }

        // Add item to character's inventory
        const { error: invError } = await supabase
          .from('character_inventory')
          .insert([
            {
              character_id: data.id,
              item_id: itemId,
              quantity: 1,
              is_equipped: false
            }
          ]);

        if (invError) {
          console.error('Error adding starting item to inventory:', invError);
        }
      }

      console.log('Character created:', data);
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Error creating character:', err);
      setError(err.message || 'Failed to create character');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid-bg" style={{ backgroundColor: 'var(--color-cyber-darker)' }}>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="glass-panel neon-border p-6 mb-8">
          <h1 className="text-4xl neon-text text-center" style={{ fontFamily: 'var(--font-cyber)' }}>
            CREATE CHARACTER
          </h1>
          <p className="text-center mt-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
            Choose your class and enter the neon streets
          </p>
        </div>

        {/* Character Name Input */}
        <div className="glass-panel p-6 mb-8" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)' }}>
          <label className="block mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
            CHARACTER NAME
          </label>
          <input
            type="text"
            value={characterName}
            onChange={(e) => setCharacterName(e.target.value)}
            placeholder="Enter character name..."
            className="terminal-input w-full"
            disabled={loading}
          />
        </div>

        {/* Class Selection Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {CHARACTER_CLASSES.map((charClass) => (
            <div
              key={charClass.id}
              onClick={() => setSelectedClass(charClass)}
              className={`glass-panel p-4 cursor-pointer transition-all ${
                selectedClass?.id === charClass.id ? 'neon-border' : ''
              }`}
              style={{
                border: selectedClass?.id === charClass.id
                  ? `2px solid var(--color-cyber-cyan)`
                  : '1px solid color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)',
                transform: selectedClass?.id === charClass.id ? 'scale(1.02)' : 'scale(1)'
              }}
            >
              <h3 className="text-xl mb-2" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
                {charClass.name}
              </h3>
              <p className="text-sm mb-3" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                {charClass.description}
              </p>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-3 text-center text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
                <div>
                  <div style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>HP</div>
                  <div style={{ color: 'var(--color-cyber-green)' }}>{charClass.hp}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>AC</div>
                  <div style={{ color: 'var(--color-cyber-green)' }}>{charClass.ac}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>CDD</div>
                  <div style={{ color: 'var(--color-cyber-green)' }}>{charClass.cdd}</div>
                </div>
              </div>

              {/* Stat Bonuses */}
              <div className="text-xs mb-2" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>
                STATS: +2 {charClass.statBonuses.primary}, +1 {charClass.statBonuses.secondary}
              </div>

              {/* Skills */}
              <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                SKILLS: {charClass.skills.join(', ')}
              </div>
            </div>
          ))}
        </div>

        {/* Selected Class Details */}
        {selectedClass && (
          <div className="glass-panel p-6 mb-8" style={{ border: '2px solid var(--color-cyber-magenta)' }}>
            <h2 className="text-2xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-magenta)' }}>
              {selectedClass.name} DETAILS
            </h2>

            {/* Tools */}
            <div className="mb-4">
              <h3 className="text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                TOOLS
              </h3>
              <div className="space-y-2">
                {selectedClass.tools.map((tool, idx) => (
                  <div key={idx} className="text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
                    <span style={{ color: 'var(--color-cyber-magenta)' }}>{tool.name}:</span>{' '}
                    <span style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>{tool.description}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Class Features */}
            <div className="mb-4">
              <h3 className="text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                CLASS FEATURES
              </h3>
              <div className="space-y-2">
                {selectedClass.classFeatures.map((feature, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded"
                    style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-magenta) 30%, transparent)' }}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-cyber)' }}>
                        {feature.name}
                      </span>
                      <span
                        className="text-xs px-2 py-1 rounded"
                        style={{ backgroundColor: 'var(--color-cyber-magenta)', color: 'var(--color-cyber-darker)' }}
                      >
                        {feature.type}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Saves */}
            <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
              SAVES: {selectedClass.saves.join(', ')}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="glass-panel p-4 mb-4" style={{ border: '1px solid var(--color-cyber-pink)' }}>
            <p style={{ color: 'var(--color-cyber-pink)', fontFamily: 'var(--font-mono)' }}>{error}</p>
          </div>
        )}

        {/* Create Button */}
        <div className="flex justify-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="neon-button"
            style={{ fontFamily: 'var(--font-cyber)' }}
            disabled={loading}
          >
            CANCEL
          </button>
          <button
            onClick={handleCreateCharacter}
            className="neon-button-magenta"
            style={{ fontFamily: 'var(--font-cyber)' }}
            disabled={loading || !selectedClass || !characterName.trim()}
          >
            {loading ? 'CREATING...' : 'CREATE CHARACTER'}
          </button>
        </div>
      </div>
    </div>
  );
}
