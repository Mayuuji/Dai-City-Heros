import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { InventoryItem } from '../types/inventory';
import { 
  calculateTotalStats, 
  getRarityColor, 
  getItemTypeIcon, 
  formatModifier,
  groupInventoryByType,
  calculateInventoryValue
} from '../utils/stats';

interface Character {
  id: string;
  name: string;
  class: string;
  level: number;
  str: number;
  dex: number;
  con: number;
  wis: number;
  int: number;
  cha: number;
  max_hp: number;
  current_hp: number;
  ac: number;
  usd: number;
}

export default function Inventory() {
  const { id } = useParams(); // character ID
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [character, setCharacter] = useState<Character | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');

  useEffect(() => {
    if (id && user) {
      fetchCharacterAndInventory();
    }
  }, [id, user]);

  const fetchCharacterAndInventory = async () => {
    try {
      setLoading(true);
      
      // Fetch character
      const { data: charData, error: charError } = await supabase
        .from('characters')
        .select('*')
        .eq('id', id)
        .eq('user_id', user?.id)
        .single();
      
      if (charError) throw charError;
      setCharacter(charData);
      
      // Fetch inventory with item details
      const { data: invData, error: invError } = await supabase
        .from('inventory')
        .select(`
          *,
          item:items (*)
        `)
        .eq('character_id', id);
      
      if (invError) throw invError;
      setInventory(invData || []);
      
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEquipToggle = async (invItem: InventoryItem) => {
    try {
      const newEquippedState = !invItem.is_equipped;
      
      // Update equipped state
      const { error } = await supabase
        .from('inventory')
        .update({ is_equipped: newEquippedState })
        .eq('id', invItem.id);
      
      if (error) throw error;
      
      // Handle ability granting/removal
      if (newEquippedState) {
        // EQUIPPING: Grant abilities that require equipped
        const { data: linkedAbilities, error: abilityError } = await supabase
          .from('item_abilities')
          .select(`
            ability_id,
            abilities!inner (
              id,
              name,
              max_charges
            )
          `)
          .eq('item_id', invItem.item_id)
          .eq('requires_equipped', true);
        
        if (abilityError) throw abilityError;
        
        if (linkedAbilities && linkedAbilities.length > 0) {
          // Check which abilities character already has
          const { data: existingAbilities } = await supabase
            .from('character_abilities')
            .select('ability_id')
            .eq('character_id', id)
            .in('ability_id', linkedAbilities.map(a => a.ability_id));
          
          const existingAbilityIds = new Set(existingAbilities?.map(a => a.ability_id) || []);
          
          // Insert only new abilities
          const newAbilities = linkedAbilities
            .filter(la => !existingAbilityIds.has(la.ability_id))
            .map(la => {
              const ability = Array.isArray(la.abilities) ? la.abilities[0] : la.abilities;
              return {
                character_id: id,
                ability_id: la.ability_id,
                current_charges: ability?.max_charges || 0,
                source_type: 'item',
                source_id: invItem.id
              };
            });
          
          if (newAbilities.length > 0) {
            const { error: insertError } = await supabase
              .from('character_abilities')
              .insert(newAbilities);
            
            if (insertError) throw insertError;
          }
        }
      } else {
        // UNEQUIPPING: Remove abilities granted by this item
        const { error: deleteError } = await supabase
          .from('character_abilities')
          .delete()
          .eq('character_id', id)
          .eq('source_type', 'item')
          .eq('source_id', invItem.id);
        
        if (deleteError) throw deleteError;
      }
      
      // Update local state
      setInventory(prev => {
        const updated = prev.map(item => 
          item.id === invItem.id 
            ? { ...item, is_equipped: newEquippedState }
            : item
        );
        // Also update selectedItem if it's the same item
        if (selectedItem && selectedItem.id === invItem.id) {
          setSelectedItem({ ...invItem, is_equipped: newEquippedState });
        }
        return updated;
      });
      
      // Refresh character data to update stats
      await fetchCharacterAndInventory();
      
    } catch (err: any) {
      console.error('Error toggling equip:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleDropItem = async (invItem: InventoryItem) => {
    if (!confirm(`Drop ${invItem.item?.name}? This cannot be undone.`)) return;
    
    try {
      const { error } = await supabase
        .from('inventory')
        .delete()
        .eq('id', invItem.id);
      
      if (error) throw error;
      
      setInventory(prev => prev.filter(item => item.id !== invItem.id));
      setSelectedItem(null);
      
    } catch (err: any) {
      console.error('Error dropping item:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleUseConsumable = async (invItem: InventoryItem) => {
    if (!invItem.item?.is_consumable) return;
    
    const currentUses = invItem.current_uses ?? invItem.item.stack_size;
    if (currentUses <= 0) {
      alert('This item has no uses remaining.');
      return;
    }

    if (!confirm(`Use ${invItem.item.name}? This will consume 1 use.`)) return;

    try {
      const newUses = currentUses - 1;

      if (newUses <= 0) {
        // Delete item if no uses left
        const { error } = await supabase
          .from('inventory')
          .delete()
          .eq('id', invItem.id);

        if (error) throw error;
        
        alert(`${invItem.item.name} consumed and removed from inventory.`);
        setInventory(prev => prev.filter(item => item.id !== invItem.id));
        setSelectedItem(null);
      } else {
        // Decrement uses
        const { error } = await supabase
          .from('inventory')
          .update({ current_uses: newUses })
          .eq('id', invItem.id);

        if (error) throw error;

        setInventory(prev =>
          prev.map(item =>
            item.id === invItem.id
              ? { ...item, current_uses: newUses }
              : item
          )
        );
        
        alert(`${invItem.item.name} used. ${newUses} uses remaining.`);
      }

    } catch (err: any) {
      console.error('Error using consumable:', err);
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
            Loading inventory...
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

  const totalStats = calculateTotalStats(
    {
      str: character.str,
      dex: character.dex,
      con: character.con,
      wis: character.wis,
      int: character.int,
      cha: character.cha,
      max_hp: character.max_hp,
      ac: character.ac
    },
    inventory
  );

  const groupedInventory = groupInventoryByType(inventory);
  const inventoryValue = calculateInventoryValue(inventory);
  const equippedItems = inventory.filter(inv => inv.is_equipped);

  const tabs = [
    { id: 'all', label: 'ALL ITEMS', count: inventory.length },
    { id: 'weapon', label: 'WEAPONS', count: groupedInventory['weapon']?.length || 0 },
    { id: 'armor', label: 'ARMOR', count: groupedInventory['armor']?.length || 0 },
    { id: 'cyberware', label: 'CYBERWARE', count: groupedInventory['cyberware']?.length || 0 },
    { id: 'consumable', label: 'CONSUMABLES', count: groupedInventory['consumable']?.length || 0 },
    { id: 'item', label: 'OTHER', count: groupedInventory['item']?.length || 0 }
  ];

  const filteredInventory = activeTab === 'all' 
    ? inventory 
    : groupedInventory[activeTab] || [];

  return (
    <div className="min-h-screen grid-bg" style={{ backgroundColor: 'var(--color-cyber-darker)' }}>
      {/* Header */}
      <div className="glass-panel neon-border" style={{ borderRadius: 0 }}>
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <button onClick={() => navigate('/dashboard')} className="neon-button text-sm">
            ← BACK TO DASHBOARD
          </button>
          <h1 className="text-2xl neon-text" style={{ fontFamily: 'var(--font-cyber)' }}>
            INVENTORY - {character.name.toUpperCase()}
          </h1>
          <div className="w-32"></div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column: Stats Summary */}
          <div className="space-y-6">
            {/* Currency */}
            <div className="glass-panel p-6 neon-border">
              <h3 className="text-lg mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-green)' }}>
                CREDITS
              </h3>
              <div className="text-3xl mb-2" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>
                ${character.usd.toLocaleString()}
              </div>
              <div className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                Inventory Value: ${inventoryValue.toLocaleString()}
              </div>
            </div>

            {/* Stat Modifiers */}
            <div className="glass-panel p-6" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)' }}>
              <h3 className="text-lg mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
                ACTIVE MODIFIERS
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'STR', base: totalStats.base_str, total: totalStats.total_str, mod: totalStats.str_mod },
                  { label: 'DEX', base: totalStats.base_dex, total: totalStats.total_dex, mod: totalStats.dex_mod },
                  { label: 'CON', base: totalStats.base_con, total: totalStats.total_con, mod: totalStats.con_mod },
                  { label: 'WIS', base: totalStats.base_wis, total: totalStats.total_wis, mod: totalStats.wis_mod },
                  { label: 'INT', base: totalStats.base_int, total: totalStats.total_int, mod: totalStats.int_mod },
                  { label: 'CHA', base: totalStats.base_cha, total: totalStats.total_cha, mod: totalStats.cha_mod },
                  { label: 'HP', base: totalStats.base_hp, total: totalStats.total_hp, mod: totalStats.hp_mod },
                  { label: 'AC', base: totalStats.base_ac, total: totalStats.total_ac, mod: totalStats.ac_mod }
                ].map(stat => (
                  <div key={stat.label} className="flex justify-between items-center">
                    <span className="text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                      {stat.label}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                        {stat.base}
                      </span>
                      {stat.mod !== 0 && (
                        <>
                          <span style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>
                            {formatModifier(stat.mod)}
                          </span>
                          <span className="text-lg" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                            = {stat.total}
                          </span>
                        </>
                      )}
                      {stat.mod === 0 && (
                        <span className="text-lg" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.3, fontFamily: 'var(--font-mono)' }}>
                          —
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Skill Bonuses */}
              {Object.keys(totalStats.skill_bonuses).length > 0 && (
                <div className="mt-6 pt-6" style={{ borderTop: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)' }}>
                  <h4 className="text-sm mb-3" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-cyber)' }}>
                    SKILL BONUSES
                  </h4>
                  {Object.entries(totalStats.skill_bonuses).map(([skill, bonus]) => (
                    <div key={skill} className="flex justify-between items-center mb-2">
                      <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                        {skill}
                      </span>
                      <span className="text-sm" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>
                        {formatModifier(bonus)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Equipped Items Summary */}
            <div className="glass-panel p-6" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-magenta) 30%, transparent)' }}>
              <h3 className="text-lg mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-magenta)' }}>
                EQUIPPED ({equippedItems.length})
              </h3>
              {equippedItems.length > 0 ? (
                <div className="space-y-2">
                  {equippedItems.map(inv => (
                    <div 
                      key={inv.id}
                      className="text-sm flex items-center gap-2 cursor-pointer hover:opacity-80"
                      onClick={() => setSelectedItem(inv)}
                      style={{ color: getRarityColor(inv.item?.rarity || 'common'), fontFamily: 'var(--font-mono)' }}
                    >
                      <span>{getItemTypeIcon(inv.item?.type || 'item')}</span>
                      <span className="truncate">{inv.item?.name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-center" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                  No items equipped
                </p>
              )}
            </div>
          </div>

          {/* Center & Right Columns: Inventory Grid */}
          <div className="lg:col-span-2">
            {/* Tabs */}
            <div className="flex gap-2 mb-6 flex-wrap">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="px-4 py-2 rounded text-sm transition-all"
                  style={{
                    backgroundColor: activeTab === tab.id 
                      ? 'var(--color-cyber-cyan)' 
                      : 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                    color: activeTab === tab.id 
                      ? 'var(--color-cyber-darker)' 
                      : 'var(--color-cyber-cyan)',
                    border: activeTab === tab.id 
                      ? 'none' 
                      : '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: activeTab === tab.id ? 'bold' : 'normal'
                  }}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>

            {/* Items Grid */}
            {filteredInventory.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-4">
                {filteredInventory.map(inv => (
                  <div
                    key={inv.id}
                    onClick={() => setSelectedItem(inv)}
                    className="glass-panel p-4 cursor-pointer transition-all hover:brightness-110"
                    style={{ 
                      border: inv.is_equipped 
                        ? `2px solid ${getRarityColor(inv.item?.rarity || 'common')}` 
                        : `1px solid color-mix(in srgb, ${getRarityColor(inv.item?.rarity || 'common')} 30%, transparent)`
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{getItemTypeIcon(inv.item?.type || 'item')}</span>
                        <div>
                          <div className="text-sm" style={{ color: getRarityColor(inv.item?.rarity || 'common'), fontFamily: 'var(--font-cyber)' }}>
                            {inv.item?.name}
                          </div>
                          <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                            {inv.item?.type.toUpperCase()} • {inv.item?.rarity.toUpperCase()}
                          </div>
                        </div>
                      </div>
                      {inv.quantity > 1 && (
                        <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-cyber-cyan)', color: 'var(--color-cyber-darker)' }}>
                          x{inv.quantity}
                        </span>
                      )}
                    </div>
                    
                    {inv.is_equipped && (
                      <div className="text-xs px-2 py-1 rounded inline-block mb-2" style={{ backgroundColor: 'var(--color-cyber-green)', color: 'var(--color-cyber-darker)' }}>
                        EQUIPPED
                      </div>
                    )}
                    
                    {inv.item?.is_consumable && (
                      <div className="text-xs px-2 py-1 rounded inline-block mb-2 ml-2" style={{ 
                        backgroundColor: (inv.current_uses ?? inv.item.stack_size) > 0 
                          ? 'var(--color-cyber-purple)' 
                          : 'var(--color-cyber-red)', 
                        color: 'var(--color-cyber-darker)' 
                      }}>
                        {(inv.current_uses ?? inv.item.stack_size) > 0 
                          ? `${inv.current_uses ?? inv.item.stack_size} USES` 
                          : 'DEPLETED'}
                      </div>
                    )}
                    
                    <p className="text-xs mb-3 line-clamp-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                      {inv.item?.description}
                    </p>
                    
                    <div className="text-xs" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>
                      ${inv.item?.price.toLocaleString()} USD
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-panel p-12 text-center">
                <p className="text-lg mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                  No items in this category
                </p>
                <p className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                  Visit a shop to purchase items
                </p>
              </div>
            )}

            {/* Item Details Panel - Always visible below inventory */}
            <div className="mt-6 glass-panel p-6" style={{ border: '1px solid var(--color-cyber-cyan)' }}>
              {selectedItem && selectedItem.item ? (
                <>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-4xl">{getItemTypeIcon(selectedItem.item.type)}</span>
                      <div>
                        <h2 className="text-2xl mb-1" style={{ color: getRarityColor(selectedItem.item.rarity), fontFamily: 'var(--font-cyber)' }}>
                          {selectedItem.item.name}
                        </h2>
                        <div className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                          {selectedItem.item.type.toUpperCase()} • {selectedItem.item.rarity.toUpperCase()}
                        </div>
                      </div>
                    </div>
                    {selectedItem.is_equipped && (
                      <div className="text-xs px-3 py-1 rounded" style={{ backgroundColor: 'var(--color-cyber-green)', color: 'var(--color-cyber-darker)' }}>
                        EQUIPPED
                      </div>
                    )}
                  </div>

                  <p className="text-sm mb-4" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                    {selectedItem.item.description || 'No description available.'}
                  </p>

                  {/* Stats */}
                  {(selectedItem.item.str_mod !== 0 || selectedItem.item.dex_mod !== 0 || selectedItem.item.con_mod !== 0 ||
                    selectedItem.item.wis_mod !== 0 || selectedItem.item.int_mod !== 0 || selectedItem.item.cha_mod !== 0 ||
                    selectedItem.item.hp_mod !== 0 || selectedItem.item.ac_mod !== 0 ||
                    (selectedItem.item.speed_mod && selectedItem.item.speed_mod !== 0) || 
                    (selectedItem.item.init_mod && selectedItem.item.init_mod !== 0) || 
                    (selectedItem.item.ic_mod && selectedItem.item.ic_mod !== 0)) && (
                    <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        { label: 'Strength', icon: '💪', value: selectedItem.item.str_mod },
                        { label: 'Dexterity', icon: '🎯', value: selectedItem.item.dex_mod },
                        { label: 'Constitution', icon: '🛡️', value: selectedItem.item.con_mod },
                        { label: 'Wisdom', icon: '👁️', value: selectedItem.item.wis_mod },
                        { label: 'Intelligence', icon: '🧠', value: selectedItem.item.int_mod },
                        { label: 'Charisma', icon: '✨', value: selectedItem.item.cha_mod },
                        { label: 'Hit Points', icon: '❤️', value: selectedItem.item.hp_mod },
                        { label: 'Armor Class', icon: '🛡️', value: selectedItem.item.ac_mod },
                        { label: 'Speed', icon: '⚡', value: selectedItem.item.speed_mod || 0 },
                        { label: 'Initiative', icon: '🎲', value: selectedItem.item.init_mod || 0 },
                        { label: 'Implant Capacity', icon: '🔧', value: selectedItem.item.ic_mod || 0 }
                      ].filter(s => s.value !== 0).map(stat => (
                        <div key={stat.label} className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>
                          <span>{stat.icon}</span>
                          <span>{stat.label}</span>
                          <span className="ml-auto">{formatModifier(stat.value)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Price & Quantity Row */}
                  <div className="flex justify-between items-center mb-4 py-2" style={{ borderTop: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)', borderBottom: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)' }}>
                    <div>
                      <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>Quantity:</span>
                      <span className="ml-2 text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{selectedItem.quantity}</span>
                    </div>
                    <div>
                      <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>Value:</span>
                      <span className="ml-2 text-sm" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>${selectedItem.item.price.toLocaleString()}</span>
                    </div>
                    {selectedItem.item.is_consumable && (
                      <div>
                        <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>Uses:</span>
                        <span className="ml-2 text-sm" style={{ 
                          color: (selectedItem.current_uses ?? selectedItem.item.stack_size) > 0 
                            ? 'var(--color-cyber-purple)' 
                            : 'var(--color-cyber-red)', 
                          fontFamily: 'var(--font-mono)' 
                        }}>
                          {selectedItem.current_uses ?? selectedItem.item.stack_size}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    {selectedItem.item.is_equippable && (
                      <button 
                        onClick={() => handleEquipToggle(selectedItem)}
                        className="neon-button flex-1"
                      >
                        {selectedItem.is_equipped ? 'UNEQUIP' : 'EQUIP'}
                      </button>
                    )}
                    {selectedItem.item.is_consumable && (
                      <button 
                        onClick={() => handleUseConsumable(selectedItem)}
                        disabled={(selectedItem.current_uses ?? selectedItem.item.stack_size) <= 0}
                        className="flex-1 px-4 py-2 rounded"
                        style={{ 
                          border: '1px solid var(--color-cyber-purple)', 
                          color: 'var(--color-cyber-purple)',
                          fontFamily: 'var(--font-mono)',
                          opacity: (selectedItem.current_uses ?? selectedItem.item.stack_size) <= 0 ? 0.5 : 1,
                          cursor: (selectedItem.current_uses ?? selectedItem.item.stack_size) <= 0 ? 'not-allowed' : 'pointer'
                        }}
                      >
                        USE
                      </button>
                    )}
                    <button 
                      onClick={() => handleDropItem(selectedItem)}
                      className="px-4 py-2 rounded"
                      style={{ 
                        border: '1px solid var(--color-cyber-pink)', 
                        color: 'var(--color-cyber-pink)',
                        fontFamily: 'var(--font-mono)'
                      }}
                    >
                      DROP
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-lg" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                    Select an item to view details
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
