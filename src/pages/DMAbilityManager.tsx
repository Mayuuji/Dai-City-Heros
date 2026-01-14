import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getAbilityTypeIcon } from '../utils/stats';
import type { Ability } from '../types/inventory';

interface AbilityWithLinks {
  ability: Ability;
  itemCount: number;
  characterCount: number;
  items: { id: string; name: string }[];
  characters: { id: string; name: string }[];
}

export default function DMAbilityManager() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [abilities, setAbilities] = useState<AbilityWithLinks[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterChargeType, setFilterChargeType] = useState<string>('all');
  const [selectedAbility, setSelectedAbility] = useState<AbilityWithLinks | null>(null);

  useEffect(() => {
    if (profile?.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    fetchAbilities();
  }, [profile, navigate]);

  const fetchAbilities = async () => {
    try {
      setLoading(true);
      
      // Fetch all abilities
      const { data: abilitiesData, error: abilitiesError } = await supabase
        .from('abilities')
        .select('*')
        .order('name');
      
      if (abilitiesError) throw abilitiesError;
      
      // For each ability, fetch linked items and characters
      const abilitiesWithLinks: AbilityWithLinks[] = await Promise.all(
        (abilitiesData || []).map(async (ability) => {
          // Fetch items that have this ability
          const { data: itemLinks } = await supabase
            .from('item_abilities')
            .select(`
              item_id,
              items (id, name)
            `)
            .eq('ability_id', ability.id);
          
          // Fetch characters that have this ability
          const { data: charLinks } = await supabase
            .from('character_abilities')
            .select(`
              character_id,
              characters (id, name)
            `)
            .eq('ability_id', ability.id);
          
          const items = (itemLinks || [])
            .map(link => {
              const item = Array.isArray(link.items) ? link.items[0] : link.items;
              return item ? { id: item.id, name: item.name } : null;
            })
            .filter(Boolean) as { id: string; name: string }[];
          
          const characters = (charLinks || [])
            .map(link => {
              const char = Array.isArray(link.characters) ? link.characters[0] : link.characters;
              return char ? { id: char.id, name: char.name } : null;
            })
            .filter(Boolean) as { id: string; name: string }[];
          
          return {
            ability,
            itemCount: items.length,
            characterCount: characters.length,
            items,
            characters
          };
        })
      );
      
      setAbilities(abilitiesWithLinks);
      
    } catch (err: any) {
      console.error('Error fetching abilities:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAbility = async (abilityId: string, abilityName: string) => {
    if (!confirm(`Delete ability "${abilityName}"? This will remove it from all items and characters. This cannot be undone.`)) {
      return;
    }
    
    try {
      // Delete ability (cascades to item_abilities and character_abilities due to foreign keys)
      const { error } = await supabase
        .from('abilities')
        .delete()
        .eq('id', abilityId);
      
      if (error) throw error;
      
      alert(`Ability "${abilityName}" deleted successfully.`);
      setSelectedAbility(null);
      await fetchAbilities();
      
    } catch (err: any) {
      console.error('Error deleting ability:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const filteredAbilities = abilities.filter(a => {
    const matchesSearch = 
      a.ability.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.ability.description && a.ability.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesType = filterType === 'all' || a.ability.type === filterType;
    const matchesChargeType = filterChargeType === 'all' || a.ability.charge_type === filterChargeType;
    
    return matchesSearch && matchesType && matchesChargeType;
  });

  if (loading) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <div className="text-2xl" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>
          LOADING...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl mb-2" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-pink)' }}>
              ABILITY MANAGER
            </h1>
            <p className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
              Manage all abilities • Total: {abilities.length}
            </p>
          </div>
          
          <button
            onClick={() => navigate('/dm/dashboard')}
            className="neon-button px-6 py-2"
          >
            ← BACK TO DM
          </button>
        </div>

        {/* Search and Filters */}
        <div className="glass-panel p-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                SEARCH
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or description..."
                className="w-full px-4 py-2 rounded"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                  border: '1px solid var(--color-cyber-cyan)',
                  color: 'var(--color-cyber-cyan)',
                  fontFamily: 'var(--font-mono)'
                }}
              />
            </div>
            
            <div>
              <label className="block text-xs mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                TYPE
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-4 py-2 rounded"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                  border: '1px solid var(--color-cyber-cyan)',
                  color: 'var(--color-cyber-cyan)',
                  fontFamily: 'var(--font-mono)'
                }}
              >
                <option value="all">All Types</option>
                <option value="action">Action</option>
                <option value="bonus_action">Bonus Action</option>
                <option value="reaction">Reaction</option>
                <option value="passive">Passive</option>
                <option value="utility">Utility</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                CHARGE TYPE
              </label>
              <select
                value={filterChargeType}
                onChange={(e) => setFilterChargeType(e.target.value)}
                className="w-full px-4 py-2 rounded"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                  border: '1px solid var(--color-cyber-cyan)',
                  color: 'var(--color-cyber-cyan)',
                  fontFamily: 'var(--font-mono)'
                }}
              >
                <option value="all">All Charges</option>
                <option value="infinite">Infinite</option>
                <option value="short_rest">Short Rest</option>
                <option value="long_rest">Long Rest</option>
                <option value="uses">Uses</option>
              </select>
            </div>
          </div>
        </div>

        {/* Abilities List */}
        <div className="grid lg:grid-cols-2 gap-4">
          {filteredAbilities.map(({ ability, itemCount, characterCount, items, characters }) => (
            <div
              key={ability.id}
              className="glass-panel p-6 cursor-pointer transition-all"
              style={{ 
                border: selectedAbility?.ability.id === ability.id 
                  ? '2px solid var(--color-cyber-pink)' 
                  : '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)'
              }}
              onClick={() => setSelectedAbility({ ability, itemCount, characterCount, items, characters })}
            >
              <div className="flex items-start gap-4">
                <div className="text-3xl">{getAbilityTypeIcon(ability.type)}</div>
                
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-lg" style={{ color: 'var(--color-cyber-pink)', fontFamily: 'var(--font-cyber)' }}>
                        {ability.name}
                      </h3>
                      <div className="flex gap-2 text-xs mt-1" style={{ fontFamily: 'var(--font-mono)' }}>
                        <span style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>
                          {ability.type.replace('_', ' ').toUpperCase()}
                        </span>
                        <span style={{ color: 'var(--color-cyber-green)', opacity: 0.7 }}>
                          {ability.charge_type === 'infinite' ? '∞' : 
                           ability.charge_type === 'short_rest' ? 'SHORT REST' :
                           ability.charge_type === 'long_rest' ? 'LONG REST' :
                           `${ability.max_charges} USES`}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {ability.description && (
                    <p className="text-sm mb-3" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                      {ability.description}
                    </p>
                  )}
                  
                  <div className="flex gap-4 text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
                    <span style={{ color: 'var(--color-cyber-green)' }}>
                      📦 {itemCount} {itemCount === 1 ? 'item' : 'items'}
                    </span>
                    <span style={{ color: 'var(--color-cyber-purple)' }}>
                      👤 {characterCount} {characterCount === 1 ? 'character' : 'characters'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredAbilities.length === 0 && (
          <div className="glass-panel p-12 text-center">
            <p className="text-lg" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
              No abilities found matching your filters.
            </p>
          </div>
        )}

        {/* Selected Ability Details */}
        {selectedAbility && (
          <div className="glass-panel p-6" style={{ border: '2px solid var(--color-cyber-pink)' }}>
            <div className="flex items-start justify-between mb-6">
              <h2 className="text-2xl" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-pink)' }}>
                {selectedAbility.ability.name}
              </h2>
              
              <div className="flex gap-2">
                <button
                  onClick={() => navigate('/dm/ability-creator')}
                  className="px-4 py-2 rounded text-sm"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-cyber-green) 20%, transparent)',
                    border: '1px solid var(--color-cyber-green)',
                    color: 'var(--color-cyber-green)',
                    fontFamily: 'var(--font-mono)'
                  }}
                >
                  EDIT (Create New)
                </button>
                <button
                  onClick={() => handleDeleteAbility(selectedAbility.ability.id, selectedAbility.ability.name)}
                  className="px-4 py-2 rounded text-sm"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-cyber-red) 20%, transparent)',
                    border: '1px solid var(--color-cyber-red)',
                    color: 'var(--color-cyber-red)',
                    fontFamily: 'var(--font-mono)'
                  }}
                >
                  DELETE
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Items */}
              <div>
                <h3 className="text-sm mb-3" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-cyber)' }}>
                  LINKED ITEMS ({selectedAbility.itemCount})
                </h3>
                {selectedAbility.items.length > 0 ? (
                  <div className="space-y-2">
                    {selectedAbility.items.map(item => (
                      <div 
                        key={item.id}
                        className="p-3 rounded"
                        style={{ 
                          backgroundColor: 'color-mix(in srgb, var(--color-cyber-green) 10%, transparent)',
                          border: '1px solid var(--color-cyber-green)'
                        }}
                      >
                        <span style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>
                          {item.name}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                    Not linked to any items.
                  </p>
                )}
              </div>

              {/* Characters */}
              <div>
                <h3 className="text-sm mb-3" style={{ color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-cyber)' }}>
                  CHARACTERS WITH ABILITY ({selectedAbility.characterCount})
                </h3>
                {selectedAbility.characters.length > 0 ? (
                  <div className="space-y-2">
                    {selectedAbility.characters.map(char => (
                      <div 
                        key={char.id}
                        className="p-3 rounded"
                        style={{ 
                          backgroundColor: 'color-mix(in srgb, var(--color-cyber-purple) 10%, transparent)',
                          border: '1px solid var(--color-cyber-purple)'
                        }}
                      >
                        <span style={{ color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>
                          {char.name}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                    No characters have this ability.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
