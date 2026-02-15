import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { InventoryItem, Item, ItemType, ItemRarity, Ability, AbilityType, ChargeType } from '../types/inventory';
import type { Location, LocationIcon, LocationColor } from '../types/map';
import type { NPC, NPCType, NPCDisposition, NPCAbility } from '../types/npc';
import type { Shop, ShopInventoryItemWithDetails } from '../types/shop';
import type { MissionWithDetails, MissionType, MissionDifficulty, MissionStatus, RewardMode } from '../types/mission';
import { getRarityColor, getRarityBgColor, getItemTypeIcon, formatModifier, getAbilityTypeIcon } from '../utils/stats';
import { ALL_SKILLS, CHARACTER_CLASSES, formatToHit, WeaponType } from '../data/characterClasses';
import { getLocationIcon, getLocationColor, ALL_LOCATION_ICONS, ALL_LOCATION_COLORS } from '../utils/mapUtils';
import WorldMap from '../components/WorldMap';

// Weapon types for rank editing
const WEAPON_TYPES: { key: WeaponType; label: string; icon: string }[] = [
  { key: 'unarmed', label: 'Unarmed', icon: '👊' },
  { key: 'melee', label: 'Melee', icon: '🗡️' },
  { key: 'sidearms', label: 'Sidearms', icon: '🔫' },
  { key: 'longarms', label: 'Longarms', icon: '🎯' },
  { key: 'heavy', label: 'Heavy', icon: '💥' },
];

interface Character {
  id: string;
  user_id: string;
  name: string;
  class: string;
  level: number;
  current_hp: number;
  max_hp: number;
  ac: number;
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
  cdd: string;
  profile?: { username: string };
  class_features?: any[];
  created_at?: string;
}

type TabId = 'players' | 'items' | 'abilities' | 'npcs' | 'map' | 'encounters' | 'missions' | 'settings';
type PlayerSubTab = 'stats' | 'inventory' | 'abilities';

