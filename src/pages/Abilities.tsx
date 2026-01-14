import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { CharacterAbility } from '../types/inventory';
import {
  getAbilityTypeIcon,
  getChargeTypeText,
  canUseAbility
} from '../utils/stats';

interface Character {
  id: string;
  name: string;
  class: string;
  level: number;
}

export default function Abilities() {
  const { id } = useParams(); // character ID
  const navigate = useNavigate();
  const { user } = useAuth();

  const [character, setCharacter] = useState<Character | null>(null);
  const [abilities, setAbilities] = useState<CharacterAbility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAbility, setSelectedAbility] = useState<CharacterAbility | null>(null);

  useEffect(() => {
    if (id && user) {
      fetchCharacterAndAbilities();
    }
  }, [id, user]);

  const fetchCharacterAndAbilities = async () => {
    try {
      setLoading(true);

      // Fetch character
      const { data: charData, error: charError } = await supabase
        .from('characters')
        .select('id, name, class, level')
        .eq('id', id)
        .eq('user_id', user?.id)
        .single();

      if (charError) throw charError;
      setCharacter(charData);

      // Fetch character abilities with ability details
      const { data: abilitiesData, error: abilitiesError } = await supabase
        .from('character_abilities')
        .select(`
          *,
          ability:abilities (*)
        `)
        .eq('character_id', id);

      if (abilitiesError) throw abilitiesError;
      setAbilities(abilitiesData || []);

    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUseAbility = async (charAbility: CharacterAbility) => {
    if (!charAbility.ability) return;
    
    // Check if ability can be used
    if (!canUseAbility({ 
      charge_type: charAbility.ability.charge_type, 
      current_charges: charAbility.current_charges 
    })) {
      alert('No charges remaining!');
      return;
    }

    // Infinite charge abilities don't need to be updated
    if (charAbility.ability.charge_type === 'infinite') {
      alert(`Used ${charAbility.ability.name}!`);
      return;
    }

    try {
      // Decrease charge count
      const newCharges = charAbility.current_charges - 1;
      
      const { error } = await supabase
        .from('character_abilities')
        .update({ current_charges: newCharges })
        .eq('id', charAbility.id);

      if (error) throw error;

      // Update local state
      setAbilities(prev =>
        prev.map(ab =>
          ab.id === charAbility.id
            ? { ...ab, current_charges: newCharges }
            : ab
        )
      );

      alert(`Used ${charAbility.ability.name}! ${newCharges} charges remaining.`);
      setSelectedAbility(null);

    } catch (err: any) {
      console.error('Error using ability:', err);
      alert(`Error: ${err.message}`);
    }
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
            Loading abilities...
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

  // Group abilities by source type
  const classAbilities = abilities.filter(ab => ab.source_type === 'class');
  const itemAbilities = abilities.filter(ab => ab.source_type === 'item');
  const tempAbilities = abilities.filter(ab => ab.source_type === 'temporary');

  return (
    <div className="min-h-screen grid-bg" style={{ backgroundColor: 'var(--color-cyber-darker)' }}>
      {/* Header */}
      <div className="glass-panel neon-border" style={{ borderRadius: 0 }}>
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <button onClick={() => navigate(`/character/${id}`)} className="neon-button text-sm">
            ← BACK TO CHARACTER
          </button>
          <h1 className="text-2xl neon-text" style={{ fontFamily: 'var(--font-cyber)' }}>
            ABILITIES - {character.name.toUpperCase()}
          </h1>
          <div className="w-32"></div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Class Abilities */}
        {classAbilities.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-purple)' }}>
              CLASS ABILITIES ({classAbilities.length})
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {classAbilities.map(charAbility => {
                const ability = charAbility.ability;
                if (!ability) return null;

                const hasCharges = canUseAbility({
                  charge_type: ability.charge_type,
                  current_charges: charAbility.current_charges
                });

                return (
                  <div
                    key={charAbility.id}
                    onClick={() => setSelectedAbility(charAbility)}
                    className="glass-panel p-4 cursor-pointer transition-all hover:brightness-110"
                    style={{
                      border: hasCharges
                        ? '1px solid var(--color-cyber-purple)'
                        : '1px solid color-mix(in srgb, var(--color-cyber-purple) 20%, transparent)',
                      opacity: hasCharges ? 1 : 0.5
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{getAbilityTypeIcon(ability.type)}</span>
                        <div>
                          <div className="text-sm" style={{ color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-cyber)' }}>
                            {ability.name}
                          </div>
                          <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                            {ability.type.toUpperCase()}
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs mb-3 line-clamp-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                      {ability.description}
                    </p>

                    {/* Charges */}
                    <div className="flex items-center justify-between">
                      {ability.charge_type === 'infinite' ? (
                        <div className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-cyber-green)', color: 'var(--color-cyber-darker)' }}>
                          UNLIMITED
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                            {getChargeTypeText(ability.charge_type, ability.max_charges)}
                          </div>
                          <div className="text-sm px-2 py-1 rounded" style={{
                            backgroundColor: hasCharges ? 'var(--color-cyber-purple)' : 'color-mix(in srgb, var(--color-cyber-purple) 30%, transparent)',
                            color: 'var(--color-cyber-darker)',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 'bold'
                          }}>
                            {charAbility.current_charges} / {ability.max_charges}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Item Abilities */}
        {itemAbilities.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
              ITEM ABILITIES ({itemAbilities.length})
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {itemAbilities.map(charAbility => {
                const ability = charAbility.ability;
                if (!ability) return null;

                const hasCharges = canUseAbility({
                  charge_type: ability.charge_type,
                  current_charges: charAbility.current_charges
                });

                return (
                  <div
                    key={charAbility.id}
                    onClick={() => setSelectedAbility(charAbility)}
                    className="glass-panel p-4 cursor-pointer transition-all hover:brightness-110"
                    style={{
                      border: hasCharges
                        ? '1px solid var(--color-cyber-cyan)'
                        : '1px solid color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)',
                      opacity: hasCharges ? 1 : 0.5
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{getAbilityTypeIcon(ability.type)}</span>
                        <div>
                          <div className="text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>
                            {ability.name}
                          </div>
                          <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                            {ability.type.toUpperCase()}
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs mb-3 line-clamp-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                      {ability.description}
                    </p>

                    {/* Charges */}
                    <div className="flex items-center justify-between">
                      {ability.charge_type === 'infinite' ? (
                        <div className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-cyber-green)', color: 'var(--color-cyber-darker)' }}>
                          UNLIMITED
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                            {getChargeTypeText(ability.charge_type, ability.max_charges)}
                          </div>
                          <div className="text-sm px-2 py-1 rounded" style={{
                            backgroundColor: hasCharges ? 'var(--color-cyber-cyan)' : 'color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)',
                            color: 'var(--color-cyber-darker)',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 'bold'
                          }}>
                            {charAbility.current_charges} / {ability.max_charges}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Temporary Abilities */}
        {tempAbilities.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-magenta)' }}>
              TEMPORARY ABILITIES ({tempAbilities.length})
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tempAbilities.map(charAbility => {
                const ability = charAbility.ability;
                if (!ability) return null;

                const hasCharges = canUseAbility({
                  charge_type: ability.charge_type,
                  current_charges: charAbility.current_charges
                });

                return (
                  <div
                    key={charAbility.id}
                    onClick={() => setSelectedAbility(charAbility)}
                    className="glass-panel p-4 cursor-pointer transition-all hover:brightness-110"
                    style={{
                      border: hasCharges
                        ? '1px solid var(--color-cyber-magenta)'
                        : '1px solid color-mix(in srgb, var(--color-cyber-magenta) 20%, transparent)',
                      opacity: hasCharges ? 1 : 0.5
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{getAbilityTypeIcon(ability.type)}</span>
                        <div>
                          <div className="text-sm" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-cyber)' }}>
                            {ability.name}
                          </div>
                          <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                            {ability.type.toUpperCase()}
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs mb-3 line-clamp-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                      {ability.description}
                    </p>

                    {/* Charges */}
                    <div className="flex items-center justify-between">
                      {ability.charge_type === 'infinite' ? (
                        <div className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-cyber-green)', color: 'var(--color-cyber-darker)' }}>
                          UNLIMITED
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                            {getChargeTypeText(ability.charge_type, ability.max_charges)}
                          </div>
                          <div className="text-sm px-2 py-1 rounded" style={{
                            backgroundColor: hasCharges ? 'var(--color-cyber-magenta)' : 'color-mix(in srgb, var(--color-cyber-magenta) 30%, transparent)',
                            color: 'var(--color-cyber-darker)',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 'bold'
                          }}>
                            {charAbility.current_charges} / {ability.max_charges}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {abilities.length === 0 && (
          <div className="glass-panel p-12 text-center">
            <p className="text-lg mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
              No abilities yet
            </p>
            <p className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
              Abilities will appear here as you level up or acquire items
            </p>
          </div>
        )}
      </div>

      {/* Ability Details Modal */}
      {selectedAbility && selectedAbility.ability && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 z-50"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
          onClick={() => setSelectedAbility(null)}
        >
          <div
            className="glass-panel p-6 max-w-lg w-full"
            style={{ border: `2px solid var(--color-cyber-${selectedAbility.source_type === 'class' ? 'purple' : selectedAbility.source_type === 'item' ? 'cyan' : 'magenta'})` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{getAbilityTypeIcon(selectedAbility.ability.type)}</span>
                <div>
                  <h2 className="text-2xl mb-1" style={{
                    color: `var(--color-cyber-${selectedAbility.source_type === 'class' ? 'purple' : selectedAbility.source_type === 'item' ? 'cyan' : 'magenta'})`,
                    fontFamily: 'var(--font-cyber)'
                  }}>
                    {selectedAbility.ability.name}
                  </h2>
                  <div className="flex items-center gap-2">
                    <div className="text-xs px-2 py-1 rounded" style={{
                      backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)',
                      color: 'var(--color-cyber-cyan)'
                    }}>
                      {selectedAbility.ability.type.toUpperCase()}
                    </div>
                    <div className="text-xs px-2 py-1 rounded" style={{
                      backgroundColor: 'color-mix(in srgb, var(--color-cyber-green) 30%, transparent)',
                      color: 'var(--color-cyber-green)'
                    }}>
                      {selectedAbility.source_type.toUpperCase()}
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedAbility(null)}
                className="text-2xl"
                style={{ color: 'var(--color-cyber-pink)' }}
              >
                ×
              </button>
            </div>

            <p className="text-sm mb-6" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
              {selectedAbility.ability.description}
            </p>

            {/* Effects */}
            {selectedAbility.ability.effects && selectedAbility.ability.effects.length > 0 && (
              <div className="mb-6 p-4 rounded" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)' }}>
                <h3 className="text-sm mb-3" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-cyber)' }}>
                  EFFECTS
                </h3>
                <div className="space-y-2">
                  {selectedAbility.ability.effects.map((effect: string, idx: number) => (
                    <div key={idx} className="text-xs" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>
                      • {effect}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Charges */}
            <div className="flex items-center justify-between mb-6 p-4 rounded" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-purple) 30%, transparent)' }}>
              <div className="text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                {getChargeTypeText(selectedAbility.ability.charge_type, selectedAbility.ability.max_charges)}
              </div>
              {selectedAbility.ability.charge_type !== 'infinite' && (
                <div className="text-2xl" style={{ color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-mono)' }}>
                  {selectedAbility.current_charges} / {selectedAbility.ability.max_charges}
                </div>
              )}
            </div>

            {/* Use Button */}
            <button
              onClick={() => handleUseAbility(selectedAbility)}
              disabled={!canUseAbility({
                charge_type: selectedAbility.ability.charge_type,
                current_charges: selectedAbility.current_charges
              })}
              className="neon-button w-full"
              style={{
                opacity: canUseAbility({
                  charge_type: selectedAbility.ability.charge_type,
                  current_charges: selectedAbility.current_charges
                }) ? 1 : 0.5
              }}
            >
              USE ABILITY
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
