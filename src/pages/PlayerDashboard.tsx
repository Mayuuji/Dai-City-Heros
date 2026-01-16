import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { CHARACTER_CLASSES, formatToHit } from '../data/characterClasses';
import WorldMap from '../components/WorldMap';
import type { InventoryItem, Ability } from '../types/inventory';
import type { Location } from '../types/map';
import type { MissionWithDetails, MissionStatus } from '../types/mission';
import type { Shop, ShopInventoryItemWithDetails } from '../types/shop';
import { getRarityColor, getItemTypeIcon } from '../utils/stats';

// Helper to convert skill name to database column name
const skillToColumn = (skillName: string): string => {
  return 'skill_' + skillName.toLowerCase().replace(/ /g, '_');
};


interface Character {
  id: string;
  player_id: string;
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
  speed: number;
  initiative_modifier: number;
  implant_capacity: number;
  save_proficiencies: string[];
  tools: string[];
  class_features: any[];
  
  // Weapon proficiency ranks (0-5)
  weapon_rank_unarmed: number;
  weapon_rank_melee: number;
  weapon_rank_sidearms: number;
  weapon_rank_longarms: number;
  weapon_rank_heavy: number;
  
  // Skills
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
}

export default function PlayerDashboard() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [abilities, setAbilities] = useState<Ability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'abilities' | 'skills' | 'inventory' | 'map' | 'missions'>('abilities');
  
  // Inventory state
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryTypeFilter, setInventoryTypeFilter] = useState<string>('all');
  const [inventoryRarityFilter, setInventoryRarityFilter] = useState<string>('all');
  const [inventorySort, setInventorySort] = useState<'name' | 'type' | 'rarity' | 'equipped'>('equipped');
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryItem | null>(null);
  const [inventoryViewMode, setInventoryViewMode] = useState<'grid' | 'list'>('grid');
  
  // Map state
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [mapSearch, setMapSearch] = useState('');
  const [mapIconFilter, setMapIconFilter] = useState<string>('all');
  const [mapViewMode, setMapViewMode] = useState<'map' | 'list'>('map');
  
  // Missions state
  const [missions, setMissions] = useState<MissionWithDetails[]>([]);
  const [missionFilter, setMissionFilter] = useState<MissionStatus | 'all'>('active');
  const [selectedMission, setSelectedMission] = useState<MissionWithDetails | null>(null);
  
  // Shop state
  const [locationShops, setLocationShops] = useState<Shop[]>([]);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [shopInventory, setShopInventory] = useState<ShopInventoryItemWithDetails[]>([]);
  const [shopLoading, setShopLoading] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null);
  
  // Player Lock state - prevents equipping/using items/shopping during encounters
  const [playersLocked, setPlayersLocked] = useState(false);
  const [lockReason, setLockReason] = useState<string | null>(null);
  
  // Computed stats (base + equipment bonuses)
  const [computedStats, setComputedStats] = useState({
    hp: 0,
    ac: 0,
    str: 0,
    dex: 0,
    con: 0,
    wis: 0,
    int: 0,
    cha: 0,
    speed: 30,
    init: 0,
    ic: 3,
    skills: {} as Record<string, number>,
    hasArmorPenalty: false, // True if wearing non-proficient armor (-2 AC, -10 speed)
    // Equipment slot tracking
    equippedArmorCount: 0,
    equippedWeaponCount: 0,
    icUsed: 0, // Total IC cost of equipped cyberware
    icRemaining: 3 // IC available (ic - icUsed)
  });

  useEffect(() => {
    if (user) {
      fetchCharacters();
    }
  }, [user]);

  useEffect(() => {
    if (selectedCharacter) {
      fetchInventory(selectedCharacter.id);
      fetchAbilities(selectedCharacter.id);
    }
  }, [selectedCharacter]);

  // Real-time subscription for character HP updates (from DM combat tracker)
  useEffect(() => {
    if (!selectedCharacter) return;

    const channel = supabase
      .channel(`character-${selectedCharacter.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'characters',
          filter: `id=eq.${selectedCharacter.id}`
        },
        (payload) => {
          // Update the selected character with new data (like HP changes)
          setSelectedCharacter(prev => prev ? { ...prev, ...payload.new } : null);
          // Also update in the characters list
          setCharacters(prev => prev.map(c => c.id === selectedCharacter.id ? { ...c, ...payload.new } : c));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedCharacter?.id]);

  // Real-time subscription for inventory changes (when DM gives/removes items)
  useEffect(() => {
    if (!selectedCharacter) return;

    const inventoryChannel = supabase
      .channel(`inventory-${selectedCharacter.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory',
          filter: `character_id=eq.${selectedCharacter.id}`
        },
        () => {
          // Refetch inventory when any change happens
          fetchInventory(selectedCharacter.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(inventoryChannel);
    };
  }, [selectedCharacter?.id]);

  // Real-time subscription for item updates (when item details change)
  useEffect(() => {
    if (!selectedCharacter) return;

    const itemsChannel = supabase
      .channel(`items-updates-${selectedCharacter.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'items'
        },
        () => {
          // Refetch inventory to get updated item details
          fetchInventory(selectedCharacter.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(itemsChannel);
    };
  }, [selectedCharacter?.id]);

  // Real-time subscription for ability changes (when DM grants/removes abilities)
  useEffect(() => {
    if (!selectedCharacter) return;

    const abilitiesChannel = supabase
      .channel(`abilities-${selectedCharacter.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'character_abilities',
          filter: `character_id=eq.${selectedCharacter.id}`
        },
        () => {
          // Refetch abilities when any change happens
          fetchAbilities(selectedCharacter.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(abilitiesChannel);
    };
  }, [selectedCharacter?.id]);

  // Fetch and subscribe to player lock status
  useEffect(() => {
    const fetchLockStatus = async () => {
      const { data } = await supabase
        .from('game_settings')
        .select('value')
        .eq('key', 'players_locked')
        .single();
      
      if (data) {
        setPlayersLocked(data.value?.locked || false);
        setLockReason(data.value?.reason || null);
      }
    };
    
    fetchLockStatus();
    
    // Subscribe to real-time changes
    const subscription = supabase
      .channel('player_lock_status')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_settings' }, (payload) => {
        if (payload.new && (payload.new as any).key === 'players_locked') {
          const value = (payload.new as any).value;
          setPlayersLocked(value?.locked || false);
          setLockReason(value?.reason || null);
        }
      })
      .subscribe();
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Fetch data based on active tab
  useEffect(() => {
    if (activeTab === 'map') {
      fetchLocations();
    } else if (activeTab === 'missions' && selectedCharacter) {
      fetchMissions();
    }
  }, [activeTab, selectedCharacter]);

  // Recalculate stats whenever character or inventory changes
  useEffect(() => {
    if (selectedCharacter) {
      calculateComputedStats();
    }
  }, [selectedCharacter, inventory]);

  const calculateComputedStats = () => {
    if (!selectedCharacter) return;

    // Get the character's class data for armor proficiencies
    const characterClass = CHARACTER_CLASSES.find(c => c.id === selectedCharacter.class);
    const armorProficiencies = characterClass?.armorProficiencies || ['clothes', 'light'];

    // Start with base stats
    let totalAcMod = 0;
    let totalHpMod = 0;
    let totalStrMod = 0;
    let totalDexMod = 0;
    let totalConMod = 0;
    let totalWisMod = 0;
    let totalIntMod = 0;
    let totalChaMod = 0;
    let totalSpeedMod = 0;
    let totalInitMod = 0;
    let totalIcMod = 0;
    const skillMods: Record<string, number> = {};

    // Check for non-proficient armor penalty
    let hasNonProficientArmor = false;

    // Equipment slot tracking
    let armorCount = 0;
    let weaponCount = 0;
    let cyberwareIcUsed = 0;

    // Add bonuses from equipped items
    inventory
      .filter(inv => inv.is_equipped && inv.item)
      .forEach(inv => {
        const item = inv.item!;
        
        // Track equipment slots
        if (item.type === 'armor') {
          armorCount++;
          // Check if this is armor the character isn't proficient with
          if (item.armor_subtype && !armorProficiencies.includes(item.armor_subtype as any)) {
            hasNonProficientArmor = true;
          }
        }
        if (item.type === 'weapon') {
          weaponCount++;
        }
        if (item.type === 'cyberware') {
          cyberwareIcUsed += item.ic_cost || 0;
        }
        
        totalAcMod += item.ac_mod || 0;
        totalHpMod += item.hp_mod || 0;
        totalStrMod += item.str_mod || 0;
        totalDexMod += item.dex_mod || 0;
        totalConMod += item.con_mod || 0;
        totalWisMod += item.wis_mod || 0;
        totalIntMod += item.int_mod || 0;
        totalChaMod += item.cha_mod || 0;
        totalSpeedMod += item.speed_mod || 0;
        totalInitMod += item.init_mod || 0;
        totalIcMod += item.ic_mod || 0;

        // Add skill mods
        if (item.skill_mods) {
          Object.entries(item.skill_mods).forEach(([skill, bonus]) => {
            skillMods[skill] = (skillMods[skill] || 0) + bonus;
          });
        }
      });

    // Apply non-proficient armor penalty: -2 AC and -10 ft movement
    if (hasNonProficientArmor) {
      totalAcMod -= 2;
      totalSpeedMod -= 10;
    }

    const totalIc = (selectedCharacter.implant_capacity || 3) + totalIcMod;

    setComputedStats({
      hp: selectedCharacter.max_hp + totalHpMod,
      ac: selectedCharacter.ac + totalAcMod,
      str: selectedCharacter.str + totalStrMod,
      dex: selectedCharacter.dex + totalDexMod,
      con: selectedCharacter.con + totalConMod,
      wis: selectedCharacter.wis + totalWisMod,
      int: selectedCharacter.int + totalIntMod,
      cha: selectedCharacter.cha + totalChaMod,
      speed: (selectedCharacter.speed || 30) + totalSpeedMod,
      init: (selectedCharacter.initiative_modifier || 0) + totalInitMod,
      ic: totalIc,
      skills: skillMods,
      hasArmorPenalty: hasNonProficientArmor,
      equippedArmorCount: armorCount,
      equippedWeaponCount: weaponCount,
      icUsed: cyberwareIcUsed,
      icRemaining: totalIc - cyberwareIcUsed
    });
  };

  const fetchInventory = async (characterId: string) => {
    try {
      const { data, error: invError } = await supabase
        .from('inventory')
        .select(`
          *,
          item:items(
            *,
            abilities:item_abilities(
              ability:abilities(*)
            )
          )
        `)
        .eq('character_id', characterId)
        .order('is_equipped', { ascending: false });

      if (invError) throw invError;

      setInventory(data || []);
    } catch (err: any) {
      console.error('Error fetching inventory:', err);
    }
  };

  const fetchAbilities = async (characterId: string) => {
    try {
      // Fetch character abilities
      const { data: charAbilities, error: abilitiesError } = await supabase
        .from('character_abilities')
        .select(`
          *,
          ability:abilities(*)
        `)
        .eq('character_id', characterId);

      if (abilitiesError) throw abilitiesError;

      // Extract character ability objects
      const characterAbilitiesList = charAbilities?.map(ca => ({
        ...ca.ability,
        current_charges: ca.current_charges,
        source: 'character' as const
      })) || [];

      // Fetch equipped items with their abilities
      const { data: equippedItems, error: itemsError } = await supabase
        .from('inventory')
        .select(`
          *,
          item:items(
            *,
            abilities:item_abilities(
              requires_equipped,
              ability:abilities(*)
            )
          )
        `)
        .eq('character_id', characterId)
        .eq('is_equipped', true);

      if (itemsError) throw itemsError;

      // Extract item abilities (only from equipped items or items that don't require equipping)
      const itemAbilitiesList: Ability[] = [];
      equippedItems?.forEach(invItem => {
        invItem.item?.abilities?.forEach((itemAbility: any) => {
          if (itemAbility.ability && (invItem.is_equipped || !itemAbility.requires_equipped)) {
            itemAbilitiesList.push({
              ...itemAbility.ability,
              source: 'item' as const,
              item_name: invItem.item.name
            });
          }
        });
      });

      // Get class features from character
      const classFeatures: Ability[] = [];
      if (selectedCharacter?.class_features && Array.isArray(selectedCharacter.class_features)) {
        selectedCharacter.class_features.forEach((feature: any) => {
          classFeatures.push({
            id: `class_feature_${feature.name}`,
            name: feature.name,
            description: feature.description || '',
            type: feature.type || 'passive',
            charge_type: feature.charges ? 'uses' : 'infinite',
            max_charges: feature.charges || null,
            charges_per_rest: feature.charges || null,
            effects: feature.effects || [],
            damage_dice: feature.damage_dice || null,
            damage_type: feature.damage_type || null,
            range_feet: feature.range_feet || null,
            area_of_effect: feature.area_of_effect || null,
            duration: feature.duration || null,
            created_at: new Date().toISOString(),
            current_charges: feature.charges || undefined,
            source: 'class' as const
          });
        });
      }

      // Combine all abilities
      const allAbilities = [...characterAbilitiesList, ...classFeatures, ...itemAbilitiesList];
      setAbilities(allAbilities);
    } catch (err: any) {
      console.error('Error fetching abilities:', err);
    }
  };

  const toggleEquipItem = async (inventoryItemId: string, currentlyEquipped: boolean) => {
    if (!selectedCharacter) return;

    // Check if players are locked
    if (playersLocked) {
      alert(`Actions locked: ${lockReason || 'DM has locked player actions'}`);
      return;
    }

    // Find the item being equipped/unequipped
    const inventoryItem = inventory.find(inv => inv.id === inventoryItemId);
    if (!inventoryItem?.item) return;

    const item = inventoryItem.item;

    // If equipping (not currently equipped), check limits
    if (!currentlyEquipped) {
      // Check armor limit (max 1)
      if (item.type === 'armor') {
        if (computedStats.equippedArmorCount >= 1) {
          alert('You can only equip 1 armor at a time. Unequip your current armor first.');
          return;
        }
      }

      // Check weapon limit (max 3)
      if (item.type === 'weapon') {
        if (computedStats.equippedWeaponCount >= 3) {
          alert('You can only equip 3 weapons at a time. Unequip a weapon first.');
          return;
        }
      }

      // Check cyberware IC limit
      if (item.type === 'cyberware') {
        const icCost = item.ic_cost || 0;
        if (icCost > computedStats.icRemaining) {
          alert(`Not enough Implant Capacity. This cyberware requires ${icCost} IC, but you only have ${computedStats.icRemaining} IC remaining.`);
          return;
        }
      }
    }

    try {
      const { error: updateError } = await supabase
        .from('inventory')
        .update({ is_equipped: !currentlyEquipped })
        .eq('id', inventoryItemId);

      if (updateError) throw updateError;

      // Update selectedInventoryItem immediately so button text updates
      if (selectedInventoryItem && selectedInventoryItem.id === inventoryItemId) {
        setSelectedInventoryItem({ ...selectedInventoryItem, is_equipped: !currentlyEquipped });
      }

      // Refresh inventory and abilities
      await fetchInventory(selectedCharacter.id);
      await fetchAbilities(selectedCharacter.id);
    } catch (err: any) {
      console.error('Error toggling item equip:', err);
      alert('Failed to equip/unequip item: ' + err.message);
    }
  };

  const consumeItem = async (inventoryItemId: string, item: any, quantity: number) => {
    if (!selectedCharacter || !item) return;

    // Check if players are locked
    if (playersLocked) {
      alert(`Actions locked: ${lockReason || 'DM has locked player actions'}`);
      return;
    }

    if (!item.is_consumable) {
      alert('This item cannot be consumed');
      return;
    }

    if (!confirm(`Are you sure you want to consume ${item.name}? This will permanently apply its effects.`)) {
      return;
    }

    try {
      // Calculate new character stats
      const updates: any = {
        str: selectedCharacter.str + (item.str_mod || 0),
        dex: selectedCharacter.dex + (item.dex_mod || 0),
        con: selectedCharacter.con + (item.con_mod || 0),
        wis: selectedCharacter.wis + (item.wis_mod || 0),
        int: selectedCharacter.int + (item.int_mod || 0),
        cha: selectedCharacter.cha + (item.cha_mod || 0),
        ac: selectedCharacter.ac + (item.ac_mod || 0),
        speed: (selectedCharacter.speed || 30) + (item.speed_mod || 0),
        initiative_modifier: (selectedCharacter.initiative_modifier || 0) + (item.init_mod || 0),
        implant_capacity: (selectedCharacter.implant_capacity || 3) + (item.ic_mod || 0),
      };

      // Handle HP based on hp_mod_type
      if (item.hp_mod && item.hp_mod !== 0) {
        const hpModType = item.hp_mod_type || 'heal';
        if (hpModType === 'heal') {
          // Heal current HP (cap at max)
          updates.current_hp = Math.min(
            selectedCharacter.current_hp + item.hp_mod,
            selectedCharacter.max_hp
          );
        } else if (hpModType === 'max_hp') {
          // Permanently increase max HP
          updates.max_hp = selectedCharacter.max_hp + item.hp_mod;
          // Also increase current HP by the same amount
          updates.current_hp = selectedCharacter.current_hp + item.hp_mod;
        }
      }

      // Apply skill modifiers permanently
      if (item.skill_mods && typeof item.skill_mods === 'object') {
        for (const [skillName, modifier] of Object.entries(item.skill_mods)) {
          if (typeof modifier === 'number' && modifier !== 0) {
            const columnName = skillToColumn(skillName);
            const currentValue = (selectedCharacter as any)[columnName] || 0;
            updates[columnName] = currentValue + modifier;
          }
        }
      }

      console.log('Consuming item:', item.name);
      console.log('Applying updates to character:', updates);

      // Update character stats
      const { data: updateResult, error: charError } = await supabase
        .from('characters')
        .update(updates)
        .eq('id', selectedCharacter.id)
        .select();

      if (charError) throw charError;
      console.log('Character update result:', updateResult);

      // Remove item from inventory (or reduce quantity)
      if (quantity > 1) {
        const { error: invError } = await supabase
          .from('inventory')
          .update({ quantity: quantity - 1 })
          .eq('id', inventoryItemId);
        if (invError) throw invError;
      } else {
        const { error: invError } = await supabase
          .from('inventory')
          .delete()
          .eq('id', inventoryItemId);
        if (invError) throw invError;
      }

      // Clear selection and refresh data
      setSelectedInventoryItem(null);
      
      // Refresh character data
      const { data: updatedChar } = await supabase
        .from('characters')
        .select('*')
        .eq('id', selectedCharacter.id)
        .single();
      
      if (updatedChar) {
        setSelectedCharacter(updatedChar);
        setCharacters(prev => prev.map(c => c.id === updatedChar.id ? updatedChar : c));
      }

      // Refresh inventory
      await fetchInventory(selectedCharacter.id);
      
      // Build effect summary
      const effects: string[] = [];
      if (item.str_mod) effects.push(`STR ${item.str_mod > 0 ? '+' : ''}${item.str_mod}`);
      if (item.dex_mod) effects.push(`DEX ${item.dex_mod > 0 ? '+' : ''}${item.dex_mod}`);
      if (item.con_mod) effects.push(`CON ${item.con_mod > 0 ? '+' : ''}${item.con_mod}`);
      if (item.wis_mod) effects.push(`WIS ${item.wis_mod > 0 ? '+' : ''}${item.wis_mod}`);
      if (item.int_mod) effects.push(`INT ${item.int_mod > 0 ? '+' : ''}${item.int_mod}`);
      if (item.cha_mod) effects.push(`CHA ${item.cha_mod > 0 ? '+' : ''}${item.cha_mod}`);
      if (item.hp_mod) {
        const hpType = item.hp_mod_type === 'max_hp' ? 'Max HP' : 'HP healed';
        effects.push(`${hpType} ${item.hp_mod > 0 ? '+' : ''}${item.hp_mod}`);
      }
      if (item.ac_mod) effects.push(`AC ${item.ac_mod > 0 ? '+' : ''}${item.ac_mod}`);
      if (item.speed_mod) effects.push(`Speed ${item.speed_mod > 0 ? '+' : ''}${item.speed_mod}`);
      if (item.init_mod) effects.push(`Init ${item.init_mod > 0 ? '+' : ''}${item.init_mod}`);
      if (item.ic_mod) effects.push(`IC ${item.ic_mod > 0 ? '+' : ''}${item.ic_mod}`);
      if (item.skill_mods && Object.keys(item.skill_mods).length > 0) {
        for (const [skill, mod] of Object.entries(item.skill_mods)) {
          if (typeof mod === 'number' && mod !== 0) {
            effects.push(`${skill} ${mod > 0 ? '+' : ''}${mod}`);
          }
        }
      }
      
      const effectSummary = effects.length > 0 ? `\n\nApplied: ${effects.join(', ')}` : '';
      alert(`${item.name} consumed! Effects applied permanently.${effectSummary}`);
    } catch (err: any) {
      console.error('Error consuming item:', err);
      alert('Failed to consume item: ' + err.message);
    }
  };

  const fetchCharacters = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('characters')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setCharacters(data || []);
      if (data && data.length > 0) {
        setSelectedCharacter(data[0]); // Auto-select first character
      }
    } catch (err: any) {
      console.error('Error fetching characters:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('is_visible', true)
        .order('name');
      
      if (error) throw error;
      setLocations(data || []);
    } catch (err: any) {
      console.error('Error fetching locations:', err);
    }
  };

  // Fetch shops for a location
  const fetchLocationShops = async (locationId: string) => {
    try {
      setShopLoading(true);
      setSelectedShop(null);
      setShopInventory([]);
      
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .eq('location_id', locationId)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setLocationShops(data || []);
    } catch (err: any) {
      console.error('Error fetching shops:', err);
      setLocationShops([]);
    } finally {
      setShopLoading(false);
    }
  };

  // Fetch inventory for a shop
  const fetchShopInventory = async (shopId: string) => {
    try {
      setShopLoading(true);
      
      const { data, error } = await supabase
        .from('shop_inventory')
        .select(`
          *,
          item:items!shop_inventory_item_id_fkey(*),
          price_item:items!shop_inventory_price_item_id_fkey(id, name, rarity)
        `)
        .eq('shop_id', shopId)
        .order('created_at');
      
      if (error) throw error;
      setShopInventory(data || []);
    } catch (err: any) {
      console.error('Error fetching shop inventory:', err);
      setShopInventory([]);
    } finally {
      setShopLoading(false);
    }
  };

  // Handle shop selection
  const handleSelectShop = (shop: Shop) => {
    setSelectedShop(shop);
    fetchShopInventory(shop.id);
  };

  // Purchase item from shop
  const handlePurchaseItem = async (shopItem: ShopInventoryItemWithDetails) => {
    if (!selectedCharacter) return;
    
    // Check if players are locked
    if (playersLocked) {
      alert(`Shopping disabled: ${lockReason || 'DM has locked player actions'}`);
      return;
    }
    
    setPurchaseLoading(shopItem.id);
    
    try {
      // Check if this is a credit purchase or barter
      if (shopItem.price_item_id) {
        // Barter - check if player has the required items
        const { data: invCheck } = await supabase
          .from('inventory')
          .select('id, quantity')
          .eq('character_id', selectedCharacter.id)
          .eq('item_id', shopItem.price_item_id)
          .single();
        
        if (!invCheck || invCheck.quantity < shopItem.price_item_quantity) {
          alert(`You need ${shopItem.price_item_quantity}x ${shopItem.price_item?.name || 'required item'} to trade for this.`);
          return;
        }
        
        // Deduct barter item
        const newQty = invCheck.quantity - shopItem.price_item_quantity;
        if (newQty <= 0) {
          await supabase.from('inventory').delete().eq('id', invCheck.id);
        } else {
          await supabase.from('inventory').update({ quantity: newQty }).eq('id', invCheck.id);
        }
      } else {
        // Credit purchase
        if (selectedCharacter.usd < shopItem.price_credits) {
          alert(`Not enough credits! You need $${shopItem.price_credits.toLocaleString()} but only have $${selectedCharacter.usd.toLocaleString()}.`);
          return;
        }
        
        // Deduct credits
        await supabase
          .from('characters')
          .update({ usd: selectedCharacter.usd - shopItem.price_credits })
          .eq('id', selectedCharacter.id);
        
        // Update local state
        setSelectedCharacter(prev => prev ? { ...prev, usd: prev.usd - shopItem.price_credits } : prev);
        setCharacters(prev => prev.map(c => 
          c.id === selectedCharacter.id ? { ...c, usd: c.usd - shopItem.price_credits } : c
        ));
      }
      
      // Add item to inventory (check if already exists)
      const { data: existingInv } = await supabase
        .from('inventory')
        .select('id, quantity')
        .eq('character_id', selectedCharacter.id)
        .eq('item_id', shopItem.item_id)
        .single();
      
      if (existingInv) {
        await supabase
          .from('inventory')
          .update({ quantity: existingInv.quantity + 1 })
          .eq('id', existingInv.id);
      } else {
        await supabase
          .from('inventory')
          .insert({
            character_id: selectedCharacter.id,
            item_id: shopItem.item_id,
            quantity: 1,
            is_equipped: false
          });
      }
      
      // Update shop stock if not unlimited
      if (shopItem.stock_quantity !== -1) {
        await supabase
          .from('shop_inventory')
          .update({ stock_quantity: shopItem.stock_quantity - 1 })
          .eq('id', shopItem.id);
        
        // Update local shop inventory
        setShopInventory(prev => prev.map(si => 
          si.id === shopItem.id ? { ...si, stock_quantity: si.stock_quantity - 1 } : si
        ).filter(si => si.stock_quantity !== 0));
      }
      
      // Refresh inventory
      fetchInventory(selectedCharacter.id);
      
      alert(`Purchased ${shopItem.item.name}!`);
    } catch (err: any) {
      console.error('Purchase error:', err);
      alert('Failed to complete purchase: ' + err.message);
    } finally {
      setPurchaseLoading(null);
    }
  };

  // Effect: Fetch shops when location is selected
  useEffect(() => {
    if (selectedLocation) {
      fetchLocationShops(selectedLocation.id);
    } else {
      setLocationShops([]);
      setSelectedShop(null);
      setShopInventory([]);
    }
  }, [selectedLocation]);

  const fetchMissions = async () => {
    if (!selectedCharacter) return;
    
    try {
      const { data: missionsData, error: missionsError } = await supabase
        .from('missions')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (missionsError) throw missionsError;
      
      // Filter to missions assigned to this player's characters
      const characterIds = characters.map(c => c.id);
      const playerMissions = (missionsData || []).filter(mission => 
        mission.assigned_to === null || // Party-wide
        mission.assigned_to?.some((charId: string) => characterIds.includes(charId))
      );
      
      setMissions(playerMissions);
    } catch (err: any) {
      console.error('Error fetching missions:', err);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const getClassInfo = (classId: string) => {
    return CHARACTER_CLASSES.find(c => c.id === classId);
  };

  // Convert stored stat to modifier
  // Old characters have stats stored as 10 + bonus (10 = +0, 11 = +1, 12 = +2)
  // New characters have direct modifiers (0, 1, 2)
  // If stat >= 8, assume old format and subtract 10
  const calculateStatModifier = (stat: number) => {
    if (stat >= 8) {
      // Old format: stored as 10 + bonus, so subtract 10
      return stat - 10;
    }
    // New format: stat IS the modifier
    return stat;
  };

  const formatModifier = (modifier: number) => {
    return modifier >= 0 ? `+${modifier}` : `${modifier}`;
  };

  // Rarity sort order
  const rarityOrder: Record<string, number> = {
    'Common': 1,
    'Uncommon': 2,
    'Rare': 3,
    'Epic': 4,
    'Mythic': 5,
    'Ultra Rare': 6,
    'MISSION ITEM': 7
  };

  // Filtered and sorted inventory
  const filteredInventory = inventory
    .filter(inv => {
      if (!inv.item) return false;
      const item = inv.item;
      
      // Search filter
      if (inventorySearch) {
        const search = inventorySearch.toLowerCase();
        if (!item.name.toLowerCase().includes(search) && 
            !item.description?.toLowerCase().includes(search)) {
          return false;
        }
      }
      
      // Type filter
      if (inventoryTypeFilter !== 'all' && item.type !== inventoryTypeFilter) {
        return false;
      }
      
      // Rarity filter
      if (inventoryRarityFilter !== 'all' && item.rarity !== inventoryRarityFilter) {
        return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      const itemA = a.item!;
      const itemB = b.item!;
      
      switch (inventorySort) {
        case 'name':
          return itemA.name.localeCompare(itemB.name);
        case 'type':
          return itemA.type.localeCompare(itemB.type);
        case 'rarity':
          return (rarityOrder[itemB.rarity] || 0) - (rarityOrder[itemA.rarity] || 0);
        case 'equipped':
        default:
          // Equipped items first, then by rarity
          if (a.is_equipped !== b.is_equipped) {
            return a.is_equipped ? -1 : 1;
          }
          return (rarityOrder[itemB.rarity] || 0) - (rarityOrder[itemA.rarity] || 0);
      }
    });

  // Get unique types and rarities for filters
  const inventoryTypes = [...new Set(inventory.map(inv => inv.item?.type).filter(Boolean))];
  const inventoryRarities = [...new Set(inventory.map(inv => inv.item?.rarity).filter(Boolean))];

  // Location icon mapping
  const locationIconMap: Record<string, string> = {
    'marker': '📍',
    'city': '🏙️',
    'dungeon': '🏚️',
    'shop': '🛒',
    'quest': '❗',
    'danger': '⚠️',
    'safe-zone': '🏠',
  };

  // Filtered and sorted locations
  const filteredLocations = locations
    .filter(loc => {
      // Exclude locations without valid coordinates
      if (!loc.lat || !loc.lng || (loc.lat === 0 && loc.lng === 0)) {
        return false;
      }
      
      // Search filter
      if (mapSearch) {
        const search = mapSearch.toLowerCase();
        if (!loc.name.toLowerCase().includes(search) && 
            !loc.description?.toLowerCase().includes(search)) {
          return false;
        }
      }
      
      // Icon/type filter
      if (mapIconFilter !== 'all' && loc.icon !== mapIconFilter) {
        return false;
      }
      
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // Get unique location types for filter
  const locationTypes = [...new Set(locations.map(loc => loc.icon))];

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0D1117 0%, #010409 50%, #0D1117 100%)', backgroundAttachment: 'fixed' }}>
      {/* Header */}
      <div className="glass-panel neon-border" style={{ borderRadius: 0 }}>
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl neon-text" style={{ fontFamily: 'var(--font-cyber)' }}>
            PLAYER TERMINAL
          </h1>
          <div className="flex items-center gap-4">
            {/* Lock Status Indicator */}
            {playersLocked && (
              <div 
                className="px-3 py-1.5 rounded flex items-center gap-2 animate-pulse"
                style={{ 
                  background: 'rgba(255, 0, 127, 0.2)', 
                  border: '1px solid var(--color-cyber-magenta)',
                  color: 'var(--color-cyber-magenta)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem'
                }}
                title={lockReason || 'Player actions locked by DM'}
              >
                🔒 {lockReason || 'LOCKED'}
              </div>
            )}
            <span className="text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
              {profile?.username || 'PLAYER'}
            </span>
            <button onClick={handleSignOut} className="neon-button-magenta text-sm">
              LOGOUT
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Character Selection (if multiple) */}
        {characters.length > 1 && (
          <div className="glass-panel p-4 mb-6" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)' }}>
            <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
              SELECT CHARACTER
            </label>
            <select
              value={selectedCharacter?.id || ''}
              onChange={(e) => {
                const char = characters.find(c => c.id === e.target.value);
                setSelectedCharacter(char || null);
              }}
              className="terminal-input w-full"
            >
              {characters.map(char => (
                <option key={char.id} value={char.id}>
                  {char.name} - Level {char.level} {getClassInfo(char.class)?.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {loading ? (
          <div className="glass-panel p-8 text-center">
            <div className="animate-spin w-12 h-12 border-4 rounded-full mx-auto mb-4" 
                 style={{ 
                   borderColor: 'color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)',
                   borderTopColor: 'var(--color-cyber-cyan)'
                 }}>
            </div>
            <p style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
              Loading character data...
            </p>
          </div>
        ) : error ? (
          <div className="glass-panel p-6" style={{ border: '1px solid var(--color-cyber-pink)' }}>
            <p style={{ color: 'var(--color-cyber-pink)', fontFamily: 'var(--font-mono)' }}>
              Error: {error}
            </p>
          </div>
        ) : !selectedCharacter ? (
          // No Character State
          <div className="glass-panel p-12 text-center">
            <h3 className="text-2xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
              NO CHARACTER FOUND
            </h3>
            <p className="mb-6" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
              Create your first character to begin your cyberpunk adventure
            </p>
            <button
              onClick={() => navigate('/character/create')}
              className="neon-button"
              style={{ fontFamily: 'var(--font-cyber)' }}
            >
              CREATE CHARACTER
            </button>
          </div>
        ) : (
          // Character Dashboard - 1/3 Sidebar + 2/3 Content Layout
          <div className="flex gap-6">
            {/* LEFT SIDEBAR - 1/3 width - Character Stats */}
            <div className="w-1/3 space-y-4">
              {/* Character Name & Class */}
              <div className="glass-panel p-4" style={{ border: '1px solid var(--color-cyber-green)' }}>
                <h2 className="text-xl mb-1" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-yellow)' }}>
                  {selectedCharacter.name.toUpperCase()}
                </h2>
                <p className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                  Level <span style={{ color: 'var(--color-cyber-yellow)' }}>{selectedCharacter.level}</span> {getClassInfo(selectedCharacter.class)?.name}
                </p>
              </div>

              {/* HP Bar */}
              <div className="glass-panel p-4" style={{ border: '1px solid var(--color-cyber-green)' }}>
                <div className="text-xs mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                  HEALTH POINTS
                </div>
                <div className="text-2xl mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                  {Math.min(selectedCharacter.current_hp, computedStats.hp)} / {computedStats.hp}
                  {computedStats.hp !== selectedCharacter.max_hp && (
                    <span className="text-sm ml-2" style={{ color: 'var(--color-cyber-green)' }}>
                      ({computedStats.hp > selectedCharacter.max_hp ? '+' : ''}{computedStats.hp - selectedCharacter.max_hp})
                    </span>
                  )}
                </div>
                <div className="h-3 rounded" style={{ backgroundColor: 'color-mix(in srgb, var(--color-cyber-magenta) 20%, transparent)' }}>
                  <div
                    className="h-full rounded"
                    style={{
                      width: `${(Math.min(selectedCharacter.current_hp, computedStats.hp) / computedStats.hp) * 100}%`,
                      backgroundColor: 'var(--color-cyber-magenta)'
                    }}
                  ></div>
                </div>
              </div>

              {/* AC, CDD, Credits */}
              <div className="glass-panel p-4" style={{ border: '1px solid var(--color-cyber-green)' }}>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>AC</div>
                    <div className="text-2xl" style={{ color: computedStats.hasArmorPenalty ? 'var(--color-cyber-magenta)' : 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                      {computedStats.ac}
                      {computedStats.hasArmorPenalty && <span className="text-xs ml-1">⚠️</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>CDD</div>
                    <div className="text-2xl" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{selectedCharacter.cdd}</div>
                  </div>
                  <div>
                    <div className="text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>CREDITS</div>
                    <div className="text-lg" style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)' }}>${selectedCharacter.usd.toLocaleString()}</div>
                  </div>
                </div>
                {computedStats.hasArmorPenalty && (
                  <div className="text-xs text-center mt-2 px-2 py-1 rounded" style={{ background: 'rgba(255, 0, 127, 0.2)', color: 'var(--color-cyber-magenta)' }}>
                    ⚠️ Non-proficient armor: −2 AC, −10 ft speed
                  </div>
                )}
              </div>

              {/* INIT, Speed, IC */}
              <div className="glass-panel p-4" style={{ border: '1px solid var(--color-cyber-green)' }}>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>INIT</div>
                    <div className="text-2xl" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                      {computedStats.init >= 0 ? `+${computedStats.init}` : computedStats.init}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>SPEED</div>
                    <div className="text-2xl" style={{ color: computedStats.hasArmorPenalty ? 'var(--color-cyber-magenta)' : 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                      {computedStats.speed} ft
                      {computedStats.hasArmorPenalty && <span className="text-xs ml-1">⚠️</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>IC</div>
                    <div className="text-2xl" style={{ color: computedStats.icRemaining <= 0 ? 'var(--color-cyber-magenta)' : 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                      {computedStats.icRemaining}/{computedStats.ic}
                    </div>
                  </div>
                </div>
              </div>

              {/* Equipment Slots */}
              <div className="glass-panel p-4" style={{ border: '1px solid var(--color-cyber-green)' }}>
                <div className="text-xs mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                  EQUIPMENT SLOTS
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-2 rounded" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)' }}>
                    <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>🛡️ ARMOR</div>
                    <div className="text-xl font-bold" style={{ color: computedStats.equippedArmorCount >= 1 ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                      {computedStats.equippedArmorCount}/1
                    </div>
                  </div>
                  <div className="text-center p-2 rounded" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)' }}>
                    <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>⚔️ WEAPONS</div>
                    <div className="text-xl font-bold" style={{ color: computedStats.equippedWeaponCount >= 3 ? 'var(--color-cyber-magenta)' : 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                      {computedStats.equippedWeaponCount}/3
                    </div>
                  </div>
                </div>
              </div>

              {/* Ability Scores */}
              <div className="glass-panel p-4" style={{ border: '1px solid var(--color-cyber-green)' }}>
                <div className="text-xs mb-3" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                  ABILITY SCORES <span style={{ opacity: 0.5 }}>(⭐ = Save Proficiency)</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { name: 'STR', value: computedStats.str },
                    { name: 'DEX', value: computedStats.dex },
                    { name: 'CON', value: computedStats.con },
                    { name: 'WIS', value: computedStats.wis },
                    { name: 'INT', value: computedStats.int },
                    { name: 'CHA', value: computedStats.cha }
                  ].map(stat => {
                    // Convert stat value to modifier (handles both old 10+ format and new direct format)
                    const modifier = calculateStatModifier(stat.value);
                    const hasSaveProficiency = selectedCharacter.save_proficiencies?.includes(stat.name);
                    return (
                      <div 
                        key={stat.name} 
                        className="text-center p-2 rounded relative" 
                        style={{ 
                          border: `1px solid ${hasSaveProficiency ? 'var(--color-cyber-green)' : 'color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)'}`,
                          background: hasSaveProficiency ? 'color-mix(in srgb, var(--color-cyber-green) 10%, transparent)' : 'transparent'
                        }}
                      >
                        {hasSaveProficiency && (
                          <span 
                            className="absolute top-1 right-1 text-xs" 
                            title="Saving Throw Proficiency"
                          >⭐</span>
                        )}
                        <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                          {stat.name}
                        </div>
                        <div className="text-2xl font-bold" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{formatModifier(modifier)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Proficiencies Widget */}
              {(() => {
                const classInfo = getClassInfo(selectedCharacter.class);
                const weaponRanks = [
                  { type: 'Unarmed', rank: selectedCharacter.weapon_rank_unarmed },
                  { type: 'Melee', rank: selectedCharacter.weapon_rank_melee },
                  { type: 'Sidearms', rank: selectedCharacter.weapon_rank_sidearms },
                  { type: 'Longarms', rank: selectedCharacter.weapon_rank_longarms },
                  { type: 'Heavy', rank: selectedCharacter.weapon_rank_heavy },
                ].filter(w => w.rank >= 1);
                
                const hasAnyProficiency = (classInfo?.armorProficiencies && classInfo.armorProficiencies.length > 0) || weaponRanks.length > 0;
                
                if (!hasAnyProficiency) return null;
                
                return (
                  <div className="glass-panel p-4" style={{ border: '1px solid var(--color-cyber-green)' }}>
                    <div className="text-xs mb-3" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                      PROFICIENCIES
                    </div>
                    
                    {/* Armor Proficiencies */}
                    {classInfo?.armorProficiencies && classInfo.armorProficiencies.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs mb-1" style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)' }}>
                          🛡️ ARMOR
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {classInfo.armorProficiencies.map((armor: string) => (
                            <span 
                              key={armor}
                              className="px-2 py-1 text-xs rounded"
                              style={{ 
                                background: 'color-mix(in srgb, var(--color-cyber-green) 20%, transparent)',
                                color: 'var(--color-cyber-green)',
                                fontFamily: 'var(--font-mono)',
                                textTransform: 'capitalize'
                              }}
                            >
                              {armor}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Weapon Proficiencies */}
                    {weaponRanks.length > 0 && (
                      <div>
                        <div className="text-xs mb-1" style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)' }}>
                          ⚔️ WEAPONS
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {weaponRanks.map((weapon) => (
                            <span 
                              key={weapon.type}
                              className="px-2 py-1 text-xs rounded flex items-center gap-1"
                              style={{ 
                                background: 'color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)',
                                color: 'var(--color-cyber-cyan)',
                                fontFamily: 'var(--font-mono)'
                              }}
                            >
                              {weapon.type}
                              <span 
                                className="px-1 rounded text-xs"
                                style={{ 
                                  background: weapon.rank >= 3 ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-green)',
                                  color: '#0D1117',
                                  fontWeight: 'bold'
                                }}
                              >
                                {weapon.rank}
                              </span>
                              <span style={{ opacity: 0.6 }}>
                                ({formatToHit(weapon.rank)})
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* RIGHT CONTENT AREA - 2/3 width */}
            <div className="w-2/3">
              {/* Tab Navigation */}
              <div className="glass-panel p-2 mb-4" style={{ border: '1px solid var(--color-cyber-green)' }}>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { id: 'abilities', label: '⚡ ABILITIES' },
                    { id: 'skills', label: '🎯 SKILLS' },
                    { id: 'inventory', label: '📦 INVENTORY' },
                    { id: 'map', label: '🗺️ WORLD MAP' },
                    { id: 'missions', label: '📋 MISSIONS' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as typeof activeTab)}
                      className="px-4 py-2 text-sm rounded transition-all"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        backgroundColor: activeTab === tab.id ? 'var(--color-cyber-yellow)' : 'transparent',
                        color: activeTab === tab.id ? '#0D1117' : 'var(--color-cyber-cyan)',
                        border: `1px solid ${activeTab === tab.id ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-green)'}`,
                        fontWeight: activeTab === tab.id ? 'bold' : 'normal'
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content */}
              <div className="glass-panel p-6" style={{ border: '1px solid var(--color-cyber-green)', minHeight: '500px' }}>
                {/* ABILITIES TAB */}
                {activeTab === 'abilities' && (
                  <div>
                    <h3 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
                      ⚡ ABILITIES
                    </h3>
                    {abilities.length === 0 ? (
                      <div className="text-center py-8" style={{ border: '2px dashed color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)', borderRadius: '8px' }}>
                        <p className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                          No abilities available
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {abilities.map((ability) => (
                          <div 
                            key={ability.id} 
                            className="p-4 rounded"
                            style={{ 
                              border: '1px solid var(--color-cyber-green)',
                              background: 'color-mix(in srgb, var(--color-cyber-cyan) 5%, transparent)'
                            }}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1">
                                <div className="font-bold" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>
                                  {ability.name}
                                </div>
                                <div className="text-xs flex items-center gap-2 flex-wrap" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                                  <span>{ability.type.toUpperCase().replace('_', ' ')}</span>
                                  {ability.source === 'class' && (
                                    <span className="px-2 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-green) 20%, transparent)', color: 'var(--color-cyber-cyan)' }}>
                                      🎓 CLASS
                                    </span>
                                  )}
                                  {ability.source === 'item' && (
                                    <span className="px-2 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-green) 20%, transparent)', color: 'var(--color-cyber-cyan)' }}>
                                      📦 {ability.item_name}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {ability.charge_type !== 'infinite' && (
                                <div className="text-xs px-2 py-1 rounded" style={{ background: 'var(--color-cyber-cyan)', color: 'black', fontFamily: 'var(--font-mono)' }}>
                                  {ability.current_charges || 0}/{ability.max_charges || 0}
                                </div>
                              )}
                            </div>
                            <p className="text-xs mb-3" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.8 }}>
                              {ability.description}
                            </p>
                            {(ability.damage_dice || ability.range_feet) && (
                              <div className="flex flex-wrap gap-2">
                                {ability.damage_dice && (
                                  <span className="text-xs px-2 py-1 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-green) 20%, transparent)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                                    🎲 {ability.damage_dice}
                                  </span>
                                )}
                                {ability.range_feet && (
                                  <span className="text-xs px-2 py-1 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-green) 20%, transparent)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                                    📏 {ability.range_feet}ft
                                  </span>
                                )}
                              </div>
                            )}
                            {ability.effects && ability.effects.length > 0 && (
                              <div className="mt-2 pt-2" style={{ borderTop: '1px solid color-mix(in srgb, var(--color-cyber-green) 20%, transparent)' }}>
                                <div className="text-xs" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>EFFECTS:</div>
                                {ability.effects.map((effect: string, i: number) => (
                                  <div key={i} className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.8 }}>• {effect}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* SKILLS TAB */}
                {activeTab === 'skills' && (
                  <div>
                    <h3 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
                      🎯 SKILLS
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {[
                        { name: 'Acrobatics', key: 'skill_acrobatics', stat: 'DEX', value: selectedCharacter.skill_acrobatics },
                        { name: 'Animal Handling', key: 'skill_animal_handling', stat: 'WIS', value: selectedCharacter.skill_animal_handling },
                        { name: 'Athletics', key: 'skill_athletics', stat: 'STR', value: selectedCharacter.skill_athletics },
                        { name: 'Biology', key: 'skill_biology', stat: 'INT', value: selectedCharacter.skill_biology },
                        { name: 'Deception', key: 'skill_deception', stat: 'CHA', value: selectedCharacter.skill_deception },
                        { name: 'Hacking', key: 'skill_hacking', stat: 'INT', value: selectedCharacter.skill_hacking },
                        { name: 'History', key: 'skill_history', stat: 'INT', value: selectedCharacter.skill_history },
                        { name: 'Insight', key: 'skill_insight', stat: 'WIS', value: selectedCharacter.skill_insight },
                        { name: 'Intimidation', key: 'skill_intimidation', stat: 'CHA', value: selectedCharacter.skill_intimidation },
                        { name: 'Investigation', key: 'skill_investigation', stat: 'INT', value: selectedCharacter.skill_investigation },
                        { name: 'Medicine', key: 'skill_medicine', stat: 'WIS', value: selectedCharacter.skill_medicine },
                        { name: 'Nature', key: 'skill_nature', stat: 'INT', value: selectedCharacter.skill_nature },
                        { name: 'Perception', key: 'skill_perception', stat: 'WIS', value: selectedCharacter.skill_perception },
                        { name: 'Performance', key: 'skill_performance', stat: 'CHA', value: selectedCharacter.skill_performance },
                        { name: 'Persuasion', key: 'skill_persuasion', stat: 'CHA', value: selectedCharacter.skill_persuasion },
                        { name: 'Sleight of Hand', key: 'skill_sleight_of_hand', stat: 'DEX', value: selectedCharacter.skill_sleight_of_hand },
                        { name: 'Stealth', key: 'skill_stealth', stat: 'DEX', value: selectedCharacter.skill_stealth },
                        { name: 'Survival', key: 'skill_survival', stat: 'WIS', value: selectedCharacter.skill_survival }
                      ].map(skill => {
                        const statKey = skill.stat.toLowerCase() as keyof typeof computedStats;
                        const rawStatValue = computedStats[statKey] as number;
                        // Convert raw stat to modifier (handles both old 10+ format and new direct format)
                        const statModifier = calculateStatModifier(rawStatValue);
                        // Look up item skill bonus by skill name (e.g., "Persuasion", "Sleight of Hand")
                        const itemSkillBonus = computedStats.skills[skill.name] || 0;
                        const hasItemBonus = itemSkillBonus > 0;
                        const totalBonus = statModifier + skill.value + itemSkillBonus;

                        return (
                          <div 
                            key={skill.key}
                            className="p-3 rounded text-center"
                            style={{ 
                              border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)',
                              background: 'transparent'
                            }}
                          >
                            <div className="flex justify-between items-center mb-1">
                              <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                                {skill.name}
                              </div>
                              {hasItemBonus && (
                                <span className="text-xs" title={`Item Bonus +${itemSkillBonus}`}>📦</span>
                              )}
                            </div>
                            <div className="text-2xl font-bold" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                              {formatModifier(totalBonus)}
                            </div>
                            <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6, fontFamily: 'var(--font-mono)' }}>
                              {skill.stat} {formatModifier(statModifier)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* INVENTORY TAB */}
                {activeTab === 'inventory' && (
                  <div className="flex flex-col h-full">
                    {/* Header with stats */}
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
                        📦 INVENTORY
                      </h3>
                      <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                        <span>{inventory.length} items</span>
                        <span>•</span>
                        <span>{inventory.filter(i => i.is_equipped).length} equipped</span>
                      </div>
                    </div>

                    {/* Search and Filters Bar */}
                    <div className="p-3 rounded mb-4 space-y-3" style={{ border: '1px solid var(--color-cyber-green)', background: 'color-mix(in srgb, var(--color-cyber-green) 5%, transparent)' }}>
                      {/* Search */}
                      <div className="flex gap-3">
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            placeholder="Search items..."
                            value={inventorySearch}
                            onChange={(e) => setInventorySearch(e.target.value)}
                            className="w-full px-3 py-2 rounded text-sm"
                            style={{
                              background: 'var(--color-cyber-darker)',
                              border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)',
                              color: 'var(--color-cyber-cyan)',
                              fontFamily: 'var(--font-mono)'
                            }}
                          />
                          {inventorySearch && (
                            <button
                              onClick={() => setInventorySearch('')}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs"
                              style={{ color: 'var(--color-cyber-cyan)' }}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        
                        {/* View Mode Toggle */}
                        <div className="flex rounded overflow-hidden" style={{ border: '1px solid var(--color-cyber-green)' }}>
                          <button
                            onClick={() => setInventoryViewMode('grid')}
                            className="px-3 py-2 text-sm"
                            style={{
                              background: inventoryViewMode === 'grid' ? 'var(--color-cyber-green)' : 'transparent',
                              color: inventoryViewMode === 'grid' ? 'black' : 'var(--color-cyber-cyan)'
                            }}
                          >
                            ▦
                          </button>
                          <button
                            onClick={() => setInventoryViewMode('list')}
                            className="px-3 py-2 text-sm"
                            style={{
                              background: inventoryViewMode === 'list' ? 'var(--color-cyber-green)' : 'transparent',
                              color: inventoryViewMode === 'list' ? 'black' : 'var(--color-cyber-cyan)'
                            }}
                          >
                            ☰
                          </button>
                        </div>
                      </div>

                      {/* Filters Row */}
                      <div className="flex gap-3 flex-wrap">
                        {/* Type Filter */}
                        <select
                          value={inventoryTypeFilter}
                          onChange={(e) => setInventoryTypeFilter(e.target.value)}
                          className="px-3 py-1.5 rounded text-sm"
                          style={{
                            background: 'var(--color-cyber-darker)',
                            border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)',
                            color: 'var(--color-cyber-cyan)',
                            fontFamily: 'var(--font-mono)'
                          }}
                        >
                          <option value="all">All Types</option>
                          {inventoryTypes.map(type => (
                            <option key={type} value={type}>{getItemTypeIcon(type as any)} {type}</option>
                          ))}
                        </select>

                        {/* Rarity Filter */}
                        <select
                          value={inventoryRarityFilter}
                          onChange={(e) => setInventoryRarityFilter(e.target.value)}
                          className="px-3 py-1.5 rounded text-sm"
                          style={{
                            background: 'var(--color-cyber-darker)',
                            border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)',
                            color: 'var(--color-cyber-cyan)',
                            fontFamily: 'var(--font-mono)'
                          }}
                        >
                          <option value="all">All Rarities</option>
                          {inventoryRarities.map(rarity => (
                            <option key={rarity} value={rarity}>{rarity}</option>
                          ))}
                        </select>

                        {/* Sort */}
                        <select
                          value={inventorySort}
                          onChange={(e) => setInventorySort(e.target.value as any)}
                          className="px-3 py-1.5 rounded text-sm"
                          style={{
                            background: 'var(--color-cyber-darker)',
                            border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)',
                            color: 'var(--color-cyber-cyan)',
                            fontFamily: 'var(--font-mono)'
                          }}
                        >
                          <option value="equipped">Sort: Equipped First</option>
                          <option value="name">Sort: Name</option>
                          <option value="type">Sort: Type</option>
                          <option value="rarity">Sort: Rarity</option>
                        </select>

                        {/* Clear Filters */}
                        {(inventorySearch || inventoryTypeFilter !== 'all' || inventoryRarityFilter !== 'all') && (
                          <button
                            onClick={() => {
                              setInventorySearch('');
                              setInventoryTypeFilter('all');
                              setInventoryRarityFilter('all');
                            }}
                            className="px-3 py-1.5 rounded text-sm"
                            style={{
                              border: '1px solid var(--color-cyber-magenta)',
                              color: 'var(--color-cyber-magenta)',
                              background: 'transparent'
                            }}
                          >
                            Clear Filters
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Results Count */}
                    {filteredInventory.length !== inventory.length && (
                      <div className="text-xs mb-3" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                        Showing {filteredInventory.length} of {inventory.length} items
                      </div>
                    )}

                    {/* Inventory Content */}
                    {inventory.length === 0 ? (
                      <div className="text-center py-12" style={{ border: '2px dashed color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)', borderRadius: '8px' }}>
                        <div className="text-4xl mb-4">📦</div>
                        <p className="text-lg" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>
                          INVENTORY EMPTY
                        </p>
                        <p className="text-sm mt-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                          Visit a shop or complete missions to acquire items
                        </p>
                      </div>
                    ) : filteredInventory.length === 0 ? (
                      <div className="text-center py-8" style={{ border: '2px dashed color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)', borderRadius: '8px' }}>
                        <p className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                          No items match your filters
                        </p>
                      </div>
                    ) : (
                      <div className={`overflow-y-auto p-1 ${inventoryViewMode === 'grid' ? 'grid grid-cols-2 lg:grid-cols-3 gap-3 content-start' : 'space-y-2'}`} style={{ maxHeight: '400px' }}>
                        {filteredInventory.map((inv) => {
                          const item = inv.item!;
                          const isSelected = selectedInventoryItem?.id === inv.id;
                          
                          return inventoryViewMode === 'grid' ? (
                            // GRID VIEW - Compact cards
                            <div 
                              key={inv.id}
                              onClick={() => setSelectedInventoryItem(isSelected ? null : inv)}
                              className="p-3 rounded cursor-pointer transition-all"
                              style={{ 
                                border: `2px solid ${isSelected ? getRarityColor(item.rarity) : inv.is_equipped ? 'var(--color-cyber-green)' : 'color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)'}`,
                                background: isSelected ? 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)' : inv.is_equipped ? 'color-mix(in srgb, var(--color-cyber-green) 8%, transparent)' : 'transparent'
                              }}
                            >
                              <div className="flex items-start gap-2 mb-2">
                                <span className="text-xl">{getItemTypeIcon(item.type)}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="font-bold text-sm truncate" style={{ color: getRarityColor(item.rarity), fontFamily: 'var(--font-cyber)' }}>
                                    {item.name}
                                  </div>
                                  <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6 }}>
                                    {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)', color: getRarityColor(item.rarity) }}>
                                  {item.rarity}
                                </span>
                                {inv.is_equipped && (
                                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--color-cyber-yellow)', color: '#0D1117', fontWeight: 'bold' }}>
                                    ✓
                                  </span>
                                )}
                                {inv.quantity > 1 && (
                                  <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                                    x{inv.quantity}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            // LIST VIEW - Full width rows
                            <div 
                              key={inv.id}
                              onClick={() => setSelectedInventoryItem(isSelected ? null : inv)}
                              className="p-3 rounded cursor-pointer transition-all flex items-center gap-4"
                              style={{ 
                                border: `1px solid ${isSelected ? getRarityColor(item.rarity) : inv.is_equipped ? 'var(--color-cyber-green)' : 'color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)'}`,
                                background: isSelected ? 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)' : inv.is_equipped ? 'color-mix(in srgb, var(--color-cyber-green) 8%, transparent)' : 'transparent'
                              }}
                            >
                              <span className="text-xl">{getItemTypeIcon(item.type)}</span>
                              <div className="flex-1 min-w-0">
                                <div className="font-bold truncate" style={{ color: getRarityColor(item.rarity), fontFamily: 'var(--font-cyber)' }}>
                                  {item.name}
                                </div>
                              </div>
                              <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6 }}>
                                {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded" style={{ color: getRarityColor(item.rarity) }}>
                                {item.rarity}
                              </span>
                              {inv.quantity > 1 && (
                                <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                                  x{inv.quantity}
                                </span>
                              )}
                              {inv.is_equipped && (
                                <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--color-cyber-yellow)', color: '#0D1117', fontWeight: 'bold' }}>
                                  EQUIPPED
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* MAP TAB */}
                {activeTab === 'map' && (
                  <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
                        🗺️ WORLD MAP
                      </h3>
                      <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                        <span>{locations.length} locations discovered</span>
                      </div>
                    </div>

                    {/* Search and Filters Bar */}
                    <div className="p-3 rounded mb-4 space-y-3" style={{ border: '1px solid var(--color-cyber-green)', background: 'color-mix(in srgb, var(--color-cyber-green) 5%, transparent)' }}>
                      <div className="flex gap-3">
                        {/* Search */}
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            placeholder="Search locations..."
                            value={mapSearch}
                            onChange={(e) => setMapSearch(e.target.value)}
                            className="w-full px-3 py-2 rounded text-sm"
                            style={{
                              background: 'var(--color-cyber-darker)',
                              border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)',
                              color: 'var(--color-cyber-cyan)',
                              fontFamily: 'var(--font-mono)'
                            }}
                          />
                          {mapSearch && (
                            <button
                              onClick={() => setMapSearch('')}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs"
                              style={{ color: 'var(--color-cyber-cyan)' }}
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        {/* Type Filter */}
                        <select
                          value={mapIconFilter}
                          onChange={(e) => setMapIconFilter(e.target.value)}
                          className="px-3 py-2 rounded text-sm"
                          style={{
                            background: 'var(--color-cyber-darker)',
                            border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)',
                            color: 'var(--color-cyber-cyan)',
                            fontFamily: 'var(--font-mono)'
                          }}
                        >
                          <option value="all">All Types</option>
                          {locationTypes.map(type => (
                            <option key={type} value={type}>{locationIconMap[type] || '📍'} {type}</option>
                          ))}
                        </select>

                        {/* View Mode Toggle */}
                        <div className="flex rounded overflow-hidden" style={{ border: '1px solid var(--color-cyber-green)' }}>
                          <button
                            onClick={() => setMapViewMode('map')}
                            className="px-3 py-2 text-sm"
                            style={{
                              background: mapViewMode === 'map' ? 'var(--color-cyber-green)' : 'transparent',
                              color: mapViewMode === 'map' ? 'black' : 'var(--color-cyber-cyan)'
                            }}
                          >
                            🗺️
                          </button>
                          <button
                            onClick={() => setMapViewMode('list')}
                            className="px-3 py-2 text-sm"
                            style={{
                              background: mapViewMode === 'list' ? 'var(--color-cyber-green)' : 'transparent',
                              color: mapViewMode === 'list' ? 'black' : 'var(--color-cyber-cyan)'
                            }}
                          >
                            ☰
                          </button>
                        </div>

                        {/* Clear Filters */}
                        {(mapSearch || mapIconFilter !== 'all') && (
                          <button
                            onClick={() => {
                              setMapSearch('');
                              setMapIconFilter('all');
                            }}
                            className="px-3 py-2 rounded text-sm"
                            style={{
                              border: '1px solid var(--color-cyber-magenta)',
                              color: 'var(--color-cyber-magenta)',
                              background: 'transparent'
                            }}
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Results Count */}
                    {filteredLocations.length !== locations.length && (
                      <div className="text-xs mb-3" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                        Showing {filteredLocations.length} of {locations.length} locations
                      </div>
                    )}

                    {/* Content Area */}
                    {locations.length === 0 ? (
                      <div className="text-center py-12" style={{ border: '2px dashed color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)', borderRadius: '8px' }}>
                        <div className="text-4xl mb-4">🗺️</div>
                        <p className="text-lg" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>
                          NO LOCATIONS DISCOVERED
                        </p>
                        <p className="text-sm mt-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                          Explore the world to discover new locations
                        </p>
                      </div>
                    ) : mapViewMode === 'map' ? (
                      /* MAP VIEW */
                      <div className="flex gap-4 flex-1">
                        {/* Large Map */}
                        <div className="flex-1 rounded overflow-hidden" style={{ border: '2px solid var(--color-cyber-green)', minHeight: '500px' }}>
                          <WorldMap
                            isDM={false}
                            onLocationClick={(loc) => setSelectedLocation(loc)}
                            externalLocations={filteredLocations}
                            showPopups={false}
                          />
                        </div>

                        {/* Location Detail Sidebar */}
                        <div className="w-80 flex-shrink-0">
                          {selectedLocation ? (
                            <div className="p-4 rounded h-full" style={{ border: '2px solid var(--color-cyber-green)', background: 'color-mix(in srgb, var(--color-cyber-dark) 90%, transparent)' }}>
                              <button 
                                onClick={() => setSelectedLocation(null)}
                                className="text-xs mb-3 hover:underline"
                                style={{ color: 'var(--color-cyber-cyan)' }}
                              >
                                ← Back to overview
                              </button>
                              
                              <div className="flex items-start gap-3 mb-4">
                                <span className="text-3xl">{locationIconMap[selectedLocation.icon] || '📍'}</span>
                                <div>
                                  <h4 className="text-lg font-bold" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>
                                    {selectedLocation.name}
                                  </h4>
                                  <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6, fontFamily: 'var(--font-mono)' }}>
                                    {selectedLocation.icon}
                                  </div>
                                </div>
                              </div>

                              <p className="text-sm mb-4" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.8, lineHeight: 1.6 }}>
                                {selectedLocation.description || 'No description available.'}
                              </p>

                              {selectedLocation.lore && (
                                <div className="p-3 rounded mb-4" style={{ background: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)', borderLeft: '3px solid var(--color-cyber-cyan)' }}>
                                  <div className="text-xs mb-1" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>
                                    LORE
                                  </div>
                                  <p className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.8 }}>
                                    {selectedLocation.lore}
                                  </p>
                                </div>
                              )}

                              {selectedLocation.tags && selectedLocation.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-4">
                                  {selectedLocation.tags.map((tag, i) => (
                                    <span key={i} className="text-xs px-2 py-1 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-green) 20%, transparent)', color: 'var(--color-cyber-cyan)' }}>
                                      #{tag}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* SHOPS SECTION */}
                              {shopLoading ? (
                                <div className="text-xs text-center py-4" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>
                                  Loading shops...
                                </div>
                              ) : locationShops.length > 0 ? (
                                <div className="mt-4 pt-4" style={{ borderTop: '1px solid color-mix(in srgb, var(--color-cyber-yellow) 30%, transparent)' }}>
                                  <div className="text-xs mb-2" style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)' }}>
                                    🏪 SHOPS ({locationShops.length})
                                  </div>
                                  <div className="space-y-2">
                                    {locationShops.map(shop => (
                                      <button
                                        key={shop.id}
                                        onClick={() => handleSelectShop(shop)}
                                        className="w-full p-2 rounded text-left transition-all hover:opacity-80"
                                        style={{
                                          border: `1px solid ${selectedShop?.id === shop.id ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-green)'}`,
                                          background: selectedShop?.id === shop.id ? 'color-mix(in srgb, var(--color-cyber-yellow) 20%, transparent)' : 'transparent'
                                        }}
                                      >
                                        <div className="text-sm font-bold" style={{ color: 'var(--color-cyber-yellow)' }}>
                                          {shop.name}
                                        </div>
                                        {shop.description && (
                                          <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6 }}>
                                            {shop.description}
                                          </div>
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <div className="p-4 rounded h-full" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)' }}>
                              <div className="text-sm mb-4" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                                QUICK NAV ({filteredLocations.length})
                              </div>
                              <div className="space-y-2 overflow-y-auto" style={{ maxHeight: '450px' }}>
                                {filteredLocations.map(loc => (
                                  <div 
                                    key={loc.id}
                                    onClick={() => setSelectedLocation(loc)}
                                    className="p-2 rounded cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-2"
                                    style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)' }}
                                  >
                                    <span>{locationIconMap[loc.icon] || '📍'}</span>
                                    <span className="text-sm truncate" style={{ color: 'var(--color-cyber-cyan)' }}>
                                      {loc.name}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* LIST VIEW */
                      <div className="flex gap-4 flex-1 min-h-0">
                        {/* Location Grid */}
                        <div className="flex-1 grid grid-cols-2 lg:grid-cols-3 gap-3 content-start overflow-y-auto" style={{ maxHeight: '500px' }}>
                          {filteredLocations.map(loc => {
                            const isSelected = selectedLocation?.id === loc.id;
                            return (
                              <div 
                                key={loc.id}
                                onClick={() => setSelectedLocation(isSelected ? null : loc)}
                                className="p-3 rounded cursor-pointer transition-all hover:brightness-110"
                                style={{ 
                                  border: `2px solid ${isSelected ? 'var(--color-cyber-green)' : 'color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)'}`,
                                  background: isSelected ? 'color-mix(in srgb, var(--color-cyber-green) 10%, transparent)' : 'transparent'
                                }}
                              >
                                <div className="flex items-start gap-2 mb-2">
                                  <span className="text-2xl">{locationIconMap[loc.icon] || '📍'}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-bold text-sm truncate" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>
                                      {loc.name}
                                    </div>
                                    <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6 }}>
                                      {loc.icon}
                                    </div>
                                  </div>
                                </div>
                                <p className="text-xs line-clamp-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>
                                  {loc.description || 'No description'}
                                </p>
                              </div>
                            );
                          })}
                        </div>

                        {/* Detail Panel */}
                        {selectedLocation && (
                          <div className="w-72 p-4 rounded flex-shrink-0" style={{ border: '2px solid var(--color-cyber-green)', background: 'color-mix(in srgb, var(--color-cyber-dark) 90%, transparent)' }}>
                            <div className="flex items-start gap-3 mb-4">
                              <span className="text-3xl">{locationIconMap[selectedLocation.icon] || '📍'}</span>
                              <div>
                                <h4 className="font-bold text-lg" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>
                                  {selectedLocation.name}
                                </h4>
                                <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6, fontFamily: 'var(--font-mono)' }}>
                                  {selectedLocation.icon}
                                </div>
                              </div>
                            </div>

                            <p className="text-sm mb-4" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.8 }}>
                              {selectedLocation.description || 'No description available.'}
                            </p>

                            {selectedLocation.lore && (
                              <div className="p-3 rounded mb-4" style={{ background: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)', borderLeft: '3px solid var(--color-cyber-cyan)' }}>
                                <div className="text-xs mb-1" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>
                                  LORE
                                </div>
                                <p className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.8 }}>
                                  {selectedLocation.lore}
                                </p>
                              </div>
                            )}

                            {selectedLocation.tags && selectedLocation.tags.length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-4">
                                {selectedLocation.tags.map((tag, i) => (
                                  <span key={i} className="text-xs px-2 py-1 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-green) 20%, transparent)', color: 'var(--color-cyber-cyan)' }}>
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* SHOPS SECTION - List View */}
                            {shopLoading ? (
                              <div className="text-xs text-center py-4" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>
                                Loading shops...
                              </div>
                            ) : locationShops.length > 0 ? (
                              <div className="mt-4 pt-4" style={{ borderTop: '1px solid color-mix(in srgb, var(--color-cyber-yellow) 30%, transparent)' }}>
                                <div className="text-xs mb-2" style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)' }}>
                                  🏪 SHOPS ({locationShops.length})
                                </div>
                                <div className="space-y-2">
                                  {locationShops.map(shop => (
                                    <button
                                      key={shop.id}
                                      onClick={() => handleSelectShop(shop)}
                                      className="w-full p-2 rounded text-left transition-all hover:opacity-80"
                                      style={{
                                        border: `1px solid ${selectedShop?.id === shop.id ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-green)'}`,
                                        background: selectedShop?.id === shop.id ? 'color-mix(in srgb, var(--color-cyber-yellow) 20%, transparent)' : 'transparent'
                                      }}
                                    >
                                      <div className="text-sm font-bold" style={{ color: 'var(--color-cyber-yellow)' }}>
                                        {shop.name}
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* MISSIONS TAB */}
                {activeTab === 'missions' && (
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
                        📋 MISSION LOG
                      </h3>
                      <div className="flex gap-2">
                        {(['all', 'active', 'completed', 'failed'] as const).map(filter => (
                          <button
                            key={filter}
                            onClick={() => setMissionFilter(filter)}
                            className="px-3 py-1 text-xs rounded"
                            style={{
                              background: missionFilter === filter ? 'var(--color-cyber-yellow)' : 'transparent',
                              color: missionFilter === filter ? '#0D1117' : 'var(--color-cyber-cyan)',
                              border: `1px solid ${missionFilter === filter ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-green)'}`,
                              fontWeight: missionFilter === filter ? 'bold' : 'normal'
                            }}
                          >
                            {filter.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {missions.filter(m => missionFilter === 'all' || m.status === missionFilter).length === 0 ? (
                      <div className="text-center py-8" style={{ border: '2px dashed color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)', borderRadius: '8px' }}>
                        <p className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                          No {missionFilter !== 'all' ? missionFilter : ''} missions
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {missions
                          .filter(m => missionFilter === 'all' || m.status === missionFilter)
                          .map(mission => (
                            <div 
                              key={mission.id}
                              className="p-4 rounded cursor-pointer hover:opacity-80 transition-opacity"
                              style={{ 
                                border: `1px solid ${mission.status === 'active' ? 'var(--color-cyber-yellow)' : 'color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)'}`,
                                background: mission.status === 'active' ? 'color-mix(in srgb, var(--color-cyber-yellow) 5%, transparent)' : 'transparent'
                              }}
                              onClick={() => setSelectedMission(selectedMission?.id === mission.id ? null : mission)}
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="font-bold" style={{ color: mission.status === 'active' ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>
                                    {mission.title}
                                  </div>
                                  <div className="text-xs flex gap-2 mt-1" style={{ fontFamily: 'var(--font-mono)' }}>
                                    <span style={{ color: 'var(--color-cyber-green)' }}>{mission.type}</span>
                                    <span style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>|</span>
                                    <span style={{ color: 'var(--color-cyber-cyan)' }}>{mission.difficulty}</span>
                                  </div>
                                </div>
                                <span 
                                  className="text-xs px-2 py-1 rounded"
                                  style={{ 
                                    background: mission.status === 'active' ? 'var(--color-cyber-yellow)' : 
                                               mission.status === 'completed' ? 'var(--color-cyber-cyan)' : 
                                               'var(--color-cyber-magenta)',
                                    color: '#0D1117',
                                    fontWeight: 'bold'
                                  }}
                                >
                                  {mission.status.toUpperCase()}
                                </span>
                              </div>
                              
                              {selectedMission?.id === mission.id && (
                                <div className="mt-4 pt-4" style={{ borderTop: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)' }}>
                                  <p className="text-sm mb-3" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.8 }}>
                                    {mission.description}
                                  </p>
                                  {mission.objectives && mission.objectives.length > 0 && (
                                    <div className="text-xs">
                                      <div className="mb-1" style={{ color: 'var(--color-cyber-green)' }}>OBJECTIVES:</div>
                                      {mission.objectives.map((obj: string, i: number) => (
                                        <div key={i} className="flex items-center gap-2" style={{ color: 'var(--color-cyber-cyan)' }}>
                                          <span style={{ color: 'var(--color-cyber-green)' }}>{i + 1}.</span>
                                          <span>{obj}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {mission.reward_credits && mission.reward_credits > 0 && (
                                    <div className="mt-2 text-xs" style={{ color: 'var(--color-cyber-yellow)' }}>
                                      💰 ${mission.reward_credits.toLocaleString()} credit reward
                                    </div>
                                  )}
                                  {mission.reward_item_ids && mission.reward_item_ids.length > 0 && (
                                    <div className="mt-2 text-xs" style={{ color: 'var(--color-cyber-green)' }}>
                                      🎁 {mission.reward_item_ids.length} reward item{mission.reward_item_ids.length > 1 ? 's' : ''} available
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Shop Widget - Separate panel below map when shop is selected */}
              {activeTab === 'map' && selectedShop && (
                <div className="glass-panel p-4 mt-4" style={{ border: '1px solid var(--color-cyber-yellow)' }}>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-yellow)' }}>
                      🏪 {selectedShop.name}
                    </h4>
                    <div className="flex items-center gap-3">
                      <div className="text-sm px-3 py-1 rounded" style={{ background: 'var(--color-cyber-green)', color: 'black', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                        💰 ${selectedCharacter?.usd.toLocaleString() || 0}
                      </div>
                      <button
                        onClick={() => setSelectedShop(null)}
                        className="text-sm px-2 py-1 rounded transition-all hover:opacity-80"
                        style={{ border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)' }}
                      >
                        ✕ Close
                      </button>
                    </div>
                  </div>
                  
                  {selectedShop.description && (
                    <p className="text-sm mb-4" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>
                      {selectedShop.description}
                    </p>
                  )}
                  
                  {/* Shop Inventory Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {shopInventory.length === 0 ? (
                      <div className="col-span-full text-center py-8" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                        No items currently in stock
                      </div>
                    ) : shopInventory.map(shopItem => {
                      const canAfford = shopItem.price_item_id 
                        ? true // Barter - we'll check on purchase
                        : (selectedCharacter?.usd || 0) >= shopItem.price_credits;
                      const outOfStock = shopItem.stock_quantity === 0;
                      const item = shopItem.item;
                      
                      // Build stat strings for display
                      const statMods: string[] = [];
                      if (item.ac_mod !== 0) statMods.push(`AC ${item.ac_mod > 0 ? '+' : ''}${item.ac_mod}`);
                      if (item.hp_mod !== 0) statMods.push(`HP ${item.hp_mod > 0 ? '+' : ''}${item.hp_mod}${item.hp_mod_type === 'max_hp' ? ' Max' : ''}`);
                      if (item.str_mod !== 0) statMods.push(`STR ${item.str_mod > 0 ? '+' : ''}${item.str_mod}`);
                      if (item.dex_mod !== 0) statMods.push(`DEX ${item.dex_mod > 0 ? '+' : ''}${item.dex_mod}`);
                      if (item.con_mod !== 0) statMods.push(`CON ${item.con_mod > 0 ? '+' : ''}${item.con_mod}`);
                      if (item.wis_mod !== 0) statMods.push(`WIS ${item.wis_mod > 0 ? '+' : ''}${item.wis_mod}`);
                      if (item.int_mod !== 0) statMods.push(`INT ${item.int_mod > 0 ? '+' : ''}${item.int_mod}`);
                      if (item.cha_mod !== 0) statMods.push(`CHA ${item.cha_mod > 0 ? '+' : ''}${item.cha_mod}`);
                      if ((item.speed_mod ?? 0) !== 0) statMods.push(`Speed ${(item.speed_mod ?? 0) > 0 ? '+' : ''}${item.speed_mod}`);
                      if ((item.init_mod ?? 0) !== 0) statMods.push(`Init ${(item.init_mod ?? 0) > 0 ? '+' : ''}${item.init_mod}`);
                      if ((item.ic_mod ?? 0) !== 0) statMods.push(`IC ${(item.ic_mod ?? 0) > 0 ? '+' : ''}${item.ic_mod}`);
                      
                      // Skill mods
                      const skillMods: string[] = [];
                      if (item.skill_mods) {
                        Object.entries(item.skill_mods).forEach(([skill, mod]) => {
                          if (mod !== 0) skillMods.push(`${skill} ${mod > 0 ? '+' : ''}${mod}`);
                        });
                      }
                      
                      return (
                        <div 
                          key={shopItem.id}
                          className="p-4 rounded-lg"
                          style={{
                            border: `2px solid ${outOfStock ? 'color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)' : getRarityColor(item.rarity)}`,
                            background: 'color-mix(in srgb, var(--color-cyber-dark) 70%, transparent)',
                            opacity: outOfStock ? 0.4 : 1
                          }}
                        >
                          {/* Item Header */}
                          <div className="flex items-start gap-3 mb-3">
                            <span className="text-2xl">{getItemTypeIcon(item.type)}</span>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold" style={{ color: getRarityColor(item.rarity), fontFamily: 'var(--font-cyber)', fontSize: '1.1rem' }}>
                                {item.name}
                              </div>
                              <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                                <span style={{ textTransform: 'uppercase' }}>{item.type}</span>
                                <span style={{ opacity: 0.5 }}> • </span>
                                <span style={{ color: getRarityColor(item.rarity) }}>{item.rarity}</span>
                                {item.weapon_subtype && (
                                  <>
                                    <span style={{ opacity: 0.5 }}> • </span>
                                    <span>{item.weapon_subtype.charAt(0).toUpperCase() + item.weapon_subtype.slice(1)}</span>
                                  </>
                                )}
                                {item.armor_subtype && (
                                  <>
                                    <span style={{ opacity: 0.5 }}> • </span>
                                    <span>{item.armor_subtype.charAt(0).toUpperCase() + item.armor_subtype.slice(1)} Armor</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Description */}
                          {item.description && (
                            <div className="mb-3 p-2 rounded" style={{ background: 'rgba(0, 0, 0, 0.3)' }}>
                              <p className="text-sm" style={{ color: 'var(--color-cyber-cyan)', lineHeight: '1.4' }}>
                                {item.description}
                              </p>
                            </div>
                          )}
                          
                          {/* Item Details Section */}
                          <div className="space-y-2 text-sm mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
                            {/* Cyberware IC Cost */}
                            {item.type === 'cyberware' && (item.ic_cost ?? 0) > 0 && (
                              <div className="flex items-center gap-2" style={{ color: 'var(--color-cyber-yellow)' }}>
                                <span>🔌</span>
                                <span>Implant Capacity Cost: <strong>{item.ic_cost}</strong></span>
                              </div>
                            )}
                            
                            {/* Stat Modifiers */}
                            {statMods.length > 0 && (
                              <div>
                                <div className="text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6 }}>STAT MODIFIERS:</div>
                                <div style={{ color: 'var(--color-cyber-green)' }}>
                                  {statMods.join(' • ')}
                                </div>
                              </div>
                            )}
                            
                            {/* Skill Modifiers */}
                            {skillMods.length > 0 && (
                              <div>
                                <div className="text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6 }}>SKILL MODIFIERS:</div>
                                <div style={{ color: 'var(--color-cyber-magenta)' }}>
                                  {skillMods.join(' • ')}
                                </div>
                              </div>
                            )}
                            
                            {/* Consumable/Equippable info */}
                            {(item.is_consumable || item.is_equippable) && (
                              <div className="flex gap-4 text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>
                                {item.is_consumable && <span>📦 Consumable</span>}
                                {item.is_equippable && <span>🎯 Equippable</span>}
                                {item.stack_size > 1 && <span>📚 Stacks to {item.stack_size}</span>}
                              </div>
                            )}
                          </div>
                          
                          {/* Price/Trade Section */}
                          <div className="pt-3 mt-3 flex items-center justify-between gap-4" style={{ borderTop: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)' }}>
                            <div style={{ fontFamily: 'var(--font-mono)' }}>
                              {shopItem.price_item_id ? (
                                <div>
                                  <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6 }}>TRADE REQUIRED:</div>
                                  <div className="font-bold" style={{ color: 'var(--color-cyber-magenta)' }}>
                                    {shopItem.price_item_quantity}x {shopItem.price_item?.name || 'Unknown Item'}
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6 }}>PRICE:</div>
                                  <div className="text-xl font-bold" style={{ color: canAfford ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-magenta)' }}>
                                    ${shopItem.price_credits.toLocaleString()}
                                    {!canAfford && <span className="text-xs ml-2" style={{ opacity: 0.7 }}>(Can't afford)</span>}
                                  </div>
                                </div>
                              )}
                              {shopItem.stock_quantity !== null && shopItem.stock_quantity !== -1 && (
                                <div className="text-xs mt-1" style={{ color: shopItem.stock_quantity <= 3 ? 'var(--color-cyber-magenta)' : 'var(--color-cyber-cyan)', opacity: 0.7 }}>
                                  {shopItem.stock_quantity <= 3 ? '⚠️ ' : ''}{shopItem.stock_quantity} in stock
                                </div>
                              )}
                              {shopItem.stock_quantity === -1 && (
                                <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-green)', opacity: 0.7 }}>
                                  ∞ Always in stock
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => handlePurchaseItem(shopItem)}
                              disabled={outOfStock || purchaseLoading === shopItem.id || (!canAfford && !shopItem.price_item_id)}
                              className="px-6 py-3 rounded text-sm font-bold transition-all"
                              style={{
                                background: outOfStock ? 'transparent' : (!canAfford && !shopItem.price_item_id) ? 'transparent' : 'var(--color-cyber-magenta)',
                                color: outOfStock || (!canAfford && !shopItem.price_item_id) ? 'var(--color-cyber-cyan)' : 'white',
                                border: `2px solid ${outOfStock || (!canAfford && !shopItem.price_item_id) ? 'var(--color-cyber-cyan)' : 'var(--color-cyber-magenta)'}`,
                                opacity: outOfStock ? 0.4 : (!canAfford && !shopItem.price_item_id) ? 0.5 : 1,
                                cursor: outOfStock || (!canAfford && !shopItem.price_item_id) ? 'not-allowed' : 'pointer',
                                fontFamily: 'var(--font-cyber)'
                              }}
                            >
                              {purchaseLoading === shopItem.id ? 'BUYING...' : outOfStock ? 'SOLD OUT' : 'PURCHASE'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Item Detail Panel - Separate widget below tab content */}
              {activeTab === 'inventory' && (
                <div className="glass-panel p-4 mt-4" style={{ border: `1px solid ${selectedInventoryItem?.item ? getRarityColor(selectedInventoryItem.item.rarity) : 'var(--color-cyber-cyan)'}` }}>
                  <h4 className="text-sm mb-3" style={{ fontFamily: 'var(--font-cyber)', color: selectedInventoryItem?.item ? getRarityColor(selectedInventoryItem.item.rarity) : 'var(--color-cyber-cyan)' }}>
                    📋 ITEM DETAILS
                  </h4>
                  {selectedInventoryItem && selectedInventoryItem.item ? (
                    <>
                      <div className="flex items-start gap-3 mb-4">
                        <span className="text-3xl">{getItemTypeIcon(selectedInventoryItem.item.type)}</span>
                        <div className="flex-1">
                          <h4 className="font-bold text-lg" style={{ color: getRarityColor(selectedInventoryItem.item.rarity), fontFamily: 'var(--font-cyber)' }}>
                            {selectedInventoryItem.item.name}
                          </h4>
                          <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                            {selectedInventoryItem.item.type.charAt(0).toUpperCase() + selectedInventoryItem.item.type.slice(1)} • {selectedInventoryItem.item.rarity.charAt(0).toUpperCase() + selectedInventoryItem.item.rarity.slice(1)}
                            {selectedInventoryItem.item.weapon_subtype && ` • ${selectedInventoryItem.item.weapon_subtype.charAt(0).toUpperCase() + selectedInventoryItem.item.weapon_subtype.slice(1)}`}
                            {selectedInventoryItem.item.armor_subtype && ` • ${selectedInventoryItem.item.armor_subtype.charAt(0).toUpperCase() + selectedInventoryItem.item.armor_subtype.slice(1)}`}
                          </div>
                          {/* Weapon To-Hit Display */}
                          {selectedInventoryItem.item.type === 'weapon' && selectedInventoryItem.item.weapon_subtype && selectedCharacter && (
                            <div className="mt-2">
                              {(() => {
                                const weaponType = selectedInventoryItem.item.weapon_subtype.toLowerCase();
                                const rankKey = `weapon_rank_${weaponType}` as keyof Character;
                                const rank = (selectedCharacter[rankKey] as number) ?? 0;
                                const isProficient = rank > 0;
                                const toHitText = formatToHit(rank);
                                return (
                                  <span 
                                    className="text-sm px-3 py-1 rounded font-bold inline-block"
                                    style={{ 
                                      background: isProficient ? 'var(--color-cyber-green)' : 'var(--color-cyber-magenta)',
                                      color: '#0D1117',
                                      fontFamily: 'var(--font-mono)'
                                    }}
                                  >
                                    🎯 To Hit: {toHitText} {!isProficient && '(Not Proficient)'}
                                  </span>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                        {selectedInventoryItem.is_equipped && (
                          <span className="text-xs px-2 py-1 rounded" style={{ background: 'var(--color-cyber-green)', color: '#0D1117', fontWeight: 'bold' }}>EQUIPPED</span>
                        )}
                      </div>

                      <p className="text-sm mb-4" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.8 }}>
                        {selectedInventoryItem.item.description || 'No description available.'}
                      </p>

                      {/* Stats - Grid layout */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                        {selectedInventoryItem.item.ac_mod !== 0 && (
                          <div className="flex justify-between text-sm" style={{ color: 'var(--color-cyber-cyan)' }}>
                            <span>🛡️ AC</span>
                            <span style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>
                              {selectedInventoryItem.item.ac_mod > 0 ? '+' : ''}{selectedInventoryItem.item.ac_mod}
                            </span>
                          </div>
                        )}
                        {selectedInventoryItem.item.hp_mod !== 0 && (
                          <div className="flex justify-between text-sm" style={{ color: 'var(--color-cyber-cyan)' }}>
                            <span>❤️ HP</span>
                            <span style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>
                              {selectedInventoryItem.item.hp_mod > 0 ? '+' : ''}{selectedInventoryItem.item.hp_mod}
                            </span>
                          </div>
                        )}
                        {selectedInventoryItem.item.str_mod !== 0 && (
                          <div className="flex justify-between text-sm" style={{ color: 'var(--color-cyber-cyan)' }}>
                            <span>💪 STR</span>
                            <span style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>
                              {selectedInventoryItem.item.str_mod > 0 ? '+' : ''}{selectedInventoryItem.item.str_mod}
                            </span>
                          </div>
                        )}
                        {selectedInventoryItem.item.dex_mod !== 0 && (
                          <div className="flex justify-between text-sm" style={{ color: 'var(--color-cyber-cyan)' }}>
                            <span>🎯 DEX</span>
                            <span style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>
                              {selectedInventoryItem.item.dex_mod > 0 ? '+' : ''}{selectedInventoryItem.item.dex_mod}
                            </span>
                          </div>
                        )}
                        {selectedInventoryItem.item.con_mod !== 0 && (
                          <div className="flex justify-between text-sm" style={{ color: 'var(--color-cyber-cyan)' }}>
                            <span>🏋️ CON</span>
                            <span style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>
                              {selectedInventoryItem.item.con_mod > 0 ? '+' : ''}{selectedInventoryItem.item.con_mod}
                            </span>
                          </div>
                        )}
                        {selectedInventoryItem.item.wis_mod !== 0 && (
                          <div className="flex justify-between text-sm" style={{ color: 'var(--color-cyber-cyan)' }}>
                            <span>🧠 WIS</span>
                            <span style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>
                              {selectedInventoryItem.item.wis_mod > 0 ? '+' : ''}{selectedInventoryItem.item.wis_mod}
                            </span>
                          </div>
                        )}
                        {selectedInventoryItem.item.int_mod !== 0 && (
                          <div className="flex justify-between text-sm" style={{ color: 'var(--color-cyber-cyan)' }}>
                            <span>📚 INT</span>
                            <span style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>
                              {selectedInventoryItem.item.int_mod > 0 ? '+' : ''}{selectedInventoryItem.item.int_mod}
                            </span>
                          </div>
                        )}
                        {selectedInventoryItem.item.cha_mod !== 0 && (
                          <div className="flex justify-between text-sm" style={{ color: 'var(--color-cyber-cyan)' }}>
                            <span>✨ CHA</span>
                            <span style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>
                              {selectedInventoryItem.item.cha_mod > 0 ? '+' : ''}{selectedInventoryItem.item.cha_mod}
                            </span>
                          </div>
                        )}
                        {(selectedInventoryItem.item.speed_mod ?? 0) !== 0 && (
                          <div className="flex justify-between text-sm" style={{ color: 'var(--color-cyber-cyan)' }}>
                            <span>⚡ Speed</span>
                            <span style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>
                              {(selectedInventoryItem.item.speed_mod ?? 0) > 0 ? '+' : ''}{selectedInventoryItem.item.speed_mod}
                            </span>
                          </div>
                        )}
                        {(selectedInventoryItem.item.init_mod ?? 0) !== 0 && (
                          <div className="flex justify-between text-sm" style={{ color: 'var(--color-cyber-cyan)' }}>
                            <span>🎲 Init</span>
                            <span style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>
                              {(selectedInventoryItem.item.init_mod ?? 0) > 0 ? '+' : ''}{selectedInventoryItem.item.init_mod}
                            </span>
                          </div>
                        )}
                        {(selectedInventoryItem.item.ic_mod ?? 0) !== 0 && (
                          <div className="flex justify-between text-sm" style={{ color: 'var(--color-cyber-cyan)' }}>
                            <span>🔧 IC</span>
                            <span style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>
                              {(selectedInventoryItem.item.ic_mod ?? 0) > 0 ? '+' : ''}{selectedInventoryItem.item.ic_mod}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Cyberware IC Cost */}
                      {selectedInventoryItem.item.type === 'cyberware' && (selectedInventoryItem.item.ic_cost ?? 0) > 0 && (
                        <div className="mb-4 p-2 rounded text-center" style={{ background: 'rgba(255, 215, 0, 0.1)', border: '1px solid var(--color-cyber-yellow)' }}>
                          <span className="text-sm" style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)' }}>
                            🔌 Requires {selectedInventoryItem.item.ic_cost} IC to equip
                          </span>
                          {!selectedInventoryItem.is_equipped && (selectedInventoryItem.item.ic_cost ?? 0) > computedStats.icRemaining && (
                            <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-magenta)' }}>
                              ⚠️ Not enough IC remaining ({computedStats.icRemaining} available)
                            </div>
                          )}
                        </div>
                      )}

                      {/* Item Abilities */}
                      {selectedInventoryItem.item.abilities && selectedInventoryItem.item.abilities.length > 0 && (
                        <div className="mb-4 p-3 rounded" style={{ background: 'rgba(189, 0, 255, 0.1)', border: '1px solid var(--color-cyber-purple)' }}>
                          <h5 className="text-sm font-bold mb-2" style={{ color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-cyber)' }}>
                            ⚡ LINKED ABILITIES
                          </h5>
                          <div className="space-y-2">
                            {selectedInventoryItem.item.abilities.map((itemAbility: any, index: number) => {
                              const ability = itemAbility.ability;
                              if (!ability) return null;
                              return (
                                <div key={ability.id || index} className="p-2 rounded" style={{ background: 'rgba(0, 0, 0, 0.3)' }}>
                                  <div className="font-bold text-sm" style={{ color: 'var(--color-cyber-cyan)' }}>
                                    {ability.name}
                                  </div>
                                  <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>
                                    {ability.type?.replace('_', ' ').toUpperCase()}
                                    {ability.damage_dice && ` • ${ability.damage_dice}`}
                                    {ability.damage_type && ` ${ability.damage_type}`}
                                    {ability.range_feet && ` • ${ability.range_feet}ft range`}
                                  </div>
                                  {ability.description && (
                                    <p className="text-xs mt-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.8 }}>
                                      {ability.description}
                                    </p>
                                  )}
                                  {ability.effects && ability.effects.length > 0 && (
                                    <ul className="mt-1 text-xs" style={{ color: 'var(--color-cyber-green)' }}>
                                      {ability.effects.map((effect: string, i: number) => (
                                        <li key={i}>• {effect}</li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Quantity & Value */}
                      <div className="flex justify-between items-center text-xs mb-4 pt-3" style={{ borderTop: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                        <div>
                          <span className="opacity-70">Quantity:</span>
                          <span className="ml-2">{selectedInventoryItem.quantity}</span>
                        </div>
                        <div>
                          <span className="opacity-70">Value:</span>
                          <span className="ml-2">${selectedInventoryItem.item.price?.toLocaleString() || 0}</span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        {/* Equip Button */}
                        {selectedInventoryItem.item.is_equippable && (
                          <button
                            onClick={() => toggleEquipItem(selectedInventoryItem.id, selectedInventoryItem.is_equipped)}
                            className="flex-1 py-2 rounded font-bold text-sm transition-all"
                            style={{
                              background: selectedInventoryItem.is_equipped ? 'transparent' : 'var(--color-cyber-yellow)',
                              color: selectedInventoryItem.is_equipped ? 'var(--color-cyber-cyan)' : '#0D1117',
                              border: `2px solid ${selectedInventoryItem.is_equipped ? 'var(--color-cyber-cyan)' : 'var(--color-cyber-yellow)'}`,
                              fontFamily: 'var(--font-cyber)'
                            }}
                          >
                            {selectedInventoryItem.is_equipped ? 'UNEQUIP' : 'EQUIP'}
                          </button>
                        )}
                        
                        {/* Consume Button */}
                        {selectedInventoryItem.item.is_consumable && (
                          <button
                            onClick={() => consumeItem(selectedInventoryItem.id, selectedInventoryItem.item, selectedInventoryItem.quantity)}
                            className="flex-1 py-2 rounded font-bold text-sm transition-all"
                            style={{
                              background: 'var(--color-cyber-magenta)',
                              color: '#0D1117',
                              border: '2px solid var(--color-cyber-magenta)',
                              fontFamily: 'var(--font-cyber)'
                            }}
                          >
                            🍴 CONSUME
                          </button>
                        )}
                      </div>
                      
                      {/* Consumable Effect Info */}
                      {selectedInventoryItem.item.is_consumable && selectedInventoryItem.item.hp_mod !== 0 && (
                        <div className="mt-2 text-xs text-center" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>
                          {selectedInventoryItem.item.hp_mod_type === 'max_hp' 
                            ? `Permanently ${selectedInventoryItem.item.hp_mod > 0 ? 'increases' : 'decreases'} Max HP`
                            : `${selectedInventoryItem.item.hp_mod > 0 ? 'Heals' : 'Damages'} ${Math.abs(selectedInventoryItem.item.hp_mod)} HP`
                          }
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                        Select an item to view details
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
