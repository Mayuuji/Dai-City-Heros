import { useAuth } from '../contexts/AuthContext';
import { useCampaign } from '../contexts/CampaignContext';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { CHARACTER_CLASSES } from '../data/characterClasses';
import { useClassAliases } from '../utils/useClassAliases';
import type { InventoryItem, Ability, EquipmentSlot, ItemSlotType } from '../types/inventory';
import type { MissionWithDetails, MissionStatus } from '../types/mission';
import type { StorageContainer, StorageItem } from '../types/storage';
import PlayerEffectsOverlay from '../components/PlayerEffectsOverlay';

// Sub-components
import StatsPanel from '../components/player/StatsPanel';
import EquipmentPanel from '../components/player/EquipmentPanel';
import InventoryPanel from '../components/player/InventoryPanel';
import AbilitiesModal from '../components/player/AbilitiesModal';
import MissionsModal from '../components/player/MissionsModal';
import StorageModal from '../components/player/StorageModal';

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
  temp_hp: number;
  ac: number;
  cdd: string;
  str: number; dex: number; con: number; wis: number; int: number; cha: number;
  usd: number;
  speed: number;
  initiative_modifier: number;
  implant_capacity: number;
  save_proficiencies: string[];
  tools: string[];
  class_features: any[];
  portrait_url?: string;
  carrying_capacity?: number;
  base_carrying_capacity?: number;
  weapon_rank_unarmed: number;
  weapon_rank_melee: number;
  weapon_rank_sidearms: number;
  weapon_rank_longarms: number;
  weapon_rank_heavy: number;
  skill_acrobatics: number; skill_animal_handling: number; skill_athletics: number;
  skill_biology: number; skill_deception: number; skill_hacking: number;
  skill_history: number; skill_insight: number; skill_intimidation: number;
  skill_investigation: number; skill_medicine: number; skill_nature: number;
  skill_perception: number; skill_performance: number; skill_persuasion: number;
  skill_sleight_of_hand: number; skill_stealth: number; skill_survival: number;
}

export default function PlayerDashboard() {
  const { user, profile, signOut } = useAuth();
  const { campaignId } = useCampaign();
  const navigate = useNavigate();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [abilities, setAbilities] = useState<Ability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Inventory state
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryTypeFilter, setInventoryTypeFilter] = useState<string>('all');
  const [inventoryRarityFilter, setInventoryRarityFilter] = useState<string>('all');
  const [inventorySort, setInventorySort] = useState<'name' | 'type' | 'rarity' | 'equipped'>('equipped');
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryItem | null>(null);
  const [inventoryViewMode, setInventoryViewMode] = useState<'grid' | 'list'>('grid');

  // Missions state
  const [missions, setMissions] = useState<MissionWithDetails[]>([]);
  const [missionFilter, setMissionFilter] = useState<MissionStatus | 'all'>('active');
  const [selectedMission, setSelectedMission] = useState<MissionWithDetails | null>(null);

  // Player Lock state
  const [playersLocked, setPlayersLocked] = useState(false);
  const [lockReason, setLockReason] = useState<string | null>(null);

  // Slot selection modal
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [slotModalItem, setSlotModalItem] = useState<InventoryItem | null>(null);
  const [availableSlots, setAvailableSlots] = useState<EquipmentSlot[]>([]);

  // Weight system
  const [weightSystemEnabled, setWeightSystemEnabled] = useState(false);

  // Storage
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [storageContainers, setStorageContainers] = useState<StorageContainer[]>([]);
  const [storageItems, setStorageItems] = useState<StorageItem[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<StorageContainer | null>(null);
  const [storeItemId, setStoreItemId] = useState<string | null>(null);
  const [storeQuantity, setStoreQuantity] = useState(1);

  // Bottom nav overlay modals
  const [showAbilitiesModal, setShowAbilitiesModal] = useState(false);
  const [showMissionsModal, setShowMissionsModal] = useState(false);

  // Equipment slot filter (when clicking empty slot in EquipmentPanel)
  const [slotFilter, setSlotFilter] = useState<EquipmentSlot | null>(null);

  // Computed stats
  const [computedStats, setComputedStats] = useState({
    hp: 0, ac: 0,
    str: 0, dex: 0, con: 0, wis: 0, int: 0, cha: 0,
    speed: 30, init: 0, ic: 3,
    skills: {} as Record<string, number>,
    hasArmorPenalty: false,
    equippedArmorCount: 0,
    equippedWeaponCount: 0,
    icUsed: 0,
    icRemaining: 3
  });

  // ============================================================
  // EFFECTS
  // ============================================================

  useEffect(() => {
    if (user) {
      fetchCharacters();
      supabase
        .from('game_settings')
        .select('value')
        .eq('campaign_id', campaignId)
        .eq('key', 'weight_system_enabled')
        .single()
        .then(({ data }) => {
          if (data?.value) setWeightSystemEnabled(data.value.enabled || false);
        });
    }
  }, [user]);

  useEffect(() => {
    if (selectedCharacter) {
      fetchInventory(selectedCharacter.id);
      fetchAbilities(selectedCharacter.id);
    }
  }, [selectedCharacter?.id]);

  // Real-time: character updates
  useEffect(() => {
    if (!selectedCharacter) return;
    const channel = supabase
      .channel(`character-${selectedCharacter.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'characters', filter: `id=eq.${selectedCharacter.id}` },
        (payload) => {
          setSelectedCharacter(prev => prev ? { ...prev, ...payload.new } : null);
          setCharacters(prev => prev.map(c => c.id === selectedCharacter.id ? { ...c, ...payload.new } : c));
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedCharacter?.id]);

  // Real-time: inventory
  useEffect(() => {
    if (!selectedCharacter) return;
    const ch = supabase
      .channel(`inventory-${selectedCharacter.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory', filter: `character_id=eq.${selectedCharacter.id}` },
        () => { fetchInventory(selectedCharacter.id); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selectedCharacter?.id]);

  // Real-time: items updates
  useEffect(() => {
    if (!selectedCharacter) return;
    const ch = supabase
      .channel(`items-updates-${selectedCharacter.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'items' },
        () => { fetchInventory(selectedCharacter.id); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selectedCharacter?.id]);

  // Real-time: abilities
  useEffect(() => {
    if (!selectedCharacter) return;
    const ch = supabase
      .channel(`abilities-${selectedCharacter.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'character_abilities', filter: `character_id=eq.${selectedCharacter.id}` },
        () => { fetchAbilities(selectedCharacter.id); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selectedCharacter?.id]);

  // Real-time: storage containers
  useEffect(() => {
    const ch = supabase
      .channel('storage-containers-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'storage_containers', filter: `campaign_id=eq.${campaignId}` },
        () => { fetchStorageContainers(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [campaignId]);

  // Real-time: player lock
  useEffect(() => {
    const fetchLockStatus = async () => {
      const { data } = await supabase
        .from('game_settings').select('value')
        .eq('campaign_id', campaignId).eq('key', 'players_locked').single();
      if (data) {
        setPlayersLocked(data.value?.locked || false);
        setLockReason(data.value?.reason || null);
      }
    };
    fetchLockStatus();
    const sub = supabase
      .channel('player_lock_status')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_settings', filter: `campaign_id=eq.${campaignId}` },
        (payload) => {
          if (payload.new && (payload.new as any).key === 'players_locked') {
            const val = (payload.new as any).value;
            setPlayersLocked(val?.locked || false);
            setLockReason(val?.reason || null);
          }
        })
      .subscribe();
    return () => { sub.unsubscribe(); };
  }, []);

  // Fetch missions when modal opens
  useEffect(() => {
    if (showMissionsModal && selectedCharacter) fetchMissions();
  }, [showMissionsModal, selectedCharacter?.id]);

  // Recalculate stats
  useEffect(() => {
    if (selectedCharacter) calculateComputedStats();
  }, [selectedCharacter, inventory]);

  // ============================================================
  // STAT CALCULATION
  // ============================================================

  const calculateComputedStats = () => {
    if (!selectedCharacter) return;
    const characterClass = CHARACTER_CLASSES.find(c => c.id === selectedCharacter.class);
    const armorProficiencies = characterClass?.armorProficiencies || ['clothes', 'light'];

    let totalAcMod = 0, totalHpMod = 0;
    let totalStrMod = 0, totalDexMod = 0, totalConMod = 0;
    let totalWisMod = 0, totalIntMod = 0, totalChaMod = 0;
    let totalSpeedMod = 0, totalInitMod = 0, totalIcMod = 0;
    const skillMods: Record<string, number> = {};
    let hasNonProficientArmor = false;
    let armorCount = 0, weaponCount = 0, cyberwareIcUsed = 0;

    inventory.filter(inv => inv.is_equipped && inv.item).forEach(inv => {
      const item = inv.item!;
      if (item.type === 'armor') {
        armorCount++;
        if (item.armor_subtype && !armorProficiencies.includes(item.armor_subtype as any)) hasNonProficientArmor = true;
      }
      if (item.type === 'weapon') weaponCount++;
      if (item.type === 'cyberware') cyberwareIcUsed += item.ic_cost || 0;

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

      if (item.skill_mods) {
        Object.entries(item.skill_mods).forEach(([skill, bonus]) => {
          skillMods[skill] = (skillMods[skill] || 0) + bonus;
        });
      }
    });

    if (hasNonProficientArmor) { totalAcMod -= 2; totalSpeedMod -= 10; }
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

  // ============================================================
  // DATA FETCHING
  // ============================================================

  const fetchCharacters = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('characters').select('*')
        .eq('campaign_id', campaignId).eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      if (fetchError) throw fetchError;
      setCharacters(data || []);
      if (data && data.length > 0) setSelectedCharacter(data[0]);
    } catch (err: any) {
      console.error('Error fetching characters:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchInventory = async (characterId: string) => {
    try {
      const { data, error: invError } = await supabase
        .from('inventory')
        .select(`*, item:items(*, abilities:item_abilities(ability:abilities(*)))`)
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
      const { data: charAbilities, error: abilitiesError } = await supabase
        .from('character_abilities')
        .select(`*, ability:abilities(*)`)
        .eq('character_id', characterId);
      if (abilitiesError) throw abilitiesError;

      const characterAbilitiesList = (charAbilities || [])
        .filter((ca: any) => ca.source_type !== 'item')
        .map((ca: any) => ({
          ...ca.ability,
          current_charges: ca.current_charges,
          source: (ca.ability?.source === 'class' ? 'class' : 'character') as any
        }));

      const grantedAbilityIds = new Set(
        (charAbilities || []).filter((ca: any) => ca.source_type !== 'item').map((ca: any) => ca.ability_id).filter(Boolean)
      );
      const grantedAbilityNames = new Set(characterAbilitiesList.map((a: any) => a.name).filter(Boolean));

      const { data: equippedItems, error: itemsError } = await supabase
        .from('inventory')
        .select(`*, item:items(*, abilities:item_abilities(requires_equipped, ability:abilities(*)))`)
        .eq('character_id', characterId).eq('is_equipped', true);
      if (itemsError) throw itemsError;

      const itemAbilitiesList: Ability[] = [];
      equippedItems?.forEach(invItem => {
        invItem.item?.abilities?.forEach((itemAbility: any) => {
          if (itemAbility.ability && !grantedAbilityIds.has(itemAbility.ability.id)) {
            grantedAbilityIds.add(itemAbility.ability.id);
            grantedAbilityNames.add(itemAbility.ability.name);
            itemAbilitiesList.push({ ...itemAbility.ability, source: 'item' as const, item_name: invItem.item.name });
          }
        });
      });

      const classFeatures: Ability[] = [];
      if (selectedCharacter?.class_features && Array.isArray(selectedCharacter.class_features)) {
        selectedCharacter.class_features.forEach((feature: any) => {
          if (grantedAbilityNames.has(feature.name)) return;
          classFeatures.push({
            id: `class_feature_${feature.name}`, name: feature.name,
            description: feature.description || '', type: feature.type || 'passive',
            charge_type: feature.charges ? 'uses' : 'infinite',
            max_charges: feature.charges || null, charges_per_rest: feature.charges || null,
            effects: feature.effects || [], damage_dice: feature.damage_dice || null,
            damage_type: feature.damage_type || null, range_feet: feature.range_feet || null,
            area_of_effect: feature.area_of_effect || null, duration: feature.duration || null,
            created_at: new Date().toISOString(),
            current_charges: feature.charges || undefined, source: 'class' as const
          });
        });
      }

      setAbilities([...characterAbilitiesList, ...classFeatures, ...itemAbilitiesList]);
    } catch (err: any) {
      console.error('Error fetching abilities:', err);
    }
  };

  const fetchMissions = async () => {
    if (!selectedCharacter) return;
    try {
      const { data, error: missionsError } = await supabase
        .from('missions').select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false });
      if (missionsError) throw missionsError;
      const characterIds = characters.map(c => c.id);
      setMissions((data || []).filter(m =>
        m.assigned_to === null || m.assigned_to?.some((id: string) => characterIds.includes(id))
      ));
    } catch (err: any) {
      console.error('Error fetching missions:', err);
    }
  };

  const fetchStorageContainers = async () => {
    const { data } = await supabase
      .from('storage_containers').select('*')
      .eq('campaign_id', campaignId).order('created_at', { ascending: true });
    if (data) setStorageContainers(data);
  };

  const fetchContainerItems = async (containerId: string) => {
    const { data } = await supabase
      .from('storage_items').select('*, item:items(*)')
      .eq('container_id', containerId);
    if (data) setStorageItems(data);
  };

  // ============================================================
  // EQUIPMENT HELPERS
  // ============================================================

  const getSlotsForType = (slotType: ItemSlotType): EquipmentSlot[] => {
    switch (slotType) {
      case 'weapon': return ['weapon_primary', 'weapon_secondary'];
      case 'head': return ['head'];
      case 'chest': return ['chest'];
      case 'legs': return ['legs'];
      case 'eyewear': return ['eyewear'];
      case 'gloves': return ['gloves'];
      case 'shoes': return ['shoes'];
      case 'accessory': return ['accessory_1', 'accessory_2'];
      default: return [];
    }
  };

  const getSlotLabel = (slot: EquipmentSlot): string => {
    const labels: Record<EquipmentSlot, string> = {
      head: '🎩 Head', chest: '🛡️ Chest', legs: '👖 Legs',
      eyewear: '👓 Eyewear', gloves: '🧤 Gloves', shoes: '👟 Shoes',
      accessory_1: '💍 Accessory 1', accessory_2: '💍 Accessory 2',
      weapon_primary: '⚔️ Primary Weapon', weapon_secondary: '🗡️ Secondary Weapon'
    };
    return labels[slot] || slot;
  };

  const equipInSlot = async (inventoryItemId: string, slot: EquipmentSlot | null) => {
    if (!selectedCharacter) return;
    if (slot) {
      const occupant = inventory.find(inv => inv.is_equipped && inv.equipped_slot === slot && inv.id !== inventoryItemId);
      if (occupant) {
        const { error: unequipError } = await supabase.from('inventory').update({ is_equipped: false, equipped_slot: null }).eq('id', occupant.id);
        if (unequipError) throw unequipError;
      }
    }
    const { error: updateError } = await supabase.from('inventory').update({ is_equipped: true, equipped_slot: slot }).eq('id', inventoryItemId);
    if (updateError) throw updateError;
    if (selectedInventoryItem && selectedInventoryItem.id === inventoryItemId) {
      setSelectedInventoryItem({ ...selectedInventoryItem, is_equipped: true, equipped_slot: slot });
    }
    await fetchInventory(selectedCharacter.id);
    await fetchAbilities(selectedCharacter.id);
  };

  const toggleEquipItem = async (inventoryItemId: string, currentlyEquipped: boolean) => {
    if (!selectedCharacter) return;
    if (playersLocked) { alert(`Actions locked: ${lockReason || 'DM has locked player actions'}`); return; }

    const inventoryItem = inventory.find(inv => inv.id === inventoryItemId);
    if (!inventoryItem?.item) return;
    const item = inventoryItem.item;

    // UNEQUIP
    if (currentlyEquipped) {
      try {
        const { error: updateError } = await supabase.from('inventory').update({ is_equipped: false, equipped_slot: null }).eq('id', inventoryItemId);
        if (updateError) throw updateError;
        if (selectedInventoryItem && selectedInventoryItem.id === inventoryItemId)
          setSelectedInventoryItem({ ...selectedInventoryItem, is_equipped: false, equipped_slot: null });
        await fetchInventory(selectedCharacter.id);
        await fetchAbilities(selectedCharacter.id);
      } catch (err: any) {
        console.error('Error unequipping:', err);
        alert('Failed to unequip: ' + err.message);
      }
      return;
    }

    // EQUIP — limits
    if (item.type === 'armor' && computedStats.equippedArmorCount >= 1) { alert('Max 1 armor equipped.'); return; }
    if (item.type === 'weapon' && computedStats.equippedWeaponCount >= 3) { alert('Max 3 weapons equipped.'); return; }
    if (item.type === 'cyberware') {
      const icCost = item.ic_cost || 0;
      if (icCost > computedStats.icRemaining) { alert(`Not enough IC. Need ${icCost}, have ${computedStats.icRemaining}.`); return; }
    }

    const slotType = item.slot_type as ItemSlotType;
    if (slotType && slotType !== 'backpack' && slotType !== 'weapon_mod') {
      const validSlots = getSlotsForType(slotType);
      if (validSlots.length === 1) {
        try {
          const occupant = inventory.find(inv => inv.is_equipped && inv.equipped_slot === validSlots[0]);
          if (occupant && !confirm(`Replace ${occupant.item?.name || 'current item'} in ${getSlotLabel(validSlots[0])}?`)) return;
          await equipInSlot(inventoryItemId, validSlots[0]);
        } catch (err: any) { alert('Failed to equip: ' + err.message); }
      } else {
        setSlotModalItem(inventoryItem);
        setAvailableSlots(validSlots);
        setShowSlotModal(true);
      }
      return;
    }

    try { await equipInSlot(inventoryItemId, null); }
    catch (err: any) { alert('Failed to equip: ' + err.message); }
  };

  // ============================================================
  // STORAGE ACTIONS
  // ============================================================

  const storeItemInContainer = async (containerId: string) => {
    if (!storeItemId || !selectedCharacter) return;
    const invItem = inventory.find(inv => inv.id === storeItemId);
    if (!invItem?.item) return;
    const qty = Math.min(storeQuantity, invItem.quantity);
    try {
      const existing = storageItems.find(si => si.item_id === invItem.item_id && si.container_id === containerId);
      if (existing) {
        await supabase.from('storage_items').update({ quantity: existing.quantity + qty }).eq('id', existing.id);
      } else {
        await supabase.from('storage_items').insert({ campaign_id: campaignId, container_id: containerId, item_id: invItem.item_id, quantity: qty, stored_by: profile?.id });
      }
      if (invItem.quantity <= qty) { await supabase.from('inventory').delete().eq('id', invItem.id); }
      else { await supabase.from('inventory').update({ quantity: invItem.quantity - qty }).eq('id', invItem.id); }
      setStoreItemId(null); setStoreQuantity(1);
      await fetchInventory(selectedCharacter.id);
      await fetchContainerItems(containerId);
    } catch (err: any) { alert(`Error: ${err.message}`); }
  };

  const retrieveItemFromContainer = async (storageItem: StorageItem, qty: number) => {
    if (!selectedCharacter) return;
    const actualQty = Math.min(qty, storageItem.quantity);
    try {
      const existingInv = inventory.find(inv => inv.item_id === storageItem.item_id);
      if (existingInv) { await supabase.from('inventory').update({ quantity: existingInv.quantity + actualQty }).eq('id', existingInv.id); }
      else { await supabase.from('inventory').insert({ character_id: selectedCharacter.id, item_id: storageItem.item_id, quantity: actualQty, campaign_id: campaignId }); }
      if (storageItem.quantity <= actualQty) { await supabase.from('storage_items').delete().eq('id', storageItem.id); }
      else { await supabase.from('storage_items').update({ quantity: storageItem.quantity - actualQty }).eq('id', storageItem.id); }
      await fetchInventory(selectedCharacter.id);
      if (selectedContainer) await fetchContainerItems(selectedContainer.id);
    } catch (err: any) { alert(`Error: ${err.message}`); }
  };

  // ============================================================
  // CONSUME ITEM
  // ============================================================

  const consumeItem = async (inventoryItemId: string, item: any, quantity: number) => {
    if (!selectedCharacter || !item) return;
    if (playersLocked) { alert(`Actions locked: ${lockReason || 'DM has locked player actions'}`); return; }
    if (!item.is_consumable) { alert('This item cannot be consumed'); return; }
    if (!confirm(`Consume ${item.name}? Effects applied permanently.`)) return;

    try {
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

      if (item.hp_mod && item.hp_mod !== 0) {
        const hpModType = item.hp_mod_type || 'heal';
        if (hpModType === 'heal') {
          updates.current_hp = Math.min(selectedCharacter.current_hp + item.hp_mod, selectedCharacter.max_hp);
        } else if (hpModType === 'max_hp') {
          updates.max_hp = selectedCharacter.max_hp + item.hp_mod;
          updates.current_hp = selectedCharacter.current_hp + item.hp_mod;
        }
      }

      if (item.skill_mods && typeof item.skill_mods === 'object') {
        for (const [skillName, modifier] of Object.entries(item.skill_mods)) {
          if (typeof modifier === 'number' && modifier !== 0) {
            const columnName = skillToColumn(skillName);
            const currentValue = (selectedCharacter as any)[columnName] || 0;
            updates[columnName] = currentValue + modifier;
          }
        }
      }

      const { error: charError } = await supabase.from('characters').update(updates).eq('id', selectedCharacter.id).select();
      if (charError) throw charError;

      if (quantity > 1) {
        const { error: invError } = await supabase.from('inventory').update({ quantity: quantity - 1 }).eq('id', inventoryItemId);
        if (invError) throw invError;
      } else {
        const { error: invError } = await supabase.from('inventory').delete().eq('id', inventoryItemId);
        if (invError) throw invError;
      }

      setSelectedInventoryItem(null);
      const { data: updatedChar } = await supabase.from('characters').select('*').eq('id', selectedCharacter.id).single();
      if (updatedChar) {
        setSelectedCharacter(updatedChar);
        setCharacters(prev => prev.map(c => c.id === updatedChar.id ? updatedChar : c));
      }
      await fetchInventory(selectedCharacter.id);

      const effects: string[] = [];
      if (item.str_mod) effects.push(`STR ${item.str_mod > 0 ? '+' : ''}${item.str_mod}`);
      if (item.dex_mod) effects.push(`DEX ${item.dex_mod > 0 ? '+' : ''}${item.dex_mod}`);
      if (item.con_mod) effects.push(`CON ${item.con_mod > 0 ? '+' : ''}${item.con_mod}`);
      if (item.wis_mod) effects.push(`WIS ${item.wis_mod > 0 ? '+' : ''}${item.wis_mod}`);
      if (item.int_mod) effects.push(`INT ${item.int_mod > 0 ? '+' : ''}${item.int_mod}`);
      if (item.cha_mod) effects.push(`CHA ${item.cha_mod > 0 ? '+' : ''}${item.cha_mod}`);
      if (item.hp_mod) effects.push(`${item.hp_mod_type === 'max_hp' ? 'Max HP' : 'HP'} ${item.hp_mod > 0 ? '+' : ''}${item.hp_mod}`);
      if (item.ac_mod) effects.push(`AC ${item.ac_mod > 0 ? '+' : ''}${item.ac_mod}`);
      const effectSummary = effects.length > 0 ? `\n\nApplied: ${effects.join(', ')}` : '';
      alert(`${item.name} consumed!${effectSummary}`);
    } catch (err: any) {
      console.error('Error consuming:', err);
      alert('Failed to consume: ' + err.message);
    }
  };

  // ============================================================
  // MISC
  // ============================================================

  const handleSignOut = async () => { await signOut(); navigate('/login'); };
  const { getClassName } = useClassAliases(campaignId);

  const refreshCharacter = async () => {
    if (!selectedCharacter) return;
    const { data } = await supabase.from('characters').select('*').eq('id', selectedCharacter.id).single();
    if (data) {
      setSelectedCharacter(data);
      setCharacters(prev => prev.map(c => c.id === data.id ? data : c));
    }
  };

  // Rarity sort order
  const rarityOrder: Record<string, number> = {
    'Common': 1, 'Uncommon': 2, 'Rare': 3, 'Epic': 4, 'Mythic': 5, 'Ultra Rare': 6, 'MISSION ITEM': 7
  };

  // Filtered and sorted inventory (with optional slot filter from EquipmentPanel)
  const filteredInventory = inventory
    .filter(inv => {
      if (!inv.item) return false;
      const item = inv.item;
      if (inventorySearch) {
        const s = inventorySearch.toLowerCase();
        if (!item.name.toLowerCase().includes(s) && !item.description?.toLowerCase().includes(s)) return false;
      }
      if (inventoryTypeFilter !== 'all' && item.type !== inventoryTypeFilter) return false;
      if (inventoryRarityFilter !== 'all' && item.rarity !== inventoryRarityFilter) return false;
      // Slot filter: show items that can go in the selected slot
      if (slotFilter) {
        const itemSlotType = item.slot_type as ItemSlotType;
        if (!itemSlotType) return false;
        const validSlots = getSlotsForType(itemSlotType);
        if (!validSlots.includes(slotFilter)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const itemA = a.item!; const itemB = b.item!;
      switch (inventorySort) {
        case 'name': return itemA.name.localeCompare(itemB.name);
        case 'type': return itemA.type.localeCompare(itemB.type);
        case 'rarity': return (rarityOrder[itemB.rarity] || 0) - (rarityOrder[itemA.rarity] || 0);
        default:
          if (a.is_equipped !== b.is_equipped) return a.is_equipped ? -1 : 1;
          return (rarityOrder[itemB.rarity] || 0) - (rarityOrder[itemA.rarity] || 0);
      }
    });

  // Equipped gear for abilities modal
  const equippedGear = inventory.filter(inv => inv.is_equipped && inv.item && (inv.item.type === 'weapon' || inv.item.type === 'armor' || inv.item.type === 'cyberware'));

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, var(--color-cyber-dark) 0%, var(--color-cyber-darker) 50%, var(--color-cyber-dark) 100%)', backgroundAttachment: 'fixed' }}>
      {/* Screen Effects */}
      <PlayerEffectsOverlay characterId={selectedCharacter?.id || null} campaignId={campaignId ?? undefined} />

      {/* HEADER */}
      <div className="glass-panel neon-border flex-shrink-0" style={{ borderRadius: 0 }}>
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h1 className="text-xl neon-text" style={{ fontFamily: 'var(--font-cyber)' }}>PLAYER TERMINAL</h1>
            {playersLocked && (
              <div className="px-2 py-1 rounded flex items-center gap-1 animate-pulse text-xs"
                style={{ background: 'rgba(255, 0, 127, 0.2)', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}
                title={lockReason || 'Locked'}>
                🔒 {lockReason || 'LOCKED'}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Character selector */}
            {characters.length > 1 && (
              <select
                value={selectedCharacter?.id || ''}
                onChange={(e) => { const c = characters.find(ch => ch.id === e.target.value); setSelectedCharacter(c || null); }}
                className="px-2 py-1 rounded text-xs"
                style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}
              >
                {characters.map(c => <option key={c.id} value={c.id}>{c.name} – Lv{c.level} {getClassName(c.class)}</option>)}
              </select>
            )}
            <button onClick={() => navigate('/rules')} className="text-xs px-2 py-1 rounded" style={{ border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>📜 RULES</button>
            <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{profile?.username || 'PLAYER'}</span>
            <button onClick={handleSignOut} className="neon-button-magenta text-xs">LOGOUT</button>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin w-12 h-12 border-4 rounded-full mx-auto mb-4" style={{ borderColor: 'color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)', borderTopColor: 'var(--color-cyber-cyan)' }} />
              <p style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>Loading...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="glass-panel p-6" style={{ border: '1px solid var(--color-cyber-pink)' }}>
              <p style={{ color: 'var(--color-cyber-pink)', fontFamily: 'var(--font-mono)' }}>Error: {error}</p>
            </div>
          </div>
        ) : !selectedCharacter ? (
          <div className="flex items-center justify-center h-full">
            <div className="glass-panel p-12 text-center">
              <h3 className="text-2xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>NO CHARACTER FOUND</h3>
              <p className="mb-6" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>Create your first character to begin</p>
              <button onClick={() => navigate('/character/create')} className="neon-button" style={{ fontFamily: 'var(--font-cyber)' }}>CREATE CHARACTER</button>
            </div>
          </div>
        ) : (
          /* THREE-PANEL LAYOUT */
          <div
            className="h-full p-2 lg:p-4"
            style={{
              display: 'grid',
              gridTemplateColumns: 'clamp(200px, 20vw, 280px) 1fr clamp(280px, 30vw, 400px)',
              gap: '12px'
            }}
          >
            {/* LEFT PANEL — Stats */}
            <div className="glass-panel p-2 overflow-y-auto overflow-x-hidden" style={{ border: '1px solid var(--color-cyber-green)' }}>
              <StatsPanel character={selectedCharacter} computedStats={computedStats} campaignId={campaignId} />
            </div>

            {/* CENTER PANEL — Character & Equipment */}
            <div className="glass-panel p-2 overflow-y-auto flex flex-col" style={{ border: '1px solid var(--color-cyber-green)' }}>
              <EquipmentPanel
                character={selectedCharacter}
                inventory={inventory}
                weightSystemEnabled={weightSystemEnabled}
                onSlotClick={(slot) => { setSlotFilter(slot); }}
                onItemClick={(item) => { setSelectedInventoryItem(item); }}
                onRefreshCharacter={refreshCharacter}
              />
            </div>

            {/* RIGHT PANEL — Inventory */}
            <div className="glass-panel p-2 overflow-y-auto flex flex-col" style={{ border: '1px solid var(--color-cyber-green)' }}>
              <InventoryPanel
                character={selectedCharacter}
                inventory={inventory}
                computedStats={computedStats}
                filteredInventory={filteredInventory}
                inventorySearch={inventorySearch}
                setInventorySearch={setInventorySearch}
                inventoryTypeFilter={inventoryTypeFilter}
                setInventoryTypeFilter={setInventoryTypeFilter}
                inventoryRarityFilter={inventoryRarityFilter}
                setInventoryRarityFilter={setInventoryRarityFilter}
                inventorySort={inventorySort}
                setInventorySort={setInventorySort}
                inventoryViewMode={inventoryViewMode}
                setInventoryViewMode={setInventoryViewMode}
                selectedInventoryItem={selectedInventoryItem}
                setSelectedInventoryItem={setSelectedInventoryItem}
                onEquipToggle={toggleEquipItem}
                onConsume={consumeItem}
                getSlotLabel={getSlotLabel}
                slotFilter={slotFilter}
                onClearSlotFilter={() => setSlotFilter(null)}
              />
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM NAVIGATION BAR */}
      {selectedCharacter && !loading && !error && (
        <div className="flex-shrink-0 glass-panel neon-border" style={{ borderRadius: 0 }}>
          <div className="container mx-auto px-4 py-2 flex justify-center gap-3">
            <button
              onClick={() => setShowAbilitiesModal(true)}
              className="px-4 py-2 rounded text-sm font-bold transition-all hover:scale-105"
              style={{ background: 'transparent', color: 'var(--color-cyber-cyan)', border: '1px solid var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}
            >
              ⚡ Abilities
            </button>
            <button
              onClick={() => setShowMissionsModal(true)}
              className="px-4 py-2 rounded text-sm font-bold transition-all hover:scale-105"
              style={{ background: 'transparent', color: 'var(--color-cyber-yellow)', border: '1px solid var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)' }}
            >
              📋 Missions
            </button>
            <button
              onClick={() => { setShowStorageModal(true); fetchStorageContainers(); }}
              className="px-4 py-2 rounded text-sm font-bold transition-all hover:scale-105"
              style={{ background: 'transparent', color: 'var(--color-cyber-green)', border: '1px solid var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}
            >
              📦 Storage
            </button>
            <button
              onClick={() => navigate('/encounter')}
              className="px-4 py-2 rounded text-sm font-bold transition-all hover:scale-105"
              style={{ background: 'transparent', color: 'var(--color-cyber-magenta)', border: '1px solid var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}
            >
              ⚔️ Combat
            </button>
          </div>
        </div>
      )}

      {/* OVERLAY MODALS */}
      <AbilitiesModal
        isOpen={showAbilitiesModal}
        onClose={() => setShowAbilitiesModal(false)}
        abilities={abilities}
        equippedGear={equippedGear}
        character={selectedCharacter || {}}
      />

      <MissionsModal
        isOpen={showMissionsModal}
        onClose={() => setShowMissionsModal(false)}
        missions={missions}
        missionFilter={missionFilter}
        setMissionFilter={setMissionFilter}
        selectedMission={selectedMission}
        setSelectedMission={setSelectedMission}
      />

      <StorageModal
        isOpen={showStorageModal}
        onClose={() => { setShowStorageModal(false); setSelectedContainer(null); setStorageItems([]); setStoreItemId(null); }}
        storageContainers={storageContainers}
        storageItems={storageItems}
        selectedContainer={selectedContainer}
        setSelectedContainer={setSelectedContainer}
        onSelectContainer={(c) => { setSelectedContainer(c); fetchContainerItems(c.id); }}
        inventory={inventory}
        storeItemId={storeItemId}
        setStoreItemId={setStoreItemId}
        storeQuantity={storeQuantity}
        setStoreQuantity={setStoreQuantity}
        onStoreItem={storeItemInContainer}
        onRetrieveItem={retrieveItemFromContainer}
      />

      {/* Slot Selection Modal */}
      {showSlotModal && slotModalItem && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="rounded-lg p-6 max-w-sm w-full" style={{ background: 'var(--color-dark-bg)', border: '2px solid var(--color-cyber-cyan)', boxShadow: '0 0 30px rgba(0, 255, 255, 0.2)' }}>
            <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>Choose Equipment Slot</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
              Equipping: <span style={{ color: 'var(--color-cyber-yellow)' }}>{slotModalItem.item?.name}</span>
            </p>
            <div className="space-y-2">
              {availableSlots.map(slot => {
                const occupant = inventory.find(inv => inv.is_equipped && inv.equipped_slot === slot);
                return (
                  <button key={slot} onClick={async () => {
                    try {
                      if (occupant && !confirm(`Replace ${occupant.item?.name || 'current item'} in ${getSlotLabel(slot)}?`)) return;
                      await equipInSlot(slotModalItem.id, slot);
                    } catch (err: any) { alert('Failed: ' + err.message); }
                    setShowSlotModal(false); setSlotModalItem(null);
                  }}
                    className="w-full p-3 rounded text-left transition-all hover:opacity-80"
                    style={{ background: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)', border: `1px solid ${occupant ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-cyan)'}`, color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                    <div className="flex justify-between items-center">
                      <span>{getSlotLabel(slot)}</span>
                      {occupant ? <span className="text-xs" style={{ color: 'var(--color-cyber-yellow)' }}>⚠️ {occupant.item?.name}</span> : <span className="text-xs opacity-50">Empty</span>}
                    </div>
                  </button>
                );
              })}
            </div>
            <button onClick={() => { setShowSlotModal(false); setSlotModalItem(null); }} className="w-full mt-4 py-2 rounded text-sm"
              style={{ border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