export default function DMDashboard() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  
  // Helper to capitalize types like "bonus_action" -> "Bonus Action", "cyberware" -> "Cyberware"
  const toTitleCase = (str: string) => str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  
  // Convert stored stat to modifier
  // Old characters have stats stored as 10 + bonus (10 = +0, 11 = +1, 12 = +2)
  // New characters have direct modifiers (0, 1, 2)
  // If stat >= 8, assume old format and subtract 10
  const calculateStatModifier = (stat: number): number => {
    if (stat >= 8) {
      // Old format: stored as 10 + bonus, so subtract 10
      return stat - 10;
    }
    // New format: stat IS the modifier
    return stat;
  };
  
  const [activeTab, setActiveTab] = useState<TabId>('players');
  const [playerSubTab, setPlayerSubTab] = useState<PlayerSubTab>('stats');
  const [loading, setLoading] = useState(true);
  
  // Player Lock State - prevents players from equipping/using items/shopping during encounters
  const [playersLocked, setPlayersLocked] = useState(false);
  const [lockReason, setLockReason] = useState<string | null>(null);
  const [lockLoading, setLockLoading] = useState(false);
  
  // Settings State
  const [landingSubtitle, setLandingSubtitle] = useState('ENTER THE NEON SHADOWS');
  const [settingsSaving, setSettingsSaving] = useState(false);
  
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [editingStats, setEditingStats] = useState(false);
  const [statEdits, setStatEdits] = useState<Partial<Character>>({});
  
  // Player inventory state
  const [playerInventory, setPlayerInventory] = useState<InventoryItem[]>([]);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [showGiveItemModal, setShowGiveItemModal] = useState(false);
  const [giveItemSearch, setGiveItemSearch] = useState('');
  const [giveItemTypeFilter, setGiveItemTypeFilter] = useState<string>('all');
  const [giveItemRarityFilter, setGiveItemRarityFilter] = useState<string>('all');
  const [giveItemSortBy, setGiveItemSortBy] = useState<'name' | 'type' | 'rarity' | 'price'>('name');
  const [giveItemSortOrder, setGiveItemSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedGiveItem, setSelectedGiveItem] = useState<Item | null>(null);
  const [giveItemQuantity, setGiveItemQuantity] = useState(1);
  
  // Remove item modal state
  const [showRemoveItemModal, setShowRemoveItemModal] = useState(false);
  const [removeItemTarget, setRemoveItemTarget] = useState<InventoryItem | null>(null);
  const [removeItemQuantity, setRemoveItemQuantity] = useState(1);

  // Items Tab state
  type ItemsSubTab = 'list' | 'create';
  const [itemsSubTab, setItemsSubTab] = useState<ItemsSubTab>('list');
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [itemFilterType, setItemFilterType] = useState<string>('all');
  const [itemFilterRarity, setItemFilterRarity] = useState<string>('all');
  const [selectedEditItem, setSelectedEditItem] = useState<Item | null>(null);
  
  // Item form state (for create/edit)
  const [itemName, setItemName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemType, setItemType] = useState<ItemType>('item');
  const [itemRarity, setItemRarity] = useState<ItemRarity>('Common');
  const [itemPrice, setItemPrice] = useState(0);
  const [itemArmorSubtype, setItemArmorSubtype] = useState<'clothes' | 'light' | 'medium' | 'heavy' | 'shield' | null>(null);
  const [itemWeaponSubtype, setItemWeaponSubtype] = useState<'unarmed' | 'melee' | 'sidearms' | 'longarms' | 'heavy' | null>(null);
  const [itemIcCost, setItemIcCost] = useState(0);
  const [itemStrMod, setItemStrMod] = useState(0);
  const [itemDexMod, setItemDexMod] = useState(0);
  const [itemConMod, setItemConMod] = useState(0);
  const [itemWisMod, setItemWisMod] = useState(0);
  const [itemIntMod, setItemIntMod] = useState(0);
  const [itemChaMod, setItemChaMod] = useState(0);
  const [itemHpMod, setItemHpMod] = useState(0);
  const [itemHpModType, setItemHpModType] = useState<'heal' | 'max_hp'>('heal');
  const [itemAcMod, setItemAcMod] = useState(0);
  const [itemSpeedMod, setItemSpeedMod] = useState(0);
  const [itemInitMod, setItemInitMod] = useState(0);
  const [itemIcMod, setItemIcMod] = useState(0);
  const [itemSkillMods, setItemSkillMods] = useState<{ [key: string]: number }>({});
  const [itemIsConsumable, setItemIsConsumable] = useState(false);
  const [itemIsEquippable, setItemIsEquippable] = useState(true);
  const [itemSaving, setItemSaving] = useState(false);
  
  // Item linked abilities state
  interface LinkedAbility {
    ability_id: string;
    ability: Ability;
    requires_equipped: boolean;
  }
  const [itemLinkedAbilities, setItemLinkedAbilities] = useState<LinkedAbility[]>([]);
  const [showLinkAbilityModal, setShowLinkAbilityModal] = useState(false);
  const [linkAbilitySearch, setLinkAbilitySearch] = useState('');

  // Abilities Tab state
  type AbilitiesSubTab = 'list' | 'create';
  const [abilitiesSubTab, setAbilitiesSubTab] = useState<AbilitiesSubTab>('list');
  const [allAbilities, setAllAbilities] = useState<Ability[]>([]);
  const [abilitiesLoading, setAbilitiesLoading] = useState(false);
  const [abilitySearchQuery, setAbilitySearchQuery] = useState('');
  const [abilityFilterType, setAbilityFilterType] = useState<string>('all');
  const [abilityFilterSource, setAbilityFilterSource] = useState<'all' | 'custom' | 'class'>('all');
  const [selectedEditAbility, setSelectedEditAbility] = useState<Ability | null>(null);
  
  // Ability form state
  const [abilityName, setAbilityName] = useState('');
  const [abilityDescription, setAbilityDescription] = useState('');
  const [abilityType, setAbilityType] = useState<AbilityType>('action');
  const [abilityChargeType, setAbilityChargeType] = useState<ChargeType>('long_rest');
  const [abilityMaxCharges, setAbilityMaxCharges] = useState<number | null>(1);
  const [abilityEffects, setAbilityEffects] = useState<string[]>(['']);
  const [abilityDamageDice, setAbilityDamageDice] = useState('');
  const [abilityDamageType, setAbilityDamageType] = useState('');
  const [abilityRange, setAbilityRange] = useState<number | null>(null);
  const [abilityAoE, setAbilityAoE] = useState('');
  const [abilityDuration, setAbilityDuration] = useState('');
  const [abilitySaving, setAbilitySaving] = useState(false);
  const [abilitySource, setAbilitySource] = useState<'custom' | 'class'>('custom');
  const [abilityClassName, setAbilityClassName] = useState<string>('');
  
  // Give Ability Modal state
  const [showGiveAbilityModal, setShowGiveAbilityModal] = useState(false);
  const [giveAbilityCharacter, setGiveAbilityCharacter] = useState<Character | null>(null);
  const [giveAbilitySearch, setGiveAbilitySearch] = useState('');
  const [selectedGiveAbility, setSelectedGiveAbility] = useState<Ability | null>(null);

  // Map Tab state
  type MapSubTab = 'list' | 'create';
  const [mapSubTab, setMapSubTab] = useState<MapSubTab>('list');
  const [allLocations, setAllLocations] = useState<Location[]>([]);
  const [mapLoading, setMapLoading] = useState(false);
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [locationFilterIcon, setLocationFilterIcon] = useState<string>('all');
  const [selectedEditLocation, setSelectedEditLocation] = useState<Location | null>(null);
  
  // Location form state
  const [locationName, setLocationName] = useState('');
  const [locationDescription, setLocationDescription] = useState('');
  const [locationLore, setLocationLore] = useState('');
  const [locationLat, setLocationLat] = useState(0);
  const [locationLng, setLocationLng] = useState(0);
  const [locationIcon, setLocationIcon] = useState<LocationIcon>('marker');
  const [locationColor, setLocationColor] = useState<LocationColor>('cyan');
  const [locationTags, setLocationTags] = useState('');
  const [locationVisible, setLocationVisible] = useState(true);
  const [locationDiscovered, setLocationDiscovered] = useState(false);
  const [locationSaving, setLocationSaving] = useState(false);

  // Shop state for Map tab
  const [locationShops, setLocationShops] = useState<Shop[]>([]);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [shopInventory, setShopInventory] = useState<ShopInventoryItemWithDetails[]>([]);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [newShopName, setNewShopName] = useState('');
  const [newShopDescription, setNewShopDescription] = useState('');
  const [editSubTab, setEditSubTab] = useState<'details' | 'shops'>('details');
  const [addItemSearch, setAddItemSearch] = useState('');
  const [addItemPrice, setAddItemPrice] = useState(100);
  const [addItemStock, setAddItemStock] = useState(10);
  const [selectedItemToAdd, setSelectedItemToAdd] = useState<Item | null>(null);
  // Barter support
  const [addItemPriceType, setAddItemPriceType] = useState<'credits' | 'item'>('credits');
  const [addItemBarterItemId, setAddItemBarterItemId] = useState<string | null>(null);
  const [addItemBarterQty, setAddItemBarterQty] = useState(1);
  const [barterItemSearch, setBarterItemSearch] = useState('');

  // Player Abilities state (for abilities sub-tab)
  interface CharacterAbility {
    id: string;
    character_id: string;
    ability_id: string;
    current_charges: number;
    source_type: 'class' | 'item' | 'temporary';
    source_id: string | null;
    granted_at: string;
    ability: Ability;
    displaySource?: 'granted' | 'class' | string; // 'item:ItemName' for item abilities
  }
  const [playerAbilities, setPlayerAbilities] = useState<CharacterAbility[]>([]);
  const [playerAbilitiesLoading, setPlayerAbilitiesLoading] = useState(false);

  // NPCs Tab state
  const [allNPCs, setAllNPCs] = useState<NPC[]>([]);
  const [npcsLoading, setNpcsLoading] = useState(false);
  const [npcSearchQuery, setNpcSearchQuery] = useState('');
  const [npcFilterType, setNpcFilterType] = useState<string>('all');
  const [npcFilterAlive, setNpcFilterAlive] = useState<string>('alive');
  const [selectedEditNPC, setSelectedEditNPC] = useState<NPC | null>(null);
  const [npcsSubTab, setNpcsSubTab] = useState<'list' | 'create'>('list');
  const [npcSaving, setNpcSaving] = useState(false);
  
  // NPC form state
  const [npcName, setNpcName] = useState('');
  const [npcType, setNpcType] = useState<NPCType>('Enemy');
  const [npcDisposition, setNpcDisposition] = useState<NPCDisposition>('Hostile');
  const [npcDescription, setNpcDescription] = useState('');
  const [npcMaxHp, setNpcMaxHp] = useState(10);
  const [npcCurrentHp, setNpcCurrentHp] = useState(10);
  const [npcAc, setNpcAc] = useState(10);
  const [npcInitMod, setNpcInitMod] = useState(0);
  const [npcStr, setNpcStr] = useState(10);
  const [npcDex, setNpcDex] = useState(10);
  const [npcCon, setNpcCon] = useState(10);
  const [npcWis, setNpcWis] = useState(10);
  const [npcInt, setNpcInt] = useState(10);
  const [npcCha, setNpcCha] = useState(10);
  const [npcAbilities, setNpcAbilities] = useState<NPCAbility[]>([]);
  const [npcDmNotes, setNpcDmNotes] = useState('');
  const [npcThreeWords, setNpcThreeWords] = useState('');
  const [npcIsAlive, setNpcIsAlive] = useState(true);

  // Encounters Tab state
  interface Encounter {
    id: string;
    name: string;
    description: string | null;
    status: 'draft' | 'active' | 'completed' | 'archived';
    round_number: number;
    current_turn: number;
    created_at: string;
  }
  interface CombatParticipant {
    id: string;
    name: string;
    type: 'player' | 'npc';
    entityId: string; // character_id or npc_id
    initiative: number | null;
    currentHp: number;
    maxHp: number;
    ac: number;
    notes: string;
    isActive: boolean;
    // Full entity data for detail popup
    entityData?: Character | NPC;
  }
  const [allEncounters, setAllEncounters] = useState<Encounter[]>([]);
  const [_encountersLoading, setEncountersLoading] = useState(false);
  const [showCreateEncounterModal, setShowCreateEncounterModal] = useState(false);
  const [newEncounterName, setNewEncounterName] = useState('');
  const [newEncounterDescription, setNewEncounterDescription] = useState('');
  const [encounterSaving, setEncounterSaving] = useState(false);
  
  // Active encounter state (combat tracker)
  const [activeEncounter, setActiveEncounter] = useState<Encounter | null>(null);
  const [combatParticipants, setCombatParticipants] = useState<CombatParticipant[]>([]);
  const [showAddParticipantModal, setShowAddParticipantModal] = useState(false);
  const [participantSearchQuery, setParticipantSearchQuery] = useState('');
  const [participantTypeFilter, setParticipantTypeFilter] = useState<string>('all');
  const [npcQuantities, setNpcQuantities] = useState<{[npcId: string]: number}>({});
  const [encounterRound, setEncounterRound] = useState(1);
  const [encounterCurrentTurn, setEncounterCurrentTurn] = useState(0);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [hpChangeInput, setHpChangeInput] = useState<{[key: string]: string}>({});
  const [notesInput, setNotesInput] = useState<{[key: string]: string}>({});
  const notesDebounceRef = useRef<{[key: string]: ReturnType<typeof setTimeout>}>({});
  const [selectedCombatParticipantId, setSelectedCombatParticipantId] = useState<string | null>(null);
  
  // Combat participant resources (inventory/abilities for players in combat)
  const [combatPlayerInventory, setCombatPlayerInventory] = useState<InventoryItem[]>([]);
  const [combatPlayerAbilities, setCombatPlayerAbilities] = useState<any[]>([]);
  const [combatResourcesLoading, setCombatResourcesLoading] = useState(false);
  const combatResourcesFetchIdRef = useRef<string | null>(null);

  // Missions Tab state
  const [allMissions, setAllMissions] = useState<MissionWithDetails[]>([]);
  const [missionsLoading, setMissionsLoading] = useState(false);
  const [missionSearchQuery, setMissionSearchQuery] = useState('');
  const [missionFilterStatus, setMissionFilterStatus] = useState<MissionStatus | 'all'>('all');
  const [missionFilterType, setMissionFilterType] = useState<MissionType | 'all'>('all');
  const [selectedMission, setSelectedMission] = useState<MissionWithDetails | null>(null);
  const [showCreateMissionModal, setShowCreateMissionModal] = useState(false);
  const [missionSaving, setMissionSaving] = useState(false);
  const [rewardItemSearch, setRewardItemSearch] = useState('');
  const [showRewardDistributionModal, setShowRewardDistributionModal] = useState(false);
  const [rewardDistribution, setRewardDistribution] = useState<{[itemId: string]: string}>({});
  const [creditDistribution, setCreditDistribution] = useState<{[charId: string]: number}>({});
  // Mission form state
  const [missionForm, setMissionForm] = useState<{
    title: string;
    description: string;
    type: MissionType;
    difficulty: MissionDifficulty;
    objectives: string[];
    assigned_to: string[];
    reward_item_ids: string[];
    reward_credits: number;
    reward_mode: RewardMode;
    saveAsDraft: boolean;
  }>({
    title: '',
    description: '',
    type: 'Side Mission',
    difficulty: 'Moderate',
    objectives: [''],
    assigned_to: [],
    reward_item_ids: [],
    reward_credits: 0,
    reward_mode: 'each',
    saveAsDraft: false
  });

  // Fetch player lock status on mount and subscribe to changes
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
      .channel('game_settings_changes')
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

  // Toggle player lock function
  const togglePlayerLock = async (lock: boolean, reason: string | null = null) => {
    setLockLoading(true);
    try {
      const { error } = await supabase.rpc('toggle_players_locked', {
        is_locked: lock,
        lock_reason: reason
      });
      
      if (error) throw error;
      
      setPlayersLocked(lock);
      setLockReason(reason);
    } catch (err: any) {
      console.error('Error toggling player lock:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setLockLoading(false);
    }
  };

  // Fetch landing page subtitle setting
  const fetchLandingSubtitle = async () => {
    const { data } = await supabase
      .from('game_settings')
      .select('value')
      .eq('key', 'landing_subtitle')
      .single();
    
    if (data?.value?.text) {
      setLandingSubtitle(data.value.text);
    }
  };

  // Save landing page subtitle
  const saveLandingSubtitle = async () => {
    setSettingsSaving(true);
    try {
      const { error } = await supabase
        .from('game_settings')
        .upsert({
          key: 'landing_subtitle',
          value: { text: landingSubtitle },
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
      
      if (error) throw error;
      alert('Settings saved successfully!');
    } catch (err: any) {
      console.error('Error saving settings:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setSettingsSaving(false);
    }
  };

  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      navigate('/player');
    }
  }, [profile, navigate]);

  useEffect(() => {
    if (activeTab === 'players') {
      fetchCharacters();
    }
    if (activeTab === 'settings') {
      fetchLandingSubtitle();
    }
  }, [activeTab]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const fetchCharacters = async () => {
    try {
      setLoading(true);
      const { data: chars, error } = await supabase
        .from('characters')
        .select('*')
        .order('name');
      
      if (error) throw error;

      const userIds = [...new Set((chars || []).map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', userIds);
      
      const profileMap = new Map((profiles || []).map(p => [p.id, p.username]));
      const enrichedChars = (chars || []).map(char => ({
        ...char,
        profile: { username: profileMap.get(char.user_id) || 'Unknown' }
      }));

      setCharacters(enrichedChars);
    } catch (err: any) {
      console.error('Error fetching characters:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCharacter = (char: Character) => {
    setSelectedCharacter(char);
    setStatEdits({});
    setEditingStats(false);
  };

  const handleStartEditing = () => {
    if (!selectedCharacter) return;
    setStatEdits({
      current_hp: selectedCharacter.current_hp,
      max_hp: selectedCharacter.max_hp,
      ac: selectedCharacter.ac,
      level: selectedCharacter.level,
      str: selectedCharacter.str,
      dex: selectedCharacter.dex,
      con: selectedCharacter.con,
      wis: selectedCharacter.wis,
      int: selectedCharacter.int,
      cha: selectedCharacter.cha,
      usd: selectedCharacter.usd,
      // Skills
      skill_acrobatics: selectedCharacter.skill_acrobatics || 0,
      skill_animal_handling: selectedCharacter.skill_animal_handling || 0,
      skill_athletics: selectedCharacter.skill_athletics || 0,
      skill_biology: selectedCharacter.skill_biology || 0,
      skill_deception: selectedCharacter.skill_deception || 0,
      skill_hacking: selectedCharacter.skill_hacking || 0,
      skill_history: selectedCharacter.skill_history || 0,
      skill_insight: selectedCharacter.skill_insight || 0,
      skill_intimidation: selectedCharacter.skill_intimidation || 0,
      skill_investigation: selectedCharacter.skill_investigation || 0,
      skill_medicine: selectedCharacter.skill_medicine || 0,
      skill_nature: selectedCharacter.skill_nature || 0,
      skill_perception: selectedCharacter.skill_perception || 0,
      skill_performance: selectedCharacter.skill_performance || 0,
      skill_persuasion: selectedCharacter.skill_persuasion || 0,
      skill_sleight_of_hand: selectedCharacter.skill_sleight_of_hand || 0,
      skill_stealth: selectedCharacter.skill_stealth || 0,
      skill_survival: selectedCharacter.skill_survival || 0,
      cdd: selectedCharacter.cdd || 'd8',
    });
    setEditingStats(true);
  };

  const handleSaveStats = async () => {
    if (!selectedCharacter) return;
    try {
      const { error } = await supabase
        .from('characters')
        .update(statEdits)
        .eq('id', selectedCharacter.id);
      
      if (error) throw error;
      
      const updated = { ...selectedCharacter, ...statEdits } as Character;
      setSelectedCharacter(updated);
      setCharacters(chars => chars.map(c => c.id === updated.id ? updated : c));
      setEditingStats(false);
    } catch (err: any) {
      alert('Failed to save: ' + err.message);
    }
  };

  const handleCancelEdit = () => {
    setStatEdits({});
    setEditingStats(false);
  };

  const handleQuickHeal = async (amount: number) => {
    if (!selectedCharacter) return;
    const newHp = Math.min(Math.max(selectedCharacter.current_hp + amount, 0), selectedCharacter.max_hp);
    const { error } = await supabase
      .from('characters')
      .update({ current_hp: newHp })
      .eq('id', selectedCharacter.id);
    
    if (!error) {
      setSelectedCharacter({ ...selectedCharacter, current_hp: newHp });
      setCharacters(chars => chars.map(c => c.id === selectedCharacter.id ? { ...c, current_hp: newHp } : c));
    }
  };

  const handleFullHeal = async () => {
    if (!selectedCharacter) return;
    const { error } = await supabase
      .from('characters')
      .update({ current_hp: selectedCharacter.max_hp })
      .eq('id', selectedCharacter.id);
    
    if (!error) {
      setSelectedCharacter({ ...selectedCharacter, current_hp: selectedCharacter.max_hp });
      setCharacters(chars => chars.map(c => c.id === selectedCharacter.id ? { ...c, current_hp: selectedCharacter.max_hp } : c));
    }
  };

  // ============ INVENTORY FUNCTIONS ============
  const fetchPlayerInventory = async (characterId: string) => {
    try {
      setInventoryLoading(true);
      const { data, error } = await supabase
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
        .order('is_equipped', { ascending: false });
      
      if (error) throw error;
      setPlayerInventory(data || []);
    } catch (err: any) {
      console.error('Error fetching inventory:', err);
    } finally {
      setInventoryLoading(false);
    }
  };

  const fetchAllItems = async () => {
    const { data } = await supabase.from('items').select('*').order('name');
    setAllItems(data || []);
  };

  const handleGiveItem = async () => {
    if (!selectedCharacter || !selectedGiveItem) return;
    
    try {
      // Check if character already has this item
      const existing = playerInventory.find(inv => inv.item?.id === selectedGiveItem.id);
      
      if (existing) {
        // Update quantity
        await supabase
          .from('inventory')
          .update({ quantity: existing.quantity + giveItemQuantity })
          .eq('id', existing.id);
      } else {
        // Add new item
        await supabase
          .from('inventory')
          .insert({
            character_id: selectedCharacter.id,
            item_id: selectedGiveItem.id,
            quantity: giveItemQuantity,
            is_equipped: false
          });
        
        // Check for linked abilities and grant them
        const { data: linkedAbilities } = await supabase
          .from('item_abilities')
          .select('ability_id, requires_equipped, ability:abilities(*)')
          .eq('item_id', selectedGiveItem.id);
        
        if (linkedAbilities && linkedAbilities.length > 0) {
          for (const link of linkedAbilities) {
            // Check if character already has this ability from this item
            const { data: existingAbility } = await supabase
              .from('character_abilities')
              .select('id')
              .eq('character_id', selectedCharacter.id)
              .eq('ability_id', link.ability_id)
              .eq('source_type', 'item')
              .eq('source_id', selectedGiveItem.id)
              .single();
            
            if (!existingAbility) {
              // Grant the ability
              const ability = link.ability as any;
              await supabase
                .from('character_abilities')
                .insert({
                  character_id: selectedCharacter.id,
                  ability_id: link.ability_id,
                  current_charges: ability?.max_charges || 1,
                  source_type: 'item',
                  source_id: selectedGiveItem.id
                });
            }
          }
        }
      }
      
      await fetchPlayerInventory(selectedCharacter.id);
      setShowGiveItemModal(false);
      setSelectedGiveItem(null);
      setGiveItemQuantity(1);
      setGiveItemSearch('');
    } catch (err: any) {
      alert('Failed to give item: ' + err.message);
    }
  };

  const openRemoveItemModal = (inv: InventoryItem) => {
    setRemoveItemTarget(inv);
    setRemoveItemQuantity(1);
    setShowRemoveItemModal(true);
  };

  const handleRemoveItem = async () => {
    if (!removeItemTarget || !selectedCharacter) return;
    
    const inv = removeItemTarget;
    const quantityToRemove = removeItemQuantity;
    
    try {
      if (quantityToRemove >= inv.quantity) {
        // Remove all - delete the inventory entry and abilities
        if (inv.item) {
          await supabase
            .from('character_abilities')
            .delete()
            .eq('character_id', selectedCharacter.id)
            .eq('source_type', 'item')
            .eq('source_id', inv.item.id);
        }
        
        await supabase.from('inventory').delete().eq('id', inv.id);
        setPlayerInventory(items => items.filter(i => i.id !== inv.id));
      } else {
        // Reduce quantity
        const newQuantity = inv.quantity - quantityToRemove;
        await supabase
          .from('inventory')
          .update({ quantity: newQuantity })
          .eq('id', inv.id);
        
        setPlayerInventory(items => items.map(i => 
          i.id === inv.id ? { ...i, quantity: newQuantity } : i
        ));
      }
      
      setShowRemoveItemModal(false);
      setRemoveItemTarget(null);
    } catch (err: any) {
      alert('Failed to remove item: ' + err.message);
    }
  };

  // Load inventory when character is selected and sub-tab is inventory
  useEffect(() => {
    if (selectedCharacter && playerSubTab === 'inventory') {
      fetchPlayerInventory(selectedCharacter.id);
      fetchAllItems();
    }
  }, [selectedCharacter, playerSubTab]);

  // Real-time subscription for inventory changes
  useEffect(() => {
    if (!selectedCharacter) return;

    const inventoryChannel = supabase
      .channel(`dm-inventory-${selectedCharacter.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory',
          filter: `character_id=eq.${selectedCharacter.id}`
        },
        () => {
          // Refetch inventory when changes occur
          fetchPlayerInventory(selectedCharacter.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(inventoryChannel);
    };
  }, [selectedCharacter?.id]);

  // Real-time subscription for item updates (when item details change)
  useEffect(() => {
    const itemsChannel = supabase
      .channel('dm-items-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'items'
        },
        () => {
          // Refetch inventory to get updated item details
          if (selectedCharacter) {
            fetchPlayerInventory(selectedCharacter.id);
          }
          // Also refetch all items for the give item modal
          fetchAllItems();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(itemsChannel);
    };
  }, [selectedCharacter?.id]);

  // Load abilities when character is selected and sub-tab is abilities
  useEffect(() => {
    if (selectedCharacter && playerSubTab === 'abilities') {
      fetchPlayerAbilities(selectedCharacter.id);
    }
  }, [selectedCharacter, playerSubTab]);

  const fetchPlayerAbilities = async (characterId: string) => {
    try {
      setPlayerAbilitiesLoading(true);
      
      // 1. Fetch character_abilities (directly granted abilities)
      const { data: charAbilities, error: charError } = await supabase
        .from('character_abilities')
        .select('*, ability:abilities(*)')
        .eq('character_id', characterId)
        .order('granted_at', { ascending: false });
      
      console.log('Fetched character abilities:', charAbilities, 'Error:', charError);
      
      if (charError) throw charError;
      
      // Convert to consistent format with source info
      const directAbilities: CharacterAbility[] = (charAbilities || []).map(ca => ({
        ...ca,
        displaySource: 'granted' as const
      }));
      
      console.log('Direct abilities after mapping:', directAbilities);
      
      // 2. Fetch item abilities from equipped items
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
      
      // Extract item abilities as CharacterAbility-like objects
      const itemAbilities: CharacterAbility[] = [];
      equippedItems?.forEach(invItem => {
        invItem.item?.abilities?.forEach((itemAbility: any) => {
          if (itemAbility.ability) {
            itemAbilities.push({
              id: `item_${invItem.item.id}_${itemAbility.ability.id}`,
              character_id: characterId,
              ability_id: itemAbility.ability.id,
              current_charges: itemAbility.ability.max_charges || 0,
              source_type: 'item' as const,
              source_id: invItem.item.id,
              granted_at: invItem.created_at || new Date().toISOString(),
              ability: itemAbility.ability,
              displaySource: `item:${invItem.item.name}` as any
            });
          }
        });
      });
      
      // 3. Get class features from selected character
      const classAbilities: CharacterAbility[] = [];
      if (selectedCharacter?.class_features && Array.isArray(selectedCharacter.class_features)) {
        selectedCharacter.class_features.forEach((feature: any, index: number) => {
          classAbilities.push({
            id: `class_${index}_${feature.name}`,
            character_id: characterId,
            ability_id: `class_feature_${index}`,
            current_charges: feature.charges || 0,
            source_type: 'class' as const,
            source_id: null,
            granted_at: selectedCharacter.created_at || new Date().toISOString(),
            ability: {
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
              created_at: new Date().toISOString()
            },
            displaySource: 'class' as any
          });
        });
      }
      
      // Combine all abilities
      setPlayerAbilities([...directAbilities, ...classAbilities, ...itemAbilities]);
    } catch (err: any) {
      console.error('Error fetching player abilities:', err);
      setPlayerAbilities([]);
    } finally {
      setPlayerAbilitiesLoading(false);
    }
  };

  const handleUpdateCharges = async (characterAbilityId: string, newCharges: number) => {
    try {
      const ability = playerAbilities.find(a => a.id === characterAbilityId);
      if (!ability) return;
      
      // Clamp charges between 0 and max_charges
      const maxCharges = ability.ability.max_charges || 0;
      const clampedCharges = Math.max(0, Math.min(newCharges, maxCharges));
      
      await supabase
        .from('character_abilities')
        .update({ current_charges: clampedCharges })
        .eq('id', characterAbilityId);
      
      setPlayerAbilities(prev => prev.map(a => 
        a.id === characterAbilityId ? { ...a, current_charges: clampedCharges } : a
      ));
    } catch (err: any) {
      alert('Failed to update charges: ' + err.message);
    }
  };

  // REST FUNCTIONS - Affect ALL players
  const handleShortRestAll = async () => {
    if (!confirm('Trigger a SHORT REST for ALL players? This will restore charges for short rest abilities.')) return;
    
    try {
      // Get ALL character abilities with their ability details
      const { data: abilitiesData } = await supabase
        .from('character_abilities')
        .select('id, current_charges, ability:abilities(max_charges, charges_per_rest, charge_type)');
      
      if (!abilitiesData) return;
      
      let updatedCount = 0;
      for (const charAbility of abilitiesData) {
        const ability = charAbility.ability as any;
        if (!ability || ability.charge_type !== 'short_rest') continue;
        
        const maxCharges = ability.max_charges || 0;
        const chargesPerRest = ability.charges_per_rest || maxCharges;
        const newCharges = Math.min(charAbility.current_charges + chargesPerRest, maxCharges);
        
        if (newCharges !== charAbility.current_charges) {
          await supabase
            .from('character_abilities')
            .update({ current_charges: newCharges })
            .eq('id', charAbility.id);
          updatedCount++;
        }
      }
      
      // Refresh abilities for selected character if viewing
      if (selectedCharacter && playerSubTab === 'abilities') {
        await fetchPlayerAbilities(selectedCharacter.id);
      }
      
      alert(`Short rest completed! ${updatedCount} abilities recharged across all players.`);
    } catch (err: any) {
      alert('Failed to process short rest: ' + err.message);
    }
  };

  const handleLongRestAll = async () => {
    if (!confirm('Trigger a LONG REST for ALL players? This will restore charges for ALL rest-based abilities (long rest abilities get 1x charges, short rest abilities get 2x charges).')) return;
    
    try {
      const { data: abilitiesData } = await supabase
        .from('character_abilities')
        .select('id, current_charges, ability:abilities(max_charges, charges_per_rest, charge_type)');
      
      if (!abilitiesData) return;
      
      let updatedCount = 0;
      for (const charAbility of abilitiesData) {
        const ability = charAbility.ability as any;
        if (!ability) continue;
        
        // Skip infinite and uses-based abilities
        if (ability.charge_type !== 'short_rest' && ability.charge_type !== 'long_rest') continue;
        
        const maxCharges = ability.max_charges || 0;
        const chargesPerRest = ability.charges_per_rest || maxCharges;
        
        // Long rest gives 2x charges for short_rest abilities, 1x for long_rest abilities
        const restMultiplier = ability.charge_type === 'short_rest' ? 2 : 1;
        const chargesToAdd = chargesPerRest * restMultiplier;
        const newCharges = Math.min(charAbility.current_charges + chargesToAdd, maxCharges);
        
        if (newCharges !== charAbility.current_charges) {
          await supabase
            .from('character_abilities')
            .update({ current_charges: newCharges })
            .eq('id', charAbility.id);
          updatedCount++;
        }
      }
      
      // Refresh abilities for selected character if viewing
      if (selectedCharacter && playerSubTab === 'abilities') {
        await fetchPlayerAbilities(selectedCharacter.id);
      }
      
      alert(`Long rest completed! ${updatedCount} abilities recharged across all players.`);
    } catch (err: any) {
      alert('Failed to process long rest: ' + err.message);
    }
  };

  const handleRemovePlayerAbility = async (characterAbilityId: string) => {
    if (!confirm('Remove this ability from the character?')) return;
    
    try {
      await supabase.from('character_abilities').delete().eq('id', characterAbilityId);
      setPlayerAbilities(prev => prev.filter(a => a.id !== characterAbilityId));
    } catch (err: any) {
      alert('Failed to remove ability: ' + err.message);
    }
  };

  const filteredGiveItems = allItems
    .filter(item => item.name.toLowerCase().includes(giveItemSearch.toLowerCase()))
    .filter(item => giveItemTypeFilter === 'all' || item.type === giveItemTypeFilter)
    .filter(item => giveItemRarityFilter === 'all' || item.rarity === giveItemRarityFilter)
    .sort((a, b) => {
      let comparison = 0;
      switch (giveItemSortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
        case 'rarity':
          const rarityOrder = ['Common', 'Uncommon', 'Rare', 'Epic', 'Mythic', 'Ultra Rare', 'MISSION ITEM'];
          comparison = rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity);
          break;
        case 'price':
          comparison = a.price - b.price;
          break;
      }
      return giveItemSortOrder === 'asc' ? comparison : -comparison;
    });

  // ============ ITEMS TAB FUNCTIONS ============
  useEffect(() => {
    if (activeTab === 'items') {
      fetchAllItemsForEditor();
      // Also fetch abilities for linking
      fetchAbilitiesForItems();
    }
  }, [activeTab]);

  const fetchAbilitiesForItems = async () => {
    try {
      const { data } = await supabase.from('abilities').select('*').order('name');
      setAllAbilities(data || []);
    } catch (err: any) {
      console.error('Error fetching abilities for items:', err);
    }
  };

  const fetchAllItemsForEditor = async () => {
    try {
      setItemsLoading(true);
      const { data } = await supabase.from('items').select('*').order('name');
      setAllItems(data || []);
    } catch (err: any) {
      console.error('Error fetching items:', err);
    } finally {
      setItemsLoading(false);
    }
  };

  const resetItemForm = () => {
    setItemName('');
    setItemDescription('');
    setItemType('item');
    setItemRarity('Common');
    setItemPrice(0);
    setItemArmorSubtype(null);
    setItemWeaponSubtype(null);
    setItemIcCost(0);
    setItemStrMod(0);
    setItemDexMod(0);
    setItemConMod(0);
    setItemWisMod(0);
    setItemIntMod(0);
    setItemChaMod(0);
    setItemHpMod(0);
    setItemHpModType('heal');
    setItemAcMod(0);
    setItemSpeedMod(0);
    setItemInitMod(0);
    setItemIcMod(0);
    setItemSkillMods({});
    setItemIsConsumable(false);
    setItemIsEquippable(true);
    setItemLinkedAbilities([]);
    setSelectedEditItem(null);
  };

  const loadItemForEdit = async (item: Item) => {
    setSelectedEditItem(item);
    setItemName(item.name);
    setItemDescription(item.description || '');
    setItemType(item.type);
    setItemRarity(item.rarity);
    setItemPrice(item.price);
    setItemArmorSubtype(item.armor_subtype || null);
    setItemWeaponSubtype(item.weapon_subtype || null);
    setItemIcCost(item.ic_cost || 0);
    setItemStrMod(item.str_mod || 0);
    setItemDexMod(item.dex_mod || 0);
    setItemConMod(item.con_mod || 0);
    setItemWisMod(item.wis_mod || 0);
    setItemIntMod(item.int_mod || 0);
    setItemChaMod(item.cha_mod || 0);
    setItemHpMod(item.hp_mod || 0);
    setItemHpModType(item.hp_mod_type || 'heal');
    setItemAcMod(item.ac_mod || 0);
    setItemSpeedMod(item.speed_mod || 0);
    setItemInitMod(item.init_mod || 0);
    setItemIcMod(item.ic_mod || 0);
    setItemSkillMods(item.skill_mods || {});
    setItemIsConsumable(item.is_consumable || false);
    setItemIsEquippable(item.is_equippable !== false);
    
    // Load linked abilities
    try {
      const { data } = await supabase
        .from('item_abilities')
        .select('ability_id, requires_equipped, ability:abilities(*)')
        .eq('item_id', item.id);
      
      if (data) {
        setItemLinkedAbilities(data.map((d: any) => ({
          ability_id: d.ability_id,
          ability: d.ability,
          requires_equipped: d.requires_equipped
        })));
      } else {
        setItemLinkedAbilities([]);
      }
    } catch (err) {
      console.error('Error loading linked abilities:', err);
      setItemLinkedAbilities([]);
    }
    setItemsSubTab('create');
  };

  const handleItemSkillMod = (skill: string, value: number) => {
    if (value === 0) {
      const newMods = { ...itemSkillMods };
      delete newMods[skill];
      setItemSkillMods(newMods);
    } else {
      setItemSkillMods({ ...itemSkillMods, [skill]: value });
    }
  };

  const handleSaveItem = async () => {
    if (!itemName.trim()) {
      alert('Please enter an item name');
      return;
    }

    try {
      setItemSaving(true);
      
      const itemData = {
        name: itemName,
        description: itemDescription || null,
        type: itemType,
        rarity: itemRarity,
        price: itemPrice,
        armor_subtype: itemArmorSubtype,
        weapon_subtype: itemWeaponSubtype,
        ic_cost: itemIcCost,
        str_mod: itemStrMod,
        dex_mod: itemDexMod,
        con_mod: itemConMod,
        wis_mod: itemWisMod,
        int_mod: itemIntMod,
        cha_mod: itemChaMod,
        hp_mod: itemHpMod,
        hp_mod_type: itemHpModType,
        ac_mod: itemAcMod,
        speed_mod: itemSpeedMod,
        init_mod: itemInitMod,
        ic_mod: itemIcMod,
        skill_mods: itemSkillMods,
        is_consumable: itemIsConsumable,
        is_equippable: itemIsEquippable,
      };

      let itemId: string;

      if (selectedEditItem) {
        // Update existing item
        const { error } = await supabase
          .from('items')
          .update(itemData)
          .eq('id', selectedEditItem.id);
        
        if (error) throw error;
        itemId = selectedEditItem.id;
        
        // Delete existing linked abilities and re-insert
        await supabase.from('item_abilities').delete().eq('item_id', itemId);
      } else {
        // Create new item
        const { data, error } = await supabase
          .from('items')
          .insert({ ...itemData, created_by: profile?.id })
          .select()
          .single();
        
        if (error) throw error;
        itemId = data.id;
      }

      // Save linked abilities
      if (itemLinkedAbilities.length > 0) {
        const abilityLinks = itemLinkedAbilities.map(la => ({
          item_id: itemId,
          ability_id: la.ability_id,
          requires_equipped: la.requires_equipped
        }));
        
        const { error: linkError } = await supabase
          .from('item_abilities')
          .insert(abilityLinks);
        
        if (linkError) {
          console.error('Error linking abilities:', linkError);
        }
      }

      alert(`Item "${itemName}" ${selectedEditItem ? 'updated' : 'created'} successfully!`);

      resetItemForm();
      setItemsSubTab('list');
      fetchAllItemsForEditor();
    } catch (err: any) {
      alert('Error saving item: ' + err.message);
    } finally {
      setItemSaving(false);
    }
  };

  const handleDeleteItem = async (itemId: string, itemName: string) => {
    if (!confirm(`Delete "${itemName}"? This cannot be undone.`)) return;
    
    try {
      const { error } = await supabase.from('items').delete().eq('id', itemId);
      if (error) throw error;
      setAllItems(items => items.filter(i => i.id !== itemId));
    } catch (err: any) {
      alert('Error deleting item: ' + err.message);
    }
  };

  // Filtered items for the Items tab list
  const filteredItemsList = allItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(itemSearchQuery.toLowerCase());
    const matchesType = itemFilterType === 'all' || item.type === itemFilterType;
    const matchesRarity = itemFilterRarity === 'all' || item.rarity === itemFilterRarity;
    return matchesSearch && matchesType && matchesRarity;
  });

  // ============ ABILITIES TAB FUNCTIONS ============
  useEffect(() => {
    if (activeTab === 'abilities') {
      fetchAllAbilities();
    }
  }, [activeTab]);

  const fetchAllAbilities = async () => {
    try {
      setAbilitiesLoading(true);
      const { data } = await supabase.from('abilities').select('*').order('name');
      setAllAbilities(data || []);
    } catch (err: any) {
      console.error('Error fetching abilities:', err);
    } finally {
      setAbilitiesLoading(false);
    }
  };

  const resetAbilityForm = () => {
    setAbilityName('');
    setAbilityDescription('');
    setAbilityType('action');
    setAbilityChargeType('long_rest');
    setAbilityMaxCharges(1);
    setAbilityEffects(['']);
    setAbilityDamageDice('');
    setAbilityDamageType('');
    setAbilityRange(null);
    setAbilityAoE('');
    setAbilityDuration('');
    setAbilitySource('custom');
    setAbilityClassName('');
    setSelectedEditAbility(null);
  };

  const loadAbilityForEdit = (ability: Ability) => {
    setSelectedEditAbility(ability);
    setAbilityName(ability.name);
    setAbilityDescription(ability.description || '');
    setAbilityType(ability.type);
    setAbilityChargeType(ability.charge_type);
    setAbilityMaxCharges(ability.max_charges);
    setAbilityEffects(ability.effects?.length ? ability.effects : ['']);
    setAbilityDamageDice(ability.damage_dice || '');
    setAbilityDamageType(ability.damage_type || '');
    setAbilityRange(ability.range_feet);
    setAbilityAoE(ability.area_of_effect || '');
    setAbilityDuration(ability.duration || '');
    setAbilitySource((ability.source as 'custom' | 'class') || 'custom');
    setAbilityClassName(ability.class_name || '');
    setAbilitiesSubTab('create');
  };

  const handleAbilityEffectChange = (index: number, value: string) => {
    const newEffects = [...abilityEffects];
    newEffects[index] = value;
    setAbilityEffects(newEffects);
  };

  const handleAddAbilityEffect = () => setAbilityEffects([...abilityEffects, '']);
  
  const handleRemoveAbilityEffect = (index: number) => {
    const newEffects = abilityEffects.filter((_, i) => i !== index);
    setAbilityEffects(newEffects.length > 0 ? newEffects : ['']);
  };

  const handleSaveAbility = async () => {
    if (!abilityName.trim()) {
      alert('Please enter an ability name');
      return;
    }
    if (abilityEffects.filter(e => e.trim()).length === 0) {
      alert('Please add at least one effect');
      return;
    }
    if (abilitySource === 'class' && !abilityClassName.trim()) {
      alert('Please select a class for this class ability');
      return;
    }

    try {
      setAbilitySaving(true);
      
      const abilityData = {
        name: abilityName,
        description: abilityDescription || null,
        type: abilityType,
        charge_type: abilityChargeType,
        max_charges: abilityChargeType === 'infinite' ? null : abilityMaxCharges,
        effects: abilityEffects.filter(e => e.trim()),
        damage_dice: abilityDamageDice || null,
        damage_type: abilityDamageType || null,
        range_feet: abilityRange,
        area_of_effect: abilityAoE || null,
        duration: abilityDuration || null,
        source: abilitySource,
        class_name: abilitySource === 'class' ? abilityClassName : null,
      };

      if (selectedEditAbility) {
        const { error } = await supabase
          .from('abilities')
          .update(abilityData)
          .eq('id', selectedEditAbility.id);
        
        if (error) throw error;
        alert(`Ability "${abilityName}" updated successfully!`);
      } else {
        const { error } = await supabase
          .from('abilities')
          .insert(abilityData);
        
        if (error) throw error;
        alert(`Ability "${abilityName}" created successfully!`);
      }

      resetAbilityForm();
      setAbilitiesSubTab('list');
      fetchAllAbilities();
    } catch (err: any) {
      alert('Error saving ability: ' + err.message);
    } finally {
      setAbilitySaving(false);
    }
  };

  const handleDeleteAbility = async (abilityId: string, abilName: string) => {
    if (!confirm(`Delete "${abilName}"? This will remove it from all items and characters.`)) return;
    
    try {
      const { error } = await supabase.from('abilities').delete().eq('id', abilityId);
      if (error) throw error;
      setAllAbilities(abilities => abilities.filter(a => a.id !== abilityId));
      if (selectedEditAbility?.id === abilityId) resetAbilityForm();
    } catch (err: any) {
      alert('Error deleting ability: ' + err.message);
    }
  };

  const handleGiveAbilityToCharacter = async () => {
    if (!giveAbilityCharacter || !selectedGiveAbility) return;
    
    try {
      // Check if character already has this ability
      const { data: existing } = await supabase
        .from('character_abilities')
        .select('id')
        .eq('character_id', giveAbilityCharacter.id)
        .eq('ability_id', selectedGiveAbility.id)
        .single();
      
      if (existing) {
        alert('Character already has this ability!');
        return;
      }
      
      const { error: insertError } = await supabase
        .from('character_abilities')
        .insert({
          character_id: giveAbilityCharacter.id,
          ability_id: selectedGiveAbility.id,
          current_charges: selectedGiveAbility.max_charges || 0,
          source_type: 'class',
          source_id: null
        });
      
      if (insertError) {
        console.error('Insert error:', insertError);
        throw insertError;
      }
      
      alert(`Gave "${selectedGiveAbility.name}" to ${giveAbilityCharacter.name}!`);
      
      // Refresh player abilities if this is the currently selected character
      if (selectedCharacter?.id === giveAbilityCharacter.id && playerSubTab === 'abilities') {
        fetchPlayerAbilities(giveAbilityCharacter.id);
      }
      
      setShowGiveAbilityModal(false);
      setGiveAbilityCharacter(null);
      setSelectedGiveAbility(null);
      setGiveAbilitySearch('');
    } catch (err: any) {
      alert('Error giving ability: ' + err.message);
    }
  };

  // Filter abilities list based on search, type, and source
  const filteredAbilitiesList = allAbilities.filter(ability => {
    const matchesSearch = ability.name.toLowerCase().includes(abilitySearchQuery.toLowerCase());
    const matchesType = abilityFilterType === 'all' || ability.type === abilityFilterType;
    const matchesSource = abilityFilterSource === 'all' || 
      (abilityFilterSource === 'custom' && (ability.source === 'custom' || !ability.source)) ||
      (abilityFilterSource === 'class' && ability.source === 'class');
    return matchesSearch && matchesType && matchesSource;
  });

  const filteredGiveAbilities = allAbilities.filter(a =>
    a.name.toLowerCase().includes(giveAbilitySearch.toLowerCase())
  );

  // ============ MAP TAB FUNCTIONS ============
  useEffect(() => {
    if (activeTab === 'map') {
      fetchAllLocations();
    }
  }, [activeTab]);

  const fetchAllLocations = async () => {
    try {
      setMapLoading(true);
      const { data } = await supabase.from('locations').select('*').order('name');
      setAllLocations(data || []);
    } catch (err: any) {
      console.error('Error fetching locations:', err);
    } finally {
      setMapLoading(false);
    }
  };

  const resetLocationForm = () => {
    setLocationName('');
    setLocationDescription('');
    setLocationLore('');
    setLocationLat(0);
    setLocationLng(0);
    setLocationIcon('marker');
    setLocationColor('cyan');
    setLocationTags('');
    setLocationVisible(true);
    setLocationDiscovered(false);
    setSelectedEditLocation(null);
    // Clear shop state
    setLocationShops([]);
    setSelectedShop(null);
    setShopInventory([]);
    setNewShopName('');
    setNewShopDescription('');
    setEditSubTab('details');
  };

  const loadLocationForEdit = (location: Location) => {
    setSelectedEditLocation(location);
    setLocationName(location.name);
    setLocationDescription(location.description || '');
    setLocationLore(location.lore || '');
    setLocationLat(location.lat);
    setLocationLng(location.lng);
    setLocationIcon(location.icon);
    setLocationColor(location.color);
    setLocationTags(location.tags?.join(', ') || '');
    setLocationVisible(location.is_visible);
    setLocationDiscovered(location.is_discovered);
    setMapSubTab('create');
    // Fetch shops for this location
    fetchLocationShops(location.id);
    setSelectedShop(null);
    setShopInventory([]);
    setEditSubTab('details');
  };

  const handleSaveLocation = async () => {
    if (!locationName.trim()) {
      alert('Please enter a location name');
      return;
    }

    try {
      setLocationSaving(true);
      
      const locationData = {
        name: locationName,
        description: locationDescription || null,
        lore: locationLore || null,
        lat: locationLat,
        lng: locationLng,
        icon: locationIcon,
        color: locationColor,
        tags: locationTags.split(',').map(t => t.trim()).filter(Boolean),
        is_visible: locationVisible,
        is_discovered: locationDiscovered,
      };

      if (selectedEditLocation) {
        const { error } = await supabase
          .from('locations')
          .update(locationData)
          .eq('id', selectedEditLocation.id);
        
        if (error) throw error;
        alert(`Location "${locationName}" updated successfully!`);
      } else {
        const { error } = await supabase
          .from('locations')
          .insert({ ...locationData, created_by: profile?.id });
        
        if (error) throw error;
        alert(`Location "${locationName}" created successfully!`);
      }

      resetLocationForm();
      setMapSubTab('list');
      fetchAllLocations();
    } catch (err: any) {
      alert('Error saving location: ' + err.message);
    } finally {
      setLocationSaving(false);
    }
  };

  const handleDeleteLocation = async (locationId: string, locName: string) => {
    if (!confirm(`Delete location "${locName}"? This cannot be undone.`)) return;
    
    try {
      const { error } = await supabase.from('locations').delete().eq('id', locationId);
      if (error) throw error;
      setAllLocations(locs => locs.filter(l => l.id !== locationId));
      if (selectedEditLocation?.id === locationId) resetLocationForm();
    } catch (err: any) {
      alert('Error deleting location: ' + err.message);
    }
  };

  // ============ SHOP FUNCTIONS FOR MAP TAB ============
  const fetchLocationShops = async (locationId: string) => {
    try {
      setShopsLoading(true);
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .eq('location_id', locationId)
        .order('name');
      
      if (error) throw error;
      setLocationShops(data || []);
    } catch (err: any) {
      console.error('Error fetching shops:', err);
    } finally {
      setShopsLoading(false);
    }
  };

  const fetchShopInventory = async (shopId: string) => {
    try {
      const { data, error } = await supabase
        .from('shop_inventory')
        .select(`
          *,
          item:items!shop_inventory_item_id_fkey(id, name, description, type, rarity, price, is_consumable),
          price_item:items!shop_inventory_price_item_id_fkey(id, name, rarity)
        `)
        .eq('shop_id', shopId)
        .order('created_at');
      
      if (error) throw error;
      setShopInventory(data || []);
    } catch (err: any) {
      console.error('Error fetching shop inventory:', err);
    }
  };

  const handleCreateShop = async () => {
    if (!selectedEditLocation || !newShopName.trim()) return;
    
    try {
      const { data, error } = await supabase
        .from('shops')
        .insert({
          location_id: selectedEditLocation.id,
          name: newShopName,
          description: newShopDescription || null,
          is_active: true,
          created_by: profile?.id
        })
        .select()
        .single();
      
      if (error) throw error;
      setLocationShops(prev => [...prev, data]);
      setNewShopName('');
      setNewShopDescription('');
    } catch (err: any) {
      alert('Error creating shop: ' + err.message);
    }
  };

  const handleDeleteShop = async (shopId: string, shopName: string) => {
    if (!confirm(`Delete shop "${shopName}"? This will also remove all inventory.`)) return;
    
    try {
      const { error } = await supabase.from('shops').delete().eq('id', shopId);
      if (error) throw error;
      setLocationShops(prev => prev.filter(s => s.id !== shopId));
      if (selectedShop?.id === shopId) {
        setSelectedShop(null);
        setShopInventory([]);
      }
    } catch (err: any) {
      alert('Error deleting shop: ' + err.message);
    }
  };

  const handleToggleShopActive = async (shop: Shop) => {
    try {
      const { error } = await supabase
        .from('shops')
        .update({ is_active: !shop.is_active })
        .eq('id', shop.id);
      
      if (error) throw error;
      setLocationShops(prev => prev.map(s => 
        s.id === shop.id ? { ...s, is_active: !s.is_active } : s
      ));
    } catch (err: any) {
      alert('Error toggling shop: ' + err.message);
    }
  };

  const handleAddItemToShop = async (itemId: string) => {
    if (!selectedShop) return;
    
    // Validate barter mode has a selected item
    if (addItemPriceType === 'item' && !addItemBarterItemId) {
      alert('Please select a trade item first');
      return;
    }
    
    try {
      const insertData: any = {
        shop_id: selectedShop.id,
        item_id: itemId,
        stock_quantity: addItemStock,
        // Use 0 for credits when in trade mode (database has NOT NULL constraint)
        price_credits: addItemPriceType === 'credits' ? addItemPrice : 0,
        price_item_id: addItemPriceType === 'item' ? addItemBarterItemId : null,
        price_item_quantity: addItemPriceType === 'item' ? addItemBarterQty : null
      };

      const { data, error } = await supabase
        .from('shop_inventory')
        .insert(insertData)
        .select(`
          *,
          item:items!shop_inventory_item_id_fkey(id, name, description, type, rarity, price, is_consumable),
          price_item:items!shop_inventory_price_item_id_fkey(id, name, rarity)
        `)
        .single();
      
      if (error) throw error;
      setShopInventory(prev => [...prev, data]);
      setAddItemSearch('');
      setSelectedItemToAdd(null);
      // Don't reset barter settings so user can add multiple items with same pricing
    } catch (err: any) {
      alert('Error adding item: ' + err.message);
    }
  };

  const handleRemoveItemFromShop = async (inventoryId: string) => {
    try {
      const { error } = await supabase.from('shop_inventory').delete().eq('id', inventoryId);
      if (error) throw error;
      setShopInventory(prev => prev.filter(i => i.id !== inventoryId));
    } catch (err: any) {
      alert('Error removing item: ' + err.message);
    }
  };

  const handleUpdateShopItemStock = async (inventoryId: string, newStock: number) => {
    try {
      const { error } = await supabase
        .from('shop_inventory')
        .update({ stock_quantity: newStock })
        .eq('id', inventoryId);
      
      if (error) throw error;
      setShopInventory(prev => prev.map(i => 
        i.id === inventoryId ? { ...i, stock_quantity: newStock } : i
      ));
    } catch (err: any) {
      alert('Error updating stock: ' + err.message);
    }
  };

  const filteredItemsForShop = allItems.filter(item =>
    item.name.toLowerCase().includes(addItemSearch.toLowerCase()) &&
    !shopInventory.some(si => si.item_id === item.id)
  );

  const filteredBarterItems = allItems.filter(item =>
    item.name.toLowerCase().includes(barterItemSearch.toLowerCase())
  );

  const filteredLocationsList = allLocations.filter(location => {
    const matchesSearch = location.name.toLowerCase().includes(locationSearchQuery.toLowerCase());
    const matchesIcon = locationFilterIcon === 'all' || location.icon === locationFilterIcon;
    return matchesSearch && matchesIcon;
  });

  // ============ ENCOUNTERS TAB FUNCTIONS ============
  useEffect(() => {
    if (activeTab === 'encounters') {
      fetchAllEncounters();
      // Also fetch characters and NPCs for adding to encounters
      fetchCharacters();
      fetchAllNPCs();
    }
  }, [activeTab]);

  const fetchAllEncounters = async () => {
    try {
      setEncountersLoading(true);
      const { data } = await supabase.from('encounters').select('*').order('created_at', { ascending: false });
      setAllEncounters(data || []);
    } catch (err: any) {
      console.error('Error fetching encounters:', err);
    } finally {
      setEncountersLoading(false);
    }
  };

  const handleCreateEncounter = async () => {
    if (!newEncounterName.trim()) {
      alert('Please enter an encounter name');
      return;
    }

    try {
      setEncounterSaving(true);
      const { error } = await supabase
        .from('encounters')
        .insert({
          name: newEncounterName,
          description: newEncounterDescription || null,
          status: 'draft',
          created_by: profile?.id,
        });

      if (error) throw error;
      alert(`Encounter "${newEncounterName}" created!`);
      setNewEncounterName('');
      setNewEncounterDescription('');
      setShowCreateEncounterModal(false);
      fetchAllEncounters();
    } catch (err: any) {
      alert('Error creating encounter: ' + err.message);
    } finally {
      setEncounterSaving(false);
    }
  };

  const handleDeleteEncounter = async (encounterId: string, encName: string) => {
    if (!confirm(`Delete encounter "${encName}"? This cannot be undone.`)) return;
    
    try {
      // Delete participants first
      await supabase.from('encounter_participants').delete().eq('encounter_id', encounterId);
      const { error } = await supabase.from('encounters').delete().eq('id', encounterId);
      if (error) throw error;
      setAllEncounters(enc => enc.filter(e => e.id !== encounterId));
      if (activeEncounter?.id === encounterId) {
        setActiveEncounter(null);
        setCombatParticipants([]);
      }
    } catch (err: any) {
      alert('Error deleting encounter: ' + err.message);
    }
  };

  // Load an encounter for combat tracking
  const loadEncounterForCombat = async (encounter: Encounter) => {
    setActiveEncounter(encounter);
    setEncounterRound(encounter.round_number);
    setEncounterCurrentTurn(encounter.current_turn);
    await fetchEncounterParticipants(encounter.id);
  };

  const fetchEncounterParticipants = async (encounterId: string) => {
    try {
      setParticipantsLoading(true);
      
      // Get participants
      const { data: participantsData, error: pError } = await supabase
        .from('encounter_participants')
        .select('*')
        .eq('encounter_id', encounterId)
        .order('initiative_order', { ascending: true, nullsFirst: false });
      
      if (pError) throw pError;
      
      // Get character data for player participants
      const characterIds = participantsData?.filter(p => p.character_id).map(p => p.character_id) || [];
      const { data: charactersData } = characterIds.length > 0 
        ? await supabase.from('characters').select('*').in('id', characterIds)
        : { data: [] };
      
      // Get NPC data
      const npcIds = participantsData?.filter(p => p.npc_id).map(p => p.npc_id) || [];
      const { data: npcsData } = npcIds.length > 0
        ? await supabase.from('npcs').select('*').in('id', npcIds)
        : { data: [] };
      
      // Build combat participants
      const participants: CombatParticipant[] = (participantsData || []).map((p: any) => {
        const char = charactersData?.find(c => c.id === p.character_id);
        const npc = npcsData?.find(n => n.id === p.npc_id);
        
        return {
          id: p.id,
          name: char?.name || npc?.name || 'Unknown',
          type: p.character_id ? 'player' : 'npc',
          entityId: p.character_id || p.npc_id,
          initiative: p.initiative_roll,
          currentHp: p.current_hp ?? (char?.current_hp || npc?.current_hp || 0),
          maxHp: p.max_hp ?? (char?.max_hp || npc?.max_hp || 0),
          ac: char?.ac || npc?.ac || 10,
          notes: p.notes || '',
          isActive: p.is_active,
          entityData: char || npc,
        };
      });
      
      setCombatParticipants(participants);
    } catch (err: any) {
      console.error('Error fetching participants:', err);
    } finally {
      setParticipantsLoading(false);
    }
  };

  const addParticipantToEncounter = async (type: 'player' | 'npc', entityId: string) => {
    if (!activeEncounter) return;
    
    try {
      let currentHp, maxHp;
      
      if (type === 'player') {
        const char = characters.find(c => c.id === entityId);
        if (!char) return;
        currentHp = char.current_hp;
        maxHp = char.max_hp;
      } else {
        const npc = allNPCs.find(n => n.id === entityId);
        if (!npc) return;
        currentHp = npc.current_hp;
        maxHp = npc.max_hp;
      }
      
      const { error } = await supabase.from('encounter_participants').insert({
        encounter_id: activeEncounter.id,
        character_id: type === 'player' ? entityId : null,
        npc_id: type === 'npc' ? entityId : null,
        participant_type: type === 'player' ? 'player' : 'enemy',
        current_hp: currentHp,
        max_hp: maxHp,
        is_active: true,
        notes: '',
      });
      
      if (error) throw error;
      await fetchEncounterParticipants(activeEncounter.id);
      setShowAddParticipantModal(false);
    } catch (err: any) {
      alert('Error adding participant: ' + err.message);
    }
  };

  // Add all party members at once
  const addAllPlayersToEncounter = async () => {
    if (!activeEncounter) return;
    
    const availablePlayers = characters.filter(c => !combatParticipants.some(p => p.entityId === c.id));
    if (availablePlayers.length === 0) return;
    
    try {
      const inserts = availablePlayers.map(char => ({
        encounter_id: activeEncounter.id,
        character_id: char.id,
        npc_id: null,
        participant_type: 'player',
        current_hp: char.current_hp,
        max_hp: char.max_hp,
        is_active: true,
        notes: '',
      }));
      
      const { error } = await supabase.from('encounter_participants').insert(inserts);
      if (error) throw error;
      await fetchEncounterParticipants(activeEncounter.id);
    } catch (err: any) {
      alert('Error adding players: ' + err.message);
    }
  };

  // Add multiple instances of an NPC (creates duplicate entries for "generic" enemies)
  const addMultipleNpcsToEncounter = async (npcId: string, quantity: number) => {
    if (!activeEncounter || quantity < 1) return;
    
    const npc = allNPCs.find(n => n.id === npcId);
    if (!npc) return;
    
    try {
      const inserts = Array.from({ length: quantity }, () => ({
        encounter_id: activeEncounter.id,
        character_id: null,
        npc_id: npcId,
        participant_type: 'enemy',
        current_hp: npc.current_hp,
        max_hp: npc.max_hp,
        is_active: true,
        notes: '',
      }));
      
      const { error } = await supabase.from('encounter_participants').insert(inserts);
      if (error) throw error;
      await fetchEncounterParticipants(activeEncounter.id);
      // Reset quantity for this NPC
      setNpcQuantities(q => ({ ...q, [npcId]: 1 }));
    } catch (err: any) {
      alert('Error adding NPCs: ' + err.message);
    }
  };

  const removeParticipantFromEncounter = async (participantId: string) => {
    if (!activeEncounter) return;
    
    try {
      const { error } = await supabase.from('encounter_participants').delete().eq('id', participantId);
      if (error) throw error;
      setCombatParticipants(p => p.filter(pt => pt.id !== participantId));
    } catch (err: any) {
      alert('Error removing participant: ' + err.message);
    }
  };

  const updateParticipantInitiative = async (participantId: string, initiative: number) => {
    try {
      const { error } = await supabase
        .from('encounter_participants')
        .update({ initiative_roll: initiative, initiative_order: initiative })
        .eq('id', participantId);
      
      if (error) throw error;
      
      // Update local state and sort
      setCombatParticipants(prev => {
        const updated = prev.map(p => p.id === participantId ? { ...p, initiative } : p);
        return updated.sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0));
      });
    } catch (err: any) {
      console.error('Error updating initiative:', err);
    }
  };

  const updateParticipantHp = async (participantId: string, newHp: number, entityId: string, type: 'player' | 'npc') => {
    try {
      const clampedHp = Math.max(0, newHp);
      
      // Update encounter participant
      await supabase.from('encounter_participants').update({ current_hp: clampedHp }).eq('id', participantId);
      
      // Also update the actual character/NPC - THIS syncs to player screens
      if (type === 'player') {
        await supabase.from('characters').update({ current_hp: clampedHp }).eq('id', entityId);
      } else {
        await supabase.from('npcs').update({ current_hp: clampedHp }).eq('id', entityId);
      }
      
      setCombatParticipants(prev => prev.map(p => p.id === participantId ? { ...p, currentHp: clampedHp } : p));
      
      // Clear HP change input after applying
      setHpChangeInput(prev => ({ ...prev, [participantId]: '' }));
    } catch (err: any) {
      console.error('Error updating HP:', err);
    }
  };

  const applyHpChange = (participant: CombatParticipant, change: number) => {
    const newHp = Math.max(0, Math.min(participant.maxHp, participant.currentHp + change));
    updateParticipantHp(participant.id, newHp, participant.entityId, participant.type);
  };

  const updateParticipantNotes = async (participantId: string, notes: string) => {
    try {
      await supabase.from('encounter_participants').update({ notes }).eq('id', participantId);
      setCombatParticipants(prev => prev.map(p => p.id === participantId ? { ...p, notes } : p));
    } catch (err: any) {
      console.error('Error updating notes:', err);
    }
  };

  // Fetch player inventory and abilities for combat management
  const fetchCombatPlayerResources = async (characterId: string) => {
    // Track which fetch is current to prevent race conditions
    combatResourcesFetchIdRef.current = characterId;
    setCombatResourcesLoading(true);
    try {
      // Fetch inventory with items
      const { data: invData } = await supabase
        .from('inventory')
        .select(`
          *,
          item:items(*)
        `)
        .eq('character_id', characterId)
        .order('is_equipped', { ascending: false });
      
      // Bail out if a different character was selected while we were fetching
      if (combatResourcesFetchIdRef.current !== characterId) return;
      setCombatPlayerInventory(invData || []);

      // Auto-seed class features into the database if not already granted
      const char = characters.find(c => c.id === characterId);
      if (char?.class) {
        const charClass = CHARACTER_CLASSES.find(c => c.name === char.class || c.id === char.class?.toLowerCase());
        if (charClass && charClass.classFeatures.length > 0) {
          // Check which class features are already granted
          const { data: existingClassAbilities } = await supabase
            .from('character_abilities')
            .select('*, ability:abilities(*)')
            .eq('character_id', characterId)
            .eq('source_type', 'class');
          
          const existingNames = (existingClassAbilities || []).map((ca: any) => ca.ability?.name).filter(Boolean);
          const missingFeatures = charClass.classFeatures.filter(f => !existingNames.includes(f.name));
          
          for (const feat of missingFeatures) {
            // Map ClassFeature type to AbilityType
            const typeMap: Record<string, string> = {
              'ACTION': 'action',
              'BONUS': 'bonus_action',
              'HIT/STEALTH': 'utility',
              'ON HIT': 'reaction',
              'passive': 'passive'
            };
            
            // Check if ability already exists in abilities table
            const { data: existingAbility } = await supabase
              .from('abilities')
              .select('id')
              .eq('name', feat.name)
              .eq('source', 'class')
              .eq('class_name', charClass.name)
              .maybeSingle();
            
            let abilityId = existingAbility?.id;
            
            if (!abilityId) {
              // Create the ability in the abilities table
              const { data: newAbility } = await supabase
                .from('abilities')
                .insert({
                  name: feat.name,
                  description: feat.description,
                  type: typeMap[feat.type] || 'action',
                  charge_type: feat.charges ? 'uses' : 'infinite',
                  max_charges: feat.charges || null,
                  effects: feat.effects || [],
                  source: 'class',
                  class_name: charClass.name,
                })
                .select('id')
                .single();
              abilityId = newAbility?.id;
            }
            
            if (abilityId) {
              // Grant to character
              await supabase
                .from('character_abilities')
                .insert({
                  character_id: characterId,
                  ability_id: abilityId,
                  current_charges: feat.charges || 0,
                  source_type: 'class',
                  source_id: charClass.id,
                });
            }
          }
        }
      }

      // Fetch character abilities (including freshly seeded class features)
      const { data: abilitiesData } = await supabase
        .from('character_abilities')
        .select(`
          *,
          ability:abilities(*)
        `)
        .eq('character_id', characterId);
      
      // Only set state if this is still the current fetch
      if (combatResourcesFetchIdRef.current === characterId) {
        setCombatPlayerAbilities(abilitiesData || []);
      }
    } catch (err: any) {
      console.error('Error fetching combat resources:', err);
    } finally {
      if (combatResourcesFetchIdRef.current === characterId) {
        setCombatResourcesLoading(false);
      }
    }
  };

  // Use a consumable on a player during combat
  const useCombatConsumable = async (inventoryItemId: string, item: any, characterId: string) => {
    if (!item || !item.is_consumable) return;
    
    if (!confirm(`Use ${item.name} on this character?`)) return;
    
    try {
      // Get current character data
      const { data: charData } = await supabase
        .from('characters')
        .select('*')
        .eq('id', characterId)
        .single();
      
      if (!charData) throw new Error('Character not found');

      // Calculate new stats
      const updates: any = {
        str: charData.str + (item.str_mod || 0),
        dex: charData.dex + (item.dex_mod || 0),
        con: charData.con + (item.con_mod || 0),
        wis: charData.wis + (item.wis_mod || 0),
        int: charData.int + (item.int_mod || 0),
        cha: charData.cha + (item.cha_mod || 0),
        ac: charData.ac + (item.ac_mod || 0),
        speed: (charData.speed || 30) + (item.speed_mod || 0),
        initiative_modifier: (charData.initiative_modifier || 0) + (item.init_mod || 0),
        implant_capacity: (charData.implant_capacity || 3) + (item.ic_mod || 0),
      };

      // Handle HP
      if (item.hp_mod && item.hp_mod !== 0) {
        const hpModType = item.hp_mod_type || 'heal';
        if (hpModType === 'heal') {
          updates.current_hp = Math.min(charData.current_hp + item.hp_mod, charData.max_hp);
        } else if (hpModType === 'max_hp') {
          updates.max_hp = charData.max_hp + item.hp_mod;
        }
      }

      // Update character
      await supabase.from('characters').update(updates).eq('id', characterId);

      // Get inventory item quantity
      const invItem = combatPlayerInventory.find(i => i.id === inventoryItemId);
      if (invItem) {
        if (invItem.quantity <= 1) {
          await supabase.from('inventory').delete().eq('id', inventoryItemId);
        } else {
          await supabase.from('inventory').update({ quantity: invItem.quantity - 1 }).eq('id', inventoryItemId);
        }
      }

      // Update combat participant HP if it was affected
      if (updates.current_hp !== undefined) {
        const participant = combatParticipants.find(p => p.entityId === characterId && p.type === 'player');
        if (participant) {
          updateParticipantHp(participant.id, updates.current_hp, characterId, 'player');
        }
      }

      // Refresh resources
      await fetchCombatPlayerResources(characterId);
      
      alert(`Used ${item.name}!`);
    } catch (err: any) {
      console.error('Error using consumable:', err);
      alert('Failed to use consumable: ' + err.message);
    }
  };

  // Use ability charge during combat
  const useCombatAbilityCharge = async (characterAbilityId: string, abilityName: string, currentCharges: number) => {
    if (currentCharges <= 0) {
      alert('No charges remaining!');
      return;
    }
    
    if (!confirm(`Use one charge of ${abilityName}? (${currentCharges - 1} charges will remain)`)) return;
    
    try {
      await supabase
        .from('character_abilities')
        .update({ current_charges: currentCharges - 1 })
        .eq('id', characterAbilityId);
      
      // Update local state
      setCombatPlayerAbilities(prev => prev.map(ca => 
        ca.id === characterAbilityId ? { ...ca, current_charges: currentCharges - 1 } : ca
      ));
      
      alert(`Used ${abilityName}! ${currentCharges - 1} charges remaining.`);
    } catch (err: any) {
      console.error('Error using ability charge:', err);
      alert('Failed to use ability: ' + err.message);
    }
  };

  const handleNotesChange = (participantId: string, value: string) => {
    // Update local state immediately
    setNotesInput(prev => ({ ...prev, [participantId]: value }));
    
    // Clear existing debounce timer
    if (notesDebounceRef.current[participantId]) {
      clearTimeout(notesDebounceRef.current[participantId]);
    }
    
    // Debounce the database update (500ms after stop typing)
    notesDebounceRef.current[participantId] = setTimeout(() => {
      updateParticipantNotes(participantId, value);
    }, 500);
  };

  const sortParticipantsByInitiative = () => {
    setCombatParticipants(prev => [...prev].sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0)));
  };

  // Select a combat participant and auto-load their resources
  const selectCombatParticipant = (participant: CombatParticipant | null) => {
    if (!participant) {
      setSelectedCombatParticipantId(null);
      combatResourcesFetchIdRef.current = null;
      setCombatPlayerInventory([]);
      setCombatPlayerAbilities([]);
      return;
    }
    // Skip if already selected (prevents unnecessary re-fetches)
    if (participant.id === selectedCombatParticipantId) return;
    setSelectedCombatParticipantId(participant.id);
    // Auto-load resources for players
    if (participant.type === 'player') {
      fetchCombatPlayerResources(participant.entityId);
    } else {
      combatResourcesFetchIdRef.current = null;
      setCombatPlayerInventory([]);
      setCombatPlayerAbilities([]);
    }
  };

  // Get HP color based on percentage
  const getHpBarColor = (current: number, max: number) => {
    const pct = max > 0 ? current / max : 0;
    if (pct > 0.6) return 'var(--color-cyber-green)';
    if (pct > 0.3) return 'var(--color-cyber-yellow)';
    return 'var(--color-cyber-magenta)';
  };

  const nextTurn = async () => {
    if (!activeEncounter || combatParticipants.length === 0) return;
    
    const activeParticipants = combatParticipants.filter(p => p.isActive);
    if (activeParticipants.length === 0) return;
    
    let newTurn = encounterCurrentTurn + 1;
    let newRound = encounterRound;
    
    if (newTurn >= activeParticipants.length) {
      newTurn = 0;
      newRound += 1;
    }
    
    setEncounterCurrentTurn(newTurn);
    setEncounterRound(newRound);
    
    // Auto-select the new current participant
    const newCurrentParticipant = activeParticipants[newTurn];
    if (newCurrentParticipant) {
      setSelectedCombatParticipantId(null); // Reset to force re-select
      selectCombatParticipant(newCurrentParticipant);
    }
    
    // Update in database
    await supabase.from('encounters').update({
      current_turn: newTurn,
      round_number: newRound,
    }).eq('id', activeEncounter.id);
  };

  const prevTurn = async () => {
    if (!activeEncounter) return;
    
    const activeParticipants = combatParticipants.filter(p => p.isActive);
    if (activeParticipants.length === 0) return;
    
    let newTurn = encounterCurrentTurn - 1;
    let newRound = encounterRound;
    
    if (newTurn < 0) {
      if (newRound > 1) {
        newRound -= 1;
        newTurn = activeParticipants.length - 1;
      } else {
        newTurn = 0;
      }
    }
    
    setEncounterCurrentTurn(newTurn);
    setEncounterRound(newRound);
    
    // Auto-select the new current participant
    const newCurrentParticipant = activeParticipants[newTurn];
    if (newCurrentParticipant) {
      setSelectedCombatParticipantId(null); // Reset to force re-select
      selectCombatParticipant(newCurrentParticipant);
    }
    
    await supabase.from('encounters').update({
      current_turn: newTurn,
      round_number: newRound,
    }).eq('id', activeEncounter.id);
  };

  const startEncounter = async () => {
    if (!activeEncounter) return;
    
    // Sort by initiative first
    sortParticipantsByInitiative();
    
    await supabase.from('encounters').update({
      status: 'active',
      started_at: new Date().toISOString(),
      round_number: 1,
      current_turn: 0,
    }).eq('id', activeEncounter.id);
    
    setActiveEncounter({ ...activeEncounter, status: 'active' });
    setEncounterRound(1);
    setEncounterCurrentTurn(0);
    fetchAllEncounters();
    
    // Auto-select first participant
    const activeParticipants = combatParticipants.filter(p => p.isActive);
    if (activeParticipants.length > 0) {
      selectCombatParticipant(activeParticipants[0]);
    }
    
    // Auto-lock players when encounter starts
    await togglePlayerLock(true, `Combat: ${activeEncounter.name}`);
  };

  const endEncounter = async () => {
    if (!activeEncounter) return;
    
    await supabase.from('encounters').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    }).eq('id', activeEncounter.id);
    
    setActiveEncounter({ ...activeEncounter, status: 'completed' });
    fetchAllEncounters();
    
    // Auto-unlock players when encounter ends
    await togglePlayerLock(false, null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'var(--color-cyber-cyan)';
      case 'active': return 'var(--color-cyber-yellow)';
      case 'completed': return 'var(--color-cyber-green)';
      case 'archived': return 'var(--color-cyber-purple)';
      default: return 'var(--color-cyber-cyan)';
    }
  };

  // ============ MISSIONS TAB FUNCTIONS ============
  const MISSION_TYPES: MissionType[] = ['Character Mission', 'Past Time', 'Encounter', 'Side Mission', 'MAIN MISSION'];
  const MISSION_DIFFICULTIES: MissionDifficulty[] = ['Low', 'Easy', 'Moderate', 'Difficult', 'Dangerous', 'Extreme', 'Suicide Mission'];

  useEffect(() => {
    if (activeTab === 'missions') {
      fetchAllMissions();
      fetchAllItems(); // Load items for reward selection
    }
  }, [activeTab]);

  const fetchAllMissions = async () => {
    try {
      setMissionsLoading(true);
      
      // Fetch missions with reward items
      const { data: missionsData, error } = await supabase
        .from('missions')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Enrich with character and item details
      const enrichedMissions: MissionWithDetails[] = await Promise.all(
        (missionsData || []).map(async (mission) => {
          const enriched: MissionWithDetails = { ...mission };
          
          // Get assigned characters
          if (mission.assigned_to && mission.assigned_to.length > 0) {
            const { data: chars } = await supabase
              .from('characters')
              .select('id, name, class')
              .in('id', mission.assigned_to);
            enriched.assigned_characters = chars || [];
          }
          
          // Get reward items
          if (mission.reward_item_ids && mission.reward_item_ids.length > 0) {
            const { data: items } = await supabase
              .from('items')
              .select('id, name, rarity, type')
              .in('id', mission.reward_item_ids);
            enriched.reward_items = items || [];
          }
          
          return enriched;
        })
      );
      
      setAllMissions(enrichedMissions);
    } catch (err: any) {
      console.error('Error fetching missions:', err);
    } finally {
      setMissionsLoading(false);
    }
  };

  const resetMissionForm = () => {
    setMissionForm({
      title: '',
      description: '',
      type: 'Side Mission',
      difficulty: 'Moderate',
      objectives: [''],
      assigned_to: [],
      reward_item_ids: [],
      reward_credits: 0,
      reward_mode: 'each',
      saveAsDraft: false
    });
  };

  const handleCreateMission = async () => {
    if (!missionForm.title.trim()) {
      alert('Mission title is required');
      return;
    }
    
    try {
      setMissionSaving(true);
      
      const { error } = await supabase
        .from('missions')
        .insert({
          title: missionForm.title.trim(),
          description: missionForm.description.trim() || null,
          type: missionForm.type,
          difficulty: missionForm.difficulty,
          objectives: missionForm.objectives.filter(o => o.trim()),
          assigned_to: missionForm.assigned_to.length > 0 ? missionForm.assigned_to : null,
          reward_item_ids: missionForm.reward_item_ids.length > 0 ? missionForm.reward_item_ids : null,
          reward_credits: missionForm.reward_credits || 0,
          reward_mode: missionForm.reward_mode,
          status: missionForm.saveAsDraft ? 'draft' : 'active',
          created_by: profile?.id || null
        });
      
      if (error) throw error;
      
      resetMissionForm();
      setShowCreateMissionModal(false);
      fetchAllMissions();
    } catch (err: any) {
      console.error('Error creating mission:', err);
      alert('Failed to create mission: ' + err.message);
    } finally {
      setMissionSaving(false);
    }
  };

  const handleUpdateMissionStatus = async (missionId: string, status: MissionStatus) => {
    // If completing a mission with 'single' mode rewards, open distribution modal
    if (status === 'completed' && selectedMission) {
      const hasRewards = (selectedMission.reward_item_ids?.length || 0) > 0 || (selectedMission.reward_credits || 0) > 0;
      
      if (hasRewards && selectedMission.reward_mode === 'single') {
        // Open distribution modal for single-recipient mode
        setShowRewardDistributionModal(true);
        return;
      } else if (hasRewards && selectedMission.reward_mode === 'each') {
        // Auto-distribute to all assigned players
        await distributeRewardsToAll(selectedMission);
      }
    }
    
    try {
      const updateData: any = { status };
      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from('missions')
        .update(updateData)
        .eq('id', missionId);
      
      if (error) throw error;
      
      fetchAllMissions();
      if (selectedMission?.id === missionId) {
        setSelectedMission(prev => prev ? { ...prev, status, completed_at: updateData.completed_at || prev.completed_at } : null);
      }
    } catch (err: any) {
      console.error('Error updating mission status:', err);
      alert('Failed to update mission: ' + err.message);
    }
  };

  // Distribute rewards to all assigned players (for 'each' mode)
  const distributeRewardsToAll = async (mission: MissionWithDetails) => {
    const assignedCharIds = mission.assigned_to || characters.map(c => c.id);
    
    try {
      // Give items to each player
      if (mission.reward_item_ids?.length) {
        for (const charId of assignedCharIds) {
          for (const itemId of mission.reward_item_ids) {
            await supabase.from('inventory').insert({
              character_id: charId,
              item_id: itemId,
              quantity: 1,
              equipped: false
            });
          }
        }
      }
      
      // Give credits to each player
      if (mission.reward_credits && mission.reward_credits > 0) {
        for (const charId of assignedCharIds) {
          const char = characters.find(c => c.id === charId);
          if (char) {
            await supabase.from('characters').update({
              usd: (char.usd || 0) + mission.reward_credits
            }).eq('id', charId);
          }
        }
      }
    } catch (err) {
      console.error('Error distributing rewards:', err);
    }
  };

  // Complete mission with selected reward distribution (for 'single' mode)
  const handleCompleteWithDistribution = async () => {
    if (!selectedMission) return;
    
    try {
      // Distribute items to selected players
      for (const [itemId, charId] of Object.entries(rewardDistribution)) {
        if (charId) {
          await supabase.from('inventory').insert({
            character_id: charId,
            item_id: itemId,
            quantity: 1,
            equipped: false
          });
        }
      }
      
      // Distribute credits to selected players
      for (const [charId, amount] of Object.entries(creditDistribution)) {
        if (amount > 0) {
          const char = characters.find(c => c.id === charId);
          if (char) {
            await supabase.from('characters').update({
              usd: (char.usd || 0) + amount
            }).eq('id', charId);
          }
        }
      }
      
      // Update mission status
      const { error } = await supabase
        .from('missions')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', selectedMission.id);
      
      if (error) throw error;
      
      // Reset and close
      setShowRewardDistributionModal(false);
      setRewardDistribution({});
      setCreditDistribution({});
      fetchAllMissions();
      setSelectedMission(prev => prev ? { ...prev, status: 'completed', completed_at: new Date().toISOString() } : null);
    } catch (err: any) {
      console.error('Error completing mission with distribution:', err);
      alert('Failed to complete mission: ' + err.message);
    }
  };

  const handleDeleteMission = async (missionId: string) => {
    if (!confirm('Are you sure you want to delete this mission? This cannot be undone.')) return;
    
    try {
      const { error } = await supabase.from('missions').delete().eq('id', missionId);
      if (error) throw error;
      
      if (selectedMission?.id === missionId) {
        setSelectedMission(null);
      }
      fetchAllMissions();
    } catch (err: any) {
      console.error('Error deleting mission:', err);
      alert('Failed to delete mission: ' + err.message);
    }
  };

  const handleEditMission = (mission: MissionWithDetails) => {
    setMissionForm({
      title: mission.title,
      description: mission.description || '',
      type: mission.type,
      difficulty: mission.difficulty,
      objectives: mission.objectives.length > 0 ? mission.objectives : [''],
      assigned_to: mission.assigned_to || [],
      reward_item_ids: mission.reward_item_ids || [],
      reward_credits: mission.reward_credits || 0,
      reward_mode: mission.reward_mode || 'each',
      saveAsDraft: mission.status === 'draft'
    });
    setSelectedMission(mission);
    setShowCreateMissionModal(true);
  };

  const handleSaveMissionEdit = async () => {
    if (!selectedMission || !missionForm.title.trim()) return;
    
    try {
      setMissionSaving(true);
      
      const { error } = await supabase
        .from('missions')
        .update({
          title: missionForm.title.trim(),
          description: missionForm.description.trim() || null,
          type: missionForm.type,
          difficulty: missionForm.difficulty,
          objectives: missionForm.objectives.filter(o => o.trim()),
          assigned_to: missionForm.assigned_to.length > 0 ? missionForm.assigned_to : null,
          reward_item_ids: missionForm.reward_item_ids.length > 0 ? missionForm.reward_item_ids : null,
          reward_credits: missionForm.reward_credits || 0,
          reward_mode: missionForm.reward_mode
        })
        .eq('id', selectedMission.id);
      
      if (error) throw error;
      
      resetMissionForm();
      setSelectedMission(null);
      setShowCreateMissionModal(false);
      fetchAllMissions();
    } catch (err: any) {
      console.error('Error updating mission:', err);
      alert('Failed to update mission: ' + err.message);
    } finally {
      setMissionSaving(false);
    }
  };

  const getMissionTypeColor = (type: MissionType) => {
    switch (type) {
      case 'MAIN MISSION': return 'var(--color-cyber-yellow)';
      case 'Side Mission': return 'var(--color-cyber-green)';
      case 'Character Mission': return 'var(--color-cyber-cyan)';
      case 'Encounter': return 'var(--color-cyber-magenta)';
      case 'Past Time': return 'var(--color-cyber-purple)';
      default: return 'var(--color-cyber-cyan)';
    }
  };

  const getDifficultyColor = (difficulty: MissionDifficulty) => {
    switch (difficulty) {
      case 'Low': return '#4ade80';
      case 'Easy': return '#86efac';
      case 'Moderate': return 'var(--color-cyber-yellow)';
      case 'Difficult': return '#fb923c';
      case 'Dangerous': return '#f87171';
      case 'Extreme': return '#ef4444';
      case 'Suicide Mission': return '#dc2626';
      default: return 'var(--color-cyber-cyan)';
    }
  };

  const getMissionStatusColor = (status: MissionStatus) => {
    switch (status) {
      case 'draft': return '#6B7280'; // Gray for draft
      case 'active': return 'var(--color-cyber-yellow)';
      case 'completed': return 'var(--color-cyber-green)';
      case 'failed': return 'var(--color-cyber-magenta)';
      default: return 'var(--color-cyber-cyan)';
    }
  };

  const filteredMissionsList = allMissions.filter(mission => {
    const matchesSearch = mission.title.toLowerCase().includes(missionSearchQuery.toLowerCase()) ||
                         (mission.description?.toLowerCase().includes(missionSearchQuery.toLowerCase()));
    const matchesStatus = missionFilterStatus === 'all' || mission.status === missionFilterStatus;
    const matchesType = missionFilterType === 'all' || mission.type === missionFilterType;
    return matchesSearch && matchesStatus && matchesType;
  });

  // ============ NPCs TAB FUNCTIONS ============
  useEffect(() => {
    if (activeTab === 'npcs') {
      fetchAllNPCs();
    }
  }, [activeTab]);

  const fetchAllNPCs = async () => {
    try {
      setNpcsLoading(true);
      const { data } = await supabase.from('npcs').select('*').order('name');
      setAllNPCs(data || []);
    } catch (err: any) {
      console.error('Error fetching NPCs:', err);
    } finally {
      setNpcsLoading(false);
    }
  };

  const resetNpcForm = () => {
    setNpcName('');
    setNpcType('Enemy');
    setNpcDisposition('Hostile');
    setNpcDescription('');
    setNpcMaxHp(10);
    setNpcCurrentHp(10);
    setNpcAc(10);
    setNpcInitMod(0);
    setNpcStr(10);
    setNpcDex(10);
    setNpcCon(10);
    setNpcWis(10);
    setNpcInt(10);
    setNpcCha(10);
    setNpcAbilities([]);
    setNpcDmNotes('');
    setNpcThreeWords('');
    setNpcIsAlive(true);
    setSelectedEditNPC(null);
  };

  const loadNpcForEdit = (npc: NPC) => {
    setSelectedEditNPC(npc);
    setNpcName(npc.name);
    setNpcType(npc.type);
    setNpcDisposition(npc.disposition);
    setNpcDescription(npc.description || '');
    setNpcMaxHp(npc.max_hp);
    setNpcCurrentHp(npc.current_hp);
    setNpcAc(npc.ac);
    setNpcInitMod(npc.initiative_modifier || 0);
    setNpcStr(npc.str);
    setNpcDex(npc.dex);
    setNpcCon(npc.con);
    setNpcWis(npc.wis);
    setNpcInt(npc.int);
    setNpcCha(npc.cha);
    setNpcAbilities(npc.abilities || []);
    setNpcDmNotes(npc.dm_notes || '');
    setNpcThreeWords(npc.three_words || '');
    setNpcIsAlive(npc.is_alive);
    setNpcsSubTab('list');
  };

  const handleSaveNpc = async () => {
    if (!npcName.trim()) {
      alert('Please enter a name');
      return;
    }

    try {
      setNpcSaving(true);
      const npcData = {
        name: npcName,
        type: npcType,
        disposition: npcDisposition,
        description: npcDescription || null,
        max_hp: npcMaxHp,
        current_hp: npcCurrentHp,
        ac: npcAc,
        initiative_modifier: npcInitMod,
        str: npcStr,
        dex: npcDex,
        con: npcCon,
        wis: npcWis,
        int: npcInt,
        cha: npcCha,
        abilities: npcAbilities,
        dm_notes: npcDmNotes || null,
        three_words: npcThreeWords || null,
        is_alive: npcIsAlive,
        is_active: true,
        created_by: profile?.id,
      };

      if (selectedEditNPC) {
        const { error } = await supabase.from('npcs').update(npcData).eq('id', selectedEditNPC.id);
        if (error) throw error;
        alert(`NPC "${npcName}" updated!`);
      } else {
        const { error } = await supabase.from('npcs').insert(npcData);
        if (error) throw error;
        alert(`NPC "${npcName}" created!`);
      }

      resetNpcForm();
      fetchAllNPCs();
      setNpcsSubTab('list');
    } catch (err: any) {
      alert('Error saving NPC: ' + err.message);
    } finally {
      setNpcSaving(false);
    }
  };

  const handleDeleteNpc = async (npcId: string, npcNameStr: string) => {
    if (!confirm(`Delete NPC "${npcNameStr}"? This cannot be undone.`)) return;

    try {
      const { error } = await supabase.from('npcs').delete().eq('id', npcId);
      if (error) throw error;
      setAllNPCs(npcs => npcs.filter(n => n.id !== npcId));
      if (selectedEditNPC?.id === npcId) resetNpcForm();
    } catch (err: any) {
      alert('Error deleting NPC: ' + err.message);
    }
  };

  const handleAddNpcAbility = () => {
    setNpcAbilities([...npcAbilities, { name: '', damage: '', effect: '' }]);
  };

  const handleUpdateNpcAbility = (index: number, field: keyof NPCAbility, value: string) => {
    const updated = [...npcAbilities];
    updated[index] = { ...updated[index], [field]: value };
    setNpcAbilities(updated);
  };

  const handleRemoveNpcAbility = (index: number) => {
    setNpcAbilities(npcAbilities.filter((_, i) => i !== index));
  };

  const getNpcTypeColor = (type: NPCType) => {
    switch (type) {
      case 'Enemy': return 'var(--color-cyber-magenta)';
      case 'Boss': return 'var(--color-cyber-magenta)';
      case 'Mini-Boss': return 'var(--color-cyber-magenta)';
      case 'Friendly NPC': return 'var(--color-cyber-green)';
      case 'Vendor': return 'var(--color-cyber-yellow)';
      case 'Quest Giver': return 'var(--color-cyber-cyan)';
      case 'Neutral NPC': return 'var(--color-cyber-purple)';
      case 'Civilian': return 'var(--color-cyber-cyan)';
      default: return 'var(--color-cyber-cyan)';
    }
  };

  const filteredNpcsList = allNPCs.filter(npc => {
    const matchesSearch = npc.name.toLowerCase().includes(npcSearchQuery.toLowerCase());
    const matchesType = npcFilterType === 'all' || npc.type === npcFilterType;
    const matchesAlive = npcFilterAlive === 'all' || 
      (npcFilterAlive === 'alive' && npc.is_alive) || 
      (npcFilterAlive === 'dead' && !npc.is_alive);
    return matchesSearch && matchesType && matchesAlive;
  });

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'players', label: 'PLAYERS', icon: '👥' },
    { id: 'items', label: 'ITEMS', icon: '🎒' },
    { id: 'abilities', label: 'ABILITIES', icon: '⚡' },
    { id: 'npcs', label: 'NPCs', icon: '👾' },
    { id: 'map', label: 'MAP', icon: '🗺️' },
    { id: 'encounters', label: 'ENCOUNTERS', icon: '⚔️' },
    { id: 'missions', label: 'MISSIONS', icon: '📋' },
    { id: 'settings', label: 'SETTINGS', icon: '⚙️' },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0D1117 0%, #010409 50%, #0D1117 100%)', backgroundAttachment: 'fixed' }}>
      <div className="glass-panel" style={{ borderRadius: 0, borderBottom: '2px solid var(--color-cyber-yellow)' }}>
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-yellow)' }}>
            👑 DM CONTROL CENTER
          </h1>
          <div className="flex items-center gap-4">
            {/* Player Lock Toggle */}
            <button
              onClick={() => togglePlayerLock(!playersLocked, playersLocked ? null : 'Manual lock')}
              disabled={lockLoading}
              className="px-4 py-2 rounded text-sm flex items-center gap-2 transition-all"
              style={{
                background: playersLocked ? 'var(--color-cyber-magenta)' : 'transparent',
                border: `2px solid ${playersLocked ? 'var(--color-cyber-magenta)' : 'var(--color-cyber-green)'}`,
                color: playersLocked ? 'white' : 'var(--color-cyber-green)',
                fontFamily: 'var(--font-mono)',
                fontWeight: 'bold',
                opacity: lockLoading ? 0.5 : 1
              }}
              title={playersLocked ? `Players locked: ${lockReason || 'Manual'}` : 'Click to lock players'}
            >
              {playersLocked ? '🔒 LOCKED' : '🔓 UNLOCKED'}
            </button>
            <button
              onClick={() => navigate('/rules')}
              className="px-3 py-1.5 rounded text-sm transition-all hover:opacity-80"
              style={{
                border: '1px solid var(--color-cyber-cyan)',
                color: 'var(--color-cyber-cyan)',
                fontFamily: 'var(--font-mono)',
                background: 'transparent'
              }}
            >
              📜 RULES
            </button>
            <span className="text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
              ADMIN: {profile?.username || 'DM'}
            </span>
            <button onClick={handleSignOut} className="px-4 py-2 rounded text-sm" style={{
              background: 'transparent',
              border: '1px solid var(--color-cyber-magenta)',
              color: 'var(--color-cyber-magenta)',
              fontFamily: 'var(--font-mono)'
            }}>
              LOGOUT
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="glass-panel p-2 mb-6" style={{ border: '1px solid var(--color-cyber-green)' }}>
          <div className="flex gap-2 flex-wrap">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="px-4 py-2 text-sm rounded transition-all"
                style={{
                  fontFamily: 'var(--font-mono)',
                  backgroundColor: activeTab === tab.id ? 'var(--color-cyber-yellow)' : 'transparent',
                  color: activeTab === tab.id ? '#0D1117' : 'var(--color-cyber-cyan)',
                  border: `1px solid ${activeTab === tab.id ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-green)'}`,
                  fontWeight: activeTab === tab.id ? 'bold' : 'normal'
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="glass-panel p-6" style={{ border: '1px solid var(--color-cyber-green)', minHeight: '600px' }}>
          
          {activeTab === 'players' && (
            <div className="space-y-4">
              {/* Party-wide Rest Controls */}
              <div className="flex items-center justify-between p-4 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-dark) 50%, transparent)', border: '1px solid var(--color-cyber-green)' }}>
                <div>
                  <h3 className="text-lg" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
                    PARTY MANAGEMENT
                  </h3>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6 }}>
                    Rest affects ALL players • Long rest = 2x short rest charges
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleShortRestAll}
                    className="px-5 py-2.5 rounded text-sm flex items-center gap-2"
                    style={{ background: 'transparent', border: '2px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}
                  >
                    🌙 SHORT REST
                  </button>
                  <button
                    onClick={handleLongRestAll}
                    className="px-5 py-2.5 rounded text-sm flex items-center gap-2"
                    style={{ background: 'var(--color-cyber-yellow)', color: '#0D1117', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}
                  >
                    🛏️ LONG REST
                  </button>
                </div>
              </div>

              {/* Character List and Details */}
              <div className="flex gap-6">
              <div className="w-1/3 space-y-2">
                <h3 className="text-lg mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
                  ALL CHARACTERS
                </h3>
                {loading ? (
                  <p style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>Loading...</p>
                ) : characters.length === 0 ? (
                  <p style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>No characters found</p>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                    {characters.map(char => (
                      <div
                        key={char.id}
                        onClick={() => handleSelectCharacter(char)}
                        className="p-3 rounded cursor-pointer transition-all"
                        style={{
                          border: `1px solid ${selectedCharacter?.id === char.id ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-green)'}`,
                          background: selectedCharacter?.id === char.id ? 'color-mix(in srgb, var(--color-cyber-yellow) 10%, transparent)' : 'transparent'
                        }}
                      >
                        <div className="font-bold" style={{ color: selectedCharacter?.id === char.id ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>
                          {char.name}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                          Lvl {char.level} {char.class} • {char.profile?.username}
                        </div>
                        <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>
                          HP: {char.current_hp}/{char.max_hp}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="w-2/3">
                {!selectedCharacter ? (
                  <div className="text-center py-12" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>
                    <p className="text-lg" style={{ fontFamily: 'var(--font-cyber)' }}>SELECT A CHARACTER</p>
                    <p className="text-sm mt-2" style={{ fontFamily: 'var(--font-mono)' }}>Click on a character to view and edit their stats</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Character Header */}
                    <div className="flex justify-between items-start">
                      <div>
                        <h2 className="text-xl" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-yellow)' }}>
                          {selectedCharacter.name}
                        </h2>
                        <p className="text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                          Level {selectedCharacter.level} {selectedCharacter.class} • Player: {selectedCharacter.profile?.username}
                        </p>
                      </div>
                    </div>

                    {/* Player Sub-Tabs */}
                    <div className="flex gap-2 border-b" style={{ borderColor: 'var(--color-cyber-green)' }}>
                      {[
                        { id: 'stats', label: '📊 STATS' },
                        { id: 'inventory', label: '🎒 INVENTORY' },
                        { id: 'abilities', label: '⚡ ABILITIES' },
                      ].map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setPlayerSubTab(tab.id as PlayerSubTab)}
                          className="px-4 py-2 text-sm transition-all"
                          style={{
                            fontFamily: 'var(--font-mono)',
                            color: playerSubTab === tab.id ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-cyan)',
                            borderBottom: playerSubTab === tab.id ? '2px solid var(--color-cyber-yellow)' : '2px solid transparent',
                            opacity: playerSubTab === tab.id ? 1 : 0.7
                          }}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* STATS SUB-TAB */}
                    {playerSubTab === 'stats' && (
                      <div className="space-y-4">
                        <div className="flex justify-end">
                          {!editingStats ? (
                            <button onClick={handleStartEditing} className="px-4 py-2 rounded text-sm" style={{ background: 'var(--color-cyber-yellow)', color: '#0D1117', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                              ✏️ EDIT STATS
                            </button>
                          ) : (
                            <div className="flex gap-2">
                              <button onClick={handleSaveStats} className="px-4 py-2 rounded text-sm" style={{ background: 'var(--color-cyber-cyan)', color: '#0D1117', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>✓ SAVE</button>
                              <button onClick={handleCancelEdit} className="px-4 py-2 rounded text-sm" style={{ background: 'transparent', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>✕ CANCEL</button>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 rounded" style={{ border: '1px solid var(--color-cyber-green)', background: 'color-mix(in srgb, var(--color-cyber-dark) 50%, transparent)' }}>
                            <div className="text-xs mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>HEALTH POINTS</div>
                            {(() => {
                              const equippedItems = playerInventory.filter(inv => inv.is_equipped && inv.item);
                              const itemHpBonus = equippedItems.reduce((sum, inv) => sum + (inv.item?.hp_mod || 0), 0);
                              return editingStats ? (
                                <div>
                                  <div className="flex gap-2 items-center">
                                    <input type="number" value={statEdits.current_hp ?? 0} onChange={e => setStatEdits({ ...statEdits, current_hp: parseInt(e.target.value) || 0 })} className="w-20 px-2 py-1 rounded text-center" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }} />
                                    <span style={{ color: 'var(--color-cyber-cyan)' }}>/</span>
                                    <input type="number" value={statEdits.max_hp ?? 0} onChange={e => setStatEdits({ ...statEdits, max_hp: parseInt(e.target.value) || 0 })} className="w-20 px-2 py-1 rounded text-center" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }} />
                                  </div>
                                  {itemHpBonus !== 0 && (
                                    <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-yellow)' }}>+{itemHpBonus} from gear</div>
                                  )}
                                </div>
                              ) : (
                                <div>
                                  <div className="text-2xl" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>{selectedCharacter.current_hp} / {selectedCharacter.max_hp + itemHpBonus}</div>
                                  {itemHpBonus !== 0 && (
                                    <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-yellow)' }}>Base: {selectedCharacter.max_hp} + {itemHpBonus} gear</div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                          <div className="p-4 rounded" style={{ border: '1px solid var(--color-cyber-green)', background: 'color-mix(in srgb, var(--color-cyber-dark) 50%, transparent)' }}>
                            <div className="text-xs mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>ARMOR CLASS</div>
                            {(() => {
                              const equippedItems = playerInventory.filter(inv => inv.is_equipped && inv.item);
                              const itemAcBonus = equippedItems.reduce((sum, inv) => sum + (inv.item?.ac_mod || 0), 0);
                              return editingStats ? (
                                <div>
                                  <input type="number" value={statEdits.ac ?? 0} onChange={e => setStatEdits({ ...statEdits, ac: parseInt(e.target.value) || 0 })} className="w-20 px-2 py-1 rounded text-center" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }} />
                                  {itemAcBonus !== 0 && (
                                    <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-yellow)' }}>+{itemAcBonus} from gear</div>
                                  )}
                                </div>
                              ) : (
                                <div>
                                  <div className="text-2xl" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{selectedCharacter.ac + itemAcBonus}</div>
                                  {itemAcBonus !== 0 && (
                                    <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-yellow)' }}>Base: {selectedCharacter.ac} + {itemAcBonus} gear</div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                          <div className="p-4 rounded" style={{ border: '1px solid var(--color-cyber-green)', background: 'color-mix(in srgb, var(--color-cyber-dark) 50%, transparent)' }}>
                            <div className="text-xs mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>LEVEL</div>
                            {editingStats ? (
                              <input type="number" value={statEdits.level ?? 1} onChange={e => setStatEdits({ ...statEdits, level: parseInt(e.target.value) || 1 })} className="w-20 px-2 py-1 rounded text-center" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }} />
                            ) : (
                              <div className="text-2xl" style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)' }}>{selectedCharacter.level}</div>
                            )}
                          </div>
                          <div className="p-4 rounded" style={{ border: '1px solid var(--color-cyber-green)', background: 'color-mix(in srgb, var(--color-cyber-dark) 50%, transparent)' }}>
                            <div className="text-xs mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>CREDITS</div>
                            {editingStats ? (
                              <input type="number" value={statEdits.usd ?? 0} onChange={e => setStatEdits({ ...statEdits, usd: parseInt(e.target.value) || 0 })} className="w-28 px-2 py-1 rounded text-center" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }} />
                            ) : (
                              <div className="text-2xl" style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)' }}>${selectedCharacter.usd.toLocaleString()}</div>
                            )}
                          </div>
                          <div className="p-4 rounded" style={{ border: '1px solid var(--color-cyber-green)', background: 'color-mix(in srgb, var(--color-cyber-dark) 50%, transparent)' }}>
                            <div className="text-xs mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>DAMAGE DIE</div>
                            {editingStats ? (
                              <select 
                                value={statEdits.cdd ?? 'd8'} 
                                onChange={e => setStatEdits({ ...statEdits, cdd: e.target.value })} 
                                className="w-20 px-2 py-1 rounded text-center cursor-pointer" 
                                style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                              >
                                <option value="d4">D4</option>
                                <option value="d6">D6</option>
                                <option value="d8">D8</option>
                                <option value="d10">D10</option>
                                <option value="d12">D12</option>
                              </select>
                            ) : (
                              <div className="text-2xl" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>{(selectedCharacter.cdd || 'd8').toUpperCase()}</div>
                            )}
                          </div>
                        </div>

                        {/* INIT, SPEED, IC */}
                        <div className="grid grid-cols-3 gap-4">
                          <div className="p-4 rounded" style={{ border: '1px solid var(--color-cyber-green)', background: 'color-mix(in srgb, var(--color-cyber-dark) 50%, transparent)' }}>
                            <div className="text-xs mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>INIT</div>
                            {(() => {
                              const equippedItems = playerInventory.filter(inv => inv.is_equipped && inv.item);
                              const itemInitBonus = equippedItems.reduce((sum, inv) => sum + (inv.item?.init_mod || 0), 0);
                              const baseInit = selectedCharacter.initiative_modifier || 0;
                              const totalInit = baseInit + itemInitBonus;
                              return editingStats ? (
                                <div>
                                  <input type="number" value={statEdits.initiative_modifier ?? 0} onChange={e => setStatEdits({ ...statEdits, initiative_modifier: parseInt(e.target.value) || 0 })} className="w-20 px-2 py-1 rounded text-center" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }} />
                                  {itemInitBonus !== 0 && (
                                    <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-yellow)' }}>+{itemInitBonus} from gear</div>
                                  )}
                                </div>
                              ) : (
                                <div>
                                  <div className="text-2xl" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{totalInit >= 0 ? `+${totalInit}` : totalInit}</div>
                                  {itemInitBonus !== 0 && (
                                    <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-yellow)' }}>Base: {baseInit >= 0 ? `+${baseInit}` : baseInit} + {itemInitBonus} gear</div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                          <div className="p-4 rounded" style={{ border: '1px solid var(--color-cyber-green)', background: 'color-mix(in srgb, var(--color-cyber-dark) 50%, transparent)' }}>
                            <div className="text-xs mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>SPEED</div>
                            {(() => {
                              const equippedItems = playerInventory.filter(inv => inv.is_equipped && inv.item);
                              const itemSpeedBonus = equippedItems.reduce((sum, inv) => sum + (inv.item?.speed_mod || 0), 0);
                              const baseSpeed = selectedCharacter.speed || 30;
                              const totalSpeed = baseSpeed + itemSpeedBonus;
                              return editingStats ? (
                                <div>
                                  <input type="number" value={statEdits.speed ?? 30} onChange={e => setStatEdits({ ...statEdits, speed: parseInt(e.target.value) || 30 })} className="w-20 px-2 py-1 rounded text-center" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }} />
                                  {itemSpeedBonus !== 0 && (
                                    <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-yellow)' }}>+{itemSpeedBonus} from gear</div>
                                  )}
                                </div>
                              ) : (
                                <div>
                                  <div className="text-2xl" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{totalSpeed} ft</div>
                                  {itemSpeedBonus !== 0 && (
                                    <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-yellow)' }}>Base: {baseSpeed} + {itemSpeedBonus} gear</div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                          <div className="p-4 rounded" style={{ border: '1px solid var(--color-cyber-green)', background: 'color-mix(in srgb, var(--color-cyber-dark) 50%, transparent)' }}>
                            <div className="text-xs mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>IC</div>
                            {(() => {
                              const equippedItems = playerInventory.filter(inv => inv.is_equipped && inv.item);
                              const itemIcBonus = equippedItems.reduce((sum, inv) => sum + (inv.item?.ic_mod || 0), 0);
                              const baseIc = selectedCharacter.implant_capacity || 3;
                              const totalIc = baseIc + itemIcBonus;
                              return editingStats ? (
                                <div>
                                  <input type="number" value={statEdits.implant_capacity ?? 3} onChange={e => setStatEdits({ ...statEdits, implant_capacity: parseInt(e.target.value) || 3 })} className="w-20 px-2 py-1 rounded text-center" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }} />
                                  {itemIcBonus !== 0 && (
                                    <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-yellow)' }}>+{itemIcBonus} from gear</div>
                                  )}
                                </div>
                              ) : (
                                <div>
                                  <div className="text-2xl" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{totalIc}</div>
                                  {itemIcBonus !== 0 && (
                                    <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-yellow)' }}>Base: {baseIc} + {itemIcBonus} gear</div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                        <div className="p-4 rounded" style={{ border: '1px solid var(--color-cyber-green)', background: 'color-mix(in srgb, var(--color-cyber-dark) 50%, transparent)' }}>
                          <div className="text-xs mb-3" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>ABILITY SCORES <span style={{ opacity: 0.5 }}>(Base + Item Bonus = Total)</span></div>
                          <div className="grid grid-cols-6 gap-3">
                            {(['str', 'dex', 'con', 'wis', 'int', 'cha'] as const).map(stat => {
                              const modKey = `${stat}_mod` as 'str_mod' | 'dex_mod' | 'con_mod' | 'wis_mod' | 'int_mod' | 'cha_mod';
                              const equippedItems = playerInventory.filter(inv => inv.is_equipped && inv.item);
                              const itemBonus = equippedItems.reduce((sum, inv) => sum + (inv.item?.[modKey] || 0), 0);
                              const baseValue = selectedCharacter[stat] || 0;
                              const totalValue = baseValue + itemBonus;
                              
                              return (
                                <div key={stat} className="text-center p-2 rounded" style={{ border: '1px solid var(--color-cyber-green)' }}>
                                  <div className="text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>{stat.toUpperCase()}</div>
                                  {editingStats ? (
                                    <div>
                                      <input type="number" value={statEdits[stat] ?? 0} onChange={e => setStatEdits({ ...statEdits, [stat]: parseInt(e.target.value) || 0 })} className="w-full px-1 py-1 rounded text-center text-lg" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }} />
                                      {itemBonus !== 0 && (
                                        <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-yellow)' }}>
                                          {itemBonus > 0 ? '+' : ''}{itemBonus} gear
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div>
                                      <div className="text-xl" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                                        {totalValue >= 0 ? '+' : ''}{totalValue}
                                      </div>
                                      <div className="text-xs mt-1" style={{ color: itemBonus !== 0 ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-cyan)', opacity: 0.6 }}>
                                        {baseValue}{itemBonus !== 0 ? ` + ${itemBonus > 0 ? '+' : ''}${itemBonus}` : ''}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="p-4 rounded" style={{ border: '1px solid var(--color-cyber-green)', background: 'color-mix(in srgb, var(--color-cyber-dark) 50%, transparent)' }}>
                          <div className="text-xs mb-3" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>QUICK ACTIONS</div>
                          <div className="flex gap-2 flex-wrap">
                            <button onClick={() => handleQuickHeal(10)} className="px-3 py-1 rounded text-sm" style={{ background: 'var(--color-cyber-cyan)', color: '#0D1117', fontFamily: 'var(--font-mono)' }}>+10 HP</button>
                            <button onClick={() => handleQuickHeal(-10)} className="px-3 py-1 rounded text-sm" style={{ background: 'var(--color-cyber-magenta)', color: '#0D1117', fontFamily: 'var(--font-mono)' }}>-10 HP</button>
                            <button onClick={handleFullHeal} className="px-3 py-1 rounded text-sm" style={{ background: 'var(--color-cyber-green)', color: 'var(--color-cyber-cyan)', border: '1px solid var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>FULL HEAL</button>
                          </div>
                        </div>

                        {/* SKILLS SECTION */}
                        <div className="p-4 rounded" style={{ border: '1px solid var(--color-cyber-purple)', background: 'color-mix(in srgb, var(--color-cyber-dark) 50%, transparent)' }}>
                          <div className="text-xs mb-3" style={{ color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-mono)' }}>SKILLS <span style={{ opacity: 0.5 }}>(Skill Points + Stat Mod + Item Bonus = Total)</span></div>
                          <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
                            {([
                              { key: 'skill_acrobatics', label: 'Acrobatics', stat: 'dex' },
                              { key: 'skill_animal_handling', label: 'Animal Handling', stat: 'wis' },
                              { key: 'skill_athletics', label: 'Athletics', stat: 'str' },
                              { key: 'skill_biology', label: 'Biology', stat: 'int' },
                              { key: 'skill_deception', label: 'Deception', stat: 'cha' },
                              { key: 'skill_hacking', label: 'Hacking', stat: 'int' },
                              { key: 'skill_history', label: 'History', stat: 'int' },
                              { key: 'skill_insight', label: 'Insight', stat: 'wis' },
                              { key: 'skill_intimidation', label: 'Intimidation', stat: 'cha' },
                              { key: 'skill_investigation', label: 'Investigation', stat: 'int' },
                              { key: 'skill_medicine', label: 'Medicine', stat: 'wis' },
                              { key: 'skill_nature', label: 'Nature', stat: 'int' },
                              { key: 'skill_perception', label: 'Perception', stat: 'wis' },
                              { key: 'skill_performance', label: 'Performance', stat: 'cha' },
                              { key: 'skill_persuasion', label: 'Persuasion', stat: 'cha' },
                              { key: 'skill_sleight_of_hand', label: 'Sleight of Hand', stat: 'dex' },
                              { key: 'skill_stealth', label: 'Stealth', stat: 'dex' },
                              { key: 'skill_survival', label: 'Survival', stat: 'wis' },
                            ] as const).map(skill => {
                              // Calculate item bonus for this skill (items store by display name e.g. 'Hacking')
                              const equippedItems = playerInventory.filter(inv => inv.is_equipped && inv.item);
                              const itemBonus = equippedItems.reduce((sum, inv) => {
                                const skillMods = inv.item?.skill_mods as Record<string, number> | undefined;
                                return sum + (skillMods?.[skill.label] || 0);
                              }, 0);
                              // Get stat modifier
                              const rawStatValue = selectedCharacter[skill.stat as keyof Character] as number || 10;
                              const statMod = calculateStatModifier(rawStatValue);
                              // Get base skill points
                              const baseSkillPoints = selectedCharacter[skill.key] || 0;
                              // Total = skill points + stat mod + item bonus
                              const totalValue = baseSkillPoints + statMod + itemBonus;
                              
                              return (
                                <div key={skill.key} className="flex flex-col p-2 rounded" style={{ border: '1px solid var(--color-cyber-purple)', background: 'var(--color-cyber-darker)' }}>
                                  <span className="text-xs truncate mb-1" style={{ color: 'var(--color-cyber-purple)' }}>{skill.label}</span>
                                  {editingStats ? (
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1">
                                        <button 
                                          onClick={() => setStatEdits({ ...statEdits, [skill.key]: Math.max(0, (statEdits[skill.key as keyof typeof statEdits] as number || 0) - 1) })} 
                                          className="px-2 py-0.5 rounded text-xs" 
                                          style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-purple)', color: 'var(--color-cyber-purple)' }}
                                        >−</button>
                                        <span className="w-6 text-center text-sm" style={{ color: 'var(--color-cyber-cyan)' }}>
                                          {(statEdits[skill.key as keyof typeof statEdits] as number) || 0}
                                        </span>
                                        <button 
                                          onClick={() => setStatEdits({ ...statEdits, [skill.key]: Math.min(10, (statEdits[skill.key as keyof typeof statEdits] as number || 0) + 1) })} 
                                          className="px-2 py-0.5 rounded text-xs" 
                                          style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-purple)', color: 'var(--color-cyber-purple)' }}
                                        >+</button>
                                      </div>
                                      <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>
                                        {skill.stat.toUpperCase()} {formatModifier(statMod)}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between">
                                      <span className="text-lg font-bold" style={{ color: totalValue !== 0 ? 'var(--color-cyber-cyan)' : 'var(--color-cyber-purple)', opacity: totalValue !== 0 ? 1 : 0.5 }}>
                                        {formatModifier(totalValue)}
                                      </span>
                                      <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6 }}>
                                        {skill.stat.toUpperCase()} {formatModifier(statMod)}
                                        {itemBonus !== 0 && <span style={{ color: 'var(--color-cyber-yellow)' }}> +{itemBonus}📦</span>}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* WEAPON PROFICIENCY RANKS SECTION */}
                        <div className="p-4 rounded" style={{ border: '1px solid var(--color-cyber-magenta)', background: 'color-mix(in srgb, var(--color-cyber-dark) 50%, transparent)' }}>
                          <div className="text-xs mb-3" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>
                            WEAPON PROFICIENCY RANKS <span style={{ opacity: 0.5 }}>(Rank 0 = −2 to hit, Rank 1-5 = +0 to +4)</span>
                          </div>
                          <div className="grid grid-cols-5 gap-2">
                            {WEAPON_TYPES.map(weapon => {
                              const rankKey = `weapon_rank_${weapon.key}` as keyof Character;
                              const currentRank = editingStats 
                                ? (statEdits[rankKey as keyof typeof statEdits] as number ?? selectedCharacter[rankKey] ?? 0)
                                : (selectedCharacter[rankKey] as number || 0);
                              
                              return (
                                <div key={weapon.key} className="flex flex-col items-center p-2 rounded" style={{ 
                                  border: `1px solid ${currentRank === 0 ? 'var(--color-cyber-magenta)' : 'var(--color-cyber-green)'}`, 
                                  background: 'var(--color-cyber-darker)' 
                                }}>
                                  <span className="text-lg mb-1">{weapon.icon}</span>
                                  <span className="text-xs mb-1" style={{ color: currentRank === 0 ? 'var(--color-cyber-magenta)' : 'var(--color-cyber-green)' }}>
                                    {weapon.label}
                                  </span>
                                  {editingStats ? (
                                    <div className="flex items-center gap-1">
                                      <button 
                                        onClick={() => setStatEdits({ ...statEdits, [rankKey]: Math.max(0, (statEdits[rankKey as keyof typeof statEdits] as number ?? selectedCharacter[rankKey] ?? 0) - 1) })} 
                                        className="px-2 py-0.5 rounded text-xs" 
                                        style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)' }}
                                      >−</button>
                                      <span className="w-6 text-center text-sm font-bold" style={{ color: 'var(--color-cyber-cyan)' }}>
                                        {currentRank}
                                      </span>
                                      <button 
                                        onClick={() => setStatEdits({ ...statEdits, [rankKey]: Math.min(5, (statEdits[rankKey as keyof typeof statEdits] as number ?? selectedCharacter[rankKey] ?? 0) + 1) })} 
                                        className="px-2 py-0.5 rounded text-xs" 
                                        style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)' }}
                                      >+</button>
                                    </div>
                                  ) : (
                                    <div className="text-center">
                                      <span className="text-lg font-bold" style={{ color: currentRank === 0 ? 'var(--color-cyber-magenta)' : 'var(--color-cyber-green)' }}>
                                        {formatToHit(currentRank)}
                                      </span>
                                      <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6 }}>
                                        Rank {currentRank}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* INVENTORY SUB-TAB */}
                    {playerSubTab === 'inventory' && (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <div className="text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                            {playerInventory.length} items
                          </div>
                          <button
                            onClick={() => setShowGiveItemModal(true)}
                            className="px-4 py-2 rounded text-sm"
                            style={{ background: 'var(--color-cyber-yellow)', color: '#0D1117', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}
                          >
                            + GIVE ITEM
                          </button>
                        </div>

                        {inventoryLoading ? (
                          <p style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>Loading inventory...</p>
                        ) : playerInventory.length === 0 ? (
                          <div className="text-center py-8" style={{ border: '2px dashed var(--color-cyber-green)', borderRadius: '8px' }}>
                            <p style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>No items in inventory</p>
                          </div>
                        ) : (
                          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                            {playerInventory.map(inv => inv.item && (
                              <div key={inv.id} className="p-4 rounded" style={{ 
                                border: inv.is_equipped ? '2px solid var(--color-cyber-yellow)' : '1px solid var(--color-cyber-green)', 
                                background: 'color-mix(in srgb, var(--color-cyber-dark) 50%, transparent)' 
                              }}>
                                {/* Header Row */}
                                <div className="flex justify-between items-start">
                                  <div className="flex items-center gap-3">
                                    <span className="text-2xl">{getItemTypeIcon(inv.item.type)}</span>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-bold" style={{ color: inv.is_equipped ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>
                                          {inv.item.name}
                                        </span>
                                        {inv.is_equipped && (
                                          <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--color-cyber-yellow)', color: '#0D1117', fontWeight: 'bold' }}>EQUIPPED</span>
                                        )}
                                      </div>
                                      <div className="text-xs flex items-center gap-2 mt-1">
                                        <span style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>{toTitleCase(inv.item.type)}</span>
                                        <span className="px-1.5 py-0.5 rounded" style={{ background: getRarityBgColor(inv.item.rarity), color: getRarityColor(inv.item.rarity), fontSize: '10px' }}>{inv.item.rarity}</span>
                                        <span style={{ color: 'var(--color-cyber-cyan)' }}>×{inv.quantity}</span>
                                        {inv.item.price > 0 && <span style={{ color: 'var(--color-cyber-yellow)' }}>${inv.item.price}</span>}
                                      </div>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => openRemoveItemModal(inv)}
                                    className="text-xs px-2 py-1 rounded"
                                    style={{ background: 'transparent', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)' }}
                                  >
                                    ✕
                                  </button>
                                </div>

                                {/* Description */}
                                {inv.item.description && (
                                  <p className="text-sm mt-3" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.8 }}>{inv.item.description}</p>
                                )}

                                {/* Stat Modifiers */}
                                {(inv.item.ac_mod !== 0 || inv.item.hp_mod !== 0 || inv.item.str_mod !== 0 || inv.item.dex_mod !== 0 || inv.item.con_mod !== 0 || inv.item.wis_mod !== 0 || inv.item.int_mod !== 0 || inv.item.cha_mod !== 0 || inv.item.init_mod !== 0 || inv.item.speed_mod !== 0) && (
                                  <div className="flex flex-wrap gap-2 mt-3">
                                    {inv.item.ac_mod !== 0 && <span className="text-xs px-2 py-1 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)', color: 'var(--color-cyber-cyan)' }}>AC {inv.item.ac_mod > 0 ? '+' : ''}{inv.item.ac_mod}</span>}
                                    {inv.item.hp_mod !== 0 && <span className="text-xs px-2 py-1 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-magenta) 20%, transparent)', color: 'var(--color-cyber-magenta)' }}>HP {inv.item.hp_mod > 0 ? '+' : ''}{inv.item.hp_mod}</span>}
                                    {inv.item.str_mod !== 0 && <span className="text-xs px-2 py-1 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-yellow) 20%, transparent)', color: 'var(--color-cyber-yellow)' }}>STR {inv.item.str_mod > 0 ? '+' : ''}{inv.item.str_mod}</span>}
                                    {inv.item.dex_mod !== 0 && <span className="text-xs px-2 py-1 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-yellow) 20%, transparent)', color: 'var(--color-cyber-yellow)' }}>DEX {inv.item.dex_mod > 0 ? '+' : ''}{inv.item.dex_mod}</span>}
                                    {inv.item.con_mod !== 0 && <span className="text-xs px-2 py-1 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-yellow) 20%, transparent)', color: 'var(--color-cyber-yellow)' }}>CON {inv.item.con_mod > 0 ? '+' : ''}{inv.item.con_mod}</span>}
                                    {inv.item.wis_mod !== 0 && <span className="text-xs px-2 py-1 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-yellow) 20%, transparent)', color: 'var(--color-cyber-yellow)' }}>WIS {inv.item.wis_mod > 0 ? '+' : ''}{inv.item.wis_mod}</span>}
                                    {inv.item.int_mod !== 0 && <span className="text-xs px-2 py-1 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-yellow) 20%, transparent)', color: 'var(--color-cyber-yellow)' }}>INT {inv.item.int_mod > 0 ? '+' : ''}{inv.item.int_mod}</span>}
                                    {inv.item.cha_mod !== 0 && <span className="text-xs px-2 py-1 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-yellow) 20%, transparent)', color: 'var(--color-cyber-yellow)' }}>CHA {inv.item.cha_mod > 0 ? '+' : ''}{inv.item.cha_mod}</span>}
                                    {inv.item.init_mod !== 0 && <span className="text-xs px-2 py-1 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-green) 20%, transparent)', color: 'var(--color-cyber-green)' }}>INIT {inv.item.init_mod > 0 ? '+' : ''}{inv.item.init_mod}</span>}
                                    {inv.item.speed_mod !== 0 && <span className="text-xs px-2 py-1 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-green) 20%, transparent)', color: 'var(--color-cyber-green)' }}>SPD {inv.item.speed_mod > 0 ? '+' : ''}{inv.item.speed_mod}</span>}
                                  </div>
                                )}

                                {/* Item Abilities */}
                                {inv.item.abilities && inv.item.abilities.length > 0 && (
                                  <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--color-cyber-green)' }}>
                                    <div className="text-xs mb-2" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>GRANTS ABILITIES:</div>
                                    <div className="space-y-2">
                                      {inv.item.abilities.map((itemAbility: any, idx: number) => itemAbility.ability && (
                                        <div key={idx} className="p-2 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-magenta) 10%, transparent)', border: '1px solid var(--color-cyber-magenta)' }}>
                                          <div className="flex items-center gap-2">
                                            <span className="text-sm">{getAbilityTypeIcon(itemAbility.ability.type)}</span>
                                            <span className="text-sm font-bold" style={{ color: 'var(--color-cyber-magenta)' }}>{itemAbility.ability.name}</span>
                                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)', color: 'var(--color-cyber-cyan)' }}>
                                              {toTitleCase(itemAbility.ability.type)}
                                            </span>
                                            {itemAbility.requires_equipped && (
                                              <span className="text-xs" style={{ color: 'var(--color-cyber-yellow)', opacity: 0.7 }}>(when equipped)</span>
                                            )}
                                          </div>
                                          {itemAbility.ability.description && (
                                            <p className="text-xs mt-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>{itemAbility.ability.description}</p>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ABILITIES SUB-TAB */}
                    {playerSubTab === 'abilities' && (
                      <div className="space-y-4">
                        {/* Header */}
                        <div className="flex justify-between items-center">
                          <div className="text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                            {playerAbilities.length} abilities
                          </div>
                          <p className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>
                            Use Party Rest buttons above to restore charges
                          </p>
                        </div>

                        {playerAbilitiesLoading ? (
                          <p style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>Loading abilities...</p>
                        ) : playerAbilities.length === 0 ? (
                          <div className="text-center py-8" style={{ border: '2px dashed var(--color-cyber-green)', borderRadius: '8px' }}>
                            <p style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>No abilities assigned</p>
                            <p className="text-xs mt-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.3 }}>
                              Use the Abilities tab to give abilities to this character
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                            {playerAbilities.map(charAbility => {
                              const isFromItem = charAbility.displaySource?.startsWith('item:');
                              const isFromClass = charAbility.displaySource === 'class';
                              const isRemovable = !isFromItem && !isFromClass;
                              const sourceLabel = isFromClass ? 'CLASS' : isFromItem ? charAbility.displaySource?.replace('item:', '📦 ') : null;
                              
                              return (
                              <div key={charAbility.id} className="p-3 rounded" style={{ border: '1px solid var(--color-cyber-green)', background: 'color-mix(in srgb, var(--color-cyber-dark) 50%, transparent)' }}>
                                <div className="flex justify-between items-start">
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">{getAbilityTypeIcon(charAbility.ability.type)}</span>
                                    <div>
                                      <div className="font-bold text-sm" style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-cyber)' }}>
                                        {charAbility.ability.name}
                                      </div>
                                      <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>
                                        {toTitleCase(charAbility.ability.type)} • {toTitleCase(charAbility.ability.charge_type)}
                                        {sourceLabel && (
                                          <span className="ml-2 px-1.5 py-0.5 rounded text-xs" style={{ 
                                            background: isFromClass 
                                              ? 'color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)' 
                                              : 'color-mix(in srgb, var(--color-cyber-magenta) 30%, transparent)', 
                                            color: isFromClass ? 'var(--color-cyber-cyan)' : 'var(--color-cyber-magenta)' 
                                          }}>
                                            {sourceLabel}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  {isRemovable && (
                                    <button
                                      onClick={() => handleRemovePlayerAbility(charAbility.id)}
                                      className="text-xs px-2 py-1 rounded"
                                      style={{ background: 'transparent', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)' }}
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                                
                                {/* Charge Management */}
                                {charAbility.ability.charge_type !== 'infinite' && (
                                  <div className="flex items-center gap-3 mt-3 pt-3" style={{ borderTop: '1px solid var(--color-cyber-green)', opacity: 0.5 }}>
                                    <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                                      CHARGES:
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => handleUpdateCharges(charAbility.id, charAbility.current_charges - 1)}
                                        disabled={charAbility.current_charges <= 0}
                                        className="w-7 h-7 rounded flex items-center justify-center text-sm font-bold"
                                        style={{
                                          background: charAbility.current_charges <= 0 ? 'var(--color-cyber-dark)' : 'var(--color-cyber-magenta)',
                                          color: charAbility.current_charges <= 0 ? 'var(--color-cyber-green)' : '#0D1117',
                                          opacity: charAbility.current_charges <= 0 ? 0.3 : 1
                                        }}
                                      >
                                        −
                                      </button>
                                      <span className="w-12 text-center text-lg font-bold" style={{ color: charAbility.current_charges === 0 ? 'var(--color-cyber-magenta)' : 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)' }}>
                                        {charAbility.current_charges}/{charAbility.ability.max_charges || 0}
                                      </span>
                                      <button
                                        onClick={() => handleUpdateCharges(charAbility.id, charAbility.current_charges + 1)}
                                        disabled={charAbility.current_charges >= (charAbility.ability.max_charges || 0)}
                                        className="w-7 h-7 rounded flex items-center justify-center text-sm font-bold"
                                        style={{
                                          background: charAbility.current_charges >= (charAbility.ability.max_charges || 0) ? 'var(--color-cyber-dark)' : 'var(--color-cyber-green)',
                                          color: charAbility.current_charges >= (charAbility.ability.max_charges || 0) ? 'var(--color-cyber-green)' : '#0D1117',
                                          opacity: charAbility.current_charges >= (charAbility.ability.max_charges || 0) ? 0.3 : 1
                                        }}
                                      >
                                        +
                                      </button>
                                    </div>
                                    <span className="text-xs ml-auto px-2 py-0.5 rounded" style={{
                                      background: charAbility.ability.charge_type === 'short_rest' ? 'color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)' : 'color-mix(in srgb, var(--color-cyber-yellow) 20%, transparent)',
                                      color: charAbility.ability.charge_type === 'short_rest' ? 'var(--color-cyber-cyan)' : 'var(--color-cyber-yellow)'
                                    }}>
                                      {charAbility.ability.charge_type === 'short_rest' ? 'Short Rest' : charAbility.ability.charge_type === 'long_rest' ? 'Long Rest' : 'Uses'}
                                    </span>
                                  </div>
                                )}
                                
                                {/* Description */}
                                <p className="text-xs mt-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6 }}>
                                  {charAbility.ability.description}
                                </p>
                              </div>
                            );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            </div>
          )}

          {/* Give Item Modal */}
          {showGiveItemModal && selectedCharacter && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => { setShowGiveItemModal(false); setGiveItemSearch(''); setGiveItemTypeFilter('all'); setGiveItemRarityFilter('all'); }}>
              <div className="glass-panel p-6 w-[800px] max-h-[85vh] overflow-hidden flex flex-col" style={{ border: '2px solid var(--color-cyber-yellow)' }} onClick={e => e.stopPropagation()}>
                <h3 className="text-lg mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-yellow)' }}>
                  🎁 GIVE ITEM TO {selectedCharacter.name.toUpperCase()}
                </h3>
                
                {/* Search and Filter Controls */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <input
                    type="text"
                    placeholder="Search by name..."
                    value={giveItemSearch}
                    onChange={e => setGiveItemSearch(e.target.value)}
                    className="col-span-2 px-3 py-2 rounded text-sm"
                    style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                  />
                  <select
                    value={giveItemTypeFilter}
                    onChange={e => setGiveItemTypeFilter(e.target.value)}
                    className="px-3 py-2 rounded text-sm"
                    style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-purple)', color: 'var(--color-cyber-purple)' }}
                  >
                    <option value="all">All Types</option>
                    <option value="weapon">⚔️ Weapons</option>
                    <option value="armor">🛡️ Armor</option>
                    <option value="consumable">💊 Consumables</option>
                    <option value="cyberware">🦾 Cyberware</option>
                    <option value="item">📦 Items</option>
                    <option value="mission_item">📜 Mission Items</option>
                  </select>
                  <select
                    value={giveItemRarityFilter}
                    onChange={e => setGiveItemRarityFilter(e.target.value)}
                    className="px-3 py-2 rounded text-sm"
                    style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-green)', color: 'var(--color-cyber-green)' }}
                  >
                    <option value="all">All Rarities</option>
                    <option value="Common">Common</option>
                    <option value="Uncommon">Uncommon</option>
                    <option value="Rare">Rare</option>
                    <option value="Epic">Epic</option>
                    <option value="Mythic">Mythic</option>
                    <option value="Ultra Rare">Ultra Rare</option>
                    <option value="MISSION ITEM">Mission Item</option>
                  </select>
                </div>

                {/* Sort Controls */}
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)' }}>Sort by:</span>
                  {(['name', 'type', 'rarity', 'price'] as const).map(sortOption => (
                    <button
                      key={sortOption}
                      onClick={() => {
                        if (giveItemSortBy === sortOption) {
                          setGiveItemSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setGiveItemSortBy(sortOption);
                          setGiveItemSortOrder('asc');
                        }
                      }}
                      className="px-2 py-1 rounded text-xs"
                      style={{
                        background: giveItemSortBy === sortOption ? 'var(--color-cyber-purple)' : 'var(--color-cyber-darker)',
                        border: `1px solid ${giveItemSortBy === sortOption ? 'var(--color-cyber-purple)' : 'var(--color-cyber-dark)'}`,
                        color: giveItemSortBy === sortOption ? '#0D1117' : 'var(--color-cyber-cyan)'
                      }}
                    >
                      {sortOption.toUpperCase()} {giveItemSortBy === sortOption && (giveItemSortOrder === 'asc' ? '↑' : '↓')}
                    </button>
                  ))}
                  <span className="ml-auto text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>
                    {filteredGiveItems.length} items found
                  </span>
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-2" style={{ maxHeight: '350px' }}>
                  {filteredGiveItems.slice(0, 50).map(item => {
                    const isSelected = selectedGiveItem?.id === item.id;
                    const hasStatMods = item.str_mod || item.dex_mod || item.con_mod || item.wis_mod || item.int_mod || item.cha_mod || item.hp_mod || item.ac_mod || item.speed_mod || item.init_mod;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedGiveItem(item)}
                        className="p-3 rounded cursor-pointer transition-all hover:brightness-110"
                        style={{
                          border: `2px solid ${isSelected ? 'var(--color-cyber-yellow)' : getRarityColor(item.rarity)}`,
                          background: isSelected ? 'color-mix(in srgb, var(--color-cyber-yellow) 15%, var(--color-cyber-darker))' : 'var(--color-cyber-darker)'
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">{getItemTypeIcon(item.type)}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold" style={{ color: getRarityColor(item.rarity) }}>{item.name}</span>
                              <span className="px-1.5 py-0.5 rounded text-xs" style={{ background: getRarityBgColor(item.rarity), color: getRarityColor(item.rarity) }}>{item.rarity}</span>
                              {item.price > 0 && (
                                <span className="text-xs" style={{ color: 'var(--color-cyber-yellow)' }}>💰 {item.price.toLocaleString()}¢</span>
                              )}
                            </div>
                            <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.8 }}>
                              {toTitleCase(item.type)}
                              {item.weapon_subtype && ` • ${toTitleCase(item.weapon_subtype)}`}
                              {item.armor_subtype && ` • ${toTitleCase(item.armor_subtype)}`}
                              {item.is_consumable && ' • Consumable'}
                              {item.is_equippable && ' • Equippable'}
                              {item.ic_cost > 0 && ` • IC: ${item.ic_cost}`}
                            </div>
                            {item.description && (
                              <div className="text-xs mt-1 line-clamp-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6 }}>
                                {item.description}
                              </div>
                            )}
                            {hasStatMods && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {item.hp_mod !== 0 && <span className="text-xs px-1 rounded" style={{ background: 'var(--color-cyber-magenta)', color: '#0D1117' }}>HP {item.hp_mod > 0 ? '+' : ''}{item.hp_mod}</span>}
                                {item.ac_mod !== 0 && <span className="text-xs px-1 rounded" style={{ background: 'var(--color-cyber-cyan)', color: '#0D1117' }}>AC {item.ac_mod > 0 ? '+' : ''}{item.ac_mod}</span>}
                                {item.str_mod !== 0 && <span className="text-xs px-1 rounded" style={{ background: 'var(--color-cyber-purple)', color: '#0D1117' }}>STR {item.str_mod > 0 ? '+' : ''}{item.str_mod}</span>}
                                {item.dex_mod !== 0 && <span className="text-xs px-1 rounded" style={{ background: 'var(--color-cyber-purple)', color: '#0D1117' }}>DEX {item.dex_mod > 0 ? '+' : ''}{item.dex_mod}</span>}
                                {item.con_mod !== 0 && <span className="text-xs px-1 rounded" style={{ background: 'var(--color-cyber-purple)', color: '#0D1117' }}>CON {item.con_mod > 0 ? '+' : ''}{item.con_mod}</span>}
                                {item.speed_mod !== 0 && <span className="text-xs px-1 rounded" style={{ background: 'var(--color-cyber-green)', color: '#0D1117' }}>SPD {item.speed_mod > 0 ? '+' : ''}{item.speed_mod}</span>}
                              </div>
                            )}
                          </div>
                          {isSelected && (
                            <div className="text-xl" style={{ color: 'var(--color-cyber-yellow)' }}>✓</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {filteredGiveItems.length === 0 && (
                    <div className="text-center py-8 text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>
                      No items found matching your filters
                    </div>
                  )}
                  {filteredGiveItems.length > 50 && (
                    <div className="text-center py-2 text-xs" style={{ color: 'var(--color-cyber-yellow)' }}>
                      Showing first 50 of {filteredGiveItems.length} items. Use filters to narrow results.
                    </div>
                  )}
                </div>

                {/* Selected Item Detail */}
                {selectedGiveItem && (
                  <div className="p-3 rounded mb-4" style={{ background: 'color-mix(in srgb, var(--color-cyber-yellow) 10%, var(--color-cyber-darker))', border: '1px solid var(--color-cyber-yellow)' }}>
                    <div className="flex items-center gap-4">
                      <span className="text-2xl">{getItemTypeIcon(selectedGiveItem.type)}</span>
                      <div className="flex-1">
                        <div className="font-bold" style={{ color: 'var(--color-cyber-yellow)' }}>{selectedGiveItem.name}</div>
                        <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)' }}>
                          {selectedGiveItem.description || 'No description'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm" style={{ color: 'var(--color-cyber-cyan)' }}>Qty:</label>
                        <button
                          onClick={() => setGiveItemQuantity(q => Math.max(1, q - 1))}
                          className="w-7 h-7 rounded flex items-center justify-center"
                          style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                        >−</button>
                        <input
                          type="number"
                          min="1"
                          value={giveItemQuantity}
                          onChange={e => setGiveItemQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-16 px-2 py-1 rounded text-center"
                          style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                        />
                        <button
                          onClick={() => setGiveItemQuantity(q => q + 1)}
                          className="w-7 h-7 rounded flex items-center justify-center"
                          style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                        >+</button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 justify-between items-center pt-3" style={{ borderTop: '1px solid var(--color-cyber-dark)' }}>
                  <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>
                    {selectedGiveItem ? `Ready to give ${giveItemQuantity}x ${selectedGiveItem.name}` : 'Select an item to give'}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowGiveItemModal(false); setGiveItemSearch(''); setGiveItemTypeFilter('all'); setGiveItemRarityFilter('all'); }}
                      className="px-4 py-2 rounded text-sm"
                      style={{ background: 'transparent', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)' }}
                    >
                      CANCEL
                    </button>
                    <button
                      onClick={handleGiveItem}
                      disabled={!selectedGiveItem}
                      className="px-4 py-2 rounded text-sm font-bold"
                      style={{
                        background: selectedGiveItem ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-green)',
                        color: '#0D1117',
                        opacity: selectedGiveItem ? 1 : 0.5
                      }}
                    >
                      🎁 GIVE ITEM
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Remove Item Modal */}
          {showRemoveItemModal && removeItemTarget && removeItemTarget.item && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setShowRemoveItemModal(false)}>
              <div className="glass-panel p-6 w-full max-w-md" style={{ border: '2px solid var(--color-cyber-magenta)' }} onClick={e => e.stopPropagation()}>
                <h3 className="text-lg mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-magenta)' }}>
                  REMOVE ITEM
                </h3>
                
                <div className="p-3 rounded mb-4" style={{ border: '1px solid var(--color-cyber-green)', background: 'color-mix(in srgb, var(--color-cyber-dark) 50%, transparent)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getItemTypeIcon(removeItemTarget.item.type)}</span>
                    <div>
                      <div className="font-bold text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>
                        {removeItemTarget.item.name}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>
                        Current quantity: {removeItemTarget.quantity}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 mb-4">
                  <label className="text-sm" style={{ color: 'var(--color-cyber-cyan)' }}>Remove quantity:</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setRemoveItemQuantity(Math.max(1, removeItemQuantity - 1))}
                      className="px-3 py-1 rounded"
                      style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)' }}
                    >−</button>
                    <input
                      type="number"
                      min="1"
                      max={removeItemTarget.quantity}
                      value={removeItemQuantity}
                      onChange={e => setRemoveItemQuantity(Math.min(removeItemTarget.quantity, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="w-16 px-2 py-1 rounded text-center"
                      style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-cyan)' }}
                    />
                    <button
                      onClick={() => setRemoveItemQuantity(Math.min(removeItemTarget.quantity, removeItemQuantity + 1))}
                      className="px-3 py-1 rounded"
                      style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)' }}
                    >+</button>
                  </div>
                  <button
                    onClick={() => setRemoveItemQuantity(removeItemTarget.quantity)}
                    className="px-2 py-1 rounded text-xs"
                    style={{ background: 'color-mix(in srgb, var(--color-cyber-magenta) 20%, transparent)', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)' }}
                  >ALL</button>
                </div>

                <div className="text-xs mb-4" style={{ color: removeItemQuantity >= removeItemTarget.quantity ? 'var(--color-cyber-magenta)' : 'var(--color-cyber-cyan)' }}>
                  {removeItemQuantity >= removeItemTarget.quantity 
                    ? '⚠️ This will remove all of this item from inventory'
                    : `Will leave ${removeItemTarget.quantity - removeItemQuantity} remaining`}
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowRemoveItemModal(false)}
                    className="px-4 py-2 rounded text-sm"
                    style={{ background: 'transparent', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={handleRemoveItem}
                    className="px-4 py-2 rounded text-sm"
                    style={{ background: 'var(--color-cyber-magenta)', color: '#0D1117' }}
                  >
                    REMOVE {removeItemQuantity}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'items' && (
            <div className="flex gap-4 h-[calc(100vh-180px)]">
              {/* Left Side - Item List (Always Visible) */}
              <div className="w-1/2 flex flex-col" style={{ minWidth: '400px' }}>
                {/* Header with Create Button */}
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-lg" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>📦 ITEMS</h3>
                  <span className="text-xs px-2 py-1 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)', color: 'var(--color-cyber-cyan)' }}>
                    {filteredItemsList.length} items
                  </span>
                  <button
                    onClick={() => { resetItemForm(); setSelectedEditItem(null); setItemsSubTab('create'); }}
                    className="ml-auto px-4 py-2 rounded text-sm"
                    style={{ background: 'var(--color-cyber-yellow)', color: '#0D1117', fontFamily: 'var(--font-cyber)' }}
                  >
                    ➕ CREATE NEW
                  </button>
                </div>

                {/* Search and Filters */}
                <div className="space-y-2 mb-3">
                  <input
                    type="text"
                    placeholder="🔍 Search items..."
                    value={itemSearchQuery}
                    onChange={e => setItemSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 rounded text-sm"
                    style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}
                  />
                  <div className="flex gap-2">
                    <select
                      value={itemFilterType}
                      onChange={e => setItemFilterType(e.target.value)}
                      className="flex-1 px-2 py-1.5 rounded text-sm"
                      style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                    >
                      <option value="all">All Types</option>
                      <option value="weapon">Weapon</option>
                      <option value="armor">Armor</option>
                      <option value="consumable">Consumable</option>
                      <option value="cyberware">Cyberware</option>
                      <option value="item">Item</option>
                      <option value="mission_item">Mission Item</option>
                    </select>
                    <select
                      value={itemFilterRarity}
                      onChange={e => setItemFilterRarity(e.target.value)}
                      className="flex-1 px-2 py-1.5 rounded text-sm"
                      style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                    >
                      <option value="all">All Rarities</option>
                      <option value="Common">Common</option>
                      <option value="Uncommon">Uncommon</option>
                      <option value="Rare">Rare</option>
                      <option value="Epic">Epic</option>
                      <option value="Mythic">Mythic</option>
                      <option value="Ultra Rare">Ultra Rare</option>
                    </select>
                  </div>
                </div>

                {/* Item Grid List */}
                <div className="flex-1 overflow-y-auto pr-2">
                  {itemsLoading ? (
                    <div className="text-center py-8" style={{ color: 'var(--color-cyber-cyan)' }}>Loading...</div>
                  ) : filteredItemsList.length === 0 ? (
                    <div className="text-center py-8" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>No items found</div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {filteredItemsList.map(item => (
                        <div
                          key={item.id}
                          className="p-3 rounded cursor-pointer transition-all hover:brightness-110"
                          style={{ 
                            border: `1px solid ${selectedEditItem?.id === item.id ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-green)'}`,
                            background: selectedEditItem?.id === item.id ? 'color-mix(in srgb, var(--color-cyber-yellow) 15%, transparent)' : 'color-mix(in srgb, var(--color-cyber-darker) 90%, transparent)'
                          }}
                          onClick={() => loadItemForEdit(item)}
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-lg">{getItemTypeIcon(item.type)}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold truncate" style={{ color: 'var(--color-cyber-cyan)' }}>{item.name}</div>
                              <div className="flex items-center gap-1 mt-1 flex-wrap">
                                <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>{toTitleCase(item.type)}</span>
                                <span className="px-1.5 py-0.5 rounded" style={{ background: getRarityBgColor(item.rarity), color: getRarityColor(item.rarity), fontSize: '9px' }}>{item.rarity}</span>
                              </div>
                              <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-green)' }}>${item.price}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Side - Edit Form */}
              <div className="w-1/2 glass-panel p-5 overflow-y-auto" style={{ border: '1px solid var(--color-cyber-cyan)', minWidth: '400px' }}>
                {!selectedEditItem && itemsSubTab !== 'create' ? (
                  <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>
                    <p className="text-xl mb-2" style={{ fontFamily: 'var(--font-cyber)' }}>SELECT AN ITEM</p>
                    <p className="text-sm" style={{ fontFamily: 'var(--font-mono)' }}>Click an item to edit, or use CREATE NEW</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-yellow)' }}>
                        {selectedEditItem ? '✏️ EDIT ITEM' : '➕ CREATE ITEM'}
                      </h3>
                      {selectedEditItem && (
                        <button
                          onClick={() => handleDeleteItem(selectedEditItem.id, selectedEditItem.name)}
                          className="px-3 py-1 rounded text-sm"
                          style={{ background: 'transparent', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)' }}
                        >
                          🗑️ DELETE
                        </button>
                      )}
                    </div>

                    {/* Basic Info */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm mb-1" style={{ color: 'var(--color-cyber-cyan)' }}>Name *</label>
                        <input
                          type="text"
                          value={itemName}
                          onChange={e => setItemName(e.target.value)}
                          placeholder="e.g., Reinforced Combat Armor"
                          className="w-full px-3 py-2 rounded"
                          style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1" style={{ color: 'var(--color-cyber-cyan)' }}>Description</label>
                        <textarea
                          value={itemDescription}
                          onChange={e => setItemDescription(e.target.value)}
                          placeholder="Describe the item..."
                          rows={2}
                          className="w-full px-3 py-2 rounded"
                          style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm mb-1" style={{ color: 'var(--color-cyber-cyan)' }}>Type</label>
                          <select
                            value={itemType}
                            onChange={e => setItemType(e.target.value as ItemType)}
                            className="w-full px-3 py-2 rounded"
                            style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
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
                          <label className="block text-sm mb-1" style={{ color: 'var(--color-cyber-cyan)' }}>Rarity</label>
                          <select
                            value={itemRarity}
                            onChange={e => setItemRarity(e.target.value as ItemRarity)}
                            className="w-full px-3 py-2 rounded"
                            style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
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
                          <label className="block text-sm mb-1" style={{ color: 'var(--color-cyber-cyan)' }}>Price ($)</label>
                          <input
                            type="number"
                            min="0"
                            value={itemPrice}
                            onChange={e => setItemPrice(e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value)))}
                            className="w-full px-3 py-2 rounded"
                            style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                          />
                        </div>
                      </div>

                      {/* Conditional Fields Based on Item Type */}
                      {itemType === 'armor' && (
                        <div>
                          <label className="block text-sm mb-1" style={{ color: 'var(--color-cyber-yellow)' }}>Armor Type</label>
                          <select
                            value={itemArmorSubtype || ''}
                            onChange={e => setItemArmorSubtype(e.target.value as any || null)}
                            className="w-full px-3 py-2 rounded"
                            style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-yellow)', color: 'var(--color-cyber-yellow)' }}
                          >
                            <option value="">-- Select Armor Type --</option>
                            <option value="clothes">Clothes</option>
                            <option value="light">Light</option>
                            <option value="medium">Medium</option>
                            <option value="heavy">Heavy</option>
                            <option value="shield">Shield</option>
                          </select>
                        </div>
                      )}

                      {itemType === 'weapon' && (
                        <div>
                          <label className="block text-sm mb-1" style={{ color: 'var(--color-cyber-magenta)' }}>Weapon Type</label>
                          <select
                            value={itemWeaponSubtype || ''}
                            onChange={e => setItemWeaponSubtype(e.target.value as any || null)}
                            className="w-full px-3 py-2 rounded"
                            style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)' }}
                          >
                            <option value="">-- Select Weapon Type --</option>
                            <option value="unarmed">Unarmed</option>
                            <option value="melee">Melee</option>
                            <option value="sidearms">Sidearms</option>
                            <option value="longarms">Longarms</option>
                            <option value="heavy">Heavy</option>
                          </select>
                        </div>
                      )}

                      {itemType === 'cyberware' && (
                        <div>
                          <label className="block text-sm mb-1" style={{ color: 'var(--color-cyber-purple)' }}>IC Cost (Implant Capacity)</label>
                          <input
                            type="number"
                            value={itemIcCost}
                            onChange={e => setItemIcCost(parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 rounded"
                            style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-purple)', color: 'var(--color-cyber-purple)' }}
                            placeholder="How much IC this cyberware uses"
                          />
                        </div>
                      )}

                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={itemIsEquippable} onChange={e => setItemIsEquippable(e.target.checked)} className="w-4 h-4" />
                          <span className="text-sm" style={{ color: 'var(--color-cyber-cyan)' }}>Equippable</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={itemIsConsumable} onChange={e => setItemIsConsumable(e.target.checked)} className="w-4 h-4" />
                          <span className="text-sm" style={{ color: 'var(--color-cyber-cyan)' }}>Consumable</span>
                        </label>
                      </div>
                    </div>

                    {/* Stat Modifiers */}
                    <div>
                      <h4 className="text-sm mb-2" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-purple)' }}>STAT MODIFIERS</h4>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { label: 'STR', value: itemStrMod, setter: setItemStrMod },
                          { label: 'DEX', value: itemDexMod, setter: setItemDexMod },
                          { label: 'CON', value: itemConMod, setter: setItemConMod },
                          { label: 'WIS', value: itemWisMod, setter: setItemWisMod },
                          { label: 'INT', value: itemIntMod, setter: setItemIntMod },
                          { label: 'CHA', value: itemChaMod, setter: setItemChaMod },
                          { label: 'HP', value: itemHpMod, setter: setItemHpMod },
                          { label: 'AC', value: itemAcMod, setter: setItemAcMod },
                        ].map(stat => (
                          <div key={stat.label} className="flex items-center gap-1">
                            <span className="text-xs w-8" style={{ color: 'var(--color-cyber-purple)' }}>{stat.label}</span>
                            <button onClick={() => stat.setter(stat.value - 1)} className="px-2 py-1 rounded text-xs" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-purple)', color: 'var(--color-cyber-purple)' }}>−</button>
                            <span className="w-8 text-center text-sm" style={{ color: stat.value === 0 ? 'var(--color-cyber-cyan)' : stat.value > 0 ? 'var(--color-cyber-green)' : 'var(--color-cyber-magenta)' }}>
                              {stat.value === 0 ? '—' : formatModifier(stat.value)}
                            </span>
                            <button onClick={() => stat.setter(stat.value + 1)} className="px-2 py-1 rounded text-xs" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-purple)', color: 'var(--color-cyber-purple)' }}>+</button>
                          </div>
                        ))}
                      </div>
                      {/* SPEED, INIT, IC Row */}
                      <div className="grid grid-cols-3 gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--color-cyber-cyan)' }}>
                        {[
                          { label: 'SPEED', value: itemSpeedMod, setter: setItemSpeedMod },
                          { label: 'INIT', value: itemInitMod, setter: setItemInitMod },
                          { label: 'IC', value: itemIcMod, setter: setItemIcMod },
                        ].map(stat => (
                          <div key={stat.label} className="flex items-center gap-1">
                            <span className="text-xs w-12" style={{ color: 'var(--color-cyber-cyan)' }}>{stat.label}</span>
                            <button onClick={() => stat.setter(stat.value - 1)} className="px-2 py-1 rounded text-xs" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}>−</button>
                            <span className="w-8 text-center text-sm" style={{ color: stat.value === 0 ? 'var(--color-cyber-cyan)' : stat.value > 0 ? 'var(--color-cyber-green)' : 'var(--color-cyber-magenta)' }}>
                              {stat.value === 0 ? '—' : formatModifier(stat.value)}
                            </span>
                            <button onClick={() => stat.setter(stat.value + 1)} className="px-2 py-1 rounded text-xs" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}>+</button>
                          </div>
                        ))}
                      </div>
                      
                      {/* HP Modifier Type - show when consumable OR HP mod is set */}
                      {(itemIsConsumable || itemHpMod !== 0) && (
                        <div className="mt-3 pt-3 flex items-center gap-3" style={{ borderTop: '1px solid var(--color-cyber-magenta)' }}>
                          <span className="text-xs" style={{ color: 'var(--color-cyber-magenta)' }}>HP Effect:</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setItemHpModType('heal')}
                              className="px-3 py-1 rounded text-xs font-bold"
                              style={{
                                background: itemHpModType === 'heal' ? 'var(--color-cyber-magenta)' : 'transparent',
                                border: '1px solid var(--color-cyber-magenta)',
                                color: itemHpModType === 'heal' ? 'black' : 'var(--color-cyber-magenta)'
                              }}
                            >
                              ❤️ Heal HP
                            </button>
                            <button
                              onClick={() => setItemHpModType('max_hp')}
                              className="px-3 py-1 rounded text-xs font-bold"
                              style={{
                                background: itemHpModType === 'max_hp' ? 'var(--color-cyber-magenta)' : 'transparent',
                                border: '1px solid var(--color-cyber-magenta)',
                                color: itemHpModType === 'max_hp' ? 'black' : 'var(--color-cyber-magenta)'
                              }}
                            >
                              💪 +Max HP
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Skill Modifiers */}
                    <div>
                      <h4 className="text-sm mb-2" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-green)' }}>SKILL BONUSES</h4>
                      <div className="grid grid-cols-3 gap-1 max-h-[150px] overflow-y-auto">
                        {ALL_SKILLS.map(skill => (
                          <div key={skill} className="flex items-center gap-1">
                            <span className="text-xs flex-1 truncate" style={{ color: 'var(--color-cyber-green)' }}>{skill}</span>
                            <button onClick={() => handleItemSkillMod(skill, (itemSkillMods[skill] || 0) - 1)} className="px-1 py-0.5 rounded text-xs" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-green)', color: 'var(--color-cyber-green)' }}>−</button>
                            <span className="w-6 text-center text-xs" style={{ color: 'var(--color-cyber-green)' }}>
                              {itemSkillMods[skill] ? formatModifier(itemSkillMods[skill]) : '—'}
                            </span>
                            <button onClick={() => handleItemSkillMod(skill, (itemSkillMods[skill] || 0) + 1)} className="px-1 py-0.5 rounded text-xs" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-green)', color: 'var(--color-cyber-green)' }}>+</button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Preview */}
                    <div className="p-4 rounded" style={{ border: `2px solid ${getRarityColor(itemRarity)}`, background: 'color-mix(in srgb, var(--color-cyber-darker) 80%, transparent)' }}>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-3xl">{getItemTypeIcon(itemType)}</span>
                        <div>
                          <div className="text-lg font-bold" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>{itemName || 'Unnamed Item'}</div>
                          <div className="text-xs flex items-center gap-2" style={{ opacity: 0.9 }}>
                            <span style={{ color: 'var(--color-cyber-cyan)' }}>{itemType.toUpperCase()}</span>
                            <span>•</span>
                            <span style={{ color: getRarityColor(itemRarity), background: getRarityBgColor(itemRarity), padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>{itemRarity.toUpperCase()}</span>
                          </div>
                        </div>
                        <div className="ml-auto text-lg" style={{ color: 'var(--color-cyber-green)' }}>${itemPrice.toLocaleString()}</div>
                      </div>
                      {itemDescription && <p className="text-xs mb-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>{itemDescription}</p>}
                      {(itemStrMod !== 0 || itemDexMod !== 0 || itemConMod !== 0 || itemWisMod !== 0 || itemIntMod !== 0 || itemChaMod !== 0 || itemHpMod !== 0 || itemAcMod !== 0 || itemSpeedMod !== 0 || itemInitMod !== 0 || itemIcMod !== 0 || Object.keys(itemSkillMods).length > 0) && (
                        <div className="text-xs space-x-2" style={{ color: 'var(--color-cyber-green)' }}>
                          {itemStrMod !== 0 && <span>STR {formatModifier(itemStrMod)}</span>}
                          {itemDexMod !== 0 && <span>DEX {formatModifier(itemDexMod)}</span>}
                          {itemConMod !== 0 && <span>CON {formatModifier(itemConMod)}</span>}
                          {itemWisMod !== 0 && <span>WIS {formatModifier(itemWisMod)}</span>}
                          {itemIntMod !== 0 && <span>INT {formatModifier(itemIntMod)}</span>}
                          {itemChaMod !== 0 && <span>CHA {formatModifier(itemChaMod)}</span>}
                          {itemHpMod !== 0 && <span>HP {formatModifier(itemHpMod)}</span>}
                          {itemAcMod !== 0 && <span>AC {formatModifier(itemAcMod)}</span>}
                          {itemSpeedMod !== 0 && <span>SPEED {formatModifier(itemSpeedMod)}</span>}
                          {itemInitMod !== 0 && <span>INIT {formatModifier(itemInitMod)}</span>}
                          {itemIcMod !== 0 && <span>IC {formatModifier(itemIcMod)}</span>}
                          {Object.entries(itemSkillMods).map(([skill, bonus]) => (
                            <span key={skill}>{skill} {formatModifier(bonus)}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Linked Abilities */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-yellow)' }}>⚡ LINKED ABILITIES</h4>
                        <button
                          onClick={() => setShowLinkAbilityModal(true)}
                          className="px-3 py-1 rounded text-xs"
                          style={{ background: 'var(--color-cyber-yellow)', color: '#0D1117', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}
                        >
                          + ADD ABILITY
                        </button>
                      </div>
                      {itemLinkedAbilities.length === 0 ? (
                        <div className="text-center py-4 rounded" style={{ border: '1px dashed var(--color-cyber-green)', opacity: 0.5 }}>
                          <p className="text-xs" style={{ color: 'var(--color-cyber-cyan)' }}>No abilities linked to this item</p>
                          <p className="text-xs mt-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>Characters who equip this item can gain abilities</p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[120px] overflow-y-auto">
                          {itemLinkedAbilities.map(la => (
                            <div key={la.ability_id} className="flex items-center justify-between p-2 rounded" style={{ border: '1px solid var(--color-cyber-green)', background: 'color-mix(in srgb, var(--color-cyber-dark) 50%, transparent)' }}>
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{getAbilityTypeIcon(la.ability.type)}</span>
                                <div>
                                  <div className="text-sm" style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-cyber)' }}>{la.ability.name}</div>
                                  <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>
                                    {la.ability.charge_type.replace('_', ' ')}
                                    {la.requires_equipped && <span className="ml-2" style={{ color: 'var(--color-cyber-magenta)' }}>• Requires Equipped</span>}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <label className="flex items-center gap-1 text-xs cursor-pointer" style={{ color: 'var(--color-cyber-cyan)' }}>
                                  <input
                                    type="checkbox"
                                    checked={la.requires_equipped}
                                    onChange={e => {
                                      setItemLinkedAbilities(prev => prev.map(a => 
                                        a.ability_id === la.ability_id ? { ...a, requires_equipped: e.target.checked } : a
                                      ));
                                    }}
                                    className="w-3 h-3"
                                  />
                                  Equipped
                                </label>
                                <button
                                  onClick={() => setItemLinkedAbilities(prev => prev.filter(a => a.ability_id !== la.ability_id))}
                                  className="px-2 py-1 rounded text-xs"
                                  style={{ background: 'transparent', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)' }}
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Save/Cancel Buttons */}
                    <div className="flex gap-4">
                      <button
                        onClick={() => { resetItemForm(); setSelectedEditItem(null); setItemsSubTab('list'); }}
                        className="flex-1 px-4 py-2 rounded"
                        style={{ background: 'transparent', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-cyber)' }}
                      >
                        CANCEL
                      </button>
                      <button
                        onClick={handleSaveItem}
                        disabled={itemSaving || !itemName.trim()}
                        className="flex-1 px-4 py-2 rounded"
                        style={{
                          background: itemName.trim() ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-green)',
                          color: '#0D1117',
                          fontFamily: 'var(--font-cyber)',
                          opacity: itemName.trim() ? 1 : 0.5
                        }}
                      >
                        {itemSaving ? 'SAVING...' : selectedEditItem ? 'UPDATE ITEM' : 'CREATE ITEM'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Link Ability to Item Modal */}
          {showLinkAbilityModal && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => { setShowLinkAbilityModal(false); setLinkAbilitySearch(''); }}>
              <div className="glass-panel p-6 w-full max-w-lg" style={{ border: '2px solid var(--color-cyber-yellow)' }} onClick={e => e.stopPropagation()}>
                <h3 className="text-lg mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-yellow)' }}>
                  ⚡ LINK ABILITY TO ITEM
                </h3>
                
                <input
                  type="text"
                  placeholder="Search abilities..."
                  value={linkAbilitySearch}
                  onChange={e => setLinkAbilitySearch(e.target.value)}
                  className="w-full px-3 py-2 rounded mb-4"
                  style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                />

                <div className="max-h-[350px] overflow-y-auto space-y-2 mb-4">
                  {allAbilities
                    .filter(ability => 
                      ability.name.toLowerCase().includes(linkAbilitySearch.toLowerCase()) &&
                      !itemLinkedAbilities.some(la => la.ability_id === ability.id)
                    )
                    .slice(0, 20)
                    .map(ability => (
                      <div
                        key={ability.id}
                        onClick={() => {
                          setItemLinkedAbilities(prev => [...prev, {
                            ability_id: ability.id,
                            ability: ability,
                            requires_equipped: true
                          }]);
                          setShowLinkAbilityModal(false);
                          setLinkAbilitySearch('');
                        }}
                        className="p-3 rounded cursor-pointer transition-all hover:brightness-110"
                        style={{ border: '1px solid var(--color-cyber-green)', background: 'color-mix(in srgb, var(--color-cyber-dark) 50%, transparent)' }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getAbilityTypeIcon(ability.type)}</span>
                          <div>
                            <div className="text-sm font-bold" style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-cyber)' }}>{ability.name}</div>
                            <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>
                              {toTitleCase(ability.type)} • {toTitleCase(ability.charge_type)}
                              {ability.max_charges && <span> • {ability.max_charges} charges</span>}
                            </div>
                          </div>
                        </div>
                        <p className="text-xs mt-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>
                          {ability.description.slice(0, 100)}{ability.description.length > 100 ? '...' : ''}
                        </p>
                      </div>
                    ))
                  }
                  {allAbilities.filter(a => 
                    a.name.toLowerCase().includes(linkAbilitySearch.toLowerCase()) &&
                    !itemLinkedAbilities.some(la => la.ability_id === a.id)
                  ).length === 0 && (
                    <div className="text-center py-8" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>
                      No matching abilities found
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => { setShowLinkAbilityModal(false); setLinkAbilitySearch(''); }}
                    className="px-4 py-2 rounded text-sm"
                    style={{ background: 'transparent', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)' }}
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'abilities' && (
            <div className="flex gap-4 h-[calc(100vh-180px)]">
              {/* Left Side - Ability List (Always Visible) */}
              <div className="w-1/2 flex flex-col" style={{ minWidth: '400px' }}>
                {/* Header with Create Button */}
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-lg" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-pink)' }}>⚡ ABILITIES</h3>
                  <span className="text-xs px-2 py-1 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-pink) 20%, transparent)', color: 'var(--color-cyber-pink)' }}>
                    {filteredAbilitiesList.length} abilities
                  </span>
                  <button
                    onClick={() => { resetAbilityForm(); setSelectedEditAbility(null); setAbilitiesSubTab('create'); }}
                    className="ml-auto px-4 py-2 rounded text-sm"
                    style={{ background: 'var(--color-cyber-yellow)', color: '#0D1117', fontFamily: 'var(--font-cyber)' }}
                  >
                    ➕ CREATE NEW
                  </button>
                </div>

                {/* Give Ability Button */}
                <button
                  onClick={() => setShowGiveAbilityModal(true)}
                  className="w-full px-4 py-2 rounded text-sm mb-3"
                  style={{ background: 'var(--color-cyber-pink)', color: '#fff', fontFamily: 'var(--font-cyber)' }}
                >
                  🎁 GIVE ABILITY TO PLAYER
                </button>

                {/* Search and Filters */}
                <div className="space-y-2 mb-3">
                  <input
                    type="text"
                    placeholder="🔍 Search abilities..."
                    value={abilitySearchQuery}
                    onChange={e => setAbilitySearchQuery(e.target.value)}
                    className="w-full px-3 py-2 rounded text-sm"
                    style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-pink)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}
                  />
                  <div className="flex gap-2">
                    <select
                      value={abilityFilterSource}
                      onChange={e => setAbilityFilterSource(e.target.value as 'all' | 'custom' | 'class')}
                      className="flex-1 px-2 py-1.5 rounded text-sm"
                      style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-pink)', color: 'var(--color-cyber-cyan)' }}
                    >
                      <option value="all">All Sources</option>
                      <option value="custom">Custom Abilities</option>
                      <option value="class">Class Features</option>
                    </select>
                    <select
                      value={abilityFilterType}
                      onChange={e => setAbilityFilterType(e.target.value)}
                      className="flex-1 px-2 py-1.5 rounded text-sm"
                      style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-pink)', color: 'var(--color-cyber-cyan)' }}
                    >
                      <option value="all">All Types</option>
                      <option value="action">Action</option>
                      <option value="bonus_action">Bonus Action</option>
                      <option value="reaction">Reaction</option>
                      <option value="passive">Passive</option>
                      <option value="utility">Utility</option>
                    </select>
                  </div>
                </div>

                {/* Ability Grid List */}
                <div className="flex-1 overflow-y-auto pr-2">
                  {abilitiesLoading ? (
                    <div className="text-center py-8" style={{ color: 'var(--color-cyber-cyan)' }}>Loading...</div>
                  ) : filteredAbilitiesList.length === 0 ? (
                    <div className="text-center py-8" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>No abilities found</div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {filteredAbilitiesList.map(ability => (
                        <div
                          key={ability.id}
                          className="p-3 rounded cursor-pointer transition-all hover:brightness-110"
                          style={{ 
                            border: `1px solid ${selectedEditAbility?.id === ability.id ? 'var(--color-cyber-yellow)' : ability.source === 'class' ? 'var(--color-cyber-cyan)' : 'var(--color-cyber-pink)'}`,
                            background: selectedEditAbility?.id === ability.id ? 'color-mix(in srgb, var(--color-cyber-yellow) 15%, transparent)' : 'color-mix(in srgb, var(--color-cyber-darker) 90%, transparent)'
                          }}
                          onClick={() => loadAbilityForEdit(ability)}
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-lg">{getAbilityTypeIcon(ability.type)}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-bold truncate" style={{ color: ability.source === 'class' ? 'var(--color-cyber-cyan)' : 'var(--color-cyber-pink)' }}>{ability.name}</div>
                                {ability.source === 'class' && ability.class_name && (
                                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)', color: 'var(--color-cyber-cyan)', fontSize: '9px' }}>
                                    {ability.class_name}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>
                                {toTitleCase(ability.type)} • {ability.charge_type === 'infinite' ? '∞' : `${ability.max_charges} charges`}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Side - Edit Form */}
              <div className="w-1/2 glass-panel p-5 overflow-y-auto" style={{ border: '1px solid var(--color-cyber-pink)', minWidth: '400px' }}>
                {!selectedEditAbility && abilitiesSubTab !== 'create' ? (
                  <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>
                    <p className="text-xl mb-2" style={{ fontFamily: 'var(--font-cyber)' }}>SELECT AN ABILITY</p>
                    <p className="text-sm" style={{ fontFamily: 'var(--font-mono)' }}>Click an ability to edit, or use CREATE NEW</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-yellow)' }}>
                        {selectedEditAbility ? '✏️ EDIT ABILITY' : '➕ CREATE ABILITY'}
                      </h3>
                      {selectedEditAbility && (
                        <button
                          onClick={() => handleDeleteAbility(selectedEditAbility.id, selectedEditAbility.name)}
                          className="px-3 py-1 rounded text-sm"
                          style={{ background: 'transparent', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)' }}
                        >
                          🗑️ DELETE
                        </button>
                      )}
                    </div>

                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm mb-1" style={{ color: 'var(--color-cyber-cyan)' }}>Name *</label>
                        <input
                          type="text"
                          value={abilityName}
                          onChange={e => setAbilityName(e.target.value)}
                          placeholder="e.g., Fireball"
                          className="w-full px-3 py-2 rounded"
                          style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1" style={{ color: 'var(--color-cyber-cyan)' }}>Type</label>
                        <select
                          value={abilityType}
                          onChange={e => setAbilityType(e.target.value as AbilityType)}
                          className="w-full px-3 py-2 rounded"
                          style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                        >
                          <option value="action">Action</option>
                          <option value="bonus_action">Bonus Action</option>
                          <option value="reaction">Reaction</option>
                          <option value="passive">Passive</option>
                          <option value="utility">Utility</option>
                        </select>
                      </div>
                    </div>

                    {/* Source Selection */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm mb-1" style={{ color: 'var(--color-cyber-yellow)' }}>Source</label>
                        <select
                          value={abilitySource}
                          onChange={e => setAbilitySource(e.target.value as 'custom' | 'class')}
                          className="w-full px-3 py-2 rounded"
                          style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-yellow)', color: 'var(--color-cyber-yellow)' }}
                        >
                          <option value="custom">Custom Ability</option>
                          <option value="class">Class Ability</option>
                        </select>
                      </div>
                      {abilitySource === 'class' && (
                        <div>
                          <label className="block text-sm mb-1" style={{ color: 'var(--color-cyber-yellow)' }}>Class *</label>
                          <select
                            value={abilityClassName}
                            onChange={e => setAbilityClassName(e.target.value)}
                            className="w-full px-3 py-2 rounded"
                            style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-yellow)', color: 'var(--color-cyber-yellow)' }}
                          >
                            <option value="">Select a class...</option>
                            {CHARACTER_CLASSES.map(c => (
                              <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm mb-1" style={{ color: 'var(--color-cyber-cyan)' }}>Description</label>
                      <textarea
                        value={abilityDescription}
                        onChange={e => setAbilityDescription(e.target.value)}
                        placeholder="Describe the ability..."
                        rows={2}
                        className="w-full px-3 py-2 rounded"
                        style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                      />
                    </div>

                    {/* Charge System */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm mb-1" style={{ color: 'var(--color-cyber-purple)' }}>Charge Type</label>
                        <select
                          value={abilityChargeType}
                          onChange={e => setAbilityChargeType(e.target.value as ChargeType)}
                          className="w-full px-3 py-2 rounded"
                          style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-purple)', color: 'var(--color-cyber-purple)' }}
                        >
                          <option value="infinite">Infinite (At-Will)</option>
                          <option value="short_rest">Short Rest</option>
                          <option value="long_rest">Long Rest</option>
                          <option value="uses">Uses (No Recharge)</option>
                        </select>
                      </div>
                      {abilityChargeType !== 'infinite' && (
                        <div>
                          <label className="block text-sm mb-1" style={{ color: 'var(--color-cyber-purple)' }}>Max Charges</label>
                          <input
                            type="number"
                            value={abilityMaxCharges ?? ''}
                            onChange={e => setAbilityMaxCharges(parseInt(e.target.value) || null)}
                            min={1}
                            className="w-full px-3 py-2 rounded"
                            style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-purple)', color: 'var(--color-cyber-purple)' }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Effects */}
                    <div>
                      <label className="block text-sm mb-1" style={{ color: 'var(--color-cyber-green)' }}>Effects *</label>
                      {abilityEffects.map((effect, idx) => (
                        <div key={idx} className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={effect}
                            onChange={e => handleAbilityEffectChange(idx, e.target.value)}
                            placeholder={`Effect ${idx + 1}`}
                            className="flex-1 px-3 py-2 rounded"
                            style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-green)', color: 'var(--color-cyber-green)' }}
                          />
                          <button onClick={() => handleRemoveAbilityEffect(idx)} className="px-3 py-2 rounded" style={{ background: 'var(--color-cyber-magenta)', color: '#fff' }}>✕</button>
                        </div>
                      ))}
                      <button onClick={handleAddAbilityEffect} className="text-sm px-3 py-1 rounded" style={{ border: '1px solid var(--color-cyber-green)', color: 'var(--color-cyber-green)' }}>+ Add Effect</button>
                    </div>

                    {/* Combat Stats (Optional) */}
                    <div className="p-3 rounded" style={{ border: '1px dashed var(--color-cyber-cyan)', opacity: 0.7 }}>
                      <h4 className="text-xs mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>COMBAT INFO (Optional)</h4>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)' }}>Damage Dice</label>
                          <input
                            type="text"
                            value={abilityDamageDice}
                            onChange={e => setAbilityDamageDice(e.target.value)}
                            placeholder="2d6"
                            className="w-full px-2 py-1 rounded text-sm"
                            style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                          />
                        </div>
                        <div>
                          <label className="block text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)' }}>Damage Type</label>
                          <input
                            type="text"
                            value={abilityDamageType}
                            onChange={e => setAbilityDamageType(e.target.value)}
                            placeholder="fire"
                            className="w-full px-2 py-1 rounded text-sm"
                            style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                          />
                        </div>
                        <div>
                          <label className="block text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)' }}>Range (ft)</label>
                          <input
                            type="number"
                            value={abilityRange ?? ''}
                            onChange={e => setAbilityRange(parseInt(e.target.value) || null)}
                            placeholder="30"
                            className="w-full px-2 py-1 rounded text-sm"
                            style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                          />
                        </div>
                        <div>
                          <label className="block text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)' }}>Area of Effect</label>
                          <input
                            type="text"
                            value={abilityAoE}
                            onChange={e => setAbilityAoE(e.target.value)}
                            placeholder="15ft cone"
                            className="w-full px-2 py-1 rounded text-sm"
                            style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                          />
                        </div>
                        <div>
                          <label className="block text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)' }}>Duration</label>
                          <input
                            type="text"
                            value={abilityDuration}
                            onChange={e => setAbilityDuration(e.target.value)}
                            placeholder="1 minute"
                            className="w-full px-2 py-1 rounded text-sm"
                            style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Preview */}
                    <div className="p-4 rounded" style={{ border: '2px solid var(--color-cyber-pink)', background: 'color-mix(in srgb, var(--color-cyber-darker) 80%, transparent)' }}>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-3xl">{getAbilityTypeIcon(abilityType)}</span>
                        <div>
                          <div className="text-lg font-bold" style={{ color: 'var(--color-cyber-pink)', fontFamily: 'var(--font-cyber)' }}>{abilityName || 'Unnamed Ability'}</div>
                          <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>
                            {abilityType.replace('_', ' ').toUpperCase()} • {abilityChargeType === 'infinite' ? '∞ At-Will' : `${abilityMaxCharges || 0} charges / ${abilityChargeType.replace('_', ' ')}`}
                          </div>
                        </div>
                      </div>
                      {abilityDescription && <p className="text-xs mb-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>{abilityDescription}</p>}
                      {abilityEffects.filter(e => e.trim()).length > 0 && (
                        <ul className="text-xs space-y-1" style={{ color: 'var(--color-cyber-green)' }}>
                          {abilityEffects.filter(e => e.trim()).map((eff, i) => <li key={i}>• {eff}</li>)}
                        </ul>
                      )}
                    </div>

                    {/* Save/Cancel Buttons */}
                    <div className="flex gap-4">
                      <button
                        onClick={() => { resetAbilityForm(); setSelectedEditAbility(null); setAbilitiesSubTab('list'); }}
                        className="flex-1 px-4 py-2 rounded"
                        style={{ background: 'transparent', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-cyber)' }}
                      >
                        CANCEL
                      </button>
                      <button
                        onClick={handleSaveAbility}
                        disabled={abilitySaving || !abilityName.trim()}
                        className="flex-1 px-4 py-2 rounded"
                        style={{
                          background: abilityName.trim() ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-green)',
                          color: '#0D1117',
                          fontFamily: 'var(--font-cyber)',
                          opacity: abilityName.trim() ? 1 : 0.5
                        }}
                      >
                        {abilitySaving ? 'SAVING...' : selectedEditAbility ? 'UPDATE ABILITY' : 'CREATE ABILITY'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Give Ability Modal */}
          {showGiveAbilityModal && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
              <div className="glass-panel p-6 w-[600px] max-h-[80vh] overflow-y-auto" style={{ border: '2px solid var(--color-cyber-pink)' }}>
                <h3 className="text-lg mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-pink)' }}>
                  🎁 GIVE ABILITY TO PLAYER
                </h3>

                {/* Step 1: Select Character */}
                {!giveAbilityCharacter ? (
                  <>
                    <p className="text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)' }}>Select a character:</p>
                    <div className="max-h-[300px] overflow-y-auto space-y-2">
                      {characters.map(char => (
                        <div
                          key={char.id}
                          onClick={() => setGiveAbilityCharacter(char)}
                          className="p-3 rounded cursor-pointer transition-all hover:brightness-110"
                          style={{ border: '1px solid var(--color-cyber-cyan)', background: 'var(--color-cyber-darker)' }}
                        >
                          <div className="text-sm" style={{ color: 'var(--color-cyber-cyan)' }}>{char.name}</div>
                          <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>{char.class} • Lvl {char.level}</div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    {/* Step 2: Select Ability */}
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-sm" style={{ color: 'var(--color-cyber-cyan)' }}>Giving to:</span>
                      <span className="font-bold" style={{ color: 'var(--color-cyber-yellow)' }}>{giveAbilityCharacter.name}</span>
                      <button onClick={() => setGiveAbilityCharacter(null)} className="text-xs px-2 py-1 rounded" style={{ border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)' }}>Change</button>
                    </div>

                    <input
                      type="text"
                      placeholder="Search abilities..."
                      value={giveAbilitySearch}
                      onChange={e => setGiveAbilitySearch(e.target.value)}
                      className="w-full px-3 py-2 rounded text-sm mb-4"
                      style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                    />

                    <div className="max-h-[250px] overflow-y-auto space-y-2 mb-4">
                      {filteredGiveAbilities.slice(0, 20).map(ability => (
                        <div
                          key={ability.id}
                          onClick={() => setSelectedGiveAbility(ability)}
                          className="p-2 rounded cursor-pointer transition-all"
                          style={{
                            border: `1px solid ${selectedGiveAbility?.id === ability.id ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-pink)'}`,
                            background: selectedGiveAbility?.id === ability.id ? 'color-mix(in srgb, var(--color-cyber-yellow) 20%, transparent)' : 'transparent'
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span>{getAbilityTypeIcon(ability.type)}</span>
                            <div>
                              <div className="text-sm" style={{ color: 'var(--color-cyber-pink)' }}>{ability.name}</div>
                              <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>{ability.type.replace('_', ' ')}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => { setShowGiveAbilityModal(false); setGiveAbilityCharacter(null); setSelectedGiveAbility(null); setGiveAbilitySearch(''); }}
                    className="px-4 py-2 rounded text-sm"
                    style={{ background: 'transparent', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)' }}
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={handleGiveAbilityToCharacter}
                    disabled={!giveAbilityCharacter || !selectedGiveAbility}
                    className="px-4 py-2 rounded text-sm"
                    style={{
                      background: (giveAbilityCharacter && selectedGiveAbility) ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-green)',
                      color: '#0D1117',
                      opacity: (giveAbilityCharacter && selectedGiveAbility) ? 1 : 0.5
                    }}
                  >
                    GIVE ABILITY
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'map' && (
            <>
              {/* Main Map Layout */}
              <div className="flex gap-4 h-[calc(100vh-180px)]">
                {/* Left Side - Map (Always Visible) */}
                <div className="w-1/2 flex flex-col" style={{ minWidth: '400px' }}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-yellow)' }}>🗺️ MAP VIEW</h3>
                    <p className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>Click map to set coordinates</p>
                  </div>
                  <div className="flex-1 rounded overflow-hidden" style={{ border: '2px solid var(--color-cyber-green)' }}>
                    <WorldMap
                      isDM={true}
                      externalLocations={allLocations}
                      onLocationClick={(location) => loadLocationForEdit(location)}
                      onMapClick={(lat, lng) => {
                        setMapSubTab('create');
                        resetLocationForm();
                        setLocationLat(lat);
                        setLocationLng(lng);
                      }}
                      showPopups={true}
                    />
                  </div>
                </div>

                {/* Right Side - List + Edit Panel */}
                <div className="w-1/2 flex flex-col gap-4" style={{ minWidth: '400px' }}>
                  {/* Top - Location List */}
                  <div className="glass-panel p-4 flex-shrink-0" style={{ border: '1px solid var(--color-cyber-cyan)', height: '250px' }}>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>📍 LOCATIONS</h4>
                      <button
                        onClick={() => { setMapSubTab('create'); resetLocationForm(); }}
                        className="px-3 py-1 rounded text-xs"
                        style={{ background: 'var(--color-cyber-yellow)', color: '#0D1117', fontFamily: 'var(--font-cyber)' }}
                      >
                        + NEW
                      </button>
                    </div>
                    
                    {/* Search and Filter */}
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        placeholder="Search..."
                        value={locationSearchQuery}
                        onChange={e => setLocationSearchQuery(e.target.value)}
                        className="flex-1 px-2 py-1 rounded text-xs"
                        style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                      />
                      <select
                        value={locationFilterIcon}
                        onChange={e => setLocationFilterIcon(e.target.value)}
                        className="px-2 py-1 rounded text-xs"
                        style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                      >
                        <option value="all">All Types</option>
                        {ALL_LOCATION_ICONS.map(icon => (
                          <option key={icon.value} value={icon.value}>{icon.emoji} {icon.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Location List */}
                    <div className="overflow-y-auto space-y-1" style={{ maxHeight: '150px' }}>
                      {mapLoading ? (
                        <div className="text-center py-4" style={{ color: 'var(--color-cyber-cyan)' }}>Loading...</div>
                      ) : filteredLocationsList.length === 0 ? (
                        <div className="text-center py-4 text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>No locations found</div>
                      ) : (
                        filteredLocationsList.map(location => (
                          <div
                            key={location.id}
                            className={`p-2 rounded cursor-pointer transition-all hover:brightness-110 ${selectedEditLocation?.id === location.id ? 'ring-2 ring-yellow-400' : ''}`}
                            style={{ border: `1px solid ${getLocationColor(location.color)}`, background: 'color-mix(in srgb, var(--color-cyber-darker) 90%, transparent)' }}
                            onClick={() => loadLocationForEdit(location)}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{getLocationIcon(location.icon)}</span>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold truncate" style={{ color: getLocationColor(location.color) }}>{location.name}</div>
                                <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>
                                  ({location.lat.toFixed(1)}, {location.lng.toFixed(1)})
                                </div>
                              </div>
                              <div className="flex gap-1">
                                {!location.is_visible && <span title="Hidden" className="text-xs opacity-50">👁️</span>}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Bottom - Edit Panel */}
                  <div className="glass-panel p-4 flex-1 overflow-hidden flex flex-col" style={{ border: '1px solid var(--color-cyber-orange)' }}>
                    {!selectedEditLocation && mapSubTab === 'list' ? (
                      <div className="flex items-center justify-center h-full" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>
                        <div className="text-center">
                          <p className="text-lg mb-2">📍 Select a location to edit</p>
                          <p className="text-xs">or click "NEW" to create one</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Header with tabs */}
                        <div className="flex items-center justify-between mb-3 flex-shrink-0">
                          <div className="flex items-center gap-3">
                            <h4 className="text-sm" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-yellow)' }}>
                              {selectedEditLocation ? `✏️ ${selectedEditLocation.name}` : '➕ NEW LOCATION'}
                            </h4>
                            {selectedEditLocation && (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => setEditSubTab('details')}
                                  className="px-3 py-1 rounded text-sm"
                                  style={{
                                    background: editSubTab === 'details' ? 'var(--color-cyber-cyan)' : 'transparent',
                                    color: editSubTab === 'details' ? '#0D1117' : 'var(--color-cyber-cyan)',
                                    border: '1px solid var(--color-cyber-cyan)'
                                  }}
                                >
                                  Details
                                </button>
                                <button
                                  onClick={() => setEditSubTab('shops')}
                                  className="px-3 py-1 rounded text-sm"
                                  style={{
                                    background: editSubTab === 'shops' ? 'var(--color-cyber-green)' : 'transparent',
                                    color: editSubTab === 'shops' ? '#0D1117' : 'var(--color-cyber-green)',
                                    border: '1px solid var(--color-cyber-green)'
                                  }}
                                >
                                  🏪 Shops ({locationShops.length})
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {selectedEditLocation && (
                              <button
                                onClick={() => handleDeleteLocation(selectedEditLocation.id, selectedEditLocation.name)}
                                className="px-2 py-1 rounded text-xs"
                                style={{ background: 'transparent', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)' }}
                              >
                                🗑️
                              </button>
                            )}
                            <button
                              onClick={() => { resetLocationForm(); setMapSubTab('list'); }}
                              className="px-2 py-1 rounded text-xs"
                              style={{ background: 'transparent', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                            >
                              ✕ Close
                            </button>
                          </div>
                        </div>

                        {/* Content area */}
                        <div className="flex-1 overflow-y-auto">
                          {editSubTab === 'details' || !selectedEditLocation ? (
                            <div className="space-y-3">
                              {/* Name + Icon/Color */}
                              <div className="grid grid-cols-3 gap-2">
                                <div className="col-span-2">
                                  <label className="block text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)' }}>Name *</label>
                                  <input
                                    type="text"
                                    value={locationName}
                                    onChange={e => setLocationName(e.target.value)}
                                    placeholder="Location name..."
                                    className="w-full px-2 py-1 rounded text-sm"
                                    style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-1">
                                  <div>
                                    <label className="block text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)' }}>Icon</label>
                                    <select
                                      value={locationIcon}
                                      onChange={e => setLocationIcon(e.target.value as LocationIcon)}
                                      className="w-full px-1 py-1 rounded text-xs"
                                      style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                                    >
                                      {ALL_LOCATION_ICONS.map(icon => (
                                        <option key={icon.value} value={icon.value}>{icon.emoji} {icon.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)' }}>Color</label>
                                    <select
                                      value={locationColor}
                                      onChange={e => setLocationColor(e.target.value as LocationColor)}
                                      className="w-full px-1 py-1 rounded text-xs"
                                      style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                                    >
                                      {ALL_LOCATION_COLORS.map(color => (
                                        <option key={color.value} value={color.value}>{color.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              </div>

                              {/* Description */}
                              <div>
                                <label className="block text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)' }}>Description</label>
                                <textarea
                                  value={locationDescription}
                                  onChange={e => setLocationDescription(e.target.value)}
                                  placeholder="Brief description..."
                                  rows={2}
                                  className="w-full px-2 py-1 rounded text-sm"
                                  style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                                />
                              </div>

                              {/* Lore */}
                              <div>
                                <label className="block text-xs mb-1" style={{ color: 'var(--color-cyber-purple)' }}>Lore (DM Notes)</label>
                                <textarea
                                  value={locationLore}
                                  onChange={e => setLocationLore(e.target.value)}
                                  placeholder="Secret lore, hidden info..."
                                  rows={2}
                                  className="w-full px-2 py-1 rounded text-sm"
                                  style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-purple)', color: 'var(--color-cyber-purple)' }}
                                />
                              </div>

                              {/* Coordinates */}
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-xs mb-1" style={{ color: 'var(--color-cyber-green)' }}>Latitude</label>
                                  <input
                                    type="number"
                                    value={locationLat}
                                    onChange={e => setLocationLat(parseFloat(e.target.value) || 0)}
                                    step="0.01"
                                    className="w-full px-2 py-1 rounded text-sm"
                                    style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-green)', color: 'var(--color-cyber-green)' }}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs mb-1" style={{ color: 'var(--color-cyber-green)' }}>Longitude</label>
                                  <input
                                    type="number"
                                    value={locationLng}
                                    onChange={e => setLocationLng(parseFloat(e.target.value) || 0)}
                                    step="0.01"
                                    className="w-full px-2 py-1 rounded text-sm"
                                    style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-green)', color: 'var(--color-cyber-green)' }}
                                  />
                                </div>
                              </div>

                              {/* Tags */}
                              <div>
                                <label className="block text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)' }}>Tags (comma-separated)</label>
                                <input
                                  type="text"
                                  value={locationTags}
                                  onChange={e => setLocationTags(e.target.value)}
                                  placeholder="e.g., shop, combat, safe"
                                  className="w-full px-2 py-1 rounded text-sm"
                                  style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                                />
                              </div>

                              {/* Visibility toggles */}
                              <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input type="checkbox" checked={locationVisible} onChange={e => setLocationVisible(e.target.checked)} className="w-3 h-3" />
                                  <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)' }}>Visible to Players</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input type="checkbox" checked={locationDiscovered} onChange={e => setLocationDiscovered(e.target.checked)} className="w-3 h-3" />
                                  <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)' }}>Already Discovered</span>
                                </label>
                              </div>

                              {/* Save Button */}
                              <button
                                onClick={handleSaveLocation}
                                disabled={locationSaving || !locationName.trim()}
                                className="w-full px-4 py-2 rounded"
                                style={{
                                  background: locationName.trim() ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-green)',
                                  color: '#0D1117',
                                  fontFamily: 'var(--font-cyber)',
                                  opacity: locationName.trim() ? 1 : 0.5
                                }}
                              >
                                {locationSaving ? 'SAVING...' : selectedEditLocation ? 'UPDATE LOCATION' : 'CREATE LOCATION'}
                              </button>
                            </div>
                          ) : (
                            /* Shops Tab Content */
                            <div className="space-y-3">
                              {/* Create New Shop */}
                              <div className="p-3 rounded" style={{ border: '1px dashed var(--color-cyber-green)', background: 'rgba(0,255,136,0.05)' }}>
                                <h5 className="text-sm mb-2" style={{ color: 'var(--color-cyber-green)' }}>➕ Add Shop to Location</h5>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={newShopName}
                                    onChange={e => setNewShopName(e.target.value)}
                                    placeholder="Shop name..."
                                    className="flex-1 px-3 py-2 rounded"
                                    style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-green)', color: 'var(--color-cyber-green)' }}
                                  />
                                  <button
                                    onClick={handleCreateShop}
                                    disabled={!newShopName.trim()}
                                    className="px-4 py-2 rounded"
                                    style={{ background: 'var(--color-cyber-green)', color: '#0D1117', opacity: newShopName.trim() ? 1 : 0.5 }}
                                  >
                                    Create
                                  </button>
                                </div>
                              </div>

                              {/* Existing Shops List */}
                              {shopsLoading ? (
                                <div className="text-center py-4" style={{ color: 'var(--color-cyber-cyan)' }}>Loading shops...</div>
                              ) : locationShops.length === 0 ? (
                                <div className="text-center py-8" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>
                                  <p className="text-lg mb-2">🏪 No shops yet</p>
                                  <p className="text-sm">Create a shop above to add inventory</p>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  {locationShops.map(shop => (
                                    <div key={shop.id} className="p-2 rounded" style={{ border: `1px solid ${shop.is_active ? 'var(--color-cyber-green)' : 'var(--color-cyber-magenta)'}`, background: 'rgba(0,0,0,0.3)' }}>
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm">🏪</span>
                                          <span className="text-sm font-bold" style={{ color: shop.is_active ? 'var(--color-cyber-green)' : 'var(--color-cyber-magenta)' }}>
                                            {shop.name}
                                          </span>
                                          {!shop.is_active && (
                                            <span className="text-xs px-1 rounded" style={{ background: 'var(--color-cyber-magenta)', color: '#0D1117' }}>CLOSED</span>
                                          )}
                                        </div>
                                        <div className="flex gap-1">
                                          <button
                                            onClick={() => handleToggleShopActive(shop)}
                                            className="px-2 py-1 rounded text-xs"
                                            style={{ background: 'transparent', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                                          >
                                            {shop.is_active ? '🔒' : '🔓'}
                                          </button>
                                          <button
                                            onClick={() => {
                                              if (selectedShop?.id === shop.id) {
                                                setSelectedShop(null);
                                                setShopInventory([]);
                                              } else {
                                                setSelectedShop(shop);
                                                fetchShopInventory(shop.id);
                                                fetchAllItems();
                                              }
                                            }}
                                            className="px-2 py-1 rounded text-xs font-bold"
                                            style={{ 
                                              background: selectedShop?.id === shop.id ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-cyan)', 
                                              color: '#0D1117' 
                                            }}
                                          >
                                            {selectedShop?.id === shop.id ? '✕ Close' : '📦 Inventory'}
                                          </button>
                                          <button
                                            onClick={() => handleDeleteShop(shop.id, shop.name)}
                                            className="px-2 py-1 rounded text-xs"
                                            style={{ background: 'transparent', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)' }}
                                          >
                                            🗑️
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Inline Inventory Editor - Below Shops */}
                              {selectedShop && (
                                <div className="mt-3 p-3 rounded" style={{ background: 'var(--color-cyber-darker)', border: '2px solid var(--color-cyber-yellow)' }}>
                                  <div className="flex items-center justify-between mb-2">
                                    <h5 className="text-sm font-bold" style={{ color: 'var(--color-cyber-yellow)' }}>
                                      📦 {selectedShop.name} Inventory ({shopInventory.length})
                                    </h5>
                                    <button
                                      onClick={() => { setSelectedShop(null); setShopInventory([]); setAddItemSearch(''); }}
                                      className="text-xs px-2 py-1 rounded"
                                      style={{ background: 'var(--color-cyber-magenta)', color: '#0D1117' }}
                                    >
                                      ✕
                                    </button>
                                  </div>

                                  {/* Add Item Section */}
                                  <div className="mb-3 p-2 rounded" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--color-cyber-cyan)' }}>
                                    <input
                                      type="text"
                                      value={addItemSearch}
                                      onChange={e => setAddItemSearch(e.target.value)}
                                      placeholder="Search items to add..."
                                      className="w-full px-2 py-1 rounded text-sm mb-2"
                                      style={{ background: 'var(--color-cyber-dark)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                                    />
                                    
                                    {/* Price Type Toggle */}
                                    <div className="flex items-center gap-2 mb-2">
                                      <button
                                        onClick={() => setAddItemPriceType('credits')}
                                        className="px-2 py-1 rounded text-xs"
                                        style={{ 
                                          background: addItemPriceType === 'credits' ? 'var(--color-cyber-yellow)' : 'transparent',
                                          color: addItemPriceType === 'credits' ? '#0D1117' : 'var(--color-cyber-yellow)',
                                          border: '1px solid var(--color-cyber-yellow)'
                                        }}
                                      >
                                        💰 Credits
                                      </button>
                                      <button
                                        onClick={() => setAddItemPriceType('item')}
                                        className="px-2 py-1 rounded text-xs"
                                        style={{ 
                                          background: addItemPriceType === 'item' ? 'var(--color-cyber-magenta)' : 'transparent',
                                          color: addItemPriceType === 'item' ? '#0D1117' : 'var(--color-cyber-magenta)',
                                          border: '1px solid var(--color-cyber-magenta)'
                                        }}
                                      >
                                        🔄 Trade
                                      </button>
                                      
                                      {addItemPriceType === 'credits' ? (
                                        <input
                                          type="number"
                                          value={addItemPrice}
                                          onChange={e => setAddItemPrice(parseInt(e.target.value) || 0)}
                                          placeholder="Price"
                                          className="w-20 px-2 py-1 rounded text-xs"
                                          style={{ background: 'var(--color-cyber-dark)', border: '1px solid var(--color-cyber-yellow)', color: 'var(--color-cyber-yellow)' }}
                                        />
                                      ) : (
                                        <>
                                          {addItemBarterItemId ? (
                                            <div 
                                              className="flex-1 flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer"
                                              style={{ background: 'var(--color-cyber-magenta)', color: '#0D1117' }}
                                              onClick={() => { setAddItemBarterItemId(null); setBarterItemSearch(''); }}
                                            >
                                              <span>🔄 {barterItemSearch}</span>
                                              <span className="ml-auto">✕</span>
                                            </div>
                                          ) : (
                                            <input
                                              type="text"
                                              value={barterItemSearch}
                                              onChange={e => setBarterItemSearch(e.target.value)}
                                              placeholder="Search trade item..."
                                              className="flex-1 px-2 py-1 rounded text-xs"
                                              style={{ background: 'var(--color-cyber-dark)', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)' }}
                                            />
                                          )}
                                          <span className="text-xs" style={{ color: 'var(--color-cyber-magenta)' }}>x</span>
                                          <input
                                            type="number"
                                            value={addItemBarterQty}
                                            onChange={e => setAddItemBarterQty(parseInt(e.target.value) || 1)}
                                            min={1}
                                            className="w-10 px-1 py-1 rounded text-xs text-center"
                                            style={{ background: 'var(--color-cyber-dark)', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)' }}
                                          />
                                        </>
                                      )}
                                      
                                      <span className="text-xs" style={{ color: 'var(--color-cyber-green)' }}>Stock:</span>
                                      <input
                                        type="number"
                                        value={addItemStock}
                                        onChange={e => {
                                          const val = e.target.value;
                                          setAddItemStock(val === '' ? 0 : parseInt(val) || 0);
                                        }}
                                        className="w-20 px-1 py-1 rounded text-xs"
                                        style={{ background: 'var(--color-cyber-dark)', border: '1px solid var(--color-cyber-green)', color: 'var(--color-cyber-green)' }}
                                      />
                                    </div>

                                    {/* Barter Item Selection Dropdown */}
                                    {addItemPriceType === 'item' && barterItemSearch && !addItemBarterItemId && (
                                      <div className="max-h-24 overflow-y-auto space-y-1 mb-2 p-1 rounded" style={{ background: 'var(--color-cyber-dark)', border: '1px solid var(--color-cyber-magenta)' }}>
                                        {filteredBarterItems.length === 0 ? (
                                          <p className="text-xs text-center py-1" style={{ color: 'var(--color-cyber-magenta)', opacity: 0.5 }}>No items found</p>
                                        ) : (
                                          filteredBarterItems.slice(0, 6).map(item => (
                                            <div
                                              key={item.id}
                                              onClick={() => { setAddItemBarterItemId(item.id); setBarterItemSearch(item.name); }}
                                              className="p-1.5 rounded cursor-pointer text-xs hover:bg-magenta-500/30"
                                              style={{ border: '1px solid transparent' }}
                                            >
                                              <span style={{ color: getRarityColor(item.rarity) }}>{item.name}</span>
                                              <span className="ml-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>{toTitleCase(item.type)}</span>
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    )}

                                    {/* Selected Item Display */}
                                    {selectedItemToAdd && (
                                      <div className="mb-2 p-2 rounded flex items-center justify-between" style={{ background: 'var(--color-cyber-green)', color: '#0D1117' }}>
                                        <div className="flex items-center gap-2">
                                          <span className="font-bold">{selectedItemToAdd.name}</span>
                                          <span className="text-xs opacity-75">({toTitleCase(selectedItemToAdd.type)})</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <button
                                            onClick={() => {
                                              if (addItemPriceType === 'item' && !addItemBarterItemId) {
                                                alert('Select a trade item first');
                                                return;
                                              }
                                              handleAddItemToShop(selectedItemToAdd.id);
                                            }}
                                            className="px-3 py-1 rounded text-xs font-bold"
                                            style={{ background: '#0D1117', color: 'var(--color-cyber-green)' }}
                                          >
                                            ✓ ADD TO SHOP
                                          </button>
                                          <button
                                            onClick={() => setSelectedItemToAdd(null)}
                                            className="px-2 py-1 text-xs"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      </div>
                                    )}

                                    {/* Search Results */}
                                    {addItemSearch && !selectedItemToAdd && (
                                      <div className="max-h-24 overflow-y-auto space-y-1">
                                        {filteredItemsForShop.length === 0 ? (
                                          <p className="text-xs text-center py-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>No items found</p>
                                        ) : (
                                          filteredItemsForShop.slice(0, 8).map(item => (
                                            <div
                                              key={item.id}
                                              onClick={() => setSelectedItemToAdd(item)}
                                              className="flex items-center justify-between p-1 rounded cursor-pointer hover:bg-cyan-500/20 text-xs"
                                              style={{ border: '1px solid var(--color-cyber-cyan)' }}
                                            >
                                              <span style={{ color: getRarityColor(item.rarity) }}>{item.name}</span>
                                              <span style={{ color: 'var(--color-cyber-cyan)' }}>Select</span>
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {/* Current Inventory */}
                                  <div className="max-h-32 overflow-y-auto space-y-1">
                                    {shopInventory.length === 0 ? (
                                      <p className="text-center text-xs py-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>Empty - search above to add items</p>
                                    ) : (
                                      shopInventory.map(invItem => (
                                        <div key={invItem.id} className="flex items-center justify-between p-1 rounded text-xs" style={{ background: 'var(--color-cyber-dark)', border: '1px solid var(--color-cyber-cyan)' }}>
                                          <div className="flex items-center gap-2">
                                            <span style={{ color: getRarityColor(invItem.item.rarity) }}>{invItem.item.name}</span>
                                            {invItem.price_credits ? (
                                              <span className="px-1 rounded" style={{ background: 'var(--color-cyber-yellow)', color: '#0D1117' }}>${invItem.price_credits}</span>
                                            ) : invItem.price_item ? (
                                              <span className="px-1 rounded" style={{ background: 'var(--color-cyber-magenta)', color: '#0D1117' }}>{invItem.price_item_quantity}x {invItem.price_item.name}</span>
                                            ) : null}
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <input
                                              type="number"
                                              value={invItem.stock_quantity}
                                              onChange={e => handleUpdateShopItemStock(invItem.id, parseInt(e.target.value) || 0)}
                                              className="w-16 px-1 py-0.5 rounded text-center text-xs"
                                              style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-green)', color: 'var(--color-cyber-green)' }}
                                            />
                                            <button
                                              onClick={() => handleRemoveItemFromShop(invItem.id)}
                                              className="px-1 text-xs"
                                              style={{ color: 'var(--color-cyber-magenta)' }}
                                            >
                                              ✕
                                            </button>
                                          </div>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'npcs' && (
            <div className="flex gap-4 h-[calc(100vh-180px)]">
              {/* Left Side - NPC List (Always Visible) */}
              <div className="w-1/2 flex flex-col" style={{ minWidth: '400px' }}>
                {/* Header with Create Button */}
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-lg" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-magenta)' }}>👾 NPCs & ENEMIES</h3>
                  <span className="text-xs px-2 py-1 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-magenta) 20%, transparent)', color: 'var(--color-cyber-magenta)' }}>
                    {filteredNpcsList.length} NPCs
                  </span>
                  <button
                    onClick={() => { resetNpcForm(); setSelectedEditNPC(null); setNpcsSubTab('create'); }}
                    className="ml-auto px-4 py-2 rounded text-sm"
                    style={{ background: 'var(--color-cyber-yellow)', color: '#0D1117', fontFamily: 'var(--font-cyber)' }}
                  >
                    ➕ CREATE NEW
                  </button>
                </div>

                {/* Search and Filters */}
                <div className="space-y-2 mb-3">
                  <input
                    type="text"
                    placeholder="🔍 Search NPCs..."
                    value={npcSearchQuery}
                    onChange={e => setNpcSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 rounded text-sm"
                    style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}
                  />
                  <div className="flex gap-2">
                    <select
                      value={npcFilterType}
                      onChange={e => setNpcFilterType(e.target.value)}
                      className="flex-1 px-2 py-1.5 rounded text-sm"
                      style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-cyan)' }}
                    >
                      <option value="all">All Types</option>
                      <option value="Enemy">Enemy</option>
                      <option value="Boss">Boss</option>
                      <option value="Mini-Boss">Mini-Boss</option>
                      <option value="Friendly NPC">Friendly NPC</option>
                      <option value="Neutral NPC">Neutral NPC</option>
                      <option value="Vendor">Vendor</option>
                      <option value="Quest Giver">Quest Giver</option>
                      <option value="Civilian">Civilian</option>
                    </select>
                    <select
                      value={npcFilterAlive}
                      onChange={e => setNpcFilterAlive(e.target.value)}
                      className="flex-1 px-2 py-1.5 rounded text-sm"
                      style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-cyan)' }}
                    >
                      <option value="all">All Status</option>
                      <option value="alive">Alive</option>
                      <option value="dead">Dead</option>
                    </select>
                  </div>
                </div>

                {/* NPC Grid List */}
                <div className="flex-1 overflow-y-auto pr-2">
                  {npcsLoading ? (
                    <div className="text-center py-8" style={{ color: 'var(--color-cyber-cyan)' }}>Loading...</div>
                  ) : filteredNpcsList.length === 0 ? (
                    <div className="text-center py-8" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>No NPCs found</div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {filteredNpcsList.map(npc => (
                        <div
                          key={npc.id}
                          className="p-3 rounded cursor-pointer transition-all hover:brightness-110"
                          style={{ 
                            border: `1px solid ${selectedEditNPC?.id === npc.id ? 'var(--color-cyber-yellow)' : getNpcTypeColor(npc.type)}`,
                            background: selectedEditNPC?.id === npc.id ? 'color-mix(in srgb, var(--color-cyber-yellow) 15%, transparent)' : 'color-mix(in srgb, var(--color-cyber-darker) 90%, transparent)',
                            opacity: npc.is_alive ? 1 : 0.5
                          }}
                          onClick={() => loadNpcForEdit(npc)}
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-lg">{npc.type === 'Boss' ? '💀' : npc.type === 'Enemy' || npc.type === 'Mini-Boss' ? '👹' : npc.type === 'Vendor' ? '🛒' : npc.type === 'Quest Giver' ? '❓' : '👤'}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold truncate" style={{ color: getNpcTypeColor(npc.type) }}>
                                {npc.name}
                                {!npc.is_alive && <span className="ml-1 text-xs">💀</span>}
                              </div>
                              <div className="flex items-center gap-1 mt-1 flex-wrap">
                                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `color-mix(in srgb, ${getNpcTypeColor(npc.type)} 20%, transparent)`, color: getNpcTypeColor(npc.type), fontSize: '9px' }}>{npc.type}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>
                                <span>❤️ {npc.current_hp}/{npc.max_hp}</span>
                                <span>🛡️ {npc.ac}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Side - Edit Form */}
              <div className="w-1/2 glass-panel p-5 overflow-y-auto" style={{ border: '1px solid var(--color-cyber-magenta)', minWidth: '400px' }}>
                {!selectedEditNPC && npcsSubTab !== 'create' ? (
                  <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>
                    <p className="text-xl mb-2" style={{ fontFamily: 'var(--font-cyber)' }}>SELECT AN NPC</p>
                    <p className="text-sm" style={{ fontFamily: 'var(--font-mono)' }}>Click an NPC to edit, or use CREATE NEW</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-yellow)' }}>
                        {selectedEditNPC ? '✏️ EDIT NPC' : '➕ CREATE NPC'}
                      </h3>
                      {selectedEditNPC && (
                        <button
                          onClick={() => handleDeleteNpc(selectedEditNPC.id, selectedEditNPC.name)}
                          className="px-3 py-1 rounded text-sm"
                          style={{ background: 'transparent', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)' }}
                        >
                          🗑️ DELETE
                        </button>
                      )}
                    </div>

                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="block text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)' }}>Name *</label>
                        <input
                          type="text"
                          value={npcName}
                          onChange={e => setNpcName(e.target.value)}
                          placeholder="e.g., Cyber Thug"
                          className="w-full px-3 py-2 rounded"
                          style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)' }}>Type</label>
                        <select
                          value={npcType}
                          onChange={e => setNpcType(e.target.value as NPCType)}
                          className="w-full px-3 py-2 rounded"
                          style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                        >
                          <option value="Enemy">Enemy</option>
                          <option value="Boss">Boss</option>
                          <option value="Mini-Boss">Mini-Boss</option>
                          <option value="Friendly NPC">Friendly NPC</option>
                          <option value="Neutral NPC">Neutral NPC</option>
                          <option value="Vendor">Vendor</option>
                          <option value="Quest Giver">Quest Giver</option>
                          <option value="Civilian">Civilian</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)' }}>Disposition</label>
                        <select
                          value={npcDisposition}
                          onChange={e => setNpcDisposition(e.target.value as NPCDisposition)}
                          className="w-full px-3 py-2 rounded"
                          style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                        >
                          <option value="Hostile">Hostile</option>
                          <option value="Unfriendly">Unfriendly</option>
                          <option value="Neutral">Neutral</option>
                          <option value="Friendly">Friendly</option>
                          <option value="Allied">Allied</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)' }}>Three Words (Quick Reference)</label>
                        <input
                          type="text"
                          value={npcThreeWords}
                          onChange={e => setNpcThreeWords(e.target.value)}
                          placeholder="e.g., Gruff, Loyal, Paranoid"
                          className="w-full px-3 py-2 rounded"
                          style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                        />
                      </div>
                    </div>

                    {/* Combat Stats */}
                    <div>
                      <h4 className="text-sm mb-2" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-magenta)' }}>COMBAT STATS</h4>
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <label className="block text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)' }}>Max HP</label>
                          <input type="number" value={npcMaxHp} onChange={e => setNpcMaxHp(parseInt(e.target.value) || 0)} className="w-full px-2 py-1 rounded text-center" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)' }} />
                        </div>
                        <div>
                          <label className="block text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)' }}>Current HP</label>
                          <input type="number" value={npcCurrentHp} onChange={e => setNpcCurrentHp(parseInt(e.target.value) || 0)} className="w-full px-2 py-1 rounded text-center" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)' }} />
                        </div>
                        <div>
                          <label className="block text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)' }}>AC</label>
                          <input type="number" value={npcAc} onChange={e => setNpcAc(parseInt(e.target.value) || 0)} className="w-full px-2 py-1 rounded text-center" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }} />
                        </div>
                        <div>
                          <label className="block text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)' }}>Init Mod</label>
                          <input type="number" value={npcInitMod} onChange={e => setNpcInitMod(parseInt(e.target.value) || 0)} className="w-full px-2 py-1 rounded text-center" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }} />
                        </div>
                      </div>
                    </div>

                    {/* Core Stats */}
                    <div>
                      <h4 className="text-sm mb-2" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-purple)' }}>CORE STATS</h4>
                      <div className="grid grid-cols-6 gap-2">
                        {[
                          { label: 'STR', value: npcStr, setter: setNpcStr },
                          { label: 'DEX', value: npcDex, setter: setNpcDex },
                          { label: 'CON', value: npcCon, setter: setNpcCon },
                          { label: 'WIS', value: npcWis, setter: setNpcWis },
                          { label: 'INT', value: npcInt, setter: setNpcInt },
                          { label: 'CHA', value: npcCha, setter: setNpcCha },
                        ].map(stat => (
                          <div key={stat.label} className="text-center">
                            <label className="block text-xs mb-1" style={{ color: 'var(--color-cyber-purple)' }}>{stat.label}</label>
                            <input type="number" value={stat.value} onChange={e => stat.setter(parseInt(e.target.value) || 0)} className="w-full px-1 py-1 rounded text-center text-sm" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-purple)', color: 'var(--color-cyber-purple)' }} />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* NPC Abilities */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-green)' }}>⚡ ABILITIES</h4>
                        <button onClick={handleAddNpcAbility} className="text-xs px-2 py-1 rounded" style={{ border: '1px solid var(--color-cyber-green)', color: 'var(--color-cyber-green)' }}>+ Add</button>
                      </div>
                      {npcAbilities.length === 0 ? (
                        <div className="text-center py-2 rounded text-xs" style={{ border: '1px dashed var(--color-cyber-green)', color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>No abilities</div>
                      ) : (
                        <div className="space-y-2 max-h-[120px] overflow-y-auto">
                          {npcAbilities.map((ability, idx) => (
                            <div key={idx} className="grid grid-cols-12 gap-1 items-center">
                              <input type="text" value={ability.name} onChange={e => handleUpdateNpcAbility(idx, 'name', e.target.value)} placeholder="Name" className="col-span-4 px-2 py-1 rounded text-xs" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-green)', color: 'var(--color-cyber-green)' }} />
                              <input type="text" value={ability.damage || ''} onChange={e => handleUpdateNpcAbility(idx, 'damage', e.target.value)} placeholder="Dmg" className="col-span-2 px-2 py-1 rounded text-xs" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-green)', color: 'var(--color-cyber-green)' }} />
                              <input type="text" value={ability.effect} onChange={e => handleUpdateNpcAbility(idx, 'effect', e.target.value)} placeholder="Effect" className="col-span-5 px-2 py-1 rounded text-xs" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-green)', color: 'var(--color-cyber-green)' }} />
                              <button onClick={() => handleRemoveNpcAbility(idx)} className="col-span-1 text-xs" style={{ color: 'var(--color-cyber-magenta)' }}>✕</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* DM Notes */}
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)' }}>DM Notes</label>
                      <textarea
                        value={npcDmNotes}
                        onChange={e => setNpcDmNotes(e.target.value)}
                        placeholder="Private notes..."
                        rows={2}
                        className="w-full px-3 py-2 rounded text-sm"
                        style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                      />
                    </div>

                    {/* Alive Status */}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={npcIsAlive} onChange={e => setNpcIsAlive(e.target.checked)} className="w-4 h-4" />
                      <span className="text-sm" style={{ color: npcIsAlive ? 'var(--color-cyber-green)' : 'var(--color-cyber-magenta)' }}>
                        {npcIsAlive ? '✓ Alive' : '💀 Dead'}
                      </span>
                    </label>

                    {/* Save/Cancel Buttons */}
                    <div className="flex gap-4">
                      <button
                        onClick={() => { resetNpcForm(); setNpcsSubTab('list'); }}
                        className="flex-1 px-4 py-2 rounded"
                        style={{ background: 'transparent', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-cyber)' }}
                      >
                        CANCEL
                      </button>
                      <button
                        onClick={handleSaveNpc}
                        disabled={npcSaving || !npcName.trim()}
                        className="flex-1 px-4 py-2 rounded"
                        style={{
                          background: npcName.trim() ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-green)',
                          color: '#0D1117',
                          fontFamily: 'var(--font-cyber)',
                          opacity: npcName.trim() ? 1 : 0.5
                        }}
                      >
                        {npcSaving ? 'SAVING...' : selectedEditNPC ? 'UPDATE NPC' : 'CREATE NPC'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'encounters' && (
            <div className="flex flex-col h-[calc(100vh-180px)]">
              {/* Top Bar: Encounter Selector + Status + Actions */}
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <h3 className="text-lg" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-magenta)' }}>⚔️ ENCOUNTERS</h3>
                
                <select
                  value={activeEncounter?.id || ''}
                  onChange={(e) => {
                    const enc = allEncounters.find(en => en.id === e.target.value);
                    if (enc) {
                      loadEncounterForCombat(enc);
                      setSelectedCombatParticipantId(null);
                    } else {
                      setActiveEncounter(null);
                      setCombatParticipants([]);
                      setSelectedCombatParticipantId(null);
                    }
                  }}
                  className="px-3 py-2 rounded text-sm min-w-[220px]"
                  style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}
                >
                  <option value="">-- Select Encounter --</option>
                  {allEncounters.map(enc => (
                    <option key={enc.id} value={enc.id}>
                      {enc.name} [{enc.status.toUpperCase()}]
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => setShowCreateEncounterModal(true)}
                  className="px-3 py-1.5 rounded text-sm"
                  style={{ background: 'var(--color-cyber-yellow)', color: '#0D1117', fontFamily: 'var(--font-cyber)' }}
                >
                  ➕ NEW
                </button>

                {activeEncounter && (
                  <button
                    onClick={() => handleDeleteEncounter(activeEncounter.id, activeEncounter.name)}
                    className="px-2 py-1.5 rounded text-sm"
                    style={{ border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)' }}
                  >
                    🗑️
                  </button>
                )}

                <div className="flex-1" />

                {/* Status & Round Info */}
                {activeEncounter && (
                  <>
                    <span className="text-sm font-bold px-2 py-1 rounded" style={{ 
                      background: getStatusColor(activeEncounter.status), 
                      color: '#0D1117',
                      fontFamily: 'var(--font-mono)' 
                    }}>
                      {activeEncounter.status.toUpperCase()}
                    </span>

                    {activeEncounter.status === 'active' && (
                      <div className="flex items-center gap-3">
                        <span className="text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                          ROUND <span style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-cyber)', fontSize: '1.1rem' }}>{encounterRound}</span>
                        </span>
                        <span className="text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                          TURN <span style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-cyber)', fontSize: '1.1rem' }}>{encounterCurrentTurn + 1}/{combatParticipants.filter(p => p.isActive).length}</span>
                        </span>
                      </div>
                    )}
                  </>
                )}

                {/* Action Buttons */}
                {activeEncounter?.status === 'draft' && (
                  <div className="flex gap-2">
                    <button onClick={() => setShowAddParticipantModal(true)} className="px-3 py-1.5 rounded text-xs" style={{ border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}>
                      ➕ ADD COMBATANT
                    </button>
                    <button onClick={sortParticipantsByInitiative} className="px-3 py-1.5 rounded text-xs" style={{ border: '1px solid var(--color-cyber-purple)', color: 'var(--color-cyber-purple)' }}>
                      ⬇️ SORT INIT
                    </button>
                    <button onClick={startEncounter} className="px-3 py-1.5 rounded text-xs" style={{ background: 'var(--color-cyber-green)', color: '#0D1117' }}>
                      ▶️ START
                    </button>
                  </div>
                )}
                {activeEncounter?.status === 'active' && (
                  <div className="flex gap-2">
                    <button onClick={() => setShowAddParticipantModal(true)} className="px-2 py-1.5 rounded text-xs" style={{ border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}>
                      ➕ ADD
                    </button>
                    <button onClick={prevTurn} className="px-3 py-1.5 rounded text-xs" style={{ border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}>◀</button>
                    <button onClick={nextTurn} className="px-3 py-1.5 rounded text-xs" style={{ background: 'var(--color-cyber-yellow)', color: '#0D1117' }}>⏩ NEXT TURN</button>
                    <button onClick={endEncounter} className="px-3 py-1.5 rounded text-xs" style={{ background: 'var(--color-cyber-magenta)', color: '#fff' }}>⏹️ END</button>
                  </div>
                )}
              </div>

              {/* Main Content: Initiative Sidebar (1/3) + Details Panel (2/3) */}
              {activeEncounter ? (
                <div className="flex gap-4 flex-1 overflow-hidden">
                  {/* LEFT: Initiative Order (1/3 width) */}
                  <div className="w-1/3 glass-panel p-4 overflow-y-auto flex flex-col" style={{ border: '1px solid var(--color-cyber-magenta)', minWidth: '280px' }}>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
                        INITIATIVE ORDER
                      </h4>
                      <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                        {combatParticipants.length} combatants
                      </span>
                    </div>

                    {participantsLoading ? (
                      <div className="text-center py-4" style={{ color: 'var(--color-cyber-cyan)' }}>Loading...</div>
                    ) : combatParticipants.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>No combatants yet</p>
                        <button onClick={() => setShowAddParticipantModal(true)} className="px-3 py-1.5 rounded text-xs mt-2" style={{ border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}>
                          ➕ Add Combatants
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1 flex-1">
                        {combatParticipants.map((p) => {
                          const activeParticipants = combatParticipants.filter(pp => pp.isActive);
                          const isCurrentTurn = activeEncounter.status === 'active' && activeParticipants[encounterCurrentTurn]?.id === p.id;
                          const isSelected = p.id === selectedCombatParticipantId;
                          const hpPct = p.maxHp > 0 ? (p.currentHp / p.maxHp) * 100 : 0;
                          const isDead = p.currentHp <= 0;

                          return (
                            <div
                              key={p.id}
                              onClick={() => selectCombatParticipant(p)}
                              className="rounded cursor-pointer transition-all relative overflow-hidden"
                              style={{
                                background: isCurrentTurn 
                                  ? 'color-mix(in srgb, var(--color-cyber-yellow) 15%, transparent)' 
                                  : isSelected 
                                    ? 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)' 
                                    : 'color-mix(in srgb, var(--color-cyber-darker) 90%, transparent)',
                                border: `1px solid ${
                                  isCurrentTurn ? 'var(--color-cyber-yellow)' :
                                  isSelected ? 'var(--color-cyber-cyan)' :
                                  'color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)'
                                }`,
                                opacity: isDead ? 0.4 : p.isActive ? 1 : 0.5,
                              }}
                            >
                              {/* Current turn left bar */}
                              {isCurrentTurn && (
                                <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: 'var(--color-cyber-yellow)' }} />
                              )}

                              <div className="p-2 pl-3">
                                <div className="flex items-center gap-2">
                                  {/* Initiative circle */}
                                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" 
                                    style={{ 
                                      background: isCurrentTurn ? 'var(--color-cyber-yellow)' : 'color-mix(in srgb, var(--color-cyber-purple) 30%, transparent)',
                                      color: isCurrentTurn ? '#0D1117' : 'var(--color-cyber-purple)',
                                      fontFamily: 'var(--font-mono)',
                                      border: `1px solid ${isCurrentTurn ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-purple)'}`
                                    }}>
                                    {p.initiative ?? '?'}
                                  </div>
                                  
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1">
                                      <span className="text-sm">{p.type === 'player' ? '👤' : '👹'}</span>
                                      <span className="font-bold text-sm truncate" style={{ 
                                        color: p.type === 'player' ? 'var(--color-cyber-cyan)' : 'var(--color-cyber-magenta)',
                                        fontFamily: 'var(--font-mono)' 
                                      }}>
                                        {p.name}
                                      </span>
                                      {isDead && <span className="text-xs">💀</span>}
                                      {isCurrentTurn && <span className="text-xs ml-auto animate-pulse" style={{ color: 'var(--color-cyber-yellow)' }}>◄ TURN</span>}
                                    </div>
                                    
                                    {/* HP bar */}
                                    <div className="flex items-center gap-2 mt-1">
                                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)' }}>
                                        <div 
                                          className="h-full rounded-full transition-all"
                                          style={{ 
                                            width: `${Math.max(0, Math.min(100, hpPct))}%`, 
                                            background: getHpBarColor(p.currentHp, p.maxHp) 
                                          }}
                                        />
                                      </div>
                                      <span className="text-xs flex-shrink-0" style={{ color: getHpBarColor(p.currentHp, p.maxHp), fontFamily: 'var(--font-mono)' }}>
                                        {p.currentHp}/{p.maxHp}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Type & AC */}
                                <div className="flex items-center gap-2 mt-1 pl-10">
                                  <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                                    {p.type.toUpperCase()}
                                    {p.entityData && 'class' in p.entityData ? ` • ${(p.entityData as any).class}` : ''}
                                    {p.entityData && 'type' in p.entityData && !('class' in p.entityData) ? ` • ${(p.entityData as any).type}` : ''}
                                  </span>
                                  <span className="text-xs ml-auto" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                                    🛡️ {p.ac}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* RIGHT: Participant Details (2/3 width) */}
                  <div className="w-2/3 glass-panel p-5 overflow-y-auto" style={{ border: '1px solid var(--color-cyber-magenta)' }}>
                    {(() => {
                      const selectedP = combatParticipants.find(p => p.id === selectedCombatParticipantId);
                      if (!selectedP) {
                        return (
                          <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>
                            <div className="text-5xl mb-4 opacity-30">⚔️</div>
                            <p className="text-lg" style={{ fontFamily: 'var(--font-cyber)' }}>SELECT A COMBATANT</p>
                            <p className="text-sm mt-1" style={{ fontFamily: 'var(--font-mono)' }}>Click on a participant from the initiative order</p>
                          </div>
                        );
                      }

                      const entityData = selectedP.entityData;
                      const isPlayer = selectedP.type === 'player';

                      return (
                        <div className="space-y-5">
                          {/* Name & Header */}
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="text-2xl" style={{ fontFamily: 'var(--font-cyber)', color: isPlayer ? 'var(--color-cyber-cyan)' : 'var(--color-cyber-magenta)' }}>
                                {isPlayer ? '👤' : '👹'} {selectedP.name}
                              </h3>
                              <div className="text-sm mt-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                                {selectedP.type.toUpperCase()}
                                {entityData && 'class' in entityData && ` • ${(entityData as any).class} • Level ${(entityData as any).level}`}
                                {entityData && 'type' in entityData && !('class' in entityData) && ` • ${(entityData as any).type}`}
                                {entityData && 'disposition' in entityData && ` • ${(entityData as any).disposition}`}
                              </div>
                            </div>
                            
                            <button
                              onClick={() => removeParticipantFromEncounter(selectedP.id)}
                              className="px-3 py-1 rounded text-xs"
                              style={{ border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)' }}
                            >
                              REMOVE
                            </button>
                          </div>

                          {/* Combat Stats Row */}
                          <div className="grid grid-cols-4 gap-3">
                            {/* HP */}
                            <div className="col-span-2 p-4 rounded" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-magenta)' }}>
                              <div className="text-xs mb-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>HIT POINTS</div>
                              <div className="flex items-center gap-3 mb-2">
                                <span className="text-3xl font-bold" style={{ color: getHpBarColor(selectedP.currentHp, selectedP.maxHp), fontFamily: 'var(--font-cyber)' }}>
                                  {selectedP.currentHp}
                                </span>
                                <span className="text-lg" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>/</span>
                                <span className="text-lg" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                                  {selectedP.maxHp}
                                </span>
                              </div>
                              
                              {/* HP bar */}
                              <div className="h-3 rounded-full overflow-hidden mb-3" style={{ background: 'color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)' }}>
                                <div className="h-full rounded-full transition-all" style={{ 
                                  width: `${Math.max(0, Math.min(100, (selectedP.currentHp / selectedP.maxHp) * 100))}%`, 
                                  background: getHpBarColor(selectedP.currentHp, selectedP.maxHp) 
                                }} />
                              </div>

                              {/* HP Controls */}
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => {
                                    const val = parseInt(hpChangeInput[selectedP.id] || '0');
                                    if (val > 0) applyHpChange(selectedP, -val);
                                  }}
                                  className="px-3 py-1 rounded text-xs"
                                  style={{ background: 'var(--color-cyber-magenta)', color: '#fff' }}
                                >− DMG</button>
                                <input
                                  type="number"
                                  value={hpChangeInput[selectedP.id] || ''}
                                  onChange={e => setHpChangeInput(prev => ({ ...prev, [selectedP.id]: e.target.value }))}
                                  placeholder="±"
                                  className="w-16 px-1 py-1 rounded text-center text-sm"
                                  style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}
                                  min="0"
                                />
                                <button 
                                  onClick={() => {
                                    const val = parseInt(hpChangeInput[selectedP.id] || '0');
                                    if (val > 0) applyHpChange(selectedP, val);
                                  }}
                                  className="px-3 py-1 rounded text-xs"
                                  style={{ background: 'var(--color-cyber-green)', color: '#0D1117' }}
                                >+ HEAL</button>
                                <button
                                  onClick={() => {
                                    updateParticipantHp(selectedP.id, selectedP.maxHp, selectedP.entityId, selectedP.type);
                                  }}
                                  className="px-2 py-1 rounded text-xs ml-auto"
                                  style={{ border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                                  title="Full Heal"
                                >MAX</button>
                              </div>
                            </div>

                            {/* AC */}
                            <div className="p-4 rounded text-center" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)' }}>
                              <div className="text-xs mb-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>ARMOR CLASS</div>
                              <div className="text-4xl font-bold" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>
                                {selectedP.ac}
                              </div>
                            </div>

                            {/* Initiative */}
                            <div className="p-4 rounded text-center" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-purple)' }}>
                              <div className="text-xs mb-2" style={{ color: 'var(--color-cyber-purple)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>INITIATIVE</div>
                              <input
                                type="number"
                                value={selectedP.initiative ?? ''}
                                onChange={e => updateParticipantInitiative(selectedP.id, parseInt(e.target.value) || 0)}
                                className="w-16 text-center text-3xl font-bold rounded mx-auto block"
                                style={{ background: 'transparent', color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-cyber)', border: 'none' }}
                                placeholder="?"
                              />
                            </div>
                          </div>

                          {/* Attribute Stats */}
                          {entityData && (
                            <div className="p-4 rounded" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-purple)' }}>
                              <div className="text-xs mb-3" style={{ color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-mono)' }}>ATTRIBUTES</div>
                              <div className="grid grid-cols-6 gap-3">
                                {(['str', 'dex', 'con', 'wis', 'int', 'cha'] as const).map(stat => {
                                  const value = (entityData as any)?.[stat] || 0;
                                  return (
                                    <div key={stat} className="text-center p-2 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-purple) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-purple) 30%, transparent)' }}>
                                      <div className="text-xs font-bold uppercase" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>{stat}</div>
                                      <div className="text-2xl font-bold" style={{ color: value >= 0 ? 'var(--color-cyber-cyan)' : 'var(--color-cyber-magenta)', fontFamily: 'var(--font-cyber)' }}>
                                        {value >= 0 ? '+' : ''}{value}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Player Abilities (includes class features + granted) */}
                          {isPlayer && combatPlayerAbilities.length > 0 && (
                            <div className="p-4 rounded" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-green)' }}>
                              <div className="text-xs mb-3" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>
                                ⚡ ABILITIES ({combatPlayerAbilities.length})
                              </div>
                              <div className="space-y-2">
                                {combatPlayerAbilities.map((ca: any) => (
                                  <div key={ca.id} className="p-3 rounded" style={{ 
                                    background: 'color-mix(in srgb, var(--color-cyber-green) 5%, transparent)',
                                    border: '1px solid color-mix(in srgb, var(--color-cyber-green) 25%, transparent)'
                                  }}>
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="font-bold text-sm" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>
                                            {ca.ability?.name}
                                          </span>
                                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--color-cyber-purple)', color: 'white' }}>
                                            {ca.ability?.type?.replace('_', ' ')}
                                          </span>
                                          {ca.ability?.source && (
                                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ 
                                              background: 'color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)',
                                              color: 'var(--color-cyber-cyan)' 
                                            }}>
                                              {ca.ability.source}{ca.ability.class_name ? `: ${ca.ability.class_name}` : ''}
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                                          {ca.ability?.description}
                                        </div>
                                        {/* Combat details */}
                                        <div className="flex flex-wrap gap-2 mt-1">
                                          {ca.ability?.damage_dice && (
                                            <span className="text-xs" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>
                                              🎯 {ca.ability.damage_dice} {ca.ability.damage_type || ''}
                                            </span>
                                          )}
                                          {ca.ability?.range_feet && (
                                            <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6, fontFamily: 'var(--font-mono)' }}>
                                              📏 {ca.ability.range_feet}ft
                                            </span>
                                          )}
                                          {ca.ability?.area_of_effect && (
                                            <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6, fontFamily: 'var(--font-mono)' }}>
                                              💥 {ca.ability.area_of_effect}
                                            </span>
                                          )}
                                          {ca.ability?.duration && (
                                            <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6, fontFamily: 'var(--font-mono)' }}>
                                              ⏱ {ca.ability.duration}
                                            </span>
                                          )}
                                        </div>
                                        {/* Effects list */}
                                        {ca.ability?.effects && ca.ability.effects.length > 0 && (
                                          <div className="mt-1">
                                            {ca.ability.effects.map((eff: string, i: number) => (
                                              <div key={i} className="text-xs" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>
                                                • {eff}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                      
                                      {/* Charges */}
                                      {ca.ability?.charge_type !== 'infinite' && (
                                        <div className="flex flex-col items-center gap-1 ml-3 flex-shrink-0">
                                          <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>CHARGES</div>
                                          <div className="text-lg font-bold" style={{ 
                                            color: ca.current_charges > 0 ? 'var(--color-cyber-green)' : 'var(--color-cyber-magenta)', 
                                            fontFamily: 'var(--font-mono)' 
                                          }}>
                                            {ca.current_charges}/{ca.ability?.max_charges || '?'}
                                          </div>
                                          {activeEncounter.status === 'active' && (
                                            <button
                                              onClick={() => useCombatAbilityCharge(ca.id, ca.ability?.name, ca.current_charges)}
                                              disabled={ca.current_charges <= 0}
                                              className="px-2 py-0.5 rounded text-xs font-bold"
                                              style={{ 
                                                background: ca.current_charges > 0 ? 'var(--color-cyber-green)' : 'transparent',
                                                color: ca.current_charges > 0 ? '#0D1117' : 'var(--color-cyber-cyan)',
                                                border: ca.current_charges > 0 ? 'none' : '1px solid var(--color-cyber-cyan)',
                                                opacity: ca.current_charges > 0 ? 1 : 0.4
                                              }}
                                            >USE</button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Player Consumables */}
                          {isPlayer && combatPlayerInventory.filter(inv => inv.item?.is_consumable).length > 0 && (
                            <div className="p-4 rounded" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-yellow)' }}>
                              <div className="text-xs mb-3" style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)' }}>
                                🍴 CONSUMABLES ({combatPlayerInventory.filter(inv => inv.item?.is_consumable).length})
                              </div>
                              <div className="space-y-1">
                                {combatPlayerInventory.filter(inv => inv.item?.is_consumable).map(inv => (
                                  <div key={inv.id} className="flex items-center justify-between p-2 rounded" style={{ border: '1px solid var(--color-cyber-yellow)', background: 'color-mix(in srgb, var(--color-cyber-darker) 90%, transparent)' }}>
                                    <div>
                                      <span className="font-bold text-sm" style={{ color: 'var(--color-cyber-yellow)' }}>{inv.item?.name}</span>
                                      <span className="text-xs ml-2" style={{ color: 'var(--color-cyber-cyan)' }}>x{inv.quantity}</span>
                                      {inv.item?.hp_mod !== 0 && (
                                        <span className="text-xs ml-2" style={{ color: 'var(--color-cyber-green)' }}>
                                          {inv.item?.hp_mod_type === 'heal' ? `❤️+${inv.item?.hp_mod}` : `❤️ Max +${inv.item?.hp_mod}`}
                                        </span>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => useCombatConsumable(inv.id, inv.item, selectedP.entityId)}
                                      className="px-3 py-1 rounded text-xs font-bold"
                                      style={{ background: 'var(--color-cyber-yellow)', color: '#0D1117' }}
                                    >USE</button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Loading indicator for player resources */}
                          {isPlayer && combatResourcesLoading && (
                            <div className="text-center py-4" style={{ color: 'var(--color-cyber-cyan)' }}>Loading abilities & inventory...</div>
                          )}

                          {/* NPC Abilities */}
                          {!isPlayer && entityData && 'abilities' in entityData && (entityData as NPC).abilities?.length > 0 && (
                            <div className="p-4 rounded" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-green)' }}>
                              <div className="text-xs mb-3" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>
                                NPC ABILITIES ({(entityData as NPC).abilities.length})
                              </div>
                              <div className="space-y-2">
                                {(entityData as NPC).abilities.map((ability, idx) => (
                                  <div key={idx} className="p-3 rounded" style={{ 
                                    background: 'color-mix(in srgb, var(--color-cyber-magenta) 5%, transparent)',
                                    border: '1px solid color-mix(in srgb, var(--color-cyber-magenta) 25%, transparent)'
                                  }}>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-sm" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>
                                        {ability.name}
                                      </span>
                                      {ability.damage && (
                                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--color-cyber-magenta)', color: '#fff' }}>
                                          {ability.damage}
                                        </span>
                                      )}
                                    </div>
                                    {ability.effect && (
                                      <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                                        {ability.effect}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* NPC Details */}
                          {!isPlayer && entityData && 'description' in entityData && (
                            <div className="p-4 rounded" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)' }}>
                              <div className="text-xs mb-3" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>NPC DETAILS</div>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                {(entityData as any).description && (
                                  <div className="col-span-2">
                                    <span className="text-xs" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>Description: </span>
                                    <span style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{(entityData as any).description}</span>
                                  </div>
                                )}
                                {(entityData as any).three_words && (
                                  <div>
                                    <span className="text-xs" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>3 Words: </span>
                                    <span style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{(entityData as any).three_words}</span>
                                  </div>
                                )}
                                {(entityData as any).speech_pattern && (
                                  <div>
                                    <span className="text-xs" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>Speech: </span>
                                    <span style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{(entityData as any).speech_pattern}</span>
                                  </div>
                                )}
                                {(entityData as any).drops_on_defeat && (
                                  <div className="col-span-2">
                                    <span className="text-xs" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>Drops: </span>
                                    <span style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>
                                      ${(entityData as any).drops_on_defeat.usd}
                                      {(entityData as any).drops_on_defeat.items?.length > 0 && ` + ${(entityData as any).drops_on_defeat.items.join(', ')}`}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* DM Notes */}
                          <div className="p-4 rounded" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)' }}>
                            <div className="text-xs mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>DM NOTES</div>
                            <textarea
                              value={notesInput[selectedP.id] !== undefined ? notesInput[selectedP.id] : selectedP.notes}
                              onChange={e => handleNotesChange(selectedP.id, e.target.value)}
                              placeholder="Combat notes... (auto-saves)"
                              rows={3}
                              className="w-full px-3 py-2 rounded text-sm"
                              style={{ background: 'color-mix(in srgb, var(--color-cyber-darker) 90%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}
                            />
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center glass-panel" style={{ border: '1px solid var(--color-cyber-magenta)' }}>
                  <div className="text-center" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>
                    <div className="text-5xl mb-4 opacity-30">⚔️</div>
                    <p className="text-lg" style={{ fontFamily: 'var(--font-cyber)' }}>SELECT AN ENCOUNTER</p>
                    <p className="text-sm mt-1" style={{ fontFamily: 'var(--font-mono)' }}>Choose from the dropdown above or create a new one</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Create Encounter Modal */}
          {showCreateEncounterModal && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
              <div className="glass-panel p-6 w-[500px]" style={{ border: '2px solid var(--color-cyber-magenta)' }}>
                <h3 className="text-lg mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-magenta)' }}>
                  ⚔️ CREATE NEW ENCOUNTER
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--color-cyber-cyan)' }}>Name *</label>
                    <input
                      type="text"
                      value={newEncounterName}
                      onChange={e => setNewEncounterName(e.target.value)}
                      placeholder="e.g., Warehouse Ambush"
                      className="w-full px-3 py-2 rounded"
                      style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--color-cyber-cyan)' }}>Description</label>
                    <textarea
                      value={newEncounterDescription}
                      onChange={e => setNewEncounterDescription(e.target.value)}
                      placeholder="Brief description of the encounter..."
                      rows={3}
                      className="w-full px-3 py-2 rounded"
                      style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end mt-6">
                  <button
                    onClick={() => { setShowCreateEncounterModal(false); setNewEncounterName(''); setNewEncounterDescription(''); }}
                    className="px-4 py-2 rounded text-sm"
                    style={{ background: 'transparent', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)' }}
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={handleCreateEncounter}
                    disabled={encounterSaving || !newEncounterName.trim()}
                    className="px-4 py-2 rounded text-sm"
                    style={{
                      background: newEncounterName.trim() ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-green)',
                      color: '#0D1117',
                      opacity: newEncounterName.trim() ? 1 : 0.5
                    }}
                  >
                    {encounterSaving ? 'CREATING...' : 'CREATE ENCOUNTER'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Add Participant Modal */}
          {showAddParticipantModal && activeEncounter && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => { setShowAddParticipantModal(false); setParticipantSearchQuery(''); setParticipantTypeFilter('all'); }}>
              <div className="glass-panel p-6 w-[750px] max-h-[85vh] overflow-hidden flex flex-col" style={{ border: '2px solid var(--color-cyber-green)' }} onClick={e => e.stopPropagation()}>
                <h3 className="text-lg mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-green)' }}>
                  ➕ ADD COMBATANTS
                </h3>

                {/* Search and Filter Controls */}
                <div className="flex gap-3 mb-4">
                  <input
                    type="text"
                    value={participantSearchQuery}
                    onChange={e => setParticipantSearchQuery(e.target.value)}
                    placeholder="Search by name..."
                    className="flex-1 px-3 py-2 rounded text-sm"
                    style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                  />
                  <select
                    value={participantTypeFilter}
                    onChange={e => setParticipantTypeFilter(e.target.value)}
                    className="px-3 py-2 rounded text-sm"
                    style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-purple)', color: 'var(--color-cyber-purple)' }}
                  >
                    <option value="all">All Types</option>
                    <option value="player">Players Only</option>
                    <option value="enemy">Enemies</option>
                    <option value="friendly">Friendly NPCs</option>
                    <option value="neutral">Neutral NPCs</option>
                    <option value="boss">Bosses</option>
                  </select>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4">
                  {/* Players Section */}
                  {(participantTypeFilter === 'all' || participantTypeFilter === 'player') && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>👥 PLAYERS</h4>
                        {characters.filter(c => !combatParticipants.some(p => p.entityId === c.id)).length > 0 && (
                          <button
                            onClick={addAllPlayersToEncounter}
                            className="px-3 py-1 rounded text-xs font-bold"
                            style={{ background: 'var(--color-cyber-cyan)', color: '#0D1117' }}
                          >
                            ⚡ ADD ALL PLAYERS
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {characters
                          .filter(c => !combatParticipants.some(p => p.entityId === c.id))
                          .filter(c => !participantSearchQuery || c.name.toLowerCase().includes(participantSearchQuery.toLowerCase()))
                          .map(char => (
                          <button
                            key={char.id}
                            onClick={() => addParticipantToEncounter('player', char.id)}
                            className="p-3 rounded text-left transition-all hover:brightness-110"
                            style={{ border: '1px solid var(--color-cyber-cyan)', background: 'color-mix(in srgb, var(--color-cyber-darker) 90%, transparent)' }}
                          >
                            <div className="font-bold" style={{ color: 'var(--color-cyber-cyan)' }}>{char.name}</div>
                            <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>
                              {char.class} Lv{char.level} • ❤️ {char.current_hp}/{char.max_hp} • 🛡️ {char.ac}
                            </div>
                          </button>
                        ))}
                        {characters.filter(c => !combatParticipants.some(p => p.entityId === c.id)).filter(c => !participantSearchQuery || c.name.toLowerCase().includes(participantSearchQuery.toLowerCase())).length === 0 && (
                          <div className="col-span-2 text-center py-2 text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>
                            {participantSearchQuery ? 'No matching players' : 'All players already added'}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* NPCs Section */}
                  {participantTypeFilter !== 'player' && (
                    <div>
                      <h4 className="text-sm mb-2" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-cyber)' }}>👾 NPCs & ENEMIES</h4>
                      <div className="text-xs mb-2 p-2 rounded" style={{ background: 'var(--color-cyber-darker)', border: '1px dashed var(--color-cyber-purple)', color: 'var(--color-cyber-purple)' }}>
                        💡 Tip: Use the quantity selector to add multiple of the same NPC
                      </div>
                      <div className="space-y-2">
                        {allNPCs
                          .filter(n => n.is_alive)
                          .filter(n => !participantSearchQuery || n.name.toLowerCase().includes(participantSearchQuery.toLowerCase()))
                          .filter(n => {
                            if (participantTypeFilter === 'all') return true;
                            if (participantTypeFilter === 'enemy') return n.type === 'Enemy';
                            if (participantTypeFilter === 'friendly') return n.type === 'Friendly NPC';
                            if (participantTypeFilter === 'neutral') return n.type === 'Neutral NPC';
                            if (participantTypeFilter === 'boss') return n.type === 'Boss' || n.type === 'Mini-Boss';
                            return true;
                          })
                          .map(npc => {
                            const currentCount = combatParticipants.filter(p => p.entityId === npc.id).length;
                            const qty = npcQuantities[npc.id] || 1;
                            return (
                              <div
                                key={npc.id}
                                className="p-3 rounded flex items-center gap-3"
                                style={{ border: `1px solid ${getNpcTypeColor(npc.type)}`, background: 'color-mix(in srgb, var(--color-cyber-darker) 90%, transparent)' }}
                              >
                                <div className="flex-1">
                                  <div className="font-bold flex items-center gap-2" style={{ color: getNpcTypeColor(npc.type) }}>
                                    {npc.name}
                                    {currentCount > 0 && (
                                      <span className="text-xs px-2 py-0.5 rounded" style={{ background: getNpcTypeColor(npc.type), color: '#0D1117' }}>
                                        {currentCount} in combat
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>
                                    {npc.type} • ❤️ {npc.current_hp}/{npc.max_hp} • 🛡️ {npc.ac}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button onClick={() => setNpcQuantities(q => ({ ...q, [npc.id]: Math.max(1, qty - 1) }))} className="w-7 h-7 rounded flex items-center justify-center text-sm font-bold" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}>−</button>
                                  <input type="number" min={1} max={20} value={qty} onChange={e => setNpcQuantities(q => ({ ...q, [npc.id]: Math.max(1, Math.min(20, parseInt(e.target.value) || 1)) }))} className="w-12 text-center px-1 py-1 rounded text-sm" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }} />
                                  <button onClick={() => setNpcQuantities(q => ({ ...q, [npc.id]: Math.min(20, qty + 1) }))} className="w-7 h-7 rounded flex items-center justify-center text-sm font-bold" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}>+</button>
                                  <button onClick={() => addMultipleNpcsToEncounter(npc.id, qty)} className="px-3 py-1 rounded text-xs font-bold" style={{ background: getNpcTypeColor(npc.type), color: '#0D1117' }}>
                                    ADD {qty > 1 ? `(${qty})` : ''}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center mt-4 pt-4" style={{ borderTop: '1px solid var(--color-cyber-dark)' }}>
                  <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>{combatParticipants.length} combatants in encounter</div>
                  <button onClick={() => { setShowAddParticipantModal(false); setParticipantSearchQuery(''); setParticipantTypeFilter('all'); }} className="px-4 py-2 rounded text-sm" style={{ background: 'transparent', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)' }}>
                    DONE
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ============ MISSIONS TAB ============ */}
          {activeTab === 'missions' && (
            <div className="flex gap-6">
              {/* Left Panel - Mission List */}
              <div className="w-1/3 space-y-4">
                {/* Header & Create Button */}
                <div className="flex items-center justify-between">
                  <h2 className="text-xl" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-yellow)' }}>
                    📋 MISSION CONTROL
                  </h2>
                  <button
                    onClick={() => {
                      resetMissionForm();
                      setSelectedMission(null);
                      setShowCreateMissionModal(true);
                    }}
                    className="px-4 py-2 rounded font-bold"
                    style={{ background: 'var(--color-cyber-yellow)', color: '#0D1117' }}
                  >
                    + NEW MISSION
                  </button>
                </div>

                {/* Search & Filters */}
                <div className="space-y-3 p-4 rounded" style={{ border: '1px solid var(--color-cyber-green)', background: 'color-mix(in srgb, var(--color-cyber-green) 5%, transparent)' }}>
                  <input
                    type="text"
                    placeholder="Search missions..."
                    value={missionSearchQuery}
                    onChange={e => setMissionSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 rounded"
                    style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                  />
                  <div className="flex gap-2">
                    <select
                      value={missionFilterStatus}
                      onChange={e => setMissionFilterStatus(e.target.value as any)}
                      className="flex-1 px-2 py-1 rounded text-sm"
                      style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                    >
                      <option value="all">All Status</option>
                      <option value="draft">Draft</option>
                      <option value="active">Active</option>
                      <option value="completed">Completed</option>
                      <option value="failed">Failed</option>
                    </select>
                    <select
                      value={missionFilterType}
                      onChange={e => setMissionFilterType(e.target.value as any)}
                      className="flex-1 px-2 py-1 rounded text-sm"
                      style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                    >
                      <option value="all">All Types</option>
                      {MISSION_TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Mission List */}
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                  {missionsLoading ? (
                    <div className="text-center py-8" style={{ color: 'var(--color-cyber-cyan)' }}>Loading missions...</div>
                  ) : filteredMissionsList.length === 0 ? (
                    <div className="text-center py-8" style={{ border: '2px dashed var(--color-cyber-cyan)', borderRadius: '8px' }}>
                      <p style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>No missions found</p>
                    </div>
                  ) : filteredMissionsList.map(mission => (
                    <div
                      key={mission.id}
                      onClick={() => setSelectedMission(mission)}
                      className="p-3 rounded cursor-pointer transition-all hover:brightness-110"
                      style={{
                        border: `2px solid ${selectedMission?.id === mission.id ? 'var(--color-cyber-yellow)' : getMissionTypeColor(mission.type)}`,
                        background: selectedMission?.id === mission.id ? 'color-mix(in srgb, var(--color-cyber-yellow) 15%, transparent)' : 'color-mix(in srgb, var(--color-cyber-dark) 50%, transparent)'
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm" style={{ color: getMissionTypeColor(mission.type), fontFamily: 'var(--font-cyber)' }}>
                              {mission.title}
                            </span>
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: getMissionStatusColor(mission.status), color: '#0D1117' }}>
                              {mission.status.toUpperCase()}
                            </span>
                          </div>
                          <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>
                            {mission.type} • <span style={{ color: getDifficultyColor(mission.difficulty) }}>{mission.difficulty}</span>
                          </div>
                        </div>
                        <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>
                          {mission.objectives.length} obj
                        </div>
                      </div>
                      {mission.assigned_characters && mission.assigned_characters.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {mission.assigned_characters.map(char => (
                            <span key={char.id} className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)', color: 'var(--color-cyber-cyan)' }}>
                              {char.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Panel - Mission Details */}
              <div className="w-2/3">
                {selectedMission ? (
                  <div className="space-y-4">
                    {/* Mission Header */}
                    <div className="p-4 rounded" style={{ border: `2px solid ${getMissionTypeColor(selectedMission.type)}`, background: 'color-mix(in srgb, var(--color-cyber-dark) 80%, transparent)' }}>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h2 className="text-2xl" style={{ fontFamily: 'var(--font-cyber)', color: getMissionTypeColor(selectedMission.type) }}>
                            {selectedMission.title}
                          </h2>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-sm px-2 py-0.5 rounded" style={{ background: getMissionStatusColor(selectedMission.status), color: '#0D1117', fontWeight: 'bold' }}>
                              {selectedMission.status.toUpperCase()}
                            </span>
                            <span className="text-sm" style={{ color: getMissionTypeColor(selectedMission.type) }}>{selectedMission.type}</span>
                            <span className="text-sm" style={{ color: getDifficultyColor(selectedMission.difficulty) }}>{selectedMission.difficulty}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditMission(selectedMission)}
                            className="px-3 py-1 rounded text-sm"
                            style={{ border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => handleDeleteMission(selectedMission.id)}
                            className="px-3 py-1 rounded text-sm"
                            style={{ border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)' }}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>

                      {selectedMission.description && (
                        <p className="text-sm mb-4" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.8, lineHeight: 1.6 }}>
                          {selectedMission.description}
                        </p>
                      )}

                      {/* Status Actions */}
                      <div className="flex gap-2 pt-3" style={{ borderTop: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)' }}>
                        {selectedMission.status !== 'draft' && selectedMission.status !== 'completed' && selectedMission.status !== 'failed' && (
                          <button
                            onClick={() => handleUpdateMissionStatus(selectedMission.id, 'draft')}
                            className="px-3 py-1 rounded text-sm font-bold"
                            style={{ background: '#6B7280', color: '#fff' }}
                          >
                            Set Draft
                          </button>
                        )}
                        {selectedMission.status !== 'active' && (
                          <button
                            onClick={() => handleUpdateMissionStatus(selectedMission.id, 'active')}
                            className="px-3 py-1 rounded text-sm font-bold"
                            style={{ background: 'var(--color-cyber-yellow)', color: '#0D1117' }}
                          >
                            Set Active
                          </button>
                        )}
                        {selectedMission.status !== 'completed' && (
                          <button
                            onClick={() => handleUpdateMissionStatus(selectedMission.id, 'completed')}
                            className="px-3 py-1 rounded text-sm font-bold"
                            style={{ background: 'var(--color-cyber-green)', color: '#0D1117' }}
                          >
                            Mark Complete
                          </button>
                        )}
                        {selectedMission.status !== 'failed' && (
                          <button
                            onClick={() => handleUpdateMissionStatus(selectedMission.id, 'failed')}
                            className="px-3 py-1 rounded text-sm font-bold"
                            style={{ background: 'var(--color-cyber-magenta)', color: '#fff' }}
                          >
                            Mark Failed
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Objectives */}
                    <div className="p-4 rounded" style={{ border: '1px solid var(--color-cyber-green)', background: 'color-mix(in srgb, var(--color-cyber-green) 5%, transparent)' }}>
                      <h3 className="text-lg mb-3" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-green)' }}>
                        🎯 OBJECTIVES ({selectedMission.objectives.length})
                      </h3>
                      {selectedMission.objectives.length === 0 ? (
                        <p className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>No objectives defined</p>
                      ) : (
                        <div className="space-y-2">
                          {selectedMission.objectives.map((obj, idx) => (
                            <div key={idx} className="flex items-start gap-3 p-2 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-darker) 80%, transparent)' }}>
                              <span className="w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold" style={{ background: 'var(--color-cyber-green)', color: '#0D1117' }}>
                                {idx + 1}
                              </span>
                              <span className="flex-1 text-sm" style={{ color: 'var(--color-cyber-cyan)' }}>{obj}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Assigned Characters */}
                      <div className="p-4 rounded" style={{ border: '1px solid var(--color-cyber-cyan)', background: 'color-mix(in srgb, var(--color-cyber-cyan) 5%, transparent)' }}>
                        <h3 className="text-lg mb-3" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
                          👥 ASSIGNED TO
                        </h3>
                        {!selectedMission.assigned_characters || selectedMission.assigned_characters.length === 0 ? (
                          <p className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>Party-wide mission</p>
                        ) : (
                          <div className="space-y-2">
                            {selectedMission.assigned_characters.map(char => (
                              <div key={char.id} className="flex items-center gap-2 p-2 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-darker) 80%, transparent)' }}>
                                <span className="font-bold" style={{ color: 'var(--color-cyber-cyan)' }}>{char.name}</span>
                                <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6 }}>{char.class}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Rewards */}
                      <div className="p-4 rounded" style={{ border: '1px solid var(--color-cyber-yellow)', background: 'color-mix(in srgb, var(--color-cyber-yellow) 5%, transparent)' }}>
                        <h3 className="text-lg mb-2" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-yellow)' }}>
                          🎁 REWARDS
                        </h3>
                        
                        {/* Reward Mode Indicator */}
                        <div className="mb-3 px-2 py-1 rounded text-xs inline-block" style={{ 
                          background: selectedMission.reward_mode === 'each' ? 'var(--color-cyber-green)' : 'var(--color-cyber-magenta)',
                          color: '#0D1117'
                        }}>
                          {selectedMission.reward_mode === 'each' ? '👥 Each Member Gets:' : '🎯 Single Recipient:'}
                        </div>
                        
                        {/* Credit Rewards */}
                        {(selectedMission.reward_credits || 0) > 0 && (
                          <div className="mb-2 p-2 rounded flex items-center gap-2" style={{ background: 'color-mix(in srgb, var(--color-cyber-darker) 80%, transparent)' }}>
                            <span className="text-lg">💰</span>
                            <span className="font-bold text-lg" style={{ color: 'var(--color-cyber-yellow)' }}>
                              {selectedMission.reward_credits.toLocaleString()} credits
                            </span>
                            {selectedMission.reward_mode === 'each' && (
                              <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6 }}>per player</span>
                            )}
                          </div>
                        )}
                        
                        {/* Item Rewards */}
                        {!selectedMission.reward_items || selectedMission.reward_items.length === 0 ? (
                          (selectedMission.reward_credits || 0) === 0 && (
                            <p className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>No rewards set</p>
                          )
                        ) : (
                          <div className="space-y-2">
                            {selectedMission.reward_items.map(item => (
                              <div key={item.id} className="flex items-center gap-2 p-2 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-darker) 80%, transparent)' }}>
                                <span>{getItemTypeIcon(item.type)}</span>
                                <span className="font-bold" style={{ color: getRarityColor(item.rarity) }}>{item.name}</span>
                                <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6 }}>{item.rarity}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full py-20" style={{ border: '2px dashed var(--color-cyber-cyan)', borderRadius: '8px' }}>
                    <div className="text-center">
                      <div className="text-4xl mb-4">📋</div>
                      <p style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                        Select a mission to view details
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Create/Edit Mission Modal */}
          {showCreateMissionModal && (
            <div className="fixed inset-0 bg-black flex items-center justify-center z-50" onClick={() => { setShowCreateMissionModal(false); resetMissionForm(); setSelectedMission(null); setRewardItemSearch(''); }}>
              <div className="p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg" style={{ background: '#0D1117', border: '2px solid var(--color-cyber-yellow)' }} onClick={e => e.stopPropagation()}>
                <h3 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-yellow)' }}>
                  {selectedMission ? '✏️ EDIT MISSION' : '📋 CREATE NEW MISSION'}
                </h3>

                <div className="space-y-4">
                  {/* Title */}
                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--color-cyber-cyan)' }}>Mission Title *</label>
                    <input
                      type="text"
                      value={missionForm.title}
                      onChange={e => setMissionForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="Enter mission title..."
                      className="w-full px-3 py-2 rounded"
                      style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                    />
                  </div>

                  {/* Type & Difficulty */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm mb-1" style={{ color: 'var(--color-cyber-cyan)' }}>Type</label>
                      <select
                        value={missionForm.type}
                        onChange={e => setMissionForm(f => ({ ...f, type: e.target.value as MissionType }))}
                        className="w-full px-3 py-2 rounded"
                        style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                      >
                        {MISSION_TYPES.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm mb-1" style={{ color: 'var(--color-cyber-cyan)' }}>Difficulty</label>
                      <select
                        value={missionForm.difficulty}
                        onChange={e => setMissionForm(f => ({ ...f, difficulty: e.target.value as MissionDifficulty }))}
                        className="w-full px-3 py-2 rounded"
                        style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                      >
                        {MISSION_DIFFICULTIES.map(diff => (
                          <option key={diff} value={diff}>{diff}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--color-cyber-cyan)' }}>Description</label>
                    <textarea
                      value={missionForm.description}
                      onChange={e => setMissionForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Mission briefing..."
                      rows={3}
                      className="w-full px-3 py-2 rounded"
                      style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                    />
                  </div>

                  {/* Objectives */}
                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--color-cyber-cyan)' }}>
                      Objectives
                      <button
                        onClick={() => setMissionForm(f => ({ ...f, objectives: [...f.objectives, ''] }))}
                        className="ml-2 px-2 py-0.5 rounded text-xs"
                        style={{ background: 'var(--color-cyber-green)', color: '#0D1117' }}
                      >
                        + Add
                      </button>
                    </label>
                    <div className="space-y-2">
                      {missionForm.objectives.map((obj, idx) => (
                        <div key={idx} className="flex gap-2">
                          <span className="w-6 h-8 flex items-center justify-center text-xs" style={{ color: 'var(--color-cyber-green)' }}>{idx + 1}.</span>
                          <input
                            type="text"
                            value={obj}
                            onChange={e => {
                              const newObjs = [...missionForm.objectives];
                              newObjs[idx] = e.target.value;
                              setMissionForm(f => ({ ...f, objectives: newObjs }));
                            }}
                            placeholder="Objective description..."
                            className="flex-1 px-3 py-1 rounded text-sm"
                            style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-green)', color: 'var(--color-cyber-cyan)' }}
                          />
                          {missionForm.objectives.length > 1 && (
                            <button
                              onClick={() => setMissionForm(f => ({ ...f, objectives: f.objectives.filter((_, i) => i !== idx) }))}
                              className="px-2 rounded"
                              style={{ color: 'var(--color-cyber-magenta)' }}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Assign to Characters */}
                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--color-cyber-cyan)' }}>
                      Assign to (leave empty for party-wide)
                    </label>
                    <div className="flex flex-wrap gap-2 p-2 rounded" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)' }}>
                      {characters.map(char => (
                        <button
                          key={char.id}
                          onClick={() => {
                            if (missionForm.assigned_to.includes(char.id)) {
                              setMissionForm(f => ({ ...f, assigned_to: f.assigned_to.filter(id => id !== char.id) }));
                            } else {
                              setMissionForm(f => ({ ...f, assigned_to: [...f.assigned_to, char.id] }));
                            }
                          }}
                          className="px-2 py-1 rounded text-sm"
                          style={{
                            background: missionForm.assigned_to.includes(char.id) ? 'var(--color-cyber-cyan)' : 'transparent',
                            color: missionForm.assigned_to.includes(char.id) ? '#0D1117' : 'var(--color-cyber-cyan)',
                            border: '1px solid var(--color-cyber-cyan)'
                          }}
                        >
                          {char.name}
                        </button>
                      ))}
                      {characters.length === 0 && (
                        <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>No characters available</span>
                      )}
                    </div>
                  </div>

                  {/* Reward Items */}
                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--color-cyber-cyan)' }}>
                      Reward Items
                    </label>
                    
                    {/* Selected Rewards Display */}
                    {missionForm.reward_item_ids.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2 p-2 rounded" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-yellow)' }}>
                        {missionForm.reward_item_ids.map(itemId => {
                          const item = allItems.find(i => i.id === itemId);
                          if (!item) return null;
                          return (
                            <div key={itemId} className="flex items-center gap-1 px-2 py-1 rounded text-xs" style={{ background: getRarityColor(item.rarity), color: '#0D1117' }}>
                              <span>{getItemTypeIcon(item.type)}</span>
                              <span className="font-bold">{item.name}</span>
                              <button
                                onClick={() => setMissionForm(f => ({ ...f, reward_item_ids: f.reward_item_ids.filter(id => id !== itemId) }))}
                                className="ml-1 hover:opacity-70"
                              >
                                ✕
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                    {/* Search Input */}
                    <div className="relative">
                      <input
                        type="text"
                        value={rewardItemSearch}
                        onChange={e => setRewardItemSearch(e.target.value)}
                        placeholder="Search items to add as reward..."
                        className="w-full px-3 py-2 rounded"
                        style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-yellow)', color: 'var(--color-cyber-cyan)' }}
                      />
                      
                      {/* Search Results Dropdown */}
                      {rewardItemSearch.trim() && (
                        <div className="absolute z-10 w-full mt-1 rounded max-h-48 overflow-y-auto" style={{ background: '#0D1117', border: '1px solid var(--color-cyber-yellow)' }}>
                          {allItems
                            .filter(item => 
                              item.name.toLowerCase().includes(rewardItemSearch.toLowerCase()) &&
                              !missionForm.reward_item_ids.includes(item.id)
                            )
                            .slice(0, 15)
                            .map(item => (
                              <button
                                key={item.id}
                                onClick={() => {
                                  setMissionForm(f => ({ ...f, reward_item_ids: [...f.reward_item_ids, item.id] }));
                                  setRewardItemSearch('');
                                }}
                                className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:opacity-80 transition-opacity"
                                style={{ borderBottom: '1px solid color-mix(in srgb, var(--color-cyber-yellow) 20%, transparent)' }}
                              >
                                <span>{getItemTypeIcon(item.type)}</span>
                                <span style={{ color: getRarityColor(item.rarity) }}>{item.name}</span>
                                <span className="text-xs ml-auto" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>{toTitleCase(item.type)} • {item.rarity}</span>
                              </button>
                            ))}
                          {allItems.filter(item => 
                            item.name.toLowerCase().includes(rewardItemSearch.toLowerCase()) &&
                            !missionForm.reward_item_ids.includes(item.id)
                          ).length === 0 && (
                            <div className="px-3 py-2 text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>No items found</div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {missionForm.reward_item_ids.length === 0 && (
                      <div className="mt-2 text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>
                        Type to search and add reward items
                      </div>
                    )}
                  </div>

                  {/* Credit Rewards */}
                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--color-cyber-cyan)' }}>
                      Credit Reward 💰
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={missionForm.reward_credits}
                      onChange={e => setMissionForm(f => ({ ...f, reward_credits: parseInt(e.target.value) || 0 }))}
                      placeholder="0"
                      className="w-full px-3 py-2 rounded"
                      style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-yellow)', color: 'var(--color-cyber-yellow)' }}
                    />
                  </div>

                  {/* Reward Distribution Mode */}
                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--color-cyber-cyan)' }}>
                      Reward Distribution Mode
                    </label>
                    <div className="flex gap-3 p-2 rounded" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)' }}>
                      <button
                        onClick={() => setMissionForm(f => ({ ...f, reward_mode: 'each' }))}
                        className="flex-1 px-3 py-2 rounded text-sm"
                        style={{
                          background: missionForm.reward_mode === 'each' ? 'var(--color-cyber-green)' : 'transparent',
                          color: missionForm.reward_mode === 'each' ? '#0D1117' : 'var(--color-cyber-cyan)',
                          border: '1px solid var(--color-cyber-green)'
                        }}
                      >
                        <div className="font-bold">Each Member</div>
                        <div className="text-xs opacity-80">All assigned players get rewards</div>
                      </button>
                      <button
                        onClick={() => setMissionForm(f => ({ ...f, reward_mode: 'single' }))}
                        className="flex-1 px-3 py-2 rounded text-sm"
                        style={{
                          background: missionForm.reward_mode === 'single' ? 'var(--color-cyber-magenta)' : 'transparent',
                          color: missionForm.reward_mode === 'single' ? '#0D1117' : 'var(--color-cyber-cyan)',
                          border: '1px solid var(--color-cyber-magenta)'
                        }}
                      >
                        <div className="font-bold">Single Recipient</div>
                        <div className="text-xs opacity-80">DM assigns rewards on completion</div>
                      </button>
                    </div>
                    <div className="mt-1 text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>
                      {missionForm.reward_mode === 'each' 
                        ? '📦 Each party member receives the full rewards (items + credits)'
                        : '🎯 On completion, you\'ll choose which players get each reward item'}
                    </div>
                  </div>

                  {/* Save as Draft Option */}
                  {!selectedMission && (
                    <div className="flex items-center gap-3 p-3 rounded" style={{ background: 'var(--color-cyber-darker)', border: '1px solid #6B7280' }}>
                      <input
                        type="checkbox"
                        id="saveAsDraft"
                        checked={missionForm.saveAsDraft}
                        onChange={e => setMissionForm(f => ({ ...f, saveAsDraft: e.target.checked }))}
                        className="w-5 h-5"
                        style={{ accentColor: '#6B7280' }}
                      />
                      <label htmlFor="saveAsDraft" className="flex-1 cursor-pointer">
                        <div className="text-sm" style={{ color: 'var(--color-cyber-cyan)' }}>Save as Draft</div>
                        <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>
                          Draft missions are hidden from players until activated
                        </div>
                      </label>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 mt-6 pt-4" style={{ borderTop: '1px solid var(--color-cyber-green)' }}>
                  <button
                    onClick={() => { setShowCreateMissionModal(false); resetMissionForm(); setSelectedMission(null); setRewardItemSearch(''); }}
                    className="px-4 py-2 rounded"
                    style={{ border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={selectedMission ? handleSaveMissionEdit : handleCreateMission}
                    disabled={missionSaving || !missionForm.title.trim()}
                    className="px-6 py-2 rounded font-bold"
                    style={{
                      background: missionForm.title.trim() ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-dark)',
                      color: missionForm.title.trim() ? '#0D1117' : 'var(--color-cyber-cyan)',
                      opacity: missionForm.title.trim() ? 1 : 0.5
                    }}
                  >
                    {missionSaving ? 'Saving...' : selectedMission ? 'Save Changes' : 'Create Mission'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ============ SETTINGS TAB ============ */}
          {activeTab === 'settings' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <h2 className="text-2xl mb-6" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-yellow)' }}>
                ⚙️ GAME SETTINGS
              </h2>

              {/* Landing Page Settings */}
              <div className="glass-panel p-6" style={{ border: '2px solid var(--color-cyber-cyan)' }}>
                <h3 className="text-lg mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
                  🏠 Landing Page
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                      Subtitle Text (shown below "DAI CITY HEROS")
                    </label>
                    <input
                      type="text"
                      value={landingSubtitle}
                      onChange={(e) => setLandingSubtitle(e.target.value)}
                      placeholder="Enter subtitle text..."
                      className="w-full px-4 py-3 rounded text-lg"
                      style={{
                        background: 'var(--color-cyber-dark)',
                        border: '2px solid var(--color-cyber-cyan)',
                        color: 'var(--color-cyber-cyan)',
                        fontFamily: 'var(--font-mono)'
                      }}
                    />
                    <p className="text-xs mt-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6 }}>
                      Preview: [ {landingSubtitle.toUpperCase()} ]
                    </p>
                  </div>

                  <button
                    onClick={saveLandingSubtitle}
                    disabled={settingsSaving}
                    className="px-6 py-3 rounded font-bold text-lg"
                    style={{
                      background: settingsSaving ? 'var(--color-cyber-dark)' : 'var(--color-cyber-cyan)',
                      color: settingsSaving ? 'var(--color-cyber-cyan)' : '#0D1117',
                      fontFamily: 'var(--font-cyber)',
                      opacity: settingsSaving ? 0.5 : 1
                    }}
                  >
                    {settingsSaving ? '⏳ Saving...' : '💾 Save Settings'}
                  </button>
                </div>
              </div>

              {/* Future settings can go here */}
              <div className="glass-panel p-6" style={{ border: '1px solid var(--color-cyber-purple)', opacity: 0.5 }}>
                <h3 className="text-lg mb-2" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-purple)' }}>
                  🔮 More Settings Coming Soon...
                </h3>
                <p className="text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                  Additional game configuration options will be added here.
                </p>
              </div>
            </div>
          )}

          {/* Reward Distribution Modal */}
          {showRewardDistributionModal && selectedMission && (
            <div className="fixed inset-0 bg-black flex items-center justify-center z-50" onClick={() => setShowRewardDistributionModal(false)}>
              <div className="p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg" style={{ background: '#0D1117', border: '2px solid var(--color-cyber-green)' }} onClick={e => e.stopPropagation()}>
                <h3 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-green)' }}>
                  🎁 DISTRIBUTE REWARDS
                </h3>
                <p className="text-sm mb-4" style={{ color: 'var(--color-cyber-cyan)' }}>
                  Assign each reward to a party member for mission: <strong>{selectedMission.title}</strong>
                </p>

                {/* Item Rewards Distribution */}
                {selectedMission.reward_items && selectedMission.reward_items.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm mb-2" style={{ color: 'var(--color-cyber-yellow)' }}>📦 Item Rewards</h4>
                    <div className="space-y-3">
                      {selectedMission.reward_items.map(item => (
                        <div key={item.id} className="flex items-center gap-3 p-3 rounded" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-yellow)' }}>
                          <div className="flex items-center gap-2 flex-1">
                            <span>{getItemTypeIcon(item.type)}</span>
                            <span className="font-bold" style={{ color: getRarityColor(item.rarity) }}>{item.name}</span>
                          </div>
                          <span className="text-sm" style={{ color: 'var(--color-cyber-cyan)' }}>→</span>
                          <select
                            value={rewardDistribution[item.id] || ''}
                            onChange={e => setRewardDistribution(prev => ({ ...prev, [item.id]: e.target.value }))}
                            className="px-3 py-2 rounded min-w-48"
                            style={{ background: 'var(--color-cyber-dark)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                          >
                            <option value="">-- Select recipient --</option>
                            {(selectedMission.assigned_characters?.length ? selectedMission.assigned_characters : characters).map(char => (
                              <option key={char.id} value={char.id}>{char.name}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Credit Rewards Distribution */}
                {(selectedMission.reward_credits || 0) > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm mb-2" style={{ color: 'var(--color-cyber-yellow)' }}>
                      💰 Credit Reward: <strong>{selectedMission.reward_credits.toLocaleString()} credits</strong> to distribute
                    </h4>
                    <div className="space-y-2">
                      {(selectedMission.assigned_characters?.length ? selectedMission.assigned_characters : characters).map(char => (
                        <div key={char.id} className="flex items-center gap-3 p-2 rounded" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-yellow)' }}>
                          <span className="flex-1 font-bold" style={{ color: 'var(--color-cyber-cyan)' }}>{char.name}</span>
                          <input
                            type="number"
                            min="0"
                            max={selectedMission.reward_credits}
                            value={creditDistribution[char.id] || 0}
                            onChange={e => setCreditDistribution(prev => ({ ...prev, [char.id]: parseInt(e.target.value) || 0 }))}
                            className="w-32 px-3 py-1 rounded text-right"
                            style={{ background: 'var(--color-cyber-dark)', border: '1px solid var(--color-cyber-yellow)', color: 'var(--color-cyber-yellow)' }}
                          />
                          <span style={{ color: 'var(--color-cyber-yellow)' }}>credits</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 text-sm" style={{ 
                      color: Object.values(creditDistribution).reduce((a, b) => a + b, 0) === selectedMission.reward_credits 
                        ? 'var(--color-cyber-green)' 
                        : 'var(--color-cyber-magenta)'
                    }}>
                      Distributed: {Object.values(creditDistribution).reduce((a, b) => a + b, 0).toLocaleString()} / {selectedMission.reward_credits.toLocaleString()} credits
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 mt-4 pt-4" style={{ borderTop: '1px solid var(--color-cyber-green)' }}>
                  <button
                    onClick={() => {
                      setShowRewardDistributionModal(false);
                      setRewardDistribution({});
                      setCreditDistribution({});
                    }}
                    className="px-4 py-2 rounded"
                    style={{ border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCompleteWithDistribution}
                    className="px-6 py-2 rounded font-bold"
                    style={{ background: 'var(--color-cyber-green)', color: '#0D1117' }}
                  >
                    ✅ Complete Mission & Distribute
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}