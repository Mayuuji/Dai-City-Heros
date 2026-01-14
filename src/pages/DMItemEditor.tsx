import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  getItemTypeIcon, 
  getRarityColor, 
  formatModifier
} from '../utils/stats';
import { ALL_SKILLS } from '../data/characterClasses';
import AbilityBrowser from '../components/AbilityBrowser';
import type { Item } from '../types/inventory';

export default function DMItemEditor() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterRarity, setFilterRarity] = useState<string>('all');
  
  // Edit form state
  const [itemName, setItemName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<string>('item');
  const [rarity, setRarity] = useState<string>('Common');
  const [price, setPrice] = useState(0);
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
  const [skillMods, setSkillMods] = useState<{ [key: string]: number }>({});
  const [isConsumable, setIsConsumable] = useState(false);
  const [isEquippable, setIsEquippable] = useState(true);
  const [stackSize, setStackSize] = useState(1);
  const [linkedAbilityIds, setLinkedAbilityIds] = useState<string[]>([]);
  const [requiresEquipped, setRequiresEquipped] = useState(true);

  useEffect(() => {
    if (profile?.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    fetchItems();
  }, [profile, navigate]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setItems(data || []);
    } catch (err: any) {
      console.error('Error fetching items:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadItemForEditing = async (item: Item) => {
    setSelectedItem(item);
    setItemName(item.name);
    setDescription(item.description || '');
    setType(item.type);
    setRarity(item.rarity);
    setPrice(item.price);
    setStrMod(item.str_mod || 0);
    setDexMod(item.dex_mod || 0);
    setConMod(item.con_mod || 0);
    setWisMod(item.wis_mod || 0);
    setIntMod(item.int_mod || 0);
    setChaMod(item.cha_mod || 0);
    setHpMod(item.hp_mod || 0);
    setAcMod(item.ac_mod || 0);
    setSpeedMod(item.speed_mod || 0);
    setInitMod(item.init_mod || 0);
    setIcMod(item.ic_mod || 0);
    setSkillMods(item.skill_mods || {});
    setIsConsumable(item.is_consumable || false);
    setIsEquippable(item.is_equippable !== false);
    setStackSize(item.stack_size || 1);

    // Fetch linked abilities
    const { data: links } = await supabase
      .from('item_abilities')
      .select('ability_id, requires_equipped')
      .eq('item_id', item.id);
    
    if (links && links.length > 0) {
      setLinkedAbilityIds(links.map(l => l.ability_id));
      setRequiresEquipped(links[0].requires_equipped);
    } else {
      setLinkedAbilityIds([]);
      setRequiresEquipped(true);
    }
  };

  const handleAddSkillMod = (skill: string, value: number) => {
    if (value === 0) {
      const newMods = { ...skillMods };
      delete newMods[skill];
      setSkillMods(newMods);
    } else {
      setSkillMods({ ...skillMods, [skill]: value });
    }
  };

  const handleSaveChanges = async () => {
    if (!selectedItem || !itemName.trim()) {
      alert('Please enter an item name');
      return;
    }

    try {
      setSaving(true);

      // Update item
      const { error: updateError } = await supabase
        .from('items')
        .update({
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
          stack_size: stackSize
        })
        .eq('id', selectedItem.id);

      if (updateError) throw updateError;

      // Delete existing ability links
      const { error: deleteError } = await supabase
        .from('item_abilities')
        .delete()
        .eq('item_id', selectedItem.id);

      if (deleteError) throw deleteError;

      // Add new ability links
      if (linkedAbilityIds.length > 0) {
        const abilityLinks = linkedAbilityIds.map(abilityId => ({
          item_id: selectedItem.id,
          ability_id: abilityId,
          requires_equipped: requiresEquipped
        }));

        const { error: linkError } = await supabase
          .from('item_abilities')
          .insert(abilityLinks);

        if (linkError) throw linkError;
      }

      alert(`Item "${itemName}" updated successfully!`);
      await fetchItems();
      setSelectedItem(null);

    } catch (err: any) {
      console.error('Error updating item:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!selectedItem) return;
    
    if (!confirm(`Delete "${selectedItem.name}"? This will remove it from all inventories. This cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', selectedItem.id);

      if (error) throw error;

      alert(`Item "${selectedItem.name}" deleted successfully.`);
      setSelectedItem(null);
      await fetchItems();

    } catch (err: any) {
      console.error('Error deleting item:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = filterType === 'all' || item.type === filterType;
    const matchesRarity = filterRarity === 'all' || item.rarity === filterRarity;
    return matchesSearch && matchesType && matchesRarity;
  });

  const hasAnyMods = strMod !== 0 || dexMod !== 0 || conMod !== 0 || wisMod !== 0 || 
                     intMod !== 0 || chaMod !== 0 || hpMod !== 0 || acMod !== 0 || 
                     speedMod !== 0 || initMod !== 0 || icMod !== 0 ||
                     Object.keys(skillMods).length > 0;

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
            <h1 className="text-4xl mb-2" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
              ITEM EDITOR
            </h1>
            <p className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
              Edit existing items • Total: {items.length}
            </p>
          </div>
          
          <button
            onClick={() => navigate('/dm/dashboard')}
            className="neon-button px-6 py-2"
          >
            ← BACK TO DM
          </button>
        </div>

        {!selectedItem ? (
          <>
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
                    placeholder="Search items..."
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
                    <option value="weapon">Weapon</option>
                    <option value="armor">Armor</option>
                    <option value="consumable">Consumable</option>
                    <option value="cyberware">Cyberware</option>
                    <option value="mission_item">Mission Item</option>
                    <option value="item">Item</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                    RARITY
                  </label>
                  <select
                    value={filterRarity}
                    onChange={(e) => setFilterRarity(e.target.value)}
                    className="w-full px-4 py-2 rounded"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                      border: '1px solid var(--color-cyber-cyan)',
                      color: 'var(--color-cyber-cyan)',
                      fontFamily: 'var(--font-mono)'
                    }}
                  >
                    <option value="all">All Rarities</option>
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
            </div>

            {/* Items List */}
            <div className="grid lg:grid-cols-3 gap-4">
              {filteredItems.map(item => (
                <div
                  key={item.id}
                  className="glass-panel p-4 cursor-pointer transition-all hover:brightness-110"
                  style={{ border: `2px solid ${getRarityColor(item.rarity)}` }}
                  onClick={() => loadItemForEditing(item)}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl">{getItemTypeIcon(item.type)}</span>
                    <div className="flex-1">
                      <div className="text-lg" style={{ color: getRarityColor(item.rarity), fontFamily: 'var(--font-cyber)' }}>
                        {item.name}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                        {item.type.toUpperCase()} • {item.rarity.toUpperCase()}
                      </div>
                    </div>
                  </div>
                  
                  {item.description && (
                    <p className="text-xs line-clamp-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                      {item.description}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {filteredItems.length === 0 && (
              <div className="glass-panel p-12 text-center">
                <p className="text-lg" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                  No items found matching your filters.
                </p>
              </div>
            )}
          </>
        ) : (
          /* Edit Form */
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left: Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Back Button */}
              <button
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 rounded"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)',
                  border: '1px solid var(--color-cyber-cyan)',
                  color: 'var(--color-cyber-cyan)',
                  fontFamily: 'var(--font-mono)'
                }}
              >
                ← BACK TO LIST
              </button>

              {/* Basic Info */}
              <div className="glass-panel p-6" style={{ border: '1px solid var(--color-cyber-cyan)' }}>
                <h2 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
                  BASIC INFO
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                      Item Name
                    </label>
                    <input
                      type="text"
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
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

                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                        Type
                      </label>
                      <select
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                        className="w-full px-4 py-2 rounded"
                        style={{
                          backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                          border: '1px solid var(--color-cyber-cyan)',
                          color: 'var(--color-cyber-cyan)',
                          fontFamily: 'var(--font-mono)'
                        }}
                      >
                        <option value="item">Item</option>
                        <option value="weapon">Weapon</option>
                        <option value="armor">Armor</option>
                        <option value="consumable">Consumable</option>
                        <option value="cyberware">Cyberware</option>
                        <option value="mission_item">Mission Item</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                        Rarity
                      </label>
                      <select
                        value={rarity}
                        onChange={(e) => setRarity(e.target.value)}
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
                          backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                          border: '1px solid var(--color-cyber-cyan)',
                          color: 'var(--color-cyber-cyan)',
                          fontFamily: 'var(--font-mono)'
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <label className="flex items-center gap-3">
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
                    <label className="flex items-center gap-3">
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
                
                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    { label: 'STR', value: strMod, setter: setStrMod },
                    { label: 'DEX', value: dexMod, setter: setDexMod },
                    { label: 'CON', value: conMod, setter: setConMod },
                    { label: 'WIS', value: wisMod, setter: setWisMod },
                    { label: 'INT', value: intMod, setter: setIntMod },
                    { label: 'CHA', value: chaMod, setter: setChaMod },
                    { label: 'HP', value: hpMod, setter: setHpMod },
                    { label: 'AC', value: acMod, setter: setAcMod },
                    { label: 'SPEED', value: speedMod, setter: setSpeedMod },
                    { label: 'INIT', value: initMod, setter: setInitMod },
                    { label: 'IC', value: icMod, setter: setIcMod }
                  ].map(stat => (
                    <div key={stat.label} className="flex items-center justify-between gap-4">
                      <span className="text-sm w-12" style={{ color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-mono)' }}>
                        {stat.label}
                      </span>
                      <div className="flex items-center gap-2 flex-1">
                        <button
                          onClick={() => stat.setter(stat.value - 1)}
                          className="px-3 py-1 rounded"
                          style={{ 
                            backgroundColor: 'color-mix(in srgb, var(--color-cyber-purple) 20%, transparent)',
                            border: '1px solid var(--color-cyber-purple)',
                            color: 'var(--color-cyber-purple)'
                          }}
                        >
                          −
                        </button>
                        <input
                          type="number"
                          value={stat.value}
                          onChange={(e) => stat.setter(parseInt(e.target.value) || 0)}
                          className="w-20 px-2 py-1 rounded text-center"
                          style={{
                            backgroundColor: 'color-mix(in srgb, var(--color-cyber-purple) 10%, transparent)',
                            border: '1px solid var(--color-cyber-purple)',
                            color: 'var(--color-cyber-purple)',
                            fontFamily: 'var(--font-mono)'
                          }}
                        />
                        <button
                          onClick={() => stat.setter(stat.value + 1)}
                          className="px-3 py-1 rounded"
                          style={{ 
                            backgroundColor: 'color-mix(in srgb, var(--color-cyber-purple) 20%, transparent)',
                            border: '1px solid var(--color-cyber-purple)',
                            color: 'var(--color-cyber-purple)'
                          }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
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
                  LINKED ABILITIES
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

              {/* Save/Delete Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={handleSaveChanges}
                  disabled={saving || !itemName.trim()}
                  className="neon-button flex-1 py-4 text-lg"
                  style={{ opacity: saving || !itemName.trim() ? 0.5 : 1 }}
                >
                  {saving ? 'SAVING...' : 'SAVE CHANGES'}
                </button>
                
                <button
                  onClick={handleDeleteItem}
                  className="px-8 py-4 rounded text-lg"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-cyber-red) 20%, transparent)',
                    border: '2px solid var(--color-cyber-red)',
                    color: 'var(--color-cyber-red)',
                    fontFamily: 'var(--font-cyber)'
                  }}
                >
                  DELETE
                </button>
              </div>
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

                  {linkedAbilityIds.length > 0 && (
                    <div className="p-4 rounded" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-pink) 30%, transparent)' }}>
                      <h3 className="text-sm mb-2" style={{ color: 'var(--color-cyber-pink)', fontFamily: 'var(--font-cyber)' }}>
                        GRANTS ABILITIES
                      </h3>
                      <div className="text-xs" style={{ color: 'var(--color-cyber-pink)', fontFamily: 'var(--font-mono)' }}>
                        • {linkedAbilityIds.length} {linkedAbilityIds.length === 1 ? 'ability' : 'abilities'} linked
                      </div>
                    </div>
                  )}

                  <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                    💰 {price} USD
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
