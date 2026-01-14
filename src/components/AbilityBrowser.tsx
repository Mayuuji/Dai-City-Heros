import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Ability } from '../types/inventory';
import { getAbilityTypeIcon } from '../utils/stats';

interface AbilityBrowserProps {
  selectedAbilityIds: string[];
  onToggleAbility: (abilityId: string) => void;
  multiSelect?: boolean;
}

export default function AbilityBrowser({ 
  selectedAbilityIds, 
  onToggleAbility,
  multiSelect = true 
}: AbilityBrowserProps) {
  const [abilities, setAbilities] = useState<Ability[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterChargeType, setFilterChargeType] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAbilities();
  }, []);

  const loadAbilities = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('abilities')
        .select('*')
        .order('name');

      if (error) throw error;
      setAbilities(data || []);
    } catch (error: any) {
      console.error('Error loading abilities:', error);
      alert(`Failed to load abilities: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredAbilities = abilities.filter(ability => {
    const matchesSearch = ability.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ability.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || ability.type === filterType;
    const matchesChargeType = filterChargeType === 'all' || ability.charge_type === filterChargeType;
    return matchesSearch && matchesType && matchesChargeType;
  });

  const isSelected = (abilityId: string) => selectedAbilityIds.includes(abilityId);

  if (loading) {
    return (
      <div className="text-center py-8" style={{ color: 'var(--color-cyber-cyan)' }}>
        Loading abilities...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="space-y-3">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search abilities..."
          className="w-full px-4 py-2 rounded"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
            border: '1px solid var(--color-cyber-cyan)',
            color: 'var(--color-cyber-cyan)',
            fontFamily: 'var(--font-mono)'
          }}
        />

        <div className="grid grid-cols-2 gap-3">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 rounded"
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

          <select
            value={filterChargeType}
            onChange={(e) => setFilterChargeType(e.target.value)}
            className="px-4 py-2 rounded"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
              border: '1px solid var(--color-cyber-cyan)',
              color: 'var(--color-cyber-cyan)',
              fontFamily: 'var(--font-mono)'
            }}
          >
            <option value="all">All Charge Types</option>
            <option value="infinite">Infinite</option>
            <option value="short_rest">Short Rest</option>
            <option value="long_rest">Long Rest</option>
            <option value="uses">Limited Uses</option>
          </select>
        </div>
      </div>

      {/* Ability List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredAbilities.length === 0 ? (
          <p className="text-center py-4" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>
            No abilities found
          </p>
        ) : (
          filteredAbilities.map(ability => {
            const selected = isSelected(ability.id);
            return (
              <button
                key={ability.id}
                onClick={() => onToggleAbility(ability.id)}
                className={`w-full text-left p-4 rounded transition-all ${
                  selected ? 'ring-2' : ''
                }`}
                style={{
                  backgroundColor: selected
                    ? 'color-mix(in srgb, var(--color-cyber-purple) 30%, transparent)'
                    : 'color-mix(in srgb, var(--color-cyber-cyan) 5%, transparent)',
                  border: `1px solid ${selected ? 'var(--color-cyber-purple)' : 'var(--color-cyber-cyan)'}`
                }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{getAbilityTypeIcon(ability.type)}</span>
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1">
                        <h3 className="font-bold" style={{ color: 'var(--color-cyber-cyan)' }}>
                          {ability.name}
                          {selected && <span className="ml-2">✓</span>}
                        </h3>
                        <p className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.8 }}>
                          {ability.type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                        </p>
                      </div>
                      
                      {ability.charge_type !== 'infinite' && (
                        <div className="text-right ml-2">
                          <div className="text-sm font-bold" style={{ color: 'var(--color-cyber-cyan)' }}>
                            {ability.max_charges || '?'} charges
                          </div>
                          <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>
                            {ability.charge_type === 'short_rest' && 'Short Rest'}
                            {ability.charge_type === 'long_rest' && 'Long Rest'}
                            {ability.charge_type === 'uses' && 'Limited Uses'}
                            {ability.charges_per_rest && ` (+${ability.charges_per_rest})`}
                          </div>
                        </div>
                      )}
                    </div>

                    <p className="text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.9 }}>
                      {ability.description}
                    </p>

                    {/* Effects */}
                    {ability.effects && ability.effects.length > 0 && (
                      <div className="space-y-1">
                        {ability.effects.map((effect, i) => (
                          <div key={i} className="text-sm flex items-start gap-2">
                            <span style={{ color: 'var(--color-cyber-green)' }}>▸</span>
                            <span style={{ color: 'var(--color-cyber-cyan)' }}>{effect}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Combat Stats */}
                    {(ability.damage_dice || ability.range_feet || ability.area_of_effect) && (
                      <div className="grid grid-cols-3 gap-2 text-xs mt-2">
                        {ability.damage_dice && (
                          <div>
                            <span style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>Damage:</span>{' '}
                            <span style={{ color: 'var(--color-cyber-red)' }}>{ability.damage_dice}</span>
                          </div>
                        )}
                        {ability.range_feet && (
                          <div>
                            <span style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>Range:</span>{' '}
                            <span style={{ color: 'var(--color-cyber-cyan)' }}>{ability.range_feet}ft</span>
                          </div>
                        )}
                        {ability.area_of_effect && (
                          <div>
                            <span style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>AoE:</span>{' '}
                            <span style={{ color: 'var(--color-cyber-cyan)' }}>{ability.area_of_effect}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Selected Count */}
      {multiSelect && selectedAbilityIds.length > 0 && (
        <div className="text-sm text-center pt-2" style={{ 
          color: 'var(--color-cyber-purple)', 
          borderTop: '1px solid var(--color-cyber-cyan)',
          opacity: 0.7
        }}>
          {selectedAbilityIds.length} {selectedAbilityIds.length === 1 ? 'ability' : 'abilities'} selected
        </div>
      )}
    </div>
  );
}
