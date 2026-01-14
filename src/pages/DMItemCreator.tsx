import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { ItemType, ItemRarity } from '../types/inventory';
import { ALL_SKILLS } from '../data/characterClasses';
import { formatModifier, getRarityColor, getItemTypeIcon } from '../utils/stats';
import AbilityBrowser from '../components/AbilityBrowser';

export default function DMItemCreator() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [itemName, setItemName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ItemType>('item');
  const [rarity, setRarity] = useState<ItemRarity>('Common');
  const [price, setPrice] = useState(0);
  
  // Stat modifiers
  const [strMod, setStrMod] = useState(0);
  const [dexMod, setDexMod] = useState(0);
  const [conMod, setConMod] = useState(0);
  const [wisMod, setWisMod] = useState(0);
  const [intMod, setIntMod] = useState(0);
  const [chaMod, setChaMod] = useState(0);
  const [hpMod, setHpMod] = useState(0);
  const [acMod, setAcMod] = useState(0);
  const [speedMod, setSpeedMod] = useState(0);
  const [initMod, setInitMod] = useState(0);
  const [icMod, setIcMod] = useState(0);
  
  // Skill modifiers
  const [skillMods, setSkillMods] = useState<{ [key: string]: number }>({});
  
  // Linked abilities
  const [linkedAbilityIds, setLinkedAbilityIds] = useState<string[]>([]);
  const [requiresEquipped, setRequiresEquipped] = useState(true);
  
  const [isConsumable, setIsConsumable] = useState(false);
  const [isEquippable, setIsEquippable] = useState(true);
  const [stackSize, setStackSize] = useState(1);
  
  const [creating, setCreating] = useState(false);

  // Check if user is admin
  if (profile?.role !== 'admin') {
    navigate('/dashboard');
    return null;
  }

  const handleAddSkillMod = (skill: string, value: number) => {
    if (value === 0) {
      const newMods = { ...skillMods };
      delete newMods[skill];
      setSkillMods(newMods);
    } else {
      setSkillMods({ ...skillMods, [skill]: value });
    }
  };

  const handleCreateItem = async () => {
    if (!itemName.trim()) {
      alert('Please enter an item name');
      return;
    }

    try {
      setCreating(true);

      // 1. Create the item first
      const { data: newItem, error: itemError } = await supabase
        .from('items')
        .insert({
          name: itemName,
          description: description || null,
          type,
          rarity,
          price,
          str_mod: strMod,
          dex_mod: dexMod,
          con_mod: conMod,
          wis_mod: wisMod,
          int_mod: intMod,
          cha_mod: chaMod,
          hp_mod: hpMod,
          ac_mod: acMod,
          speed_mod: speedMod,
          init_mod: initMod,
          ic_mod: icMod,
          skill_mods: skillMods,
          is_consumable: isConsumable,
          is_equippable: isEquippable,
          stack_size: stackSize,
          created_by: profile?.id
        })
        .select()
        .single();

      if (itemError) throw itemError;

      // 2. Link abilities if any were selected
      if (linkedAbilityIds.length > 0 && newItem) {
        const abilityLinks = linkedAbilityIds.map(abilityId => ({
          item_id: newItem.id,
          ability_id: abilityId,
          requires_equipped: requiresEquipped
        }));

        const { error: linkError } = await supabase
          .from('item_abilities')
          .insert(abilityLinks);

        if (linkError) {
          console.error('Error linking abilities:', linkError);
          alert(`Item created but failed to link abilities: ${linkError.message}`);
          return;
        }
      }

      alert(`Item "${itemName}" created successfully!${linkedAbilityIds.length > 0 ? ` Linked ${linkedAbilityIds.length} abilities.` : ''}`);
      
      // Reset form
      setItemName('');
      setDescription('');
      setType('item');
      setRarity('Common');
      setPrice(0);
      setStrMod(0);
      setDexMod(0);
      setConMod(0);
      setWisMod(0);
      setIntMod(0);
      setChaMod(0);
      setHpMod(0);
      setAcMod(0);
      setSpeedMod(0);
      setInitMod(0);
      setIcMod(0);
      setSkillMods({});
      setIsConsumable(false);
      setIsEquippable(true);
      setStackSize(1);
      setLinkedAbilityIds([]);
      setRequiresEquipped(true);

    } catch (err: any) {
      console.error('Error creating item:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const hasAnyMods = strMod !== 0 || dexMod !== 0 || conMod !== 0 || wisMod !== 0 || 
                     intMod !== 0 || chaMod !== 0 || hpMod !== 0 || acMod !== 0 || 
                     speedMod !== 0 || initMod !== 0 || icMod !== 0 ||
                     Object.keys(skillMods).length > 0;

  return (
    <div className="min-h-screen grid-bg" style={{ backgroundColor: 'var(--color-cyber-darker)' }}>
      {/* Header */}
      <div className="glass-panel" style={{ borderRadius: 0, border: '2px solid var(--color-cyber-cyan)' }}>
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <button onClick={() => navigate('/dashboard')} className="neon-button text-sm">
            ← BACK TO DASHBOARD
          </button>
          <h1 className="text-2xl neon-text" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
            ⚔️ ITEM CREATOR
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
                    Item Name *
                  </label>
                  <input
                    type="text"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="e.g., Reinforced Combat Armor"
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
                    placeholder="Describe the item's appearance and function..."
                    rows={3}
                    className="w-full px-4 py-2 rounded"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                      border: '1px solid var(--color-cyber-cyan)',
                      color: 'var(--color-cyber-cyan)',
                      fontFamily: 'var(--font-mono)'
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
                      onChange={(e) => setType(e.target.value as ItemType)}
                      className="w-full px-4 py-2 rounded"
                      style={{
                        backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                        border: '1px solid var(--color-cyber-cyan)',
                        color: 'var(--color-cyber-cyan)',
                        fontFamily: 'var(--font-mono)'
                      }}
                    >
                      <option value="weapon">Weapon</option>
                      <option value="armor">Armor</option>
                      <option value="consumable">Consumable</option>
                      <option value="cyberware">Cyberware</option>
                      <option value="item">Item</option>
                      <option value="mission_item">Mission Item</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                      Rarity
                    </label>
                    <select
                      value={rarity}
                      onChange={(e) => setRarity(e.target.value as ItemRarity)}
                      className="w-full px-4 py-2 rounded"
                      style={{
                        backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                        border: '1px solid var(--color-cyber-cyan)',
                        color: 'var(--color-cyber-cyan)',
                        fontFamily: 'var(--font-mono)'
                      }}
                    >
                      <option value="Common">Common</option>
                      <option value="Uncommon">Uncommon</option>
                      <option value="Rare">Rare</option>
                      <option value="Epic">Epic</option>
                      <option value="Mythic">Mythic</option>
                      <option value="Ultra Rare">Ultra Rare</option>
                      <option value="MISSION ITEM">MISSION ITEM</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                    Price (USD)
                  </label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2 rounded"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--color-cyber-green) 10%, transparent)',
                      border: '1px solid var(--color-cyber-green)',
                      color: 'var(--color-cyber-green)',
                      fontFamily: 'var(--font-mono)'
                    }}
                  />
                </div>

                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isEquippable}
                      onChange={(e) => setIsEquippable(e.target.checked)}
                      className="w-5 h-5"
                    />
                    <span className="text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                      Equippable
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isConsumable}
                      onChange={(e) => setIsConsumable(e.target.checked)}
                      className="w-5 h-5"
                    />
                    <span className="text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                      Consumable
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Stat Modifiers */}
            <div className="glass-panel p-6" style={{ border: '1px solid var(--color-cyber-purple)' }}>
              <h2 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-purple)' }}>
                STAT MODIFIERS
              </h2>
              
              <div className="grid grid-cols-4 gap-4 mb-4">
                {/* Row 1: Core Stats */}
                <div className="flex items-center gap-2">
                  <span className="text-sm w-10" style={{ color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-mono)' }}>STR</span>
                  <button onClick={() => setStrMod(strMod - 1)} className="px-2 py-1 rounded" style={{ border: '1px solid var(--color-cyber-purple)', color: 'var(--color-cyber-purple)' }}>−</button>
                  <span className="w-8 text-center" style={{ color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-mono)' }}>{strMod}</span>
                  <button onClick={() => setStrMod(strMod + 1)} className="px-2 py-1 rounded" style={{ border: '1px solid var(--color-cyber-purple)', color: 'var(--color-cyber-purple)' }}>+</button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm w-10" style={{ color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-mono)' }}>DEX</span>
                  <button onClick={() => setDexMod(dexMod - 1)} className="px-2 py-1 rounded" style={{ border: '1px solid var(--color-cyber-purple)', color: 'var(--color-cyber-purple)' }}>−</button>
                  <span className="w-8 text-center" style={{ color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-mono)' }}>{dexMod}</span>
                  <button onClick={() => setDexMod(dexMod + 1)} className="px-2 py-1 rounded" style={{ border: '1px solid var(--color-cyber-purple)', color: 'var(--color-cyber-purple)' }}>+</button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm w-10" style={{ color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-mono)' }}>CON</span>
                  <button onClick={() => setConMod(conMod - 1)} className="px-2 py-1 rounded" style={{ border: '1px solid var(--color-cyber-purple)', color: 'var(--color-cyber-purple)' }}>−</button>
                  <span className="w-8 text-center" style={{ color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-mono)' }}>{conMod}</span>
                  <button onClick={() => setConMod(conMod + 1)} className="px-2 py-1 rounded" style={{ border: '1px solid var(--color-cyber-purple)', color: 'var(--color-cyber-purple)' }}>+</button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm w-10" style={{ color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-mono)' }}>WIS</span>
                  <button onClick={() => setWisMod(wisMod - 1)} className="px-2 py-1 rounded" style={{ border: '1px solid var(--color-cyber-purple)', color: 'var(--color-cyber-purple)' }}>−</button>
                  <span className="w-8 text-center" style={{ color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-mono)' }}>{wisMod}</span>
                  <button onClick={() => setWisMod(wisMod + 1)} className="px-2 py-1 rounded" style={{ border: '1px solid var(--color-cyber-purple)', color: 'var(--color-cyber-purple)' }}>+</button>
                </div>
                {/* Row 2: More Stats */}
                <div className="flex items-center gap-2">
                  <span className="text-sm w-10" style={{ color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-mono)' }}>INT</span>
                  <button onClick={() => setIntMod(intMod - 1)} className="px-2 py-1 rounded" style={{ border: '1px solid var(--color-cyber-purple)', color: 'var(--color-cyber-purple)' }}>−</button>
                  <span className="w-8 text-center" style={{ color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-mono)' }}>{intMod}</span>
                  <button onClick={() => setIntMod(intMod + 1)} className="px-2 py-1 rounded" style={{ border: '1px solid var(--color-cyber-purple)', color: 'var(--color-cyber-purple)' }}>+</button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm w-10" style={{ color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-mono)' }}>CHA</span>
                  <button onClick={() => setChaMod(chaMod - 1)} className="px-2 py-1 rounded" style={{ border: '1px solid var(--color-cyber-purple)', color: 'var(--color-cyber-purple)' }}>−</button>
                  <span className="w-8 text-center" style={{ color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-mono)' }}>{chaMod}</span>
                  <button onClick={() => setChaMod(chaMod + 1)} className="px-2 py-1 rounded" style={{ border: '1px solid var(--color-cyber-purple)', color: 'var(--color-cyber-purple)' }}>+</button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm w-10" style={{ color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-mono)' }}>HP</span>
                  <button onClick={() => setHpMod(hpMod - 1)} className="px-2 py-1 rounded" style={{ border: '1px solid var(--color-cyber-purple)', color: 'var(--color-cyber-purple)' }}>−</button>
                  <span className="w-8 text-center" style={{ color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-mono)' }}>{hpMod}</span>
                  <button onClick={() => setHpMod(hpMod + 1)} className="px-2 py-1 rounded" style={{ border: '1px solid var(--color-cyber-purple)', color: 'var(--color-cyber-purple)' }}>+</button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm w-10" style={{ color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-mono)' }}>AC</span>
                  <button onClick={() => setAcMod(acMod - 1)} className="px-2 py-1 rounded" style={{ border: '1px solid var(--color-cyber-purple)', color: 'var(--color-cyber-purple)' }}>−</button>
                  <span className="w-8 text-center" style={{ color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-mono)' }}>{acMod}</span>
                  <button onClick={() => setAcMod(acMod + 1)} className="px-2 py-1 rounded" style={{ border: '1px solid var(--color-cyber-purple)', color: 'var(--color-cyber-purple)' }}>+</button>
                </div>
              </div>
              
              {/* NEW: SPEED, INIT, IC Row - Cyan colored to stand out */}
              <div className="grid grid-cols-3 gap-4 pt-4" style={{ borderTop: '1px solid var(--color-cyber-cyan)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-sm w-12" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>SPEED</span>
                  <button onClick={() => setSpeedMod(speedMod - 1)} className="px-2 py-1 rounded" style={{ border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}>−</button>
                  <span className="w-8 text-center" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{speedMod}</span>
                  <button onClick={() => setSpeedMod(speedMod + 1)} className="px-2 py-1 rounded" style={{ border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}>+</button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm w-12" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>INIT</span>
                  <button onClick={() => setInitMod(initMod - 1)} className="px-2 py-1 rounded" style={{ border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}>−</button>
                  <span className="w-8 text-center" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{initMod}</span>
                  <button onClick={() => setInitMod(initMod + 1)} className="px-2 py-1 rounded" style={{ border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}>+</button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm w-12" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>IC</span>
                  <button onClick={() => setIcMod(icMod - 1)} className="px-2 py-1 rounded" style={{ border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}>−</button>
                  <span className="w-8 text-center" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{icMod}</span>
                  <button onClick={() => setIcMod(icMod + 1)} className="px-2 py-1 rounded" style={{ border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}>+</button>
                </div>
              </div>
            </div>

            {/* Skill Modifiers */}
            <div className="glass-panel p-6" style={{ border: '1px solid var(--color-cyber-green)' }}>
              <h2 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-green)' }}>
                SKILL BONUSES
              </h2>
              
              <div className="grid md:grid-cols-2 gap-3">
                {ALL_SKILLS.map(skill => (
                  <div key={skill} className="flex items-center justify-between gap-4">
                    <span className="text-xs flex-1" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>
                      {skill}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAddSkillMod(skill, (skillMods[skill] || 0) - 1)}
                        className="px-2 py-1 rounded text-xs"
                        style={{ 
                          backgroundColor: 'color-mix(in srgb, var(--color-cyber-green) 20%, transparent)',
                          border: '1px solid var(--color-cyber-green)',
                          color: 'var(--color-cyber-green)'
                        }}
                      >
                        −
                      </button>
                      <span className="w-12 text-center text-sm" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>
                        {skillMods[skill] ? formatModifier(skillMods[skill]) : '—'}
                      </span>
                      <button
                        onClick={() => handleAddSkillMod(skill, (skillMods[skill] || 0) + 1)}
                        className="px-2 py-1 rounded text-xs"
                        style={{ 
                          backgroundColor: 'color-mix(in srgb, var(--color-cyber-green) 20%, transparent)',
                          border: '1px solid var(--color-cyber-green)',
                          color: 'var(--color-cyber-green)'
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Linked Abilities */}
            <div className="glass-panel p-6" style={{ border: '1px solid var(--color-cyber-pink)' }}>
              <h2 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-pink)' }}>
                LINKED ABILITIES (Optional)
              </h2>
              
              <div className="mb-4">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={requiresEquipped}
                    onChange={(e) => setRequiresEquipped(e.target.checked)}
                    className="w-5 h-5"
                  />
                  <span className="text-sm" style={{ color: 'var(--color-cyber-pink)', fontFamily: 'var(--font-mono)' }}>
                    Requires Equipped
                  </span>
                </label>
                <p className="text-xs mt-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                  {requiresEquipped 
                    ? 'Abilities will be granted when item is equipped, removed when unequipped.'
                    : 'Abilities will be granted immediately when item is received.'}
                </p>
              </div>

              <AbilityBrowser
                selectedAbilityIds={linkedAbilityIds}
                onToggleAbility={(abilityId) => {
                  setLinkedAbilityIds(prev => 
                    prev.includes(abilityId)
                      ? prev.filter(id => id !== abilityId)
                      : [...prev, abilityId]
                  );
                }}
                multiSelect={true}
              />
            </div>

            {/* Create Button */}
            <button
              onClick={handleCreateItem}
              disabled={creating || !itemName.trim()}
              className="neon-button w-full py-4 text-lg"
              style={{ opacity: creating || !itemName.trim() ? 0.5 : 1 }}
            >
              {creating ? 'CREATING...' : 'CREATE ITEM'}
            </button>
          </div>

          {/* Right: Preview */}
          <div className="lg:col-span-1">
            <div className="glass-panel p-6 sticky top-4" style={{ border: `2px solid ${getRarityColor(rarity)}` }}>
              <h2 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: getRarityColor(rarity) }}>
                PREVIEW
              </h2>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{getItemTypeIcon(type)}</span>
                  <div>
                    <div className="text-lg" style={{ color: getRarityColor(rarity), fontFamily: 'var(--font-cyber)' }}>
                      {itemName || 'Unnamed Item'}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                      {type.toUpperCase()} • {rarity.toUpperCase()}
                    </div>
                  </div>
                </div>

                {description && (
                  <p className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                    {description}
                  </p>
                )}

                {hasAnyMods && (
                  <div className="p-4 rounded" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)' }}>
                    <h3 className="text-sm mb-2" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-cyber)' }}>
                      EFFECTS
                    </h3>
                    <div className="space-y-1">
                      {[
                        { label: 'STR', value: strMod },
                        { label: 'DEX', value: dexMod },
                        { label: 'CON', value: conMod },
                        { label: 'WIS', value: wisMod },
                        { label: 'INT', value: intMod },
                        { label: 'CHA', value: chaMod },
                        { label: 'HP', value: hpMod },
                        { label: 'AC', value: acMod },
                        { label: 'SPEED', value: speedMod },
                        { label: 'INIT', value: initMod },
                        { label: 'IC', value: icMod }
                      ].filter(s => s.value !== 0).map(stat => (
                        <div key={stat.label} className="text-xs" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>
                          • {stat.label} {formatModifier(stat.value)}
                        </div>
                      ))}
                      {Object.entries(skillMods).map(([skill, bonus]) => (
                        <div key={skill} className="text-xs" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>
                          • {skill} {formatModifier(bonus)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center pt-4" style={{ borderTop: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)' }}>
                  <div className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                    {isEquippable && <span>Equippable</span>}
                    {isConsumable && <span> • Consumable</span>}
                  </div>
                  <div className="text-lg" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>
                    ${price.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
