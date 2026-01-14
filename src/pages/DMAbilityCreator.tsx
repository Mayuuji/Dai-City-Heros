import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { AbilityType, ChargeType } from '../types/inventory';
import { getAbilityTypeIcon } from '../utils/stats';

export default function DMAbilityCreator() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [abilityName, setAbilityName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<AbilityType>('action');
  const [chargeType, setChargeType] = useState<ChargeType>('long_rest');
  const [maxCharges, setMaxCharges] = useState<number | null>(1);
  const [chargesPerRest, setChargesPerRest] = useState<number | null>(null);
  
  // Effects
  const [effects, setEffects] = useState<string[]>(['']);
  
  // Optional combat stats
  const [damageDice, setDamageDice] = useState('');
  const [damageType, setDamageType] = useState('');
  const [rangeFeet, setRangeFeet] = useState<number | null>(null);
  const [areaOfEffect, setAreaOfEffect] = useState('');
  const [duration, setDuration] = useState('');
  
  const [creating, setCreating] = useState(false);

  // Check if user is admin
  if (profile?.role !== 'admin') {
    navigate('/dashboard');
    return null;
  }

  const handleAddEffect = () => {
    setEffects([...effects, '']);
  };

  const handleRemoveEffect = (index: number) => {
    const newEffects = effects.filter((_, i) => i !== index);
    setEffects(newEffects.length > 0 ? newEffects : ['']);
  };

  const handleEffectChange = (index: number, value: string) => {
    const newEffects = [...effects];
    newEffects[index] = value;
    setEffects(newEffects);
  };

  const handleCreateAbility = async () => {
    if (!abilityName.trim()) {
      alert('Please enter an ability name');
      return;
    }

    if (effects.filter(e => e.trim()).length === 0) {
      alert('Please add at least one effect');
      return;
    }

    try {
      setCreating(true);

      const { error } = await supabase
        .from('abilities')
        .insert({
          name: abilityName,
          description: description || null,
          type,
          charge_type: chargeType,
          max_charges: chargeType === 'infinite' ? null : maxCharges,
          charges_per_rest: chargesPerRest,
          effects: effects.filter(e => e.trim()),
          damage_dice: damageDice || null,
          damage_type: damageType || null,
          range_feet: rangeFeet,
          area_of_effect: areaOfEffect || null,
          duration: duration || null
        })
        .select()
        .single();

      if (error) throw error;

      alert(`Ability "${abilityName}" created successfully!`);
      
      // Reset form
      setAbilityName('');
      setDescription('');
      setType('action');
      setChargeType('long_rest');
      setMaxCharges(1);
      setChargesPerRest(null);
      setEffects(['']);
      setDamageDice('');
      setDamageType('');
      setRangeFeet(null);
      setAreaOfEffect('');
      setDuration('');
    } catch (error: any) {
      console.error('Error creating ability:', error);
      alert(`Failed to create ability: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  const hasContent = abilityName.trim() || description.trim() || effects.some(e => e.trim()) ||
                     damageDice || damageType || rangeFeet || areaOfEffect || duration;

  return (
    <div className="min-h-screen grid-bg" style={{ backgroundColor: 'var(--color-cyber-darker)' }}>
      {/* Header */}
      <div className="glass-panel" style={{ borderRadius: 0, border: '2px solid var(--color-cyber-cyan)' }}>
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <button onClick={() => navigate('/dashboard')} className="neon-button text-sm">
            ← BACK TO DASHBOARD
          </button>
          <h1 className="text-2xl neon-text" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
            ⚡ ABILITY CREATOR
          </h1>
          <div className="w-32"></div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <div className="glass-panel p-6" style={{ border: '1px solid var(--color-cyber-cyan)' }}>
              <h2 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
                BASIC INFORMATION
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                    Ability Name *
                  </label>
                  <input
                    type="text"
                    value={abilityName}
                    onChange={(e) => setAbilityName(e.target.value)}
                    placeholder="e.g., Fireball, Sprint Boost, Stealth Mode"
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
                  <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what this ability does..."
                    rows={3}
                    className="w-full px-4 py-2 rounded"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                      border: '1px solid var(--color-cyber-cyan)',
                      color: 'var(--color-cyber-cyan)',
                      fontFamily: 'var(--font-mono)',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                      Type
                    </label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value as AbilityType)}
                      className="w-full px-4 py-2 rounded"
                      style={{
                        backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                        border: '1px solid var(--color-cyber-cyan)',
                        color: 'var(--color-cyber-cyan)',
                        fontFamily: 'var(--font-mono)'
                      }}
                    >
                      <option value="action">Action</option>
                      <option value="bonus_action">Bonus Action</option>
                      <option value="reaction">Reaction</option>
                      <option value="passive">Passive</option>
                      <option value="utility">Utility</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                      Charge Type
                    </label>
                    <select
                      value={chargeType}
                      onChange={(e) => {
                        const newChargeType = e.target.value as ChargeType;
                        setChargeType(newChargeType);
                        if (newChargeType === 'infinite') {
                          setMaxCharges(null);
                          setChargesPerRest(null);
                        } else if (maxCharges === null) {
                          setMaxCharges(1);
                        }
                      }}
                      className="w-full px-4 py-2 rounded"
                      style={{
                        backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                        border: '1px solid var(--color-cyber-cyan)',
                        color: 'var(--color-cyber-cyan)',
                        fontFamily: 'var(--font-mono)'
                      }}
                    >
                      <option value="infinite">Infinite (No Charges)</option>
                      <option value="short_rest">Short Rest</option>
                      <option value="long_rest">Long Rest</option>
                      <option value="uses">Limited Uses</option>
                    </select>
                  </div>
                </div>

                {chargeType !== 'infinite' && (
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                        Max Charges
                      </label>
                      <input
                        type="number"
                        value={maxCharges || ''}
                        onChange={(e) => setMaxCharges(e.target.value ? parseInt(e.target.value) : null)}
                        min={1}
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
                      <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                        Charges Per Rest (Optional)
                      </label>
                      <input
                        type="number"
                        value={chargesPerRest || ''}
                        onChange={(e) => setChargesPerRest(e.target.value ? parseInt(e.target.value) : null)}
                        min={1}
                        placeholder="e.g., restore 2 per rest"
                        className="w-full px-4 py-2 rounded"
                        style={{
                          backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                          border: '1px solid var(--color-cyber-cyan)',
                          color: 'var(--color-cyber-cyan)',
                          fontFamily: 'var(--font-mono)'
                        }}
                      />
                      <p className="text-xs mt-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>
                        Leave empty to restore all charges per rest
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Effects */}
            <div className="glass-panel p-6" style={{ border: '1px solid var(--color-cyber-cyan)' }}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
                  EFFECTS *
                </h2>
                <button
                  onClick={handleAddEffect}
                  className="neon-button text-sm px-3 py-1"
                >
                  + ADD EFFECT
                </button>
              </div>
              
              <div className="space-y-3">
                {effects.map((effect, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={effect}
                      onChange={(e) => handleEffectChange(index, e.target.value)}
                      placeholder={`Effect ${index + 1} (e.g., "Damage: 8d6 fire", "Healing: 2d8 HP")`}
                      className="flex-1 px-4 py-2 rounded"
                      style={{
                        backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                        border: '1px solid var(--color-cyber-cyan)',
                        color: 'var(--color-cyber-cyan)',
                        fontFamily: 'var(--font-mono)'
                      }}
                    />
                    {effects.length > 1 && (
                      <button
                        onClick={() => handleRemoveEffect(index)}
                        className="px-3 py-2 rounded"
                        style={{
                          backgroundColor: 'color-mix(in srgb, var(--color-cyber-red) 20%, transparent)',
                          border: '1px solid var(--color-cyber-red)',
                          color: 'var(--color-cyber-red)'
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Combat Stats (Optional) */}
            <div className="glass-panel p-6" style={{ border: '1px solid var(--color-cyber-cyan)' }}>
              <h2 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
                COMBAT STATS (Optional)
              </h2>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                    Damage Dice
                  </label>
                  <input
                    type="text"
                    value={damageDice}
                    onChange={(e) => setDamageDice(e.target.value)}
                    placeholder="e.g., 8d6, 2d8+4"
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
                  <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                    Damage Type
                  </label>
                  <input
                    type="text"
                    value={damageType}
                    onChange={(e) => setDamageType(e.target.value)}
                    placeholder="e.g., fire, slashing, kinetic"
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
                  <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                    Range (feet)
                  </label>
                  <input
                    type="number"
                    value={rangeFeet || ''}
                    onChange={(e) => setRangeFeet(e.target.value ? parseInt(e.target.value) : null)}
                    min={0}
                    placeholder="e.g., 30, 60, 120"
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
                  <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                    Area of Effect
                  </label>
                  <input
                    type="text"
                    value={areaOfEffect}
                    onChange={(e) => setAreaOfEffect(e.target.value)}
                    placeholder="e.g., 20ft radius, 30ft cone"
                    className="w-full px-4 py-2 rounded"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                      border: '1px solid var(--color-cyber-cyan)',
                      color: 'var(--color-cyber-cyan)',
                      fontFamily: 'var(--font-mono)'
                    }}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                    Duration
                  </label>
                  <input
                    type="text"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="e.g., 1 minute, 1 hour, Instantaneous"
                    className="w-full px-4 py-2 rounded"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                      border: '1px solid var(--color-cyber-cyan)',
                      color: 'var(--color-cyber-cyan)',
                      fontFamily: 'var(--font-mono)'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Create Button */}
            <button
              onClick={handleCreateAbility}
              disabled={creating || !abilityName.trim() || effects.filter(e => e.trim()).length === 0}
              className="w-full neon-button py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontFamily: 'var(--font-cyber)' }}
            >
              {creating ? 'CREATING...' : '⚡ CREATE ABILITY'}
            </button>
          </div>

          {/* Right: Live Preview */}
          <div className="lg:col-span-1">
            <div className="glass-panel p-6 sticky top-4" style={{ border: '1px solid var(--color-cyber-cyan)' }}>
              <h2 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
                LIVE PREVIEW
              </h2>
              
              {hasContent ? (
                <div className="space-y-3">
                  {/* Ability Card Preview */}
                  <div
                    className="glass-panel p-4"
                    style={{
                      border: '1px solid var(--color-cyber-cyan)',
                      backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 5%, transparent)'
                    }}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getAbilityTypeIcon(type)}</span>
                          <h3 className="font-bold" style={{ color: 'var(--color-cyber-cyan)' }}>
                            {abilityName || 'Ability Name'}
                          </h3>
                        </div>
                        <p className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.8 }}>
                          {type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                        </p>
                      </div>
                      
                      {chargeType !== 'infinite' && (
                        <div className="text-right">
                          <div className="text-sm font-bold" style={{ color: 'var(--color-cyber-cyan)' }}>
                            {maxCharges || '?'} / {maxCharges || '?'}
                          </div>
                          <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>
                            {chargeType === 'short_rest' && 'Short Rest'}
                            {chargeType === 'long_rest' && 'Long Rest'}
                            {chargeType === 'uses' && 'Limited Uses'}
                            {chargesPerRest && ` (+${chargesPerRest})`}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    {description && (
                      <p className="text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.9 }}>
                        {description}
                      </p>
                    )}

                    {/* Effects */}
                    {effects.filter(e => e.trim()).length > 0 && (
                      <div className="space-y-1 mb-2">
                        {effects.filter(e => e.trim()).map((effect, i) => (
                          <div key={i} className="text-sm flex items-start gap-2">
                            <span style={{ color: 'var(--color-cyber-green)' }}>▸</span>
                            <span style={{ color: 'var(--color-cyber-cyan)' }}>{effect}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Combat Stats */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {damageDice && (
                        <div>
                          <span style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>Damage:</span>{' '}
                          <span style={{ color: 'var(--color-cyber-red)' }}>{damageDice}</span>
                        </div>
                      )}
                      {damageType && (
                        <div>
                          <span style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>Type:</span>{' '}
                          <span style={{ color: 'var(--color-cyber-cyan)' }}>{damageType}</span>
                        </div>
                      )}
                      {rangeFeet && (
                        <div>
                          <span style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>Range:</span>{' '}
                          <span style={{ color: 'var(--color-cyber-cyan)' }}>{rangeFeet}ft</span>
                        </div>
                      )}
                      {areaOfEffect && (
                        <div>
                          <span style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>AoE:</span>{' '}
                          <span style={{ color: 'var(--color-cyber-cyan)' }}>{areaOfEffect}</span>
                        </div>
                      )}
                      {duration && (
                        <div className="col-span-2">
                          <span style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>Duration:</span>{' '}
                          <span style={{ color: 'var(--color-cyber-cyan)' }}>{duration}</span>
                        </div>
                      )}
                    </div>

                    {/* Info Note */}
                    <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--color-cyber-cyan)', opacity: 0.3 }}>
                      <p className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>
                        💡 Attach this ability to an item in the Item Creator
                      </p>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="text-xs space-y-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>
                    <p>✓ This is how the ability will appear to players</p>
                    {chargesPerRest && chargeType !== 'infinite' && (
                      <p>⚠️ Restores {chargesPerRest} charge(s) per {chargeType.replace('_', ' ')}</p>
                    )}
                    <p>📎 Abilities can be attached to items when equipped</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>
                  <p className="text-sm">Fill out the form to see a preview</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
