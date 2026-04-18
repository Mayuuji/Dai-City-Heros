import { useAuth } from '../contexts/AuthContext';
import { useCampaign } from '../contexts/CampaignContext';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { InventoryItem, Item, ItemType, ItemRarity, Ability, AbilityType, ChargeType } from '../types/inventory';
import type { NPC, NPCType } from '../types/npc';
import type { MissionWithDetails, MissionType, MissionDifficulty, MissionStatus, RewardMode } from '../types/mission';
import type { StorageContainer, StorageItem } from '../types/storage';
import { getRarityColor, getRarityBgColor, getItemTypeIcon, formatModifier, getAbilityTypeIcon, getAbilityCooldownText } from '../utils/stats';
import { ALL_SKILLS, CHARACTER_CLASSES, formatToHit, WeaponType } from '../data/characterClasses';
import { useClassAliases } from '../utils/useClassAliases';
import NumberInput from '../components/NumberInput';

// Weapon types for rank editing
const WEAPON_TYPES: { key: WeaponType; label: string; icon: string }[] = [
  { key: 'unarmed', label: 'Unarmed', icon: 'ðŸ‘Š' },
  { key: 'melee', label: 'Melee', icon: 'ðŸ—¡ï¸' },
  { key: 'sidearms', label: 'Sidearms', icon: 'ðŸ”«' },
  { key: 'longarms', label: 'Longarms', icon: 'ðŸŽ¯' },
  { key: 'heavy', label: 'Heavy', icon: 'ðŸ’¥' },
];

interface Character {
  id: string;
  user_id: string;
  name: string;
  class: string;
  level: number;
  current_hp: number;
  max_hp: number;
  temp_hp: number;
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

type TabId = 'players' | 'items' | 'abilities' | 'npcs' | 'encounters' | 'missions' | 'effects' | 'settings';
type PlayerSubTab = 'stats' | 'inventory' | 'abilities';

export default function DMDashboard() {
  const { profile, signOut } = useAuth();
  const { campaignId } = useCampaign();
  const navigate = useNavigate();
  const { getClassName } = useClassAliases(campaignId);
  
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
  const [campaignInviteCode, setCampaignInviteCode] = useState('');
  const [inviteCodeEditing, setInviteCodeEditing] = useState(false);
  const [inviteCodeSaving, setInviteCodeSaving] = useState(false);
  const [classAliases, setClassAliases] = useState<Record<string, { display_name: string; description: string }>>({});
  const [classAliasesSaving, setClassAliasesSaving] = useState(false);
  
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
  
  // Status effects for encounters
  const [encounterStatusEffects, setEncounterStatusEffects] = useState<{id: string; encounter_id: string; participant_id: string; label: string; remaining_rounds: number; created_at: string}[]>([]);
  const [newEncStatusLabel, setNewEncStatusLabel] = useState('');
  const [newEncStatusDuration, setNewEncStatusDuration] = useState(1);

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

  // Effects Tab state
  interface GameEffect {
    id: string;
    effect_type: 'blackout' | 'flash' | 'glitch' | 'media' | 'clear';
    target_type: 'all' | 'select';
    target_character_ids: string[];
    display_mode: 'fullscreen' | 'popup';
    media_url: string | null;
    media_type: 'image' | 'video' | null;
    flash_interval_ms: number;
    is_active: boolean;
    created_at: string;
  }
  const [activeGameEffects, setActiveGameEffects] = useState<GameEffect[]>([]);
  const [, setEffectsLoading] = useState(false);
  const [effectTargetType, setEffectTargetType] = useState<'all' | 'select'>('all');
  const [effectTargetIds, setEffectTargetIds] = useState<string[]>([]);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string>('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [mediaDisplayMode, setMediaDisplayMode] = useState<'fullscreen' | 'popup'>('fullscreen');
  const [mediaUploading, setMediaUploading] = useState(false);
  const [flashInterval, setFlashInterval] = useState(200);

  // Weight system
  const [weightSystemEnabled, setWeightSystemEnabled] = useState(false);

  // Storage containers
  const [storageContainers, setStorageContainers] = useState<StorageContainer[]>([]);
  const [storageItems, setStorageItems] = useState<StorageItem[]>([]);
  const [newContainerName, setNewContainerName] = useState('');
  const [newContainerDesc, setNewContainerDesc] = useState('');
  const [newContainerCapacity, setNewContainerCapacity] = useState<number | null>(null);
  const [selectedContainer, setSelectedContainer] = useState<StorageContainer | null>(null);

  // Fetch player lock status on mount and subscribe to changes
  useEffect(() => {
    const fetchLockStatus = async () => {
      const { data } = await supabase
        .from('game_settings')
        .select('value')
        .eq('campaign_id', campaignId)
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_settings', filter: `campaign_id=eq.${campaignId}` }, (payload) => {
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
        lock_reason: reason,
        p_campaign_id: campaignId
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
      .eq('campaign_id', campaignId)
      .eq('key', 'landing_subtitle')
      .single();
    
    if (data?.value?.text) {
      setLandingSubtitle(data.value.text);
    }
  };

  // Fetch invite code for this campaign
  const fetchInviteCode = async () => {
    const { data } = await supabase
      .from('campaigns')
      .select('invite_code')
      .eq('id', campaignId)
      .single();
    if (data?.invite_code) setCampaignInviteCode(data.invite_code);
  };

  // Save custom invite code
  const saveInviteCode = async () => {
    if (!campaignInviteCode.trim()) return;
    setInviteCodeSaving(true);
    try {
      const { error } = await supabase
        .from('campaigns')
        .update({ invite_code: campaignInviteCode.trim().toLowerCase() })
        .eq('id', campaignId);
      if (error) throw error;
      setInviteCodeEditing(false);
      alert('Invite code updated!');
    } catch (err: any) {
      if (err.message?.includes('duplicate') || err.code === '23505') {
        alert('That invite code is already taken. Please choose a different one.');
      } else {
        alert(`Error: ${err.message}`);
      }
    } finally {
      setInviteCodeSaving(false);
    }
  };

  // Fetch class aliases for this campaign
  const fetchClassAliases = async () => {
    const { data } = await supabase
      .from('game_settings')
      .select('value')
      .eq('campaign_id', campaignId)
      .eq('key', 'class_aliases')
      .single();
    if (data?.value) setClassAliases(data.value);
  };

  // Save class aliases
  const saveClassAliases = async () => {
    setClassAliasesSaving(true);
    try {
      const { error } = await supabase
        .from('game_settings')
        .upsert({
          key: 'class_aliases',
          value: classAliases,
          updated_at: new Date().toISOString(),
          campaign_id: campaignId
        }, { onConflict: 'key,campaign_id' });
      if (error) throw error;
      alert('Class aliases saved!');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setClassAliasesSaving(false);
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
          updated_at: new Date().toISOString(),
          campaign_id: campaignId
        }, { onConflict: 'key,campaign_id' });
      
      if (error) throw error;
      alert('Settings saved successfully!');
    } catch (err: any) {
      console.error('Error saving settings:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setSettingsSaving(false);
    }
  };

  // Weight system setting
  const fetchWeightSetting = async () => {
    const { data } = await supabase
      .from('game_settings')
      .select('value')
      .eq('campaign_id', campaignId)
      .eq('key', 'weight_system_enabled')
      .single();
    if (data?.value) setWeightSystemEnabled(data.value.enabled || false);
  };

  const toggleWeightSystem = async (enabled: boolean) => {
    try {
      await supabase
        .from('game_settings')
        .upsert({
          key: 'weight_system_enabled',
          value: { enabled },
          updated_at: new Date().toISOString(),
          campaign_id: campaignId
        }, { onConflict: 'key,campaign_id' });
      setWeightSystemEnabled(enabled);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  // Storage container functions
  const fetchStorageContainers = async () => {
    const { data } = await supabase
      .from('storage_containers')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true });
    if (data) setStorageContainers(data);
  };

  const fetchStorageItems = async (containerId: string) => {
    const { data } = await supabase
      .from('storage_items')
      .select('*, item:items(*)')
      .eq('container_id', containerId);
    if (data) setStorageItems(data);
  };

  const createStorageContainer = async () => {
    if (!newContainerName.trim()) return;
    try {
      const { error } = await supabase.from('storage_containers').insert({
        campaign_id: campaignId,
        name: newContainerName.trim(),
        description: newContainerDesc.trim() || null,
        max_capacity: newContainerCapacity,
        created_by: profile?.id
      });
      if (error) throw error;
      setNewContainerName('');
      setNewContainerDesc('');
      setNewContainerCapacity(null);
      await fetchStorageContainers();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const deleteStorageContainer = async (id: string) => {
    if (!confirm('Delete this container and all its contents?')) return;
    try {
      await supabase.from('storage_containers').delete().eq('id', id);
      if (selectedContainer?.id === id) {
        setSelectedContainer(null);
        setStorageItems([]);
      }
      await fetchStorageContainers();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const toggleContainerLock = async (container: StorageContainer) => {
    try {
      await supabase.from('storage_containers')
        .update({ is_locked: !container.is_locked })
        .eq('id', container.id);
      await fetchStorageContainers();
      if (selectedContainer?.id === container.id) {
        setSelectedContainer({ ...container, is_locked: !container.is_locked });
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const removeStorageItem = async (storageItemId: string) => {
    try {
      await supabase.from('storage_items').delete().eq('id', storageItemId);
      if (selectedContainer) await fetchStorageItems(selectedContainer.id);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
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
      fetchInviteCode();
      fetchClassAliases();
      fetchWeightSetting();
      fetchStorageContainers();
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
        .eq('campaign_id', campaignId)
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

  const handleSetTempHp = async (amount: number) => {
    if (!selectedCharacter) return;
    const newTempHp = Math.max((selectedCharacter.temp_hp || 0) + amount, 0);
    const { error } = await supabase
      .from('characters')
      .update({ temp_hp: newTempHp })
      .eq('id', selectedCharacter.id);
    if (!error) {
      setSelectedCharacter({ ...selectedCharacter, temp_hp: newTempHp });
      setCharacters(chars => chars.map(c => c.id === selectedCharacter.id ? { ...c, temp_hp: newTempHp } : c));
    }
  };

  const handleClearTempHp = async () => {
    if (!selectedCharacter) return;
    const { error } = await supabase
      .from('characters')
      .update({ temp_hp: 0 })
      .eq('id', selectedCharacter.id);
    if (!error) {
      setSelectedCharacter({ ...selectedCharacter, temp_hp: 0 });
      setCharacters(chars => chars.map(c => c.id === selectedCharacter.id ? { ...c, temp_hp: 0 } : c));
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
    const { data } = await supabase.from('items').select('*').eq('campaign_id', campaignId).order('name');
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
            is_equipped: false,
            campaign_id: campaignId
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
                  source_id: selectedGiveItem.id,
                  campaign_id: campaignId
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
      
      // Track ability IDs already present from character_abilities to avoid duplicates
      const grantedAbilityIds = new Set(
        (charAbilities || []).map((ca: any) => ca.ability_id).filter(Boolean)
      );
      
      // Extract item abilities as CharacterAbility-like objects (skip if already granted)
      const itemAbilities: CharacterAbility[] = [];
      equippedItems?.forEach(invItem => {
        invItem.item?.abilities?.forEach((itemAbility: any) => {
          if (itemAbility.ability && !grantedAbilityIds.has(itemAbility.ability.id)) {
            grantedAbilityIds.add(itemAbility.ability.id); // prevent cross-item duplicates too
            itemAbilities.push({
              id: `item_${invItem.item.id}_${itemAbility.ability.id}`,
              character_id: characterId,
              ability_id: itemAbility.ability.id,
              current_charges: itemAbility.ability.max_charges || 0,
              source_type: 'item' as const,
              source_id: invItem.item.id,
              granted_at: invItem.created_at || new Date().toISOString(),
              ability: { ...itemAbility.ability, item_name: invItem.item.name },
              displaySource: `item:${invItem.item.name}` as any
            });
          }
        });
      });
      
      // 3. Get class features from selected character (only if not already seeded in character_abilities)
      const grantedAbilityNames = new Set(
        (charAbilities || []).map((ca: any) => ca.ability?.name).filter(Boolean)
      );
      const classAbilities: CharacterAbility[] = [];
      if (selectedCharacter?.class_features && Array.isArray(selectedCharacter.class_features)) {
        selectedCharacter.class_features.forEach((feature: any, index: number) => {
          // Skip if this class feature was already seeded into character_abilities
          if (grantedAbilityNames.has(feature.name)) return;
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
        .select('id, current_charges, ability:abilities(max_charges, charges_per_rest, charge_type)')
        .eq('campaign_id', campaignId);
      
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
        .select('id, current_charges, ability:abilities(max_charges, charges_per_rest, charge_type)')
        .eq('campaign_id', campaignId);
      
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
      const { data } = await supabase.from('abilities').select('*').eq('campaign_id', campaignId).order('name');
      setAllAbilities(data || []);
    } catch (err: any) {
      console.error('Error fetching abilities for items:', err);
    }
  };

  const fetchAllItemsForEditor = async () => {
    try {
      setItemsLoading(true);
      const { data } = await supabase.from('items').select('*').eq('campaign_id', campaignId).order('name');
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
        campaign_id: campaignId,
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
          .insert({ ...itemData, created_by: profile?.id, campaign_id: campaignId })
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
      seedAndFetchAbilities();
    }
  }, [activeTab]);

  // Auto-seed class abilities for this campaign if none exist yet
  const seedClassAbilitiesIfNeeded = async () => {
    if (!campaignId) return;

    // Check if this campaign already has class abilities
    const { data: existing } = await supabase
      .from('abilities')
      .select('id')
      .eq('campaign_id', campaignId)
      .eq('source', 'class')
      .limit(1);

    if (existing && existing.length > 0) return; // Already seeded

    console.log('[Abilities] Seeding class abilities for campaign:', campaignId);

    const typeMap: Record<string, string> = {
      'ACTION': 'action',
      'BONUS': 'bonus_action',
      'HIT/STEALTH': 'utility',
      'ON HIT': 'reaction',
      'passive': 'passive'
    };

    const abilityRows = CHARACTER_CLASSES.flatMap(cls =>
      cls.classFeatures.map(feat => ({
        name: feat.name,
        description: feat.description,
        type: typeMap[feat.type] || 'action',
        charge_type: feat.charges ? 'long_rest' : 'infinite',
        max_charges: feat.charges || null,
        charges_per_rest: feat.charges || null,
        effects: feat.effects || [],
        source: 'class',
        class_name: cls.name,
        campaign_id: campaignId,
      }))
    );

    if (abilityRows.length > 0) {
      const { error } = await supabase.from('abilities').insert(abilityRows);
      if (error) {
        console.error('[Abilities] Error seeding class abilities:', error);
      } else {
        console.log(`[Abilities] Seeded ${abilityRows.length} class abilities`);
      }
    }
  };

  const seedAndFetchAbilities = async () => {
    await seedClassAbilitiesIfNeeded();
    await fetchAllAbilities();
  };

  const fetchAllAbilities = async () => {
    try {
      setAbilitiesLoading(true);
      const { data } = await supabase.from('abilities').select('*').eq('campaign_id', campaignId).order('name');
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
        campaign_id: campaignId,
      };

      if (selectedEditAbility) {
        const { error } = await supabase
          .from('abilities')
          .update(abilityData)
          .eq('id', selectedEditAbility.id);
        
        if (error) throw error;

        // Propagate charge changes to all characters who have this ability
        const newMax = abilityData.max_charges;
        if (newMax === null) {
          // Charges removed (infinite) â€” reset current_charges to 0
          await supabase
            .from('character_abilities')
            .update({ current_charges: 0 })
            .eq('ability_id', selectedEditAbility.id);
        } else if (
          selectedEditAbility.max_charges !== null &&
          newMax !== selectedEditAbility.max_charges
        ) {
          // max_charges changed â€” clamp existing current_charges
          const { data: charAbilities } = await supabase
            .from('character_abilities')
            .select('id, current_charges')
            .eq('ability_id', selectedEditAbility.id);
          if (charAbilities) {
            for (const ca of charAbilities) {
              const clamped = Math.min(ca.current_charges, newMax);
              if (clamped !== ca.current_charges) {
                await supabase
                  .from('character_abilities')
                  .update({ current_charges: clamped })
                  .eq('id', ca.id);
              }
            }
          }
        }

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
          source_id: null,
          campaign_id: campaignId
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
      const { data } = await supabase.from('encounters').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: false });
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
          campaign_id: campaignId,
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
    await fetchEncounterStatuses(encounter.id);
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
        campaign_id: campaignId,
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
        campaign_id: campaignId,
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
        campaign_id: campaignId,
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
              .eq('campaign_id', campaignId)
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
                  campaign_id: campaignId,
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
                  campaign_id: campaignId,
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
      
      // Also fetch item abilities from equipped items
      const { data: equippedItems } = await supabase
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
      
      // Build item abilities as CharacterAbility-like objects
      const itemAbilities: any[] = [];
      equippedItems?.forEach((invItem: any) => {
        invItem.item?.abilities?.forEach((itemAbility: any) => {
          if (itemAbility.ability) {
            // Check if this ability is already in character_abilities (avoid duplicates)
            const alreadyGranted = (abilitiesData || []).some(
              (ca: any) => ca.ability_id === itemAbility.ability.id
            );
            if (!alreadyGranted) {
              itemAbilities.push({
                id: `item_${invItem.item.id}_${itemAbility.ability.id}`,
                character_id: characterId,
                ability_id: itemAbility.ability.id,
                current_charges: itemAbility.ability.max_charges || 0,
                source_type: 'item',
                source_id: invItem.item.id,
                granted_at: invItem.acquired_at || new Date().toISOString(),
                ability: {
                  ...itemAbility.ability,
                  item_name: invItem.item.name,
                },
              });
            }
          }
        });
      });

      // Fallback: load class features from character object if auto-seeding didn't cover them
      const char2 = characters.find(c => c.id === characterId);
      const classFeatureFallback: any[] = [];
      if (char2?.class_features && Array.isArray(char2.class_features)) {
        const seededNames = new Set((abilitiesData || []).map((ca: any) => ca.ability?.name).filter(Boolean));
        // Also check item abilities we've already built
        itemAbilities.forEach((ia: any) => seededNames.add(ia.ability?.name));
        
        const typeMap: Record<string, string> = {
          'ACTION': 'action',
          'BONUS': 'bonus_action',
          'HIT/STEALTH': 'utility',
          'ON HIT': 'reaction',
          'passive': 'passive'
        };
        
        char2.class_features.forEach((feature: any, index: number) => {
          if (seededNames.has(feature.name)) return; // already in DB
          classFeatureFallback.push({
            id: `class_${index}_${feature.name}`,
            character_id: characterId,
            ability_id: `class_feature_${index}`,
            current_charges: feature.charges || 0,
            source_type: 'class',
            source_id: null,
            granted_at: new Date().toISOString(),
            ability: {
              id: `class_feature_${feature.name}`,
              name: feature.name,
              description: feature.description || '',
              type: typeMap[feature.type] || 'action',
              charge_type: feature.charges ? 'uses' : 'infinite',
              max_charges: feature.charges || null,
              effects: feature.effects || [],
              source: 'class',
              class_name: char2.class || '',
            },
          });
        });
      }

      // Only set state if this is still the current fetch
      if (combatResourcesFetchIdRef.current === characterId) {
        setCombatPlayerAbilities([...(abilitiesData || []), ...itemAbilities, ...classFeatureFallback]);
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
      // Item abilities have synthetic IDs (item_xxx_xxx) â€” only update local state
      const isItemAbility = characterAbilityId.startsWith('item_');
      
      if (!isItemAbility) {
        await supabase
          .from('character_abilities')
          .update({ current_charges: currentCharges - 1 })
          .eq('id', characterAbilityId);
      }
      
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

  // ==========================================
  // ENCOUNTER STATUS EFFECTS
  // ==========================================
  const fetchEncounterStatuses = async (encounterId: string) => {
    try {
      const { data, error } = await supabase
        .from('encounter_statuses')
        .select('*')
        .eq('encounter_id', encounterId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setEncounterStatusEffects(data || []);
    } catch (err: any) {
      console.error('Error fetching encounter statuses:', err);
    }
  };

  const addEncounterStatus = async (participantId: string) => {
    if (!activeEncounter || !newEncStatusLabel.trim()) return;
    try {
      const { error } = await supabase.from('encounter_statuses').insert({
        campaign_id: campaignId,
        encounter_id: activeEncounter.id,
        participant_id: participantId,
        label: newEncStatusLabel.trim(),
        remaining_rounds: newEncStatusDuration,
      });
      if (error) throw error;
      setNewEncStatusLabel('');
      setNewEncStatusDuration(1);
      fetchEncounterStatuses(activeEncounter.id);
    } catch (err: any) {
      console.error('Error adding status:', err);
    }
  };

  const removeEncounterStatus = async (statusId: string) => {
    if (!activeEncounter) return;
    try {
      await supabase.from('encounter_statuses').delete().eq('id', statusId);
      setEncounterStatusEffects(prev => prev.filter(s => s.id !== statusId));
    } catch (err: any) {
      console.error('Error removing status:', err);
    }
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
    
    // Auto-decrement status effects when a new round starts
    if (newRound > encounterRound) {
      await supabase.rpc('decrement_encounter_statuses', { p_encounter_id: activeEncounter.id });
      fetchEncounterStatuses(activeEncounter.id);
    }
    
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
        .eq('campaign_id', campaignId)
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
          created_by: profile?.id || null,
          campaign_id: campaignId
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
              equipped: false,
              campaign_id: campaignId
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
            equipped: false,
            campaign_id: campaignId
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
      const { data } = await supabase.from('npcs').select('*').eq('campaign_id', campaignId).order('name');
      setAllNPCs(data || []);
    } catch (err: any) {
      console.error('Error fetching NPCs:', err);
    }
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

  // ============ EFFECTS TAB FUNCTIONS ============

  const fetchActiveEffects = async () => {
    setEffectsLoading(true);
    try {
      const { data } = await supabase
        .from('game_effects')
        .select('*')
        .eq('campaign_id', campaignId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      setActiveGameEffects(data || []);
    } catch (err) {
      console.error('Error fetching effects:', err);
    } finally {
      setEffectsLoading(false);
    }
  };

  // Load effects when tab is opened
  useEffect(() => {
    if (activeTab === 'effects') {
      fetchActiveEffects();
    }
  }, [activeTab]);

  const sendEffect = async (effectType: 'blackout' | 'flash' | 'glitch' | 'media') => {
    try {
      const effectData: any = {
        effect_type: effectType,
        target_type: effectTargetType,
        target_character_ids: effectTargetType === 'select' ? effectTargetIds : [],
        is_active: true,
        campaign_id: campaignId,
      };

      if (effectType === 'media') {
        if (!mediaFile) {
          alert('Please select or paste an image/video file');
          return;
        }
        setMediaUploading(true);
        // Upload to Supabase Storage
        const fileExt = mediaFile.name.split('.').pop() || 'png';
        const fileName = `effect_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('effect-media')
          .upload(fileName, mediaFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage
          .from('effect-media')
          .getPublicUrl(fileName);
        effectData.media_url = urlData.publicUrl;
        effectData.media_type = mediaType;
        effectData.display_mode = mediaDisplayMode;
        setMediaUploading(false);
      }

      if (effectType === 'flash') {
        effectData.flash_interval_ms = flashInterval;
      }

      const { error } = await supabase.from('game_effects').insert(effectData);
      if (error) throw error;
      
      await fetchActiveEffects();
    } catch (err: any) {
      setMediaUploading(false);
      alert('Failed to send effect: ' + err.message);
    }
  };

  const clearEffect = async (effectId: string) => {
    try {
      await supabase
        .from('game_effects')
        .delete()
        .eq('id', effectId);
      await fetchActiveEffects();
    } catch (err: any) {
      alert('Failed to clear effect: ' + err.message);
    }
  };

  const clearAllEffects = async () => {
    if (!confirm('Clear ALL active screen effects?')) return;
    try {
      await supabase
        .from('game_effects')
        .delete()
        .eq('campaign_id', campaignId)
        .eq('is_active', true);
    } catch (err: any) {
      alert('Failed to clear effects: ' + err.message);
    }
  };

  const handleMediaFileSelect = (file: File) => {
    setMediaFile(file);
    // Auto-detect type
    if (file.type.startsWith('video/')) {
      setMediaType('video');
    } else {
      setMediaType('image');
    }
    // Create local preview URL
    const url = URL.createObjectURL(file);
    setMediaPreviewUrl(url);
  };

  const handleMediaPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/') || item.type.startsWith('video/')) {
        const file = item.getAsFile();
        if (file) {
          handleMediaFileSelect(file);
          e.preventDefault();
          break;
        }
      }
    }
  };

  const handleMediaDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
      handleMediaFileSelect(file);
    }
  };

  const toggleEffectTarget = (charId: string) => {
    setEffectTargetIds(prev =>
      prev.includes(charId) ? prev.filter(id => id !== charId) : [...prev, charId]
    );
  };


  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'players', label: 'PLAYERS', icon: '👥' },
    { id: 'items', label: 'ITEMS', icon: '🎒' },
    { id: 'abilities', label: 'ABILITIES', icon: '⚡' },
    { id: 'npcs', label: 'NPCs', icon: '👾' },
    { id: 'encounters', label: 'ENCOUNTERS', icon: '⚔️' },
    { id: 'missions', label: 'MISSIONS', icon: '📋' },
    { id: 'effects', label: 'EFFECTS', icon: '🎬' },
    { id: 'settings', label: 'SETTINGS', icon: '⚙️' },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, var(--color-cyber-dark) 0%, var(--color-cyber-darker) 50%, var(--color-cyber-dark) 100%)', backgroundAttachment: 'fixed' }}>

      {/* ═══════════════════ HEADER BAR ═══════════════════ */}
      <header style={{ borderBottom: '2px solid var(--color-cyber-yellow)', background: 'color-mix(in srgb, var(--color-cyber-dark) 80%, transparent)', backdropFilter: 'blur(16px)' }}>
        {/* Accent gradient line */}
        <div style={{ height: '2px', background: 'linear-gradient(90deg, var(--color-cyber-magenta), var(--color-cyber-yellow), var(--color-cyber-cyan), var(--color-cyber-yellow), var(--color-cyber-magenta))' }} />
        <div className="container mx-auto px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl tracking-wider" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-yellow)', textShadow: '0 0 20px rgba(255, 159, 28, 0.3)' }}>
              👑 DM CONTROL CENTER
            </h1>
            {/* Lock Status Badge */}
            <button
              onClick={() => togglePlayerLock(!playersLocked, playersLocked ? null : 'Manual lock')}
              disabled={lockLoading}
              className="px-3 py-1.5 rounded-full text-xs flex items-center gap-2 transition-all hover:scale-105"
              style={{
                background: playersLocked
                  ? 'color-mix(in srgb, var(--color-cyber-magenta) 25%, transparent)'
                  : 'color-mix(in srgb, var(--color-cyber-green) 15%, transparent)',
                border: `1px solid ${playersLocked ? 'var(--color-cyber-magenta)' : 'color-mix(in srgb, var(--color-cyber-cyan) 40%, transparent)'}`,
                color: playersLocked ? 'var(--color-cyber-magenta)' : 'var(--color-cyber-cyan)',
                fontFamily: 'var(--font-mono)',
                fontWeight: 'bold',
                opacity: lockLoading ? 0.5 : 1,
                boxShadow: playersLocked ? '0 0 12px rgba(217, 54, 84, 0.3)' : 'none'
              }}
              title={playersLocked ? `Players locked: ${lockReason || 'Manual'}` : 'Click to lock players'}
            >
              {playersLocked ? '🔒 LOCKED' : '🔓 UNLOCKED'}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dm/ruleset-editor')}
              className="px-3 py-1.5 rounded text-xs transition-all hover:scale-105"
              style={{ border: '1px solid var(--color-cyber-yellow)', color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)', background: 'color-mix(in srgb, var(--color-cyber-yellow) 8%, transparent)' }}
            >
              📐 RULESET
            </button>
            <button
              onClick={() => navigate('/rules')}
              className="px-3 py-1.5 rounded text-xs transition-all hover:scale-105"
              style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 50%, transparent)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', background: 'transparent' }}
            >
              📜 RULES
            </button>
            <div className="w-px h-6" style={{ background: 'color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)' }} />
            <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.7 }}>
              {profile?.username || 'DM'}
            </span>
            <button onClick={handleSignOut} className="px-3 py-1.5 rounded text-xs transition-all hover:scale-105" style={{ background: 'transparent', border: '1px solid color-mix(in srgb, var(--color-cyber-magenta) 50%, transparent)', color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>
              LOGOUT
            </button>
          </div>
        </div>
      </header>

      {/* ═══════════════════ TAB NAVIGATION ═══════════════════ */}
      <nav className="container mx-auto px-6 pt-4 pb-2">
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'color-mix(in srgb, var(--color-cyber-dark) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 12%, transparent)' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 px-3 py-2.5 text-xs rounded-md transition-all relative"
              style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: activeTab === tab.id ? 'bold' : 'normal',
                letterSpacing: '0.05em',
                background: activeTab === tab.id
                  ? 'linear-gradient(180deg, color-mix(in srgb, var(--color-cyber-yellow) 20%, transparent), color-mix(in srgb, var(--color-cyber-yellow) 8%, transparent))'
                  : 'transparent',
                color: activeTab === tab.id ? 'var(--color-cyber-yellow)' : 'color-mix(in srgb, var(--color-cyber-cyan) 60%, transparent)',
                borderBottom: activeTab === tab.id ? '2px solid var(--color-cyber-yellow)' : '2px solid transparent',
                boxShadow: activeTab === tab.id ? '0 2px 12px rgba(255, 159, 28, 0.15)' : 'none',
              }}
            >
              <span className="mr-1.5">{tab.icon}</span>{tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* ═══════════════════ MAIN CONTENT ═══════════════════ */}
      <main className="container mx-auto px-6 py-4">

        {/* ══════════ PLAYERS TAB ══════════ */}
        {activeTab === 'players' && (
          <div className="space-y-4">
            {/* Party-wide Rest Controls */}
            <div className="flex items-center justify-between p-4 rounded-lg" style={{ background: 'color-mix(in srgb, var(--color-cyber-dark) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)' }}>
              <div>
                <h3 className="text-sm tracking-wider" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>PARTY MANAGEMENT</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.4, fontFamily: 'var(--font-mono)' }}>
                  Rest affects ALL players • Long rest = 2x short rest charges
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={handleShortRestAll} className="neon-button text-xs flex items-center gap-1.5" style={{ padding: '0.5rem 1rem' }}>
                  🌙 SHORT REST
                </button>
                <button onClick={handleLongRestAll} className="px-4 py-2 rounded text-xs font-bold transition-all hover:scale-105" style={{ background: 'var(--color-cyber-yellow)', color: 'white', fontFamily: 'var(--font-mono)', boxShadow: '0 0 12px rgba(255, 159, 28, 0.2)' }}>
                  🛏️ LONG REST
                </button>
              </div>
            </div>

            {/* Character List + Details */}
            <div className="flex gap-4">
              {/* Left: Character List */}
              <div className="w-1/3 space-y-1" style={{ minWidth: '260px' }}>
                <h4 className="text-xs tracking-widest mb-3 px-1" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)', opacity: 0.6 }}>ALL CHARACTERS</h4>
                {loading ? (
                  <p className="text-sm px-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>Loading...</p>
                ) : characters.length === 0 ? (
                  <p className="text-sm px-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>No characters found</p>
                ) : (
                  <div className="space-y-1 max-h-[calc(100vh-300px)] overflow-y-auto pr-1">
                    {characters.map(char => {
                      const isSelected = selectedCharacter?.id === char.id;
                      const hpPct = char.max_hp > 0 ? (char.current_hp / char.max_hp) * 100 : 0;
                      return (
                        <div
                          key={char.id}
                          onClick={() => handleSelectCharacter(char)}
                          className="p-3 rounded-lg cursor-pointer transition-all hover:brightness-110"
                          style={{
                            border: `1px solid ${isSelected ? 'var(--color-cyber-yellow)' : 'color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)'}`,
                            background: isSelected
                              ? 'color-mix(in srgb, var(--color-cyber-yellow) 10%, transparent)'
                              : 'color-mix(in srgb, var(--color-cyber-dark) 40%, transparent)',
                            boxShadow: isSelected ? '0 0 12px rgba(255, 159, 28, 0.1)' : 'none'
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-bold text-sm" style={{ color: isSelected ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>
                              {char.name}
                            </div>
                            <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.4, fontFamily: 'var(--font-mono)' }}>
                              {char.profile?.username}
                            </span>
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6, fontFamily: 'var(--font-mono)' }}>
                            Lv{char.level} {getClassName(char.class)}
                          </div>
                          {/* Mini HP bar */}
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)' }}>
                              <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, hpPct))}%`, background: hpPct > 50 ? 'var(--color-cyber-cyan)' : hpPct > 25 ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-magenta)' }} />
                            </div>
                            <span className="text-xs flex-shrink-0" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>
                              {char.current_hp}/{char.max_hp}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right: Character Details */}
              <div className="w-2/3">
                {!selectedCharacter ? (
                  <div className="flex flex-col items-center justify-center h-full py-20 rounded-lg" style={{ border: '1px dashed color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)' }}>
                    <div className="text-4xl mb-4 opacity-20">👤</div>
                    <p className="text-sm" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)', opacity: 0.4 }}>SELECT A CHARACTER</p>
                    <p className="text-xs mt-1" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-cyber-cyan)', opacity: 0.3 }}>Click on a character to view and edit their stats</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Character Header */}
                    <div className="flex justify-between items-start p-4 rounded-lg" style={{ background: 'color-mix(in srgb, var(--color-cyber-dark) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-yellow) 30%, transparent)' }}>
                      <div>
                        <h2 className="text-xl tracking-wide" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-yellow)' }}>
                          {selectedCharacter.name}
                        </h2>
                        <p className="text-xs mt-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.6 }}>
                          Level {selectedCharacter.level} {getClassName(selectedCharacter.class)} • Player: {selectedCharacter.profile?.username}
                        </p>
                      </div>
                      {!editingStats ? (
                        <button onClick={handleStartEditing} className="px-4 py-2 rounded text-xs font-bold transition-all hover:scale-105" style={{ background: 'var(--color-cyber-yellow)', color: 'white', fontFamily: 'var(--font-mono)', boxShadow: '0 0 10px rgba(255, 159, 28, 0.2)' }}>
                          ✏️ EDIT STATS
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={handleSaveStats} className="px-4 py-2 rounded text-xs font-bold" style={{ background: 'var(--color-cyber-cyan)', color: 'white', fontFamily: 'var(--font-mono)' }}>✓ SAVE</button>
                          <button onClick={handleCancelEdit} className="px-4 py-2 rounded text-xs" style={{ background: 'transparent', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>✕ CANCEL</button>
                        </div>
                      )}
                    </div>

                    {/* Player Sub-Tabs */}
                    <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'color-mix(in srgb, var(--color-cyber-dark) 40%, transparent)' }}>
                      {[
                        { id: 'stats', label: '📊 STATS' },
                        { id: 'inventory', label: '🎒 INVENTORY' },
                        { id: 'abilities', label: '⚡ ABILITIES' },
                      ].map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setPlayerSubTab(tab.id as PlayerSubTab)}
                          className="flex-1 px-4 py-2 text-xs rounded-md transition-all"
                          style={{
                            fontFamily: 'var(--font-mono)',
                            color: playerSubTab === tab.id ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-cyan)',
                            background: playerSubTab === tab.id ? 'color-mix(in srgb, var(--color-cyber-yellow) 12%, transparent)' : 'transparent',
                            borderBottom: playerSubTab === tab.id ? '2px solid var(--color-cyber-yellow)' : '2px solid transparent',
                            fontWeight: playerSubTab === tab.id ? 'bold' : 'normal',
                            opacity: playerSubTab === tab.id ? 1 : 0.6
                          }}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* ── STATS SUB-TAB ── */}
                    {playerSubTab === 'stats' && (
                      <div className="space-y-4">
                        {/* Primary Stats Grid */}
                        <div className="grid grid-cols-3 gap-3">
                          {/* HP Card */}
                          <div className="p-4 rounded-lg" style={{ background: 'color-mix(in srgb, var(--color-cyber-dark) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-magenta) 30%, transparent)' }}>
                            <div className="text-xs mb-2 tracking-wider" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)', opacity: 0.7 }}>❤️ HEALTH POINTS</div>
                            {(() => {
                              const equippedItems = playerInventory.filter(inv => inv.is_equipped && inv.item);
                              const itemHpBonus = equippedItems.reduce((sum, inv) => sum + (inv.item?.hp_mod || 0), 0);
                              return editingStats ? (
                                <div>
                                  <div className="flex gap-2 items-center">
                                    <NumberInput value={statEdits.current_hp ?? 0} onChange={v => setStatEdits({ ...statEdits, current_hp: v })} className="w-20 px-2 py-1 rounded text-center" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }} />
                                    <span style={{ color: 'var(--color-cyber-cyan)', opacity: 0.4 }}>/</span>
                                    <NumberInput value={statEdits.max_hp ?? 0} onChange={v => setStatEdits({ ...statEdits, max_hp: v })} className="w-20 px-2 py-1 rounded text-center" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }} />
                                  </div>
                                  {itemHpBonus !== 0 && <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-yellow)' }}>+{itemHpBonus} from gear</div>}
                                </div>
                              ) : (
                                <div>
                                  <div className="text-2xl font-bold" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>{selectedCharacter.current_hp} / {selectedCharacter.max_hp + itemHpBonus}</div>
                                  {(selectedCharacter.temp_hp || 0) > 0 && <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)' }}>🛡️ +{selectedCharacter.temp_hp} Temp HP</div>}
                                  {itemHpBonus !== 0 && <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-yellow)', opacity: 0.7 }}>Base: {selectedCharacter.max_hp} + {itemHpBonus} gear</div>}
                                </div>
                              );
                            })()}
                          </div>

                          {/* AC Card */}
                          <div className="p-4 rounded-lg" style={{ background: 'color-mix(in srgb, var(--color-cyber-dark) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 25%, transparent)' }}>
                            <div className="text-xs mb-2 tracking-wider" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.7 }}>🛡️ ARMOR CLASS</div>
                            {(() => {
                              const equippedItems = playerInventory.filter(inv => inv.is_equipped && inv.item);
                              const itemAcBonus = equippedItems.reduce((sum, inv) => sum + (inv.item?.ac_mod || 0), 0);
                              return editingStats ? (
                                <div>
                                  <NumberInput value={statEdits.ac ?? 0} onChange={v => setStatEdits({ ...statEdits, ac: v })} className="w-20 px-2 py-1 rounded text-center" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }} />
                                  {itemAcBonus !== 0 && <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-yellow)' }}>+{itemAcBonus} from gear</div>}
                                </div>
                              ) : (
                                <div>
                                  <div className="text-2xl font-bold" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{selectedCharacter.ac + itemAcBonus}</div>
                                  {itemAcBonus !== 0 && <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-yellow)', opacity: 0.7 }}>Base: {selectedCharacter.ac} + {itemAcBonus} gear</div>}
                                </div>
                              );
                            })()}
                          </div>

                          {/* Credits Card */}
                          <div className="p-4 rounded-lg" style={{ background: 'color-mix(in srgb, var(--color-cyber-dark) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-yellow) 25%, transparent)' }}>
                            <div className="text-xs mb-2 tracking-wider" style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)', opacity: 0.7 }}>💰 CREDITS</div>
                            {editingStats ? (
                              <NumberInput value={statEdits.usd ?? 0} onChange={v => setStatEdits({ ...statEdits, usd: v })} className="w-28 px-2 py-1 rounded text-center" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }} />
                            ) : (
                              <div className="text-2xl font-bold" style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)' }}>${selectedCharacter.usd.toLocaleString()}</div>
                            )}
                          </div>
                        </div>

                        {/* Secondary Stats Row */}
                        <div className="grid grid-cols-5 gap-3">
                          {/* Level */}
                          <div className="p-3 rounded-lg text-center" style={{ background: 'color-mix(in srgb, var(--color-cyber-dark) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)' }}>
                            <div className="text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.5 }}>LEVEL</div>
                            {editingStats ? (
                              <NumberInput value={statEdits.level ?? 1} onChange={v => setStatEdits({ ...statEdits, level: v })} defaultValue={1} className="w-16 mx-auto px-2 py-1 rounded text-center" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }} />
                            ) : (
                              <div className="text-xl font-bold" style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)' }}>{selectedCharacter.level}</div>
                            )}
                          </div>
                          {/* Damage Die */}
                          <div className="p-3 rounded-lg text-center" style={{ background: 'color-mix(in srgb, var(--color-cyber-dark) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-magenta) 15%, transparent)' }}>
                            <div className="text-xs mb-1" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)', opacity: 0.5 }}>CDD</div>
                            {editingStats ? (
                              <select value={statEdits.cdd ?? 'd8'} onChange={e => setStatEdits({ ...statEdits, cdd: e.target.value })} className="w-16 mx-auto px-1 py-1 rounded text-center cursor-pointer" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}>
                                <option value="d4">D4</option><option value="d6">D6</option><option value="d8">D8</option><option value="d10">D10</option><option value="d12">D12</option>
                              </select>
                            ) : (
                              <div className="text-xl font-bold" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>{(selectedCharacter.cdd || 'd8').toUpperCase()}</div>
                            )}
                          </div>
                          {/* Init */}
                          <div className="p-3 rounded-lg text-center" style={{ background: 'color-mix(in srgb, var(--color-cyber-dark) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)' }}>
                            <div className="text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.5 }}>INIT</div>
                            {(() => {
                              const equippedItems = playerInventory.filter(inv => inv.is_equipped && inv.item);
                              const itemInitBonus = equippedItems.reduce((sum, inv) => sum + (inv.item?.init_mod || 0), 0);
                              const baseInit = selectedCharacter.initiative_modifier || 0;
                              const totalInit = baseInit + itemInitBonus;
                              return editingStats ? (
                                <div>
                                  <NumberInput value={statEdits.initiative_modifier ?? 0} onChange={v => setStatEdits({ ...statEdits, initiative_modifier: v })} className="w-16 mx-auto px-2 py-1 rounded text-center" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }} />
                                  {itemInitBonus !== 0 && <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-yellow)' }}>+{itemInitBonus} gear</div>}
                                </div>
                              ) : (
                                <div>
                                  <div className="text-xl font-bold" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{totalInit >= 0 ? `+${totalInit}` : totalInit}</div>
                                  {itemInitBonus !== 0 && <div className="text-xs mt-0.5" style={{ color: 'var(--color-cyber-yellow)', opacity: 0.7 }}>+{itemInitBonus} gear</div>}
                                </div>
                              );
                            })()}
                          </div>
                          {/* Speed */}
                          <div className="p-3 rounded-lg text-center" style={{ background: 'color-mix(in srgb, var(--color-cyber-dark) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)' }}>
                            <div className="text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.5 }}>SPEED</div>
                            {(() => {
                              const equippedItems = playerInventory.filter(inv => inv.is_equipped && inv.item);
                              const itemSpeedBonus = equippedItems.reduce((sum, inv) => sum + (inv.item?.speed_mod || 0), 0);
                              const baseSpeed = selectedCharacter.speed || 30;
                              const totalSpeed = baseSpeed + itemSpeedBonus;
                              return editingStats ? (
                                <div>
                                  <NumberInput value={statEdits.speed ?? 30} onChange={v => setStatEdits({ ...statEdits, speed: v })} defaultValue={30} className="w-16 mx-auto px-2 py-1 rounded text-center" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }} />
                                  {itemSpeedBonus !== 0 && <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-yellow)' }}>+{itemSpeedBonus} gear</div>}
                                </div>
                              ) : (
                                <div>
                                  <div className="text-xl font-bold" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{totalSpeed}ft</div>
                                  {itemSpeedBonus !== 0 && <div className="text-xs mt-0.5" style={{ color: 'var(--color-cyber-yellow)', opacity: 0.7 }}>+{itemSpeedBonus} gear</div>}
                                </div>
                              );
                            })()}
                          </div>
                          {/* IC */}
                          <div className="p-3 rounded-lg text-center" style={{ background: 'color-mix(in srgb, var(--color-cyber-dark) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)' }}>
                            <div className="text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.5 }}>IC</div>
                            {(() => {
                              const equippedItems = playerInventory.filter(inv => inv.is_equipped && inv.item);
                              const itemIcBonus = equippedItems.reduce((sum, inv) => sum + (inv.item?.ic_mod || 0), 0);
                              const baseIc = selectedCharacter.implant_capacity || 3;
                              const totalIc = baseIc + itemIcBonus;
                              return editingStats ? (
                                <div>
                                  <NumberInput value={statEdits.implant_capacity ?? 3} onChange={v => setStatEdits({ ...statEdits, implant_capacity: v })} defaultValue={3} className="w-16 mx-auto px-2 py-1 rounded text-center" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }} />
                                  {itemIcBonus !== 0 && <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-yellow)' }}>+{itemIcBonus} gear</div>}
                                </div>
                              ) : (
                                <div>
                                  <div className="text-xl font-bold" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{totalIc}</div>
                                  {itemIcBonus !== 0 && <div className="text-xs mt-0.5" style={{ color: 'var(--color-cyber-yellow)', opacity: 0.7 }}>+{itemIcBonus} gear</div>}
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Ability Scores */}
                        <div className="p-4 rounded-lg" style={{ background: 'color-mix(in srgb, var(--color-cyber-dark) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)' }}>
                          <div className="text-xs mb-3 tracking-wider" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.5 }}>ABILITY SCORES</div>
                          <div className="grid grid-cols-6 gap-3">
                            {(['str', 'dex', 'con', 'wis', 'int', 'cha'] as const).map(stat => {
                              const modKey = `${stat}_mod` as 'str_mod' | 'dex_mod' | 'con_mod' | 'wis_mod' | 'int_mod' | 'cha_mod';
                              const equippedItems = playerInventory.filter(inv => inv.is_equipped && inv.item);
                              const itemBonus = equippedItems.reduce((sum, inv) => sum + (inv.item?.[modKey] || 0), 0);
                              const baseValue = selectedCharacter[stat] || 0;
                              const totalValue = baseValue + itemBonus;
                              return (
                                <div key={stat} className="text-center p-2 rounded-lg" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)', background: 'color-mix(in srgb, var(--color-cyber-darker) 60%, transparent)' }}>
                                  <div className="text-xs mb-1 font-bold" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6 }}>{stat.toUpperCase()}</div>
                                  {editingStats ? (
                                    <div>
                                      <NumberInput value={statEdits[stat] ?? 0} onChange={v => setStatEdits({ ...statEdits, [stat]: v })} className="w-full px-1 py-1 rounded text-center text-lg" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }} />
                                      {itemBonus !== 0 && <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-yellow)' }}>{itemBonus > 0 ? '+' : ''}{itemBonus} gear</div>}
                                    </div>
                                  ) : (
                                    <div>
                                      <div className="text-xl font-bold" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{totalValue >= 0 ? '+' : ''}{totalValue}</div>
                                      <div className="text-xs mt-1" style={{ color: itemBonus !== 0 ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-cyan)', opacity: 0.5 }}>
                                        {baseValue}{itemBonus !== 0 ? ` + ${itemBonus > 0 ? '+' : ''}${itemBonus}` : ''}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="p-4 rounded-lg" style={{ background: 'color-mix(in srgb, var(--color-cyber-dark) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)' }}>
                          <div className="text-xs mb-3 tracking-wider" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.5 }}>QUICK ACTIONS</div>
                          <div className="flex gap-2 flex-wrap">
                            <button onClick={() => handleQuickHeal(10)} className="px-3 py-1.5 rounded text-xs font-bold" style={{ background: 'var(--color-cyber-cyan)', color: 'white', fontFamily: 'var(--font-mono)' }}>+10 HP</button>
                            <button onClick={() => handleQuickHeal(-10)} className="px-3 py-1.5 rounded text-xs font-bold" style={{ background: 'var(--color-cyber-magenta)', color: 'white', fontFamily: 'var(--font-mono)' }}>-10 HP</button>
                            <button onClick={handleFullHeal} className="px-3 py-1.5 rounded text-xs font-bold" style={{ background: 'color-mix(in srgb, var(--color-cyber-green) 30%, transparent)', color: 'var(--color-cyber-cyan)', border: '1px solid var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>FULL HEAL</button>
                          </div>
                          <div className="text-xs mt-4 mb-2 tracking-wider" style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)', opacity: 0.7 }}>
                            🛡️ TEMP HP: <span style={{ color: 'var(--color-cyber-cyan)' }}>{selectedCharacter.temp_hp || 0}</span>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            <button onClick={() => handleSetTempHp(5)} className="px-3 py-1.5 rounded text-xs font-bold" style={{ background: 'var(--color-cyber-yellow)', color: 'white', fontFamily: 'var(--font-mono)' }}>+5 THP</button>
                            <button onClick={() => handleSetTempHp(10)} className="px-3 py-1.5 rounded text-xs font-bold" style={{ background: 'var(--color-cyber-yellow)', color: 'white', fontFamily: 'var(--font-mono)' }}>+10 THP</button>
                            <button onClick={() => handleSetTempHp(-5)} className="px-3 py-1.5 rounded text-xs font-bold" style={{ background: 'var(--color-cyber-magenta)', color: 'white', fontFamily: 'var(--font-mono)' }}>-5 THP</button>
                            <button onClick={handleClearTempHp} className="px-3 py-1.5 rounded text-xs" style={{ background: 'transparent', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>CLEAR THP</button>
                          </div>
                        </div>

                        {/* Skills */}
                        <div className="p-4 rounded-lg" style={{ background: 'color-mix(in srgb, var(--color-cyber-dark) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-purple) 20%, transparent)' }}>
                          <div className="text-xs mb-3 tracking-wider" style={{ color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-mono)' }}>SKILLS <span style={{ opacity: 0.5 }}>(Points + Stat + Gear = Total)</span></div>
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
                              const equippedItems = playerInventory.filter(inv => inv.is_equipped && inv.item);
                              const itemBonus = equippedItems.reduce((sum, inv) => { const skillMods = inv.item?.skill_mods as Record<string, number> | undefined; return sum + (skillMods?.[skill.label] || 0); }, 0);
                              const rawStatValue = selectedCharacter[skill.stat as keyof Character] as number || 10;
                              const statMod = calculateStatModifier(rawStatValue);
                              const baseSkillPoints = selectedCharacter[skill.key] || 0;
                              const totalValue = baseSkillPoints + statMod + itemBonus;
                              return (
                                <div key={skill.key} className="flex flex-col p-2 rounded" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-purple) 25%, transparent)', background: 'color-mix(in srgb, var(--color-cyber-darker) 70%, transparent)' }}>
                                  <span className="text-xs truncate mb-1" style={{ color: 'var(--color-cyber-purple)', opacity: 0.8 }}>{skill.label}</span>
                                  {editingStats ? (
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1">
                                        <button onClick={() => setStatEdits({ ...statEdits, [skill.key]: Math.max(0, (statEdits[skill.key as keyof typeof statEdits] as number || 0) - 1) })} className="px-2 py-0.5 rounded text-xs" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-purple)', color: 'var(--color-cyber-purple)' }}>−</button>
                                        <span className="w-6 text-center text-sm" style={{ color: 'var(--color-cyber-cyan)' }}>{(statEdits[skill.key as keyof typeof statEdits] as number) || 0}</span>
                                        <button onClick={() => setStatEdits({ ...statEdits, [skill.key]: Math.min(10, (statEdits[skill.key as keyof typeof statEdits] as number || 0) + 1) })} className="px-2 py-0.5 rounded text-xs" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-purple)', color: 'var(--color-cyber-purple)' }}>+</button>
                                      </div>
                                      <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>{skill.stat.toUpperCase()} {formatModifier(statMod)}</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between">
                                      <span className="text-lg font-bold" style={{ color: totalValue !== 0 ? 'var(--color-cyber-cyan)' : 'var(--color-cyber-purple)', opacity: totalValue !== 0 ? 1 : 0.4 }}>{formatModifier(totalValue)}</span>
                                      <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>
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

                        {/* Weapon Proficiency Ranks */}
                        <div className="p-4 rounded-lg" style={{ background: 'color-mix(in srgb, var(--color-cyber-dark) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-magenta) 20%, transparent)' }}>
                          <div className="text-xs mb-3 tracking-wider" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>WEAPON RANKS <span style={{ opacity: 0.5 }}>(Rank 0 = −2, Rank 1-5 = +0 to +4)</span></div>
                          <div className="grid grid-cols-5 gap-3">
                            {WEAPON_TYPES.map(weapon => {
                              const rankKey = `weapon_rank_${weapon.key}` as keyof Character;
                              const currentRank = editingStats ? (statEdits[rankKey as keyof typeof statEdits] as number ?? selectedCharacter[rankKey] ?? 0) : (selectedCharacter[rankKey] as number || 0);
                              return (
                                <div key={weapon.key} className="flex flex-col items-center p-3 rounded-lg" style={{ border: `1px solid ${currentRank === 0 ? 'color-mix(in srgb, var(--color-cyber-magenta) 30%, transparent)' : 'color-mix(in srgb, var(--color-cyber-green) 40%, transparent)'}`, background: 'color-mix(in srgb, var(--color-cyber-darker) 70%, transparent)' }}>
                                  <span className="text-lg mb-1">{weapon.icon}</span>
                                  <span className="text-xs mb-1" style={{ color: currentRank === 0 ? 'var(--color-cyber-magenta)' : 'var(--color-cyber-green)', opacity: 0.8 }}>{weapon.label}</span>
                                  {editingStats ? (
                                    <div className="flex items-center gap-1">
                                      <button onClick={() => setStatEdits({ ...statEdits, [rankKey]: Math.max(0, (statEdits[rankKey as keyof typeof statEdits] as number ?? selectedCharacter[rankKey] ?? 0) - 1) })} className="px-2 py-0.5 rounded text-xs" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)' }}>−</button>
                                      <span className="w-6 text-center text-sm font-bold" style={{ color: 'var(--color-cyber-cyan)' }}>{currentRank}</span>
                                      <button onClick={() => setStatEdits({ ...statEdits, [rankKey]: Math.min(5, (statEdits[rankKey as keyof typeof statEdits] as number ?? selectedCharacter[rankKey] ?? 0) + 1) })} className="px-2 py-0.5 rounded text-xs" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)' }}>+</button>
                                    </div>
                                  ) : (
                                    <div className="text-center">
                                      <span className="text-lg font-bold" style={{ color: currentRank === 0 ? 'var(--color-cyber-magenta)' : 'var(--color-cyber-green)' }}>{formatToHit(currentRank)}</span>
                                      <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.4 }}>Rank {currentRank}</div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── INVENTORY SUB-TAB ── */}
                    {playerSubTab === 'inventory' && (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <div className="text-xs tracking-wider" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.6 }}>{playerInventory.length} ITEMS</div>
                          <button onClick={() => setShowGiveItemModal(true)} className="px-4 py-2 rounded text-xs font-bold transition-all hover:scale-105" style={{ background: 'var(--color-cyber-yellow)', color: 'white', fontFamily: 'var(--font-mono)', boxShadow: '0 0 10px rgba(255, 159, 28, 0.2)' }}>
                            + GIVE ITEM
                          </button>
                        </div>
                        {inventoryLoading ? (
                          <p className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>Loading inventory...</p>
                        ) : playerInventory.length === 0 ? (
                          <div className="text-center py-12 rounded-lg" style={{ border: '1px dashed color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)' }}>
                            <p style={{ color: 'var(--color-cyber-cyan)', opacity: 0.4, fontFamily: 'var(--font-mono)' }}>No items in inventory</p>
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                            {playerInventory.map(inv => inv.item && (
                              <div key={inv.id} className="p-4 rounded-lg transition-all" style={{ border: inv.is_equipped ? '1px solid var(--color-cyber-yellow)' : '1px solid color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)', background: inv.is_equipped ? 'color-mix(in srgb, var(--color-cyber-yellow) 6%, transparent)' : 'color-mix(in srgb, var(--color-cyber-dark) 50%, transparent)' }}>
                                <div className="flex justify-between items-start">
                                  <div className="flex items-center gap-3">
                                    <span className="text-2xl">{getItemTypeIcon(inv.item.type)}</span>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-bold text-sm" style={{ color: inv.is_equipped ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>{inv.item.name}</span>
                                        {inv.is_equipped && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--color-cyber-yellow)', color: 'white', fontWeight: 'bold', fontSize: '9px' }}>EQUIPPED</span>}
                                      </div>
                                      <div className="text-xs flex items-center gap-2 mt-1" style={{ opacity: 0.7 }}>
                                        <span style={{ color: 'var(--color-cyber-cyan)' }}>{toTitleCase(inv.item.type)}</span>
                                        <span className="px-1.5 py-0.5 rounded" style={{ background: getRarityBgColor(inv.item.rarity), color: getRarityColor(inv.item.rarity), fontSize: '9px' }}>{inv.item.rarity}</span>
                                        <span style={{ color: 'var(--color-cyber-cyan)' }}>×{inv.quantity}</span>
                                        {inv.item.price > 0 && <span style={{ color: 'var(--color-cyber-yellow)' }}>${inv.item.price}</span>}
                                      </div>
                                    </div>
                                  </div>
                                  <button onClick={() => openRemoveItemModal(inv)} className="text-xs px-2 py-1 rounded opacity-60 hover:opacity-100 transition-opacity" style={{ background: 'transparent', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)' }}>✕</button>
                                </div>
                                {inv.item.description && <p className="text-xs mt-3" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6 }}>{inv.item.description}</p>}
                                {(inv.item.ac_mod !== 0 || inv.item.hp_mod !== 0 || inv.item.str_mod !== 0 || inv.item.dex_mod !== 0 || inv.item.con_mod !== 0 || inv.item.wis_mod !== 0 || inv.item.int_mod !== 0 || inv.item.cha_mod !== 0 || inv.item.init_mod !== 0 || inv.item.speed_mod !== 0) && (
                                  <div className="flex flex-wrap gap-1 mt-3">
                                    {inv.item.ac_mod !== 0 && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)', color: 'var(--color-cyber-cyan)' }}>AC {inv.item.ac_mod > 0 ? '+' : ''}{inv.item.ac_mod}</span>}
                                    {inv.item.hp_mod !== 0 && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--color-cyber-magenta) 15%, transparent)', color: 'var(--color-cyber-magenta)' }}>HP {inv.item.hp_mod > 0 ? '+' : ''}{inv.item.hp_mod}</span>}
                                    {inv.item.str_mod !== 0 && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--color-cyber-yellow) 15%, transparent)', color: 'var(--color-cyber-yellow)' }}>STR {inv.item.str_mod > 0 ? '+' : ''}{inv.item.str_mod}</span>}
                                    {inv.item.dex_mod !== 0 && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--color-cyber-yellow) 15%, transparent)', color: 'var(--color-cyber-yellow)' }}>DEX {inv.item.dex_mod > 0 ? '+' : ''}{inv.item.dex_mod}</span>}
                                    {inv.item.con_mod !== 0 && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--color-cyber-yellow) 15%, transparent)', color: 'var(--color-cyber-yellow)' }}>CON {inv.item.con_mod > 0 ? '+' : ''}{inv.item.con_mod}</span>}
                                    {inv.item.wis_mod !== 0 && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--color-cyber-yellow) 15%, transparent)', color: 'var(--color-cyber-yellow)' }}>WIS {inv.item.wis_mod > 0 ? '+' : ''}{inv.item.wis_mod}</span>}
                                    {inv.item.int_mod !== 0 && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--color-cyber-yellow) 15%, transparent)', color: 'var(--color-cyber-yellow)' }}>INT {inv.item.int_mod > 0 ? '+' : ''}{inv.item.int_mod}</span>}
                                    {inv.item.cha_mod !== 0 && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--color-cyber-yellow) 15%, transparent)', color: 'var(--color-cyber-yellow)' }}>CHA {inv.item.cha_mod > 0 ? '+' : ''}{inv.item.cha_mod}</span>}
                                    {inv.item.init_mod !== 0 && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--color-cyber-green) 20%, transparent)', color: 'var(--color-cyber-green)' }}>INIT {inv.item.init_mod > 0 ? '+' : ''}{inv.item.init_mod}</span>}
                                    {inv.item.speed_mod !== 0 && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--color-cyber-green) 20%, transparent)', color: 'var(--color-cyber-green)' }}>SPD {inv.item.speed_mod > 0 ? '+' : ''}{inv.item.speed_mod}</span>}
                                  </div>
                                )}
                                {inv.item.abilities && inv.item.abilities.length > 0 && (
                                  <div className="mt-3 pt-3" style={{ borderTop: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)' }}>
                                    <div className="text-xs mb-2" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)', opacity: 0.7 }}>GRANTS ABILITIES:</div>
                                    <div className="space-y-1">
                                      {inv.item.abilities.map((itemAbility: any, idx: number) => itemAbility.ability && (
                                        <div key={idx} className="p-2 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-magenta) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-magenta) 20%, transparent)' }}>
                                          <div className="flex items-center gap-2">
                                            <span className="text-sm">{getAbilityTypeIcon(itemAbility.ability.type)}</span>
                                            <span className="text-xs font-bold" style={{ color: 'var(--color-cyber-magenta)' }}>{itemAbility.ability.name}</span>
                                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)', color: 'var(--color-cyber-cyan)', fontSize: '9px' }}>{toTitleCase(itemAbility.ability.type)}</span>
                                            {itemAbility.requires_equipped && <span className="text-xs" style={{ color: 'var(--color-cyber-yellow)', opacity: 0.6 }}>(when equipped)</span>}
                                          </div>
                                          {itemAbility.ability.description && <p className="text-xs mt-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>{itemAbility.ability.description}</p>}
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

                    {/* ── ABILITIES SUB-TAB ── */}
                    {playerSubTab === 'abilities' && (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <div className="text-xs tracking-wider" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.6 }}>{playerAbilities.length} ABILITIES</div>
                          <p className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.3, fontFamily: 'var(--font-mono)' }}>Use Party Rest buttons above to restore charges</p>
                        </div>
                        {playerAbilitiesLoading ? (
                          <p className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>Loading abilities...</p>
                        ) : playerAbilities.length === 0 ? (
                          <div className="text-center py-12 rounded-lg" style={{ border: '1px dashed color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)' }}>
                            <p style={{ color: 'var(--color-cyber-cyan)', opacity: 0.4, fontFamily: 'var(--font-mono)' }}>No abilities assigned</p>
                            <p className="text-xs mt-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.2 }}>Use the Abilities tab to give abilities to this character</p>
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                            {playerAbilities.map(charAbility => {
                              const isFromItem = charAbility.displaySource?.startsWith('item:');
                              const isFromClass = charAbility.displaySource === 'class';
                              const isRemovable = !isFromItem && !isFromClass;
                              const sourceLabel = isFromClass ? 'CLASS' : isFromItem ? charAbility.displaySource?.replace('item:', '📦 ') : null;
                              return (
                                <div key={charAbility.id} className="p-3 rounded-lg" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)', background: 'color-mix(in srgb, var(--color-cyber-dark) 50%, transparent)' }}>
                                  <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                      <span className="text-lg">{getAbilityTypeIcon(charAbility.ability.type)}</span>
                                      <div>
                                        <div className="font-bold text-sm" style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-cyber)' }}>{charAbility.ability.name}</div>
                                        <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6 }}>
                                          {toTitleCase(charAbility.ability.type)} • {toTitleCase(charAbility.ability.charge_type)}
                                          {sourceLabel && (
                                            <span className="ml-2 px-1.5 py-0.5 rounded text-xs" style={{ background: isFromClass ? 'color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)' : 'color-mix(in srgb, var(--color-cyber-magenta) 20%, transparent)', color: isFromClass ? 'var(--color-cyber-cyan)' : 'var(--color-cyber-magenta)' }}>
                                              {sourceLabel}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    {isRemovable && (
                                      <button onClick={() => handleRemovePlayerAbility(charAbility.id)} className="text-xs px-2 py-1 rounded opacity-60 hover:opacity-100 transition-opacity" style={{ background: 'transparent', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)' }}>✕</button>
                                    )}
                                  </div>
                                  {charAbility.ability.charge_type !== 'infinite' && (
                                    <div className="flex items-center gap-3 mt-3 pt-3" style={{ borderTop: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)' }}>
                                      <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.5 }}>CHARGES:</span>
                                      <div className="flex items-center gap-2">
                                        <button onClick={() => handleUpdateCharges(charAbility.id, charAbility.current_charges - 1)} disabled={charAbility.current_charges <= 0} className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: charAbility.current_charges <= 0 ? 'var(--color-cyber-dark)' : 'var(--color-cyber-magenta)', color: charAbility.current_charges <= 0 ? 'var(--color-cyber-green)' : 'white', opacity: charAbility.current_charges <= 0 ? 0.3 : 1 }}>−</button>
                                        <span className="w-12 text-center text-lg font-bold" style={{ color: charAbility.current_charges === 0 ? 'var(--color-cyber-magenta)' : 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)' }}>{charAbility.current_charges}/{charAbility.ability.max_charges || 0}</span>
                                        <button onClick={() => handleUpdateCharges(charAbility.id, charAbility.current_charges + 1)} disabled={charAbility.current_charges >= (charAbility.ability.max_charges || 0)} className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: charAbility.current_charges >= (charAbility.ability.max_charges || 0) ? 'var(--color-cyber-dark)' : 'var(--color-cyber-green)', color: charAbility.current_charges >= (charAbility.ability.max_charges || 0) ? 'var(--color-cyber-green)' : 'white', opacity: charAbility.current_charges >= (charAbility.ability.max_charges || 0) ? 0.3 : 1 }}>+</button>
                                      </div>
                                      <span className="text-xs ml-auto px-2 py-0.5 rounded-full" style={{ background: charAbility.ability.charge_type === 'short_rest' ? 'color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)' : 'color-mix(in srgb, var(--color-cyber-yellow) 15%, transparent)', color: charAbility.ability.charge_type === 'short_rest' ? 'var(--color-cyber-cyan)' : 'var(--color-cyber-yellow)' }}>
                                        {charAbility.ability.charge_type === 'short_rest' ? 'Short Rest' : charAbility.ability.charge_type === 'long_rest' ? 'Long Rest' : 'Uses'}
                                      </span>
                                    </div>
                                  )}
                                  {(() => {
                                    const cooldownText = getAbilityCooldownText(charAbility.ability, charAbility.current_charges);
                                    return cooldownText ? (
                                      <div className="text-xs px-2 py-1 mt-2 rounded" style={{ background: charAbility.current_charges <= 0 ? 'color-mix(in srgb, var(--color-cyber-magenta) 15%, transparent)' : 'color-mix(in srgb, var(--color-cyber-yellow) 10%, transparent)', color: charAbility.current_charges <= 0 ? 'var(--color-cyber-magenta)' : 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)' }}>
                                        {cooldownText}
                                      </div>
                                    ) : null;
                                  })()}
                                  <p className="text-xs mt-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.4 }}>{charAbility.ability.description}</p>
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


        {/* ══════════ ITEMS TAB ══════════ */}
        {activeTab === 'items' && (
          <div className="flex gap-4" style={{ height: 'calc(100vh - 180px)' }}>
            {/* Left: Items List */}
            <div className="w-1/2 flex flex-col overflow-hidden rounded-lg" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)', background: 'color-mix(in srgb, var(--color-cyber-dark) 60%, transparent)' }}>
              {/* Search & Filters */}
              <div className="p-4 space-y-3" style={{ borderBottom: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)' }}>
                <div className="flex gap-2">
                  <input type="text" placeholder="Search items..." value={itemSearchQuery} onChange={e => setItemSearchQuery(e.target.value)} className="flex-1 px-3 py-2 rounded text-sm" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }} />
                  <button onClick={() => { resetItemForm(); setItemsSubTab('create'); }} className="px-4 py-2 rounded text-xs font-bold whitespace-nowrap" style={{ background: 'var(--color-cyber-yellow)', color: 'white', fontFamily: 'var(--font-mono)', boxShadow: '0 0 10px rgba(255, 159, 28, 0.2)' }}>
                    + NEW
                  </button>
                </div>
                <div className="flex gap-2">
                  <select value={itemFilterType} onChange={e => setItemFilterType(e.target.value)} className="flex-1 px-2 py-1.5 rounded text-xs cursor-pointer" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 25%, transparent)', color: 'var(--color-cyber-cyan)' }}>
                    <option value="all">All Types</option>
                    <option value="weapon">Weapon</option>
                    <option value="armor">Armor</option>
                    <option value="consumable">Consumable</option>
                    <option value="implant">Implant</option>
                    <option value="gear">Gear</option>
                    <option value="misc">Misc</option>
                  </select>
                  <select value={itemFilterRarity} onChange={e => setItemFilterRarity(e.target.value)} className="flex-1 px-2 py-1.5 rounded text-xs cursor-pointer" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 25%, transparent)', color: 'var(--color-cyber-cyan)' }}>
                    <option value="all">All Rarities</option>
                    <option value="common">Common</option>
                    <option value="uncommon">Uncommon</option>
                    <option value="rare">Rare</option>
                    <option value="very_rare">Very Rare</option>
                    <option value="epic">Epic</option>
                    <option value="legendary">Legendary</option>
                    <option value="unique">Unique</option>
                  </select>
                </div>
              </div>
              {/* Item Grid */}
              <div className="flex-1 overflow-y-auto p-4">
                {itemsLoading ? (
                  <p className="text-sm text-center" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>Loading items...</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {filteredItemsList.map(item => (
                      <div
                        key={item.id}
                        onClick={() => loadItemForEdit(item)}
                        className="p-3 rounded-lg cursor-pointer transition-all hover:brightness-110"
                        style={{
                          border: `1px solid ${selectedEditItem?.id === item.id ? 'var(--color-cyber-yellow)' : 'color-mix(in srgb, var(--color-cyber-cyan) 12%, transparent)'}`,
                          background: selectedEditItem?.id === item.id ? 'color-mix(in srgb, var(--color-cyber-yellow) 8%, transparent)' : 'color-mix(in srgb, var(--color-cyber-darker) 60%, transparent)',
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getItemTypeIcon(item.type)}</span>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold truncate" style={{ color: selectedEditItem?.id === item.id ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>{item.name}</div>
                            <div className="text-xs flex items-center gap-1.5 mt-0.5">
                              <span style={{ color: 'var(--color-cyber-cyan)', opacity: 0.4 }}>{toTitleCase(item.type)}</span>
                              <span className="px-1 rounded" style={{ background: getRarityBgColor(item.rarity), color: getRarityColor(item.rarity), fontSize: '8px' }}>{item.rarity}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Create/Edit Form */}
            <div className="w-1/2 overflow-y-auto rounded-lg" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)', background: 'color-mix(in srgb, var(--color-cyber-dark) 60%, transparent)' }}>
              {!selectedEditItem && itemsSubTab !== 'create' ? (
                <div className="flex flex-col items-center justify-center h-full py-20">
                  <div className="text-4xl mb-4 opacity-20">🎒</div>
                  <p className="text-sm" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)', opacity: 0.4 }}>SELECT OR CREATE AN ITEM</p>
                </div>
              ) : (
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm tracking-wider" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-yellow)' }}>
                      {selectedEditItem ? '✏️ EDIT ITEM' : '➕ CREATE ITEM'}
                    </h3>
                    {selectedEditItem && (
                      <button onClick={() => { resetItemForm(); setItemsSubTab('create'); }} className="text-xs px-2 py-1 rounded" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)', color: 'var(--color-cyber-cyan)', opacity: 0.6 }}>
                        ➕ New Item
                      </button>
                    )}
                  </div>

                  {/* Basic Info */}
                  <div className="space-y-3">
                    <input type="text" placeholder="Item name..." value={itemName} onChange={e => setItemName(e.target.value)} className="w-full px-4 py-2.5 rounded text-sm" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }} />
                    <textarea placeholder="Item description..." value={itemDescription} onChange={e => setItemDescription(e.target.value)} rows={3} className="w-full px-4 py-2.5 rounded text-sm resize-none" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }} />
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs mb-1 block" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>TYPE</label>
                        <select value={itemType} onChange={e => setItemType(e.target.value as any)} className="w-full px-2 py-2 rounded text-xs cursor-pointer" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 25%, transparent)', color: 'var(--color-cyber-cyan)' }}>
                          <option value="weapon">Weapon</option>
                          <option value="armor">Armor</option>
                          <option value="consumable">Consumable</option>
                          <option value="implant">Implant</option>
                          <option value="gear">Gear</option>
                          <option value="misc">Misc</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs mb-1 block" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>RARITY</label>
                        <select value={itemRarity} onChange={e => setItemRarity(e.target.value as any)} className="w-full px-2 py-2 rounded text-xs cursor-pointer" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 25%, transparent)', color: 'var(--color-cyber-cyan)' }}>
                          <option value="common">Common</option>
                          <option value="uncommon">Uncommon</option>
                          <option value="rare">Rare</option>
                          <option value="very_rare">Very Rare</option>
                          <option value="epic">Epic</option>
                          <option value="legendary">Legendary</option>
                          <option value="unique">Unique</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs mb-1 block" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>PRICE</label>
                        <NumberInput value={itemPrice} onChange={setItemPrice} defaultValue={0} className="w-full px-2 py-2 rounded text-xs" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 25%, transparent)', color: 'var(--color-cyber-cyan)' }} />
                      </div>
                    </div>
                  </div>

                  {/* Conditional Fields */}
                  {itemType === 'armor' && (
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>ARMOR SUBTYPE</label>
                      <select value={itemArmorSubtype || ''} onChange={e => setItemArmorSubtype(e.target.value as any)} className="w-full px-2 py-2 rounded text-xs cursor-pointer" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 25%, transparent)', color: 'var(--color-cyber-cyan)' }}>
                        <option value="">None</option>
                        <option value="light">Light</option>
                        <option value="medium">Medium</option>
                        <option value="heavy">Heavy</option>
                        <option value="shield">Shield</option>
                        <option value="helmet">Helmet</option>
                      </select>
                    </div>
                  )}
                  {itemType === 'weapon' && (
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>WEAPON SUBTYPE</label>
                      <select value={itemWeaponSubtype || ''} onChange={e => setItemWeaponSubtype(e.target.value as any)} className="w-full px-2 py-2 rounded text-xs cursor-pointer" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 25%, transparent)', color: 'var(--color-cyber-cyan)' }}>
                        <option value="">None</option>
                        <option value="unarmed">Unarmed</option>
                        <option value="melee">Melee</option>
                        <option value="sidearms">Sidearms</option>
                        <option value="longarms">Longarms</option>
                        <option value="heavy">Heavy</option>
                      </select>
                    </div>
                  )}
                  {(itemType as string) === 'implant' && (
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>IC COST</label>
                      <NumberInput value={itemIcCost} onChange={setItemIcCost} defaultValue={1} className="w-20 px-2 py-2 rounded text-xs" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 25%, transparent)', color: 'var(--color-cyber-cyan)' }} />
                    </div>
                  )}

                  {/* Equippable / Consumable */}
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={itemIsEquippable} onChange={e => setItemIsEquippable(e.target.checked)} className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: 'var(--color-cyber-cyan)' }} />
                      <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>Equippable</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={itemIsConsumable} onChange={e => setItemIsConsumable(e.target.checked)} className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: 'var(--color-cyber-cyan)' }} />
                      <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>Consumable</span>
                    </label>
                  </div>

                  {/* Stat Modifiers */}
                  <div className="p-4 rounded-lg" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)', background: 'color-mix(in srgb, var(--color-cyber-darker) 60%, transparent)' }}>
                    <div className="text-xs mb-3 tracking-wider" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.5 }}>STAT MODIFIERS</div>
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
                      ].map(mod => (
                        <div key={mod.label} className="flex flex-col items-center p-2 rounded" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)' }}>
                          <span className="text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>{mod.label}</span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => mod.setter(mod.value - 1)} className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)', color: 'var(--color-cyber-cyan)' }}>−</button>
                            <span className="w-8 text-center text-sm font-bold" style={{ color: mod.value !== 0 ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-cyan)', opacity: mod.value !== 0 ? 1 : 0.3 }}>{mod.value}</span>
                            <button onClick={() => mod.setter(mod.value + 1)} className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)', color: 'var(--color-cyber-cyan)' }}>+</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {[
                        { label: 'SPEED', value: itemSpeedMod, setter: setItemSpeedMod },
                        { label: 'INIT', value: itemInitMod, setter: setItemInitMod },
                        { label: 'IC', value: itemIcMod, setter: setItemIcMod },
                      ].map(mod => (
                        <div key={mod.label} className="flex flex-col items-center p-2 rounded" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)' }}>
                          <span className="text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>{mod.label}</span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => mod.setter(mod.value - 1)} className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)', color: 'var(--color-cyber-cyan)' }}>−</button>
                            <span className="w-8 text-center text-sm font-bold" style={{ color: mod.value !== 0 ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-cyan)', opacity: mod.value !== 0 ? 1 : 0.3 }}>{mod.value}</span>
                            <button onClick={() => mod.setter(mod.value + 1)} className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)', color: 'var(--color-cyber-cyan)' }}>+</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* HP Mod Type */}
                  {(itemIsConsumable || itemHpMod !== 0) && (
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>HP MOD TYPE</label>
                      <select value={itemHpModType} onChange={e => setItemHpModType(e.target.value as any)} className="w-full px-2 py-2 rounded text-xs cursor-pointer" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 25%, transparent)', color: 'var(--color-cyber-cyan)' }}>
                        <option value="heal">Heal (restores current HP)</option>
                        <option value="max_hp">Max HP (increases maximum)</option>
                      </select>
                    </div>
                  )}

                  {/* Skill Bonuses */}
                  <div className="p-4 rounded-lg" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-purple) 15%, transparent)', background: 'color-mix(in srgb, var(--color-cyber-darker) 60%, transparent)' }}>
                    <div className="text-xs mb-3 tracking-wider" style={{ color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-mono)', opacity: 0.5 }}>SKILL BONUSES</div>
                    <div className="grid grid-cols-3 gap-1 max-h-[200px] overflow-y-auto">
                      {ALL_SKILLS.map(skill => (
                        <div key={skill} className="flex items-center justify-between p-1.5 rounded" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-purple) 10%, transparent)' }}>
                          <span className="text-xs truncate mr-2" style={{ color: 'var(--color-cyber-purple)', opacity: 0.6 }}>{skill}</span>
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <button onClick={() => handleItemSkillMod(skill, ((itemSkillMods as Record<string, number>)?.[skill] || 0) - 1)} className="px-1 py-0.5 rounded text-xs" style={{ background: 'var(--color-cyber-darker)', color: 'var(--color-cyber-purple)' }}>−</button>
                            <span className="w-6 text-center text-xs" style={{ color: ((itemSkillMods as Record<string, number>)?.[skill] || 0) !== 0 ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-cyan)', opacity: ((itemSkillMods as Record<string, number>)?.[skill] || 0) !== 0 ? 1 : 0.3 }}>{(itemSkillMods as Record<string, number>)?.[skill] || 0}</span>
                            <button onClick={() => handleItemSkillMod(skill, ((itemSkillMods as Record<string, number>)?.[skill] || 0) + 1)} className="px-1 py-0.5 rounded text-xs" style={{ background: 'var(--color-cyber-darker)', color: 'var(--color-cyber-purple)' }}>+</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Linked Abilities */}
                  <div className="p-4 rounded-lg" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-magenta) 15%, transparent)', background: 'color-mix(in srgb, var(--color-cyber-darker) 60%, transparent)' }}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs tracking-wider" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)', opacity: 0.5 }}>LINKED ABILITIES</span>
                      <button onClick={() => setShowLinkAbilityModal(true)} className="px-2 py-1 rounded text-xs" style={{ border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>+ LINK</button>
                    </div>
                    {itemLinkedAbilities.length === 0 ? (
                      <p className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.3 }}>No linked abilities</p>
                    ) : (
                      <div className="space-y-2">
                        {itemLinkedAbilities.map((la, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 rounded" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-magenta) 20%, transparent)' }}>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold" style={{ color: 'var(--color-cyber-magenta)' }}>{la.ability?.name || la.ability_id}</span>
                              <label className="flex items-center gap-1 cursor-pointer">
                                <input type="checkbox" checked={la.requires_equipped} onChange={e => { const updated = [...itemLinkedAbilities]; updated[idx] = { ...la, requires_equipped: e.target.checked }; setItemLinkedAbilities(updated); }} className="w-3 h-3" style={{ accentColor: 'var(--color-cyber-yellow)' }} />
                                <span className="text-xs" style={{ color: 'var(--color-cyber-yellow)', opacity: 0.6 }}>Requires Equip</span>
                              </label>
                            </div>
                            <button onClick={() => setItemLinkedAbilities(itemLinkedAbilities.filter((_, i) => i !== idx))} className="text-xs px-1.5 py-0.5 rounded" style={{ color: 'var(--color-cyber-magenta)', opacity: 0.6 }}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Item Preview */}
                  <div className="p-4 rounded-lg" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)', background: 'color-mix(in srgb, var(--color-cyber-darker) 70%, transparent)' }}>
                    <div className="text-xs mb-2 tracking-wider" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.5 }}>PREVIEW</div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{getItemTypeIcon(itemType)}</span>
                      <div>
                        <span className="font-bold text-sm" style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-cyber)' }}>{itemName || 'Unnamed Item'}</span>
                        <div className="text-xs flex items-center gap-1.5">
                          <span style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>{toTitleCase(itemType)}</span>
                          <span className="px-1 rounded" style={{ background: getRarityBgColor(itemRarity), color: getRarityColor(itemRarity), fontSize: '8px' }}>{itemRarity}</span>
                          {itemPrice > 0 && <span style={{ color: 'var(--color-cyber-yellow)' }}>${itemPrice}</span>}
                        </div>
                      </div>
                    </div>
                    {itemDescription && <p className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>{itemDescription}</p>}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <button onClick={handleSaveItem} disabled={itemSaving || !itemName.trim()} className="flex-1 py-3 rounded text-sm font-bold transition-all" style={{ background: itemSaving || !itemName.trim() ? 'var(--color-cyber-dark)' : 'var(--color-cyber-yellow)', color: itemSaving || !itemName.trim() ? 'var(--color-cyber-green)' : 'white', fontFamily: 'var(--font-mono)', opacity: itemSaving || !itemName.trim() ? 0.5 : 1, boxShadow: itemSaving || !itemName.trim() ? 'none' : '0 0 15px rgba(255, 159, 28, 0.2)' }}>
                      {itemSaving ? 'SAVING...' : selectedEditItem ? 'UPDATE ITEM' : 'CREATE ITEM'}
                    </button>
                    {selectedEditItem && (
                      <button onClick={() => handleDeleteItem(selectedEditItem.id, selectedEditItem.name)} className="px-6 py-3 rounded text-sm font-bold" style={{ background: 'var(--color-cyber-magenta)', color: 'white', fontFamily: 'var(--font-mono)' }}>🗑️ DELETE</button>
                    )}
                    <button onClick={resetItemForm} className="px-6 py-3 rounded text-sm" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.6 }}>RESET</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════ ABILITIES TAB ══════════ */}
        {activeTab === 'abilities' && (
          <div className="flex gap-4" style={{ height: 'calc(100vh - 180px)' }}>
            {/* Left: Abilities List */}
            <div className="w-1/2 flex flex-col overflow-hidden rounded-lg" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)', background: 'color-mix(in srgb, var(--color-cyber-dark) 60%, transparent)' }}>
              <div className="p-4 space-y-3" style={{ borderBottom: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)' }}>
                <div className="flex gap-2">
                  <input type="text" placeholder="Search abilities..." value={abilitySearchQuery} onChange={e => setAbilitySearchQuery(e.target.value)} className="flex-1 px-3 py-2 rounded text-sm" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }} />
                  <button onClick={() => { resetAbilityForm(); setAbilitiesSubTab('create'); }} className="px-4 py-2 rounded text-xs font-bold whitespace-nowrap" style={{ background: 'var(--color-cyber-yellow)', color: 'white', fontFamily: 'var(--font-mono)', boxShadow: '0 0 10px rgba(255, 159, 28, 0.2)' }}>
                    + NEW
                  </button>
                  <button onClick={() => setShowGiveAbilityModal(true)} className="px-4 py-2 rounded text-xs font-bold whitespace-nowrap" style={{ background: 'var(--color-cyber-cyan)', color: 'white', fontFamily: 'var(--font-mono)' }}>
                    🎁 GIVE
                  </button>
                </div>
                <div className="flex gap-2">
                  <select value={abilityFilterSource} onChange={e => setAbilityFilterSource(e.target.value as any)} className="flex-1 px-2 py-1.5 rounded text-xs cursor-pointer" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 25%, transparent)', color: 'var(--color-cyber-cyan)' }}>
                    <option value="all">All Sources</option>
                    <option value="custom">Custom</option>
                    <option value="class">Class</option>
                  </select>
                  <select value={abilityFilterType} onChange={e => setAbilityFilterType(e.target.value)} className="flex-1 px-2 py-1.5 rounded text-xs cursor-pointer" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 25%, transparent)', color: 'var(--color-cyber-cyan)' }}>
                    <option value="all">All Types</option>
                    <option value="active">Active</option>
                    <option value="passive">Passive</option>
                    <option value="reaction">Reaction</option>
                    <option value="bonus">Bonus</option>
                    <option value="special">Special</option>
                  </select>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {abilitiesLoading ? (
                  <p className="text-sm text-center" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>Loading abilities...</p>
                ) : filteredAbilitiesList.length === 0 ? (
                  <p className="text-sm text-center" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>No abilities found</p>
                ) : (
                  filteredAbilitiesList.map(ability => (
                    <div
                      key={ability.id}
                      onClick={() => loadAbilityForEdit(ability)}
                      className="p-3 rounded-lg cursor-pointer transition-all hover:brightness-110"
                      style={{
                        border: `1px solid ${selectedEditAbility?.id === ability.id ? 'var(--color-cyber-yellow)' : 'color-mix(in srgb, var(--color-cyber-cyan) 12%, transparent)'}`,
                        background: selectedEditAbility?.id === ability.id ? 'color-mix(in srgb, var(--color-cyber-yellow) 8%, transparent)' : 'color-mix(in srgb, var(--color-cyber-darker) 60%, transparent)',
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getAbilityTypeIcon(ability.type)}</span>
                        <div>
                          <div className="text-xs font-bold" style={{ color: selectedEditAbility?.id === ability.id ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>{ability.name}</div>
                          <div className="text-xs flex items-center gap-1.5 mt-0.5">
                            <span style={{ color: 'var(--color-cyber-cyan)', opacity: 0.4 }}>{toTitleCase(ability.type)}</span>
                            <span style={{ color: 'var(--color-cyber-cyan)', opacity: 0.4 }}>•</span>
                            <span style={{ color: ability.source === 'class' ? 'var(--color-cyber-magenta)' : 'var(--color-cyber-cyan)', opacity: 0.6 }}>{toTitleCase(ability.source || '')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right: Create/Edit Form */}
            <div className="w-1/2 overflow-y-auto rounded-lg" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)', background: 'color-mix(in srgb, var(--color-cyber-dark) 60%, transparent)' }}>
              {!selectedEditAbility && abilitiesSubTab !== 'create' ? (
                <div className="flex flex-col items-center justify-center h-full py-20">
                  <div className="text-4xl mb-4 opacity-20">⚡</div>
                  <p className="text-sm" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)', opacity: 0.4 }}>SELECT OR CREATE AN ABILITY</p>
                </div>
              ) : (
                <div className="p-6 space-y-4">
                  <h3 className="text-sm tracking-wider" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-yellow)' }}>
                    {selectedEditAbility ? '✏️ EDIT ABILITY' : '➕ CREATE ABILITY'}
                  </h3>

                  {/* Basic Info */}
                  <input type="text" placeholder="Ability name..." value={abilityName} onChange={e => setAbilityName(e.target.value)} className="w-full px-4 py-2.5 rounded text-sm" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }} />
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>TYPE</label>
                      <select value={abilityType} onChange={e => setAbilityType(e.target.value as any)} className="w-full px-2 py-2 rounded text-xs cursor-pointer" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 25%, transparent)', color: 'var(--color-cyber-cyan)' }}>
                        <option value="active">Active</option>
                        <option value="passive">Passive</option>
                        <option value="reaction">Reaction</option>
                        <option value="bonus">Bonus</option>
                        <option value="special">Special</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>SOURCE</label>
                      <select value={abilitySource} onChange={e => setAbilitySource(e.target.value as any)} className="w-full px-2 py-2 rounded text-xs cursor-pointer" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 25%, transparent)', color: 'var(--color-cyber-cyan)' }}>
                        <option value="custom">Custom</option>
                        <option value="class">Class</option>
                      </select>
                    </div>
                    {abilitySource === 'class' && (
                      <div>
                        <label className="text-xs mb-1 block" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>CLASS</label>
                        <select value={abilityClassName} onChange={e => setAbilityClassName(e.target.value)} className="w-full px-2 py-2 rounded text-xs cursor-pointer" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 25%, transparent)', color: 'var(--color-cyber-cyan)' }}>
                          <option value="">Select class...</option>
                          {CHARACTER_CLASSES.map(cls => (
                            <option key={cls.id} value={cls.id}>{getClassName(cls.id)}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  <textarea placeholder="Description..." value={abilityDescription} onChange={e => setAbilityDescription(e.target.value)} rows={3} className="w-full px-4 py-2.5 rounded text-sm resize-none" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }} />

                  {/* Charges */}
                  <div className="p-3 rounded-lg" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-yellow) 15%, transparent)', background: 'color-mix(in srgb, var(--color-cyber-darker) 60%, transparent)' }}>
                    <div className="text-xs mb-2" style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)', opacity: 0.5 }}>CHARGE SYSTEM</div>
                    <div className="flex gap-3 items-center">
                      <select value={abilityChargeType} onChange={e => setAbilityChargeType(e.target.value as any)} className="flex-1 px-2 py-2 rounded text-xs cursor-pointer" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 25%, transparent)', color: 'var(--color-cyber-cyan)' }}>
                        <option value="infinite">Infinite</option>
                        <option value="short_rest">Short Rest</option>
                        <option value="long_rest">Long Rest</option>
                        <option value="uses">Uses (One-time)</option>
                      </select>
                      {abilityChargeType !== 'infinite' && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>MAX:</span>
                          <NumberInput value={abilityMaxCharges || 0} onChange={setAbilityMaxCharges} defaultValue={1} className="w-16 px-2 py-2 rounded text-xs text-center" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Effects */}
                  <div className="p-3 rounded-lg" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-magenta) 15%, transparent)', background: 'color-mix(in srgb, var(--color-cyber-darker) 60%, transparent)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)', opacity: 0.5 }}>EFFECTS</span>
                      <button onClick={handleAddAbilityEffect} className="text-xs px-2 py-1 rounded" style={{ border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)' }}>+ ADD</button>
                    </div>
                    <div className="space-y-2">
                      {abilityEffects.map((effect, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <input type="text" value={effect} onChange={e => handleAbilityEffectChange(idx, e.target.value)} placeholder="Effect description..." className="flex-1 px-3 py-1.5 rounded text-xs" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-magenta) 25%, transparent)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }} />
                          <button onClick={() => handleRemoveAbilityEffect(idx)} className="text-xs px-1.5 py-0.5 rounded" style={{ color: 'var(--color-cyber-magenta)', opacity: 0.6 }}>✕</button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Combat Info */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>DAMAGE DICE</label>
                      <input type="text" value={abilityDamageDice} onChange={e => setAbilityDamageDice(e.target.value)} placeholder="e.g. 2d6" className="w-full px-3 py-2 rounded text-xs" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 25%, transparent)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }} />
                    </div>
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>DAMAGE TYPE</label>
                      <input type="text" value={abilityDamageType} onChange={e => setAbilityDamageType(e.target.value)} placeholder="e.g. fire" className="w-full px-3 py-2 rounded text-xs" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 25%, transparent)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }} />
                    </div>
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>RANGE</label>
                      <input type="text" value={abilityRange ?? ''} onChange={e => setAbilityRange(e.target.value as any)} placeholder="e.g. 60ft" className="w-full px-3 py-2 rounded text-xs" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 25%, transparent)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }} />
                    </div>
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>AOE</label>
                      <input type="text" value={abilityAoE} onChange={e => setAbilityAoE(e.target.value)} placeholder="e.g. 15ft cone" className="w-full px-3 py-2 rounded text-xs" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 25%, transparent)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>DURATION</label>
                    <input type="text" value={abilityDuration} onChange={e => setAbilityDuration(e.target.value)} placeholder="e.g. 1 minute" className="w-full px-3 py-2 rounded text-xs" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 25%, transparent)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }} />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <button onClick={handleSaveAbility} disabled={abilitySaving || !abilityName.trim()} className="flex-1 py-3 rounded text-sm font-bold transition-all" style={{ background: abilitySaving || !abilityName.trim() ? 'var(--color-cyber-dark)' : 'var(--color-cyber-yellow)', color: abilitySaving || !abilityName.trim() ? 'var(--color-cyber-green)' : 'white', fontFamily: 'var(--font-mono)', opacity: abilitySaving || !abilityName.trim() ? 0.5 : 1 }}>
                      {abilitySaving ? 'SAVING...' : selectedEditAbility ? 'UPDATE ABILITY' : 'CREATE ABILITY'}
                    </button>
                    {selectedEditAbility && (
                      <button onClick={() => handleDeleteAbility(selectedEditAbility.id, selectedEditAbility.name)} className="px-6 py-3 rounded text-sm font-bold" style={{ background: 'var(--color-cyber-magenta)', color: 'white', fontFamily: 'var(--font-mono)' }}>🗑️ DELETE</button>
                    )}
                    <button onClick={resetAbilityForm} className="px-6 py-3 rounded text-sm" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.6 }}>RESET</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════ NPCs TAB ══════════ */}
        {activeTab === 'npcs' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 rounded-lg" style={{ background: 'color-mix(in srgb, var(--color-cyber-dark) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)' }}>
              <div>
                <h3 className="text-lg tracking-wider" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>NPC DATABASE</h3>
                <p className="text-xs mt-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.4, fontFamily: 'var(--font-mono)' }}>
                  {allNPCs.length} NPCs registered • Use the full NPC Manager for detailed editing
                </p>
              </div>
              <button onClick={() => navigate('/dm/npcs')} className="px-6 py-3 rounded text-sm font-bold transition-all hover:scale-105" style={{ background: 'var(--color-cyber-yellow)', color: 'white', fontFamily: 'var(--font-mono)', boxShadow: '0 0 15px rgba(255, 159, 28, 0.2)' }}>
                🔧 OPEN NPC MANAGER
              </button>
            </div>

            {/* NPC Quick Overview */}
            {allNPCs.length === 0 ? (
              <div className="text-center py-20 rounded-lg" style={{ border: '1px dashed color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)' }}>
                <div className="text-4xl mb-4 opacity-20">👾</div>
                <p style={{ color: 'var(--color-cyber-cyan)', opacity: 0.4, fontFamily: 'var(--font-mono)' }}>No NPCs created yet</p>
                <p className="text-xs mt-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.2 }}>Use the NPC Manager to create enemies, allies, and other characters</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 max-h-[calc(100vh-280px)] overflow-y-auto">
                {allNPCs.map(npc => (
                  <div key={npc.id} className="p-4 rounded-lg transition-all hover:brightness-110" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)', background: 'color-mix(in srgb, var(--color-cyber-dark) 50%, transparent)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>{npc.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `color-mix(in srgb, ${getNpcTypeColor(npc.type)} 20%, transparent)`, color: getNpcTypeColor(npc.type) }}>
                        {npc.type}
                      </span>
                    </div>
                    <div className="flex gap-4 text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
                      <span style={{ color: 'var(--color-cyber-magenta)' }}>HP: {npc.current_hp || '?'}/{npc.max_hp || '?'}</span>
                      <span style={{ color: 'var(--color-cyber-cyan)' }}>AC: {npc.ac || '?'}</span>
                    </div>
                    {npc.three_words && (
                      <p className="text-xs mt-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.4, fontStyle: 'italic' }}>{npc.three_words}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}


        {/* ══════════ ENCOUNTERS TAB ══════════ */}
        {activeTab === 'encounters' && (
          <div className="flex flex-col" style={{ height: 'calc(100vh - 180px)' }}>
            {/* Encounter Command Bar */}
            <div className="flex items-center gap-3 p-4 rounded-t-lg" style={{ background: 'color-mix(in srgb, var(--color-cyber-dark) 70%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-magenta) 30%, transparent)', borderBottom: '2px solid var(--color-cyber-magenta)' }}>
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
                className="px-3 py-2 rounded text-sm min-w-[220px] cursor-pointer"
                style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}
              >
                <option value="">-- Select Encounter --</option>
                {allEncounters.map(enc => (
                  <option key={enc.id} value={enc.id}>
                    {enc.name} [{enc.status.toUpperCase()}]
                  </option>
                ))}
              </select>

              <button onClick={() => setShowCreateEncounterModal(true)} className="px-3 py-2 rounded text-xs font-bold transition-all hover:scale-105" style={{ background: 'var(--color-cyber-yellow)', color: 'white', fontFamily: 'var(--font-mono)' }}>
                ➕ NEW
              </button>

              {activeEncounter && (
                <button onClick={() => handleDeleteEncounter(activeEncounter.id, activeEncounter.name)} className="px-2 py-2 rounded text-xs" style={{ border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)' }}>
                  🗑️
                </button>
              )}

              <div className="flex-1" />

              {/* Status & Round Info */}
              {activeEncounter && (
                <>
                  <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: getStatusColor(activeEncounter.status), color: 'white', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' as const }}>
                    {activeEncounter.status}
                  </span>

                  {activeEncounter.status === 'active' && (
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>ROUND</div>
                        <div className="text-xl font-bold" style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-cyber)' }}>{encounterRound}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>TURN</div>
                        <div className="text-xl font-bold" style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-cyber)' }}>{encounterCurrentTurn + 1}/{combatParticipants.filter(p => p.isActive).length}</div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Action Buttons */}
              {activeEncounter?.status === 'draft' && (
                <div className="flex gap-2">
                  <button onClick={() => setShowAddParticipantModal(true)} className="px-3 py-1.5 rounded text-xs font-bold" style={{ border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                    ➕ ADD COMBATANT
                  </button>
                  <button onClick={sortParticipantsByInitiative} className="px-3 py-1.5 rounded text-xs font-bold" style={{ border: '1px solid var(--color-cyber-purple)', color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-mono)' }}>
                    ⬇️ SORT INIT
                  </button>
                  <button onClick={startEncounter} className="px-4 py-1.5 rounded text-xs font-bold transition-all hover:scale-105" style={{ background: 'var(--color-cyber-cyan)', color: 'white', fontFamily: 'var(--font-mono)', boxShadow: '0 0 12px rgba(64, 224, 208, 0.2)' }}>
                    ▶️ START COMBAT
                  </button>
                </div>
              )}
              {activeEncounter?.status === 'active' && (
                <div className="flex gap-2">
                  <button onClick={() => setShowAddParticipantModal(true)} className="px-2 py-1.5 rounded text-xs" style={{ border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                    ➕ ADD
                  </button>
                  <button onClick={prevTurn} className="px-3 py-1.5 rounded text-xs font-bold" style={{ border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>◀</button>
                  <button onClick={nextTurn} className="px-4 py-1.5 rounded text-xs font-bold transition-all hover:scale-105" style={{ background: 'var(--color-cyber-yellow)', color: 'white', fontFamily: 'var(--font-mono)', boxShadow: '0 0 12px rgba(255, 159, 28, 0.2)' }}>⏩ NEXT TURN</button>
                  <button onClick={endEncounter} className="px-3 py-1.5 rounded text-xs font-bold" style={{ background: 'var(--color-cyber-magenta)', color: 'white', fontFamily: 'var(--font-mono)' }}>⏹️ END</button>
                </div>
              )}
            </div>

            {/* Main Content: Initiative Sidebar + Details Panel */}
            {activeEncounter ? (
              <div className="flex gap-4 flex-1 overflow-hidden mt-4">
                {/* LEFT: Initiative Order */}
                <div className="w-1/3 flex flex-col overflow-hidden rounded-lg" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-magenta) 40%, transparent)', background: 'color-mix(in srgb, var(--color-cyber-dark) 60%, transparent)', minWidth: '280px' }}>
                  <div className="flex items-center justify-between p-3" style={{ borderBottom: '1px solid color-mix(in srgb, var(--color-cyber-magenta) 20%, transparent)' }}>
                    <h4 className="text-xs tracking-wider" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-magenta)' }}>INITIATIVE ORDER</h4>
                    <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>{combatParticipants.length}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {participantsLoading ? (
                      <div className="text-center py-4" style={{ color: 'var(--color-cyber-cyan)' }}>Loading...</div>
                    ) : combatParticipants.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>No combatants</p>
                        <button onClick={() => setShowAddParticipantModal(true)} className="px-3 py-1.5 rounded text-xs mt-2" style={{ border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}>
                          ➕ Add
                        </button>
                      </div>
                    ) : (
                      combatParticipants.map((p) => {
                        const activeParticipants = combatParticipants.filter(pp => pp.isActive);
                        const isCurrentTurn = activeEncounter.status === 'active' && activeParticipants[encounterCurrentTurn]?.id === p.id;
                        const isSelected = p.id === selectedCombatParticipantId;
                        const hpPct = p.maxHp > 0 ? (p.currentHp / p.maxHp) * 100 : 0;
                        const isDead = p.currentHp <= 0;

                        return (
                          <div
                            key={p.id}
                            onClick={() => selectCombatParticipant(p)}
                            className="rounded-lg cursor-pointer transition-all relative overflow-hidden"
                            style={{
                              background: isCurrentTurn
                                ? 'color-mix(in srgb, var(--color-cyber-yellow) 15%, transparent)'
                                : isSelected
                                  ? 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)'
                                  : 'color-mix(in srgb, var(--color-cyber-darker) 90%, transparent)',
                              border: `1px solid ${isCurrentTurn ? 'var(--color-cyber-yellow)' : isSelected ? 'var(--color-cyber-cyan)' : 'color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)'}`,
                              opacity: isDead ? 0.4 : p.isActive ? 1 : 0.5,
                              boxShadow: isCurrentTurn ? '0 0 12px rgba(255, 159, 28, 0.15)' : 'none'
                            }}
                          >
                            {isCurrentTurn && <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: 'var(--color-cyber-yellow)' }} />}
                            <div className="p-2 pl-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                                  style={{
                                    background: isCurrentTurn ? 'var(--color-cyber-yellow)' : 'color-mix(in srgb, var(--color-cyber-purple) 30%, transparent)',
                                    color: isCurrentTurn ? 'white' : 'var(--color-cyber-purple)',
                                    fontFamily: 'var(--font-mono)',
                                    border: `1px solid ${isCurrentTurn ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-purple)'}`
                                  }}>
                                  {p.initiative ?? '?'}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1">
                                    <span className="text-sm">{p.type === 'player' ? '👤' : '👹'}</span>
                                    <span className="font-bold text-sm truncate" style={{ color: p.type === 'player' ? 'var(--color-cyber-cyan)' : 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>
                                      {p.name}
                                    </span>
                                    {isDead && <span className="text-xs">💀</span>}
                                    {isCurrentTurn && <span className="text-xs ml-auto animate-pulse" style={{ color: 'var(--color-cyber-yellow)' }}>◄ TURN</span>}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)' }}>
                                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, hpPct))}%`, background: getHpBarColor(p.currentHp, p.maxHp) }} />
                                    </div>
                                    <span className="text-xs flex-shrink-0" style={{ color: getHpBarColor(p.currentHp, p.maxHp), fontFamily: 'var(--font-mono)' }}>
                                      {p.currentHp}/{p.maxHp}
                                    </span>
                                  </div>
                                </div>
                              </div>
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
                              {encounterStatusEffects.filter(s => s.participant_id === p.id).length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1 pl-10">
                                  {encounterStatusEffects.filter(s => s.participant_id === p.id).map(s => (
                                    <span key={s.id} className="text-xs px-1 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-magenta) 25%, transparent)', color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)', border: '1px solid color-mix(in srgb, var(--color-cyber-magenta) 40%, transparent)' }}>
                                      {s.label} ({s.remaining_rounds}r)
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* RIGHT: Participant Details */}
                <div className="w-2/3 overflow-y-auto rounded-lg" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-magenta) 30%, transparent)', background: 'color-mix(in srgb, var(--color-cyber-dark) 60%, transparent)' }}>
                  {(() => {
                    const selectedP = combatParticipants.find(p => p.id === selectedCombatParticipantId);
                    if (!selectedP) {
                      return (
                        <div className="flex flex-col items-center justify-center h-full py-20">
                          <div className="text-5xl mb-4 opacity-20">⚔️</div>
                          <p className="text-sm" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)', opacity: 0.4 }}>SELECT A COMBATANT</p>
                          <p className="text-xs mt-1" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-cyber-cyan)', opacity: 0.3 }}>Click on a participant from the initiative order</p>
                        </div>
                      );
                    }

                    const entityData = selectedP.entityData;
                    const isPlayer = selectedP.type === 'player';

                    return (
                      <div className="p-5 space-y-4">
                        {/* Header */}
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-xl" style={{ fontFamily: 'var(--font-cyber)', color: isPlayer ? 'var(--color-cyber-cyan)' : 'var(--color-cyber-magenta)' }}>
                              {isPlayer ? '👤' : '👹'} {selectedP.name}
                            </h3>
                            <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                              {selectedP.type.toUpperCase()}
                              {entityData && 'class' in entityData && ` • ${(entityData as any).class} • Level ${(entityData as any).level}`}
                              {entityData && 'type' in entityData && !('class' in entityData) && ` • ${(entityData as any).type}`}
                              {entityData && 'disposition' in entityData && ` • ${(entityData as any).disposition}`}
                            </div>
                          </div>
                          <button onClick={() => removeParticipantFromEncounter(selectedP.id)} className="px-3 py-1 rounded text-xs transition-all hover:scale-105" style={{ border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>
                            REMOVE
                          </button>
                        </div>

                        {/* DM Notes */}
                        <div className="p-3 rounded-lg" style={{ background: 'color-mix(in srgb, var(--color-cyber-darker) 70%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 25%, transparent)' }}>
                          <div className="text-xs mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.6 }}>📝 DM NOTES</div>
                          <textarea
                            value={notesInput[selectedP.id] !== undefined ? notesInput[selectedP.id] : selectedP.notes}
                            onChange={e => handleNotesChange(selectedP.id, e.target.value)}
                            placeholder="Combat notes... (auto-saves)"
                            rows={2}
                            className="w-full px-3 py-2 rounded text-sm resize-none"
                            style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}
                          />
                        </div>

                        {/* Status Effects */}
                        <div className="p-3 rounded-lg" style={{ background: 'color-mix(in srgb, var(--color-cyber-darker) 70%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-magenta) 25%, transparent)' }}>
                          <div className="text-xs mb-2" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>🔴 STATUS EFFECTS</div>
                          <div className="flex flex-wrap gap-2 mb-3">
                            {encounterStatusEffects.filter(s => s.participant_id === selectedP.id).map(s => (
                              <div key={s.id} className="flex items-center gap-1 px-2 py-1 rounded text-xs" style={{ background: 'color-mix(in srgb, var(--color-cyber-magenta) 20%, transparent)', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>
                                <span>{s.label}</span>
                                <span style={{ opacity: 0.6 }}>({s.remaining_rounds}r)</span>
                                <button onClick={() => removeEncounterStatus(s.id)} className="ml-1 hover:opacity-100" style={{ opacity: 0.6 }}>✕</button>
                              </div>
                            ))}
                            {encounterStatusEffects.filter(s => s.participant_id === selectedP.id).length === 0 && (
                              <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.4, fontFamily: 'var(--font-mono)' }}>No active effects</span>
                            )}
                          </div>
                          {activeEncounter?.status !== 'completed' && (
                            <div className="flex items-center gap-2">
                              <input type="text" value={newEncStatusLabel} onChange={(e) => setNewEncStatusLabel(e.target.value)} placeholder="e.g. Poison 3 DMG, Stunned..." className="flex-1 px-2 py-1.5 rounded text-xs" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-magenta) 40%, transparent)', color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }} />
                              <div className="flex items-center gap-1">
                                <input type="number" min={1} max={99} value={newEncStatusDuration} onChange={(e) => setNewEncStatusDuration(parseInt(e.target.value) || 1)} className="w-12 px-1 py-1.5 rounded text-xs text-center" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-magenta) 40%, transparent)', color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }} />
                                <span className="text-xs" style={{ color: 'var(--color-cyber-magenta)', opacity: 0.6 }}>r</span>
                              </div>
                              <button onClick={() => addEncounterStatus(selectedP.id)} disabled={!newEncStatusLabel.trim()} className="px-3 py-1.5 rounded text-xs font-bold" style={{ border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)', opacity: newEncStatusLabel.trim() ? 1 : 0.4, fontFamily: 'var(--font-mono)' }}>
                                + ADD
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Combat Stats */}
                        <div className="grid grid-cols-4 gap-3">
                          {/* HP */}
                          <div className="col-span-2 p-4 rounded-lg" style={{ background: 'color-mix(in srgb, var(--color-cyber-darker) 70%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-magenta) 30%, transparent)' }}>
                            <div className="text-xs mb-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>HIT POINTS</div>
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-3xl font-bold" style={{ color: getHpBarColor(selectedP.currentHp, selectedP.maxHp), fontFamily: 'var(--font-cyber)' }}>{selectedP.currentHp}</span>
                              <span className="text-lg" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>/</span>
                              <span className="text-lg" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{selectedP.maxHp}</span>
                            </div>
                            <div className="h-3 rounded-full overflow-hidden mb-3" style={{ background: 'color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)' }}>
                              <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, (selectedP.currentHp / selectedP.maxHp) * 100))}%`, background: getHpBarColor(selectedP.currentHp, selectedP.maxHp) }} />
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => { const val = parseInt(hpChangeInput[selectedP.id] || '0'); if (val > 0) applyHpChange(selectedP, -val); }} className="px-3 py-1.5 rounded text-xs font-bold" style={{ background: 'var(--color-cyber-magenta)', color: 'white', fontFamily: 'var(--font-mono)' }}>− DMG</button>
                              <input type="number" value={hpChangeInput[selectedP.id] || ''} onChange={e => setHpChangeInput(prev => ({ ...prev, [selectedP.id]: e.target.value }))} placeholder="±" className="w-16 px-1 py-1.5 rounded text-center text-sm" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }} min="0" />
                              <button onClick={() => { const val = parseInt(hpChangeInput[selectedP.id] || '0'); if (val > 0) applyHpChange(selectedP, val); }} className="px-3 py-1.5 rounded text-xs font-bold" style={{ background: 'color-mix(in srgb, var(--color-cyber-green) 60%, transparent)', color: 'white', fontFamily: 'var(--font-mono)' }}>+ HEAL</button>
                              <button onClick={() => { updateParticipantHp(selectedP.id, selectedP.maxHp, selectedP.entityId, selectedP.type); }} className="px-2 py-1.5 rounded text-xs ml-auto" style={{ border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }} title="Full Heal">MAX</button>
                            </div>
                          </div>
                          {/* AC */}
                          <div className="p-4 rounded-lg text-center" style={{ background: 'color-mix(in srgb, var(--color-cyber-darker) 70%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 25%, transparent)' }}>
                            <div className="text-xs mb-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>ARMOR CLASS</div>
                            <div className="text-4xl font-bold" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>{selectedP.ac}</div>
                          </div>
                          {/* Initiative */}
                          <div className="p-4 rounded-lg text-center" style={{ background: 'color-mix(in srgb, var(--color-cyber-darker) 70%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-purple) 25%, transparent)' }}>
                            <div className="text-xs mb-2" style={{ color: 'var(--color-cyber-purple)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>INITIATIVE</div>
                            <NumberInput value={selectedP.initiative ?? 0} onChange={v => updateParticipantInitiative(selectedP.id, v)} className="w-16 text-center text-3xl font-bold rounded mx-auto block" style={{ background: 'transparent', color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-cyber)', border: 'none' }} placeholder="?" />
                          </div>
                        </div>

                        {/* Attributes */}
                        {entityData && (
                          <div className="p-3 rounded-lg" style={{ background: 'color-mix(in srgb, var(--color-cyber-darker) 70%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-purple) 20%, transparent)' }}>
                            <div className="text-xs mb-2" style={{ color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-mono)', opacity: 0.6 }}>ATTRIBUTES</div>
                            <div className="grid grid-cols-6 gap-2">
                              {(['str', 'dex', 'con', 'wis', 'int', 'cha'] as const).map(stat => {
                                const value = (entityData as any)?.[stat] || 0;
                                return (
                                  <div key={stat} className="text-center p-2 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-purple) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-purple) 20%, transparent)' }}>
                                    <div className="text-xs font-bold uppercase" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>{stat}</div>
                                    <div className="text-xl font-bold" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>{value >= 0 ? '+' : ''}{value}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Player Abilities */}
                        {isPlayer && combatPlayerAbilities.length > 0 && (
                          <div className="p-3 rounded-lg" style={{ background: 'color-mix(in srgb, var(--color-cyber-darker) 70%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-green) 25%, transparent)' }}>
                            <div className="text-xs mb-3" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>⚡ ABILITIES ({combatPlayerAbilities.length})</div>
                            <div className="space-y-2">
                              {combatPlayerAbilities.map((ca: any) => (
                                <div key={ca.id} className="p-3 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-green) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-green) 20%, transparent)' }}>
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-bold text-sm" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>{ca.ability?.name}</span>
                                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--color-cyber-purple)', color: 'white' }}>{ca.ability?.type?.replace('_', ' ')}</span>
                                        {ca.ability?.source && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)', color: 'var(--color-cyber-cyan)' }}>{ca.ability.source}{ca.ability.class_name ? `: ${ca.ability.class_name}` : ''}</span>}
                                        {ca.ability?.item_name && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-yellow) 20%, transparent)', color: 'var(--color-cyber-yellow)' }}>🔧 {ca.ability.item_name}</span>}
                                      </div>
                                      <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>{ca.ability?.description}</div>
                                      <div className="flex flex-wrap gap-2 mt-1">
                                        {ca.ability?.damage_dice && <span className="text-xs" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>🎯 {ca.ability.damage_dice} {ca.ability.damage_type || ''}</span>}
                                        {ca.ability?.range_feet && <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6, fontFamily: 'var(--font-mono)' }}>📏 {ca.ability.range_feet}ft</span>}
                                        {ca.ability?.area_of_effect && <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6, fontFamily: 'var(--font-mono)' }}>💥 {ca.ability.area_of_effect}</span>}
                                        {ca.ability?.duration && <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6, fontFamily: 'var(--font-mono)' }}>⏱ {ca.ability.duration}</span>}
                                      </div>
                                      {ca.ability?.effects && ca.ability.effects.length > 0 && (
                                        <div className="mt-1">{ca.ability.effects.map((eff: string, i: number) => (<div key={i} className="text-xs" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>• {eff}</div>))}</div>
                                      )}
                                    </div>
                                    {ca.ability?.charge_type !== 'infinite' && (
                                      <div className="flex flex-col items-center gap-1 ml-3 flex-shrink-0">
                                        <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>CHARGES</div>
                                        <div className="text-lg font-bold" style={{ color: ca.current_charges > 0 ? 'var(--color-cyber-green)' : 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>{ca.current_charges}/{ca.ability?.max_charges || '?'}</div>
                                        {activeEncounter.status === 'active' && (
                                          <button onClick={() => useCombatAbilityCharge(ca.id, ca.ability?.name, ca.current_charges)} disabled={ca.current_charges <= 0} className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: ca.current_charges > 0 ? 'var(--color-cyber-green)' : 'transparent', color: ca.current_charges > 0 ? 'white' : 'var(--color-cyber-cyan)', border: ca.current_charges > 0 ? 'none' : '1px solid var(--color-cyber-cyan)', opacity: ca.current_charges > 0 ? 1 : 0.4 }}>USE</button>
                                        )}
                                        {(() => { const cooldownText = getAbilityCooldownText(ca.ability, ca.current_charges); return cooldownText ? (<div className="text-xs mt-1" style={{ color: ca.current_charges <= 0 ? 'var(--color-cyber-magenta)' : 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)' }}>{cooldownText}</div>) : null; })()}
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
                          <div className="p-3 rounded-lg" style={{ background: 'color-mix(in srgb, var(--color-cyber-darker) 70%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-yellow) 25%, transparent)' }}>
                            <div className="text-xs mb-3" style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)' }}>🍴 CONSUMABLES ({combatPlayerInventory.filter(inv => inv.item?.is_consumable).length})</div>
                            <div className="space-y-1">
                              {combatPlayerInventory.filter(inv => inv.item?.is_consumable).map(inv => (
                                <div key={inv.id} className="flex items-center justify-between p-2 rounded" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-yellow) 30%, transparent)', background: 'color-mix(in srgb, var(--color-cyber-darker) 90%, transparent)' }}>
                                  <div>
                                    <span className="font-bold text-sm" style={{ color: 'var(--color-cyber-yellow)' }}>{inv.item?.name}</span>
                                    <span className="text-xs ml-2" style={{ color: 'var(--color-cyber-cyan)' }}>x{inv.quantity}</span>
                                    {inv.item?.hp_mod !== 0 && (<span className="text-xs ml-2" style={{ color: 'var(--color-cyber-green)' }}>{inv.item?.hp_mod_type === 'heal' ? `❤️+${inv.item?.hp_mod}` : `❤️ Max +${inv.item?.hp_mod}`}</span>)}
                                  </div>
                                  <button onClick={() => useCombatConsumable(inv.id, inv.item, selectedP.entityId)} className="px-3 py-1 rounded text-xs font-bold" style={{ background: 'var(--color-cyber-yellow)', color: 'white', fontFamily: 'var(--font-mono)' }}>USE</button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {isPlayer && combatResourcesLoading && (
                          <div className="text-center py-4" style={{ color: 'var(--color-cyber-cyan)' }}>Loading abilities & inventory...</div>
                        )}

                        {/* NPC Abilities */}
                        {!isPlayer && entityData && 'abilities' in entityData && (entityData as NPC).abilities?.length > 0 && (
                          <div className="p-3 rounded-lg" style={{ background: 'color-mix(in srgb, var(--color-cyber-darker) 70%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-green) 25%, transparent)' }}>
                            <div className="text-xs mb-3" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>NPC ABILITIES ({(entityData as NPC).abilities.length})</div>
                            <div className="space-y-2">
                              {(entityData as NPC).abilities.map((ability, idx) => (
                                <div key={idx} className="p-3 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-magenta) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-magenta) 20%, transparent)' }}>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>{ability.name}</span>
                                    {ability.damage && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--color-cyber-magenta)', color: 'white' }}>{ability.damage}</span>}
                                  </div>
                                  {ability.effect && <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>{ability.effect}</div>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* NPC Details */}
                        {!isPlayer && entityData && 'description' in entityData && (
                          <div className="p-3 rounded-lg" style={{ background: 'color-mix(in srgb, var(--color-cyber-darker) 70%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)' }}>
                            <div className="text-xs mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.6 }}>NPC DETAILS</div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              {(entityData as any).description && (<div className="col-span-2"><span className="text-xs" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>Description: </span><span style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{(entityData as any).description}</span></div>)}
                              {(entityData as any).three_words && (<div><span className="text-xs" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>3 Words: </span><span style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{(entityData as any).three_words}</span></div>)}
                              {(entityData as any).speech_pattern && (<div><span className="text-xs" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>Speech: </span><span style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{(entityData as any).speech_pattern}</span></div>)}
                              {(entityData as any).drops_on_defeat && (<div className="col-span-2"><span className="text-xs" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>Drops: </span><span style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>${(entityData as any).drops_on_defeat.usd}{(entityData as any).drops_on_defeat.items?.length > 0 && ` + ${(entityData as any).drops_on_defeat.items.join(', ')}`}</span></div>)}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center mt-4 rounded-lg" style={{ border: '1px dashed color-mix(in srgb, var(--color-cyber-magenta) 30%, transparent)', background: 'color-mix(in srgb, var(--color-cyber-dark) 40%, transparent)' }}>
                <div className="text-center py-20">
                  <div className="text-5xl mb-4 opacity-20">⚔️</div>
                  <p className="text-sm" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)', opacity: 0.4 }}>SELECT AN ENCOUNTER</p>
                  <p className="text-xs mt-1" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-cyber-cyan)', opacity: 0.3 }}>Choose from the dropdown above or create a new one</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════ MISSIONS TAB ══════════ */}
        {activeTab === 'missions' && (
          <div className="flex gap-6" style={{ height: 'calc(100vh - 180px)' }}>
            {/* Left: Mission List */}
            <div className="w-1/3 flex flex-col overflow-hidden rounded-lg" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)', background: 'color-mix(in srgb, var(--color-cyber-dark) 60%, transparent)' }}>
              <div className="p-4 space-y-3" style={{ borderBottom: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)' }}>
                <div className="flex gap-2">
                  <input type="text" placeholder="Search missions..." value={missionSearchQuery} onChange={e => setMissionSearchQuery(e.target.value)} className="flex-1 px-3 py-2 rounded text-sm" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }} />
                  <button onClick={() => { resetMissionForm(); setShowCreateMissionModal(true); }} className="px-4 py-2 rounded text-xs font-bold whitespace-nowrap" style={{ background: 'var(--color-cyber-yellow)', color: 'white', fontFamily: 'var(--font-mono)', boxShadow: '0 0 10px rgba(255, 159, 28, 0.2)' }}>
                    + NEW
                  </button>
                </div>
                <div className="flex gap-2">
                  <select value={missionFilterStatus} onChange={e => setMissionFilterStatus(e.target.value as any)} className="flex-1 px-2 py-1.5 rounded text-xs cursor-pointer" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 25%, transparent)', color: 'var(--color-cyber-cyan)' }}>
                    <option value="all">All Status</option>
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                  </select>
                  <select value={missionFilterType} onChange={e => setMissionFilterType(e.target.value as any)} className="flex-1 px-2 py-1.5 rounded text-xs cursor-pointer" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 25%, transparent)', color: 'var(--color-cyber-cyan)' }}>
                    <option value="all">All Types</option>
                    {MISSION_TYPES.map(t => (<option key={t} value={t}>{toTitleCase(t)}</option>))}
                  </select>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {missionsLoading ? (
                  <p className="text-sm text-center" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>Loading missions...</p>
                ) : filteredMissionsList.length === 0 ? (
                  <p className="text-sm text-center" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>No missions found</p>
                ) : (
                  filteredMissionsList.map(mission => (
                    <div
                      key={mission.id}
                      onClick={() => setSelectedMission(mission)}
                      className="p-3 rounded-lg cursor-pointer transition-all hover:brightness-110"
                      style={{
                        border: `1px solid ${selectedMission?.id === mission.id ? 'var(--color-cyber-yellow)' : 'color-mix(in srgb, var(--color-cyber-cyan) 12%, transparent)'}`,
                        background: selectedMission?.id === mission.id ? 'color-mix(in srgb, var(--color-cyber-yellow) 8%, transparent)' : 'color-mix(in srgb, var(--color-cyber-darker) 60%, transparent)',
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold" style={{ color: selectedMission?.id === mission.id ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>{mission.title}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `color-mix(in srgb, ${getMissionTypeColor(mission.type)} 20%, transparent)`, color: getMissionTypeColor(mission.type) }}>{toTitleCase(mission.type)}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `color-mix(in srgb, ${getMissionStatusColor(mission.status)} 20%, transparent)`, color: getMissionStatusColor(mission.status) }}>{toTitleCase(mission.status)}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `color-mix(in srgb, ${getDifficultyColor(mission.difficulty)} 20%, transparent)`, color: getDifficultyColor(mission.difficulty) }}>{toTitleCase(mission.difficulty)}</span>
                      </div>
                      {(mission.assigned_to?.length ?? 0) > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {mission.assigned_to?.map(charId => {
                            const char = characters.find(c => c.id === charId);
                            return char ? <span key={charId} className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)', color: 'var(--color-cyber-cyan)' }}>{char.name}</span> : null;
                          })}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right: Mission Detail */}
            <div className="w-2/3 overflow-y-auto rounded-lg" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)', background: 'color-mix(in srgb, var(--color-cyber-dark) 60%, transparent)' }}>
              {!selectedMission ? (
                <div className="flex flex-col items-center justify-center h-full py-20">
                  <div className="text-4xl mb-4 opacity-20">📋</div>
                  <p className="text-sm" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)', opacity: 0.4 }}>SELECT A MISSION</p>
                </div>
              ) : (
                <div className="p-6 space-y-4">
                  {/* Mission Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-yellow)' }}>{selectedMission.title}</h3>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs px-2 py-1 rounded" style={{ background: `color-mix(in srgb, ${getMissionTypeColor(selectedMission.type)} 20%, transparent)`, color: getMissionTypeColor(selectedMission.type), fontFamily: 'var(--font-mono)' }}>{toTitleCase(selectedMission.type)}</span>
                        <span className="text-xs px-2 py-1 rounded" style={{ background: `color-mix(in srgb, ${getMissionStatusColor(selectedMission.status)} 20%, transparent)`, color: getMissionStatusColor(selectedMission.status), fontFamily: 'var(--font-mono)' }}>{toTitleCase(selectedMission.status)}</span>
                        <span className="text-xs px-2 py-1 rounded" style={{ background: `color-mix(in srgb, ${getDifficultyColor(selectedMission.difficulty)} 20%, transparent)`, color: getDifficultyColor(selectedMission.difficulty), fontFamily: 'var(--font-mono)' }}>{toTitleCase(selectedMission.difficulty)}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleEditMission(selectedMission)} className="px-3 py-1.5 rounded text-xs font-bold" style={{ border: '1px solid var(--color-cyber-yellow)', color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)' }}>✏️ EDIT</button>
                      <button onClick={() => handleDeleteMission(selectedMission.id)} className="px-3 py-1.5 rounded text-xs" style={{ border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>🗑️</button>
                    </div>
                  </div>

                  {/* Status Actions */}
                  <div className="flex gap-2 flex-wrap">
                    {['draft', 'active', 'completed', 'failed'].map(status => (
                      <button key={status} onClick={() => handleUpdateMissionStatus(selectedMission.id, status as MissionStatus)} disabled={selectedMission.status === status} className="px-3 py-1.5 rounded text-xs font-bold transition-all" style={{ background: selectedMission.status === status ? getMissionStatusColor(status as MissionStatus) : 'transparent', color: selectedMission.status === status ? 'white' : getMissionStatusColor(status as MissionStatus), border: `1px solid ${getMissionStatusColor(status as MissionStatus)}`, opacity: selectedMission.status === status ? 1 : 0.6, fontFamily: 'var(--font-mono)' }}>
                        {toTitleCase(status)}
                      </button>
                    ))}
                  </div>

                  {/* Description */}
                  {selectedMission.description && (
                    <div className="p-4 rounded-lg" style={{ background: 'color-mix(in srgb, var(--color-cyber-darker) 70%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)' }}>
                      <div className="text-xs mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.5 }}>DESCRIPTION</div>
                      <p className="text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{selectedMission.description}</p>
                    </div>
                  )}

                  {/* Objectives */}
                  {(selectedMission.objectives?.length ?? 0) > 0 && (
                    <div className="p-4 rounded-lg" style={{ background: 'color-mix(in srgb, var(--color-cyber-darker) 70%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)' }}>
                      <div className="text-xs mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.5 }}>OBJECTIVES</div>
                      <div className="space-y-1">
                        {selectedMission.objectives.map((obj: string, idx: number) => (
                          <div key={idx} className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                            <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs" style={{ background: 'color-mix(in srgb, var(--color-cyber-yellow) 20%, transparent)', color: 'var(--color-cyber-yellow)', fontWeight: 'bold' }}>{idx + 1}</span>
                            {obj}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Assigned Characters */}
                  {(selectedMission.assigned_to?.length ?? 0) > 0 && (
                    <div className="p-4 rounded-lg" style={{ background: 'color-mix(in srgb, var(--color-cyber-darker) 70%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)' }}>
                      <div className="text-xs mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.5 }}>ASSIGNED</div>
                      <div className="flex flex-wrap gap-2">
                        {selectedMission.assigned_to?.map(charId => {
                          const char = characters.find(c => c.id === charId);
                          return char ? <span key={charId} className="text-sm px-3 py-1 rounded-full" style={{ background: 'color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)', color: 'var(--color-cyber-cyan)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)', fontFamily: 'var(--font-mono)' }}>👤 {char.name}</span> : null;
                        })}
                      </div>
                    </div>
                  )}

                  {/* Rewards */}
                  {(selectedMission.reward_credits > 0 || (selectedMission.reward_items?.length ?? 0) > 0) && (
                    <div className="p-4 rounded-lg" style={{ background: 'color-mix(in srgb, var(--color-cyber-darker) 70%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-yellow) 25%, transparent)' }}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="text-xs" style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)' }}>🏆 REWARDS</div>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--color-cyber-yellow) 15%, transparent)', color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)' }}>
                          {selectedMission.reward_mode === 'each' ? 'Per Player' : 'Shared'}
                        </span>
                      </div>
                      {selectedMission.reward_credits > 0 && (
                        <div className="text-sm mb-2" style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)' }}>💰 ${selectedMission.reward_credits.toLocaleString()} credits</div>
                      )}
                      {(selectedMission.reward_items?.length ?? 0) > 0 && (
                        <div className="space-y-1">
                          {selectedMission.reward_items?.map((item: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 text-sm">
                              <span>{getItemTypeIcon(item.type)}</span>
                              <span style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{item.name}</span>
                              <span className="px-1 rounded" style={{ background: getRarityBgColor(item.rarity), color: getRarityColor(item.rarity), fontSize: '9px' }}>{item.rarity}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}


          {/* ═══════════════════ EFFECTS TAB ═══════════════════ */}
          {activeTab === 'effects' && (
            <div className="max-w-5xl mx-auto space-y-6">
              {/* Header */}
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl tracking-wider" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-magenta)', textShadow: '0 0 15px rgba(217, 54, 84, 0.3)' }}>
                    🎬 SCREEN EFFECTS
                  </h2>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                    Override player screens with visual effects
                  </p>
                </div>
                {activeGameEffects.length > 0 && (
                  <button
                    onClick={clearAllEffects}
                    className="neon-button-magenta text-sm font-bold flex items-center gap-2"
                  >
                    ⛔ CLEAR ALL ({activeGameEffects.length})
                  </button>
                )}
              </div>

              {/* Active Effects Banner */}
              {activeGameEffects.length > 0 && (
                <div className="rounded-lg p-4" style={{ background: 'color-mix(in srgb, var(--color-cyber-magenta) 8%, transparent)', border: '2px solid var(--color-cyber-magenta)', boxShadow: 'var(--shadow-neon-magenta)' }}>
                  <h3 className="text-xs font-bold mb-3 tracking-widest" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>
                    ⚡ ACTIVE EFFECTS
                  </h3>
                  <div className="space-y-2">
                    {activeGameEffects.map(effect => (
                      <div key={effect.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'color-mix(in srgb, var(--color-cyber-darker) 90%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-magenta) 40%, transparent)' }}>
                        <div className="flex items-center gap-3">
                          <span className="text-lg">
                            {effect.effect_type === 'blackout' && '⬛'}
                            {effect.effect_type === 'flash' && '💡'}
                            {effect.effect_type === 'glitch' && '📺'}
                            {effect.effect_type === 'media' && '🖼️'}
                          </span>
                          <div>
                            <span className="font-bold text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                              {effect.effect_type === 'blackout' && 'BLACKOUT'}
                              {effect.effect_type === 'flash' && 'FLASH'}
                              {effect.effect_type === 'glitch' && 'GLITCH'}
                              {effect.effect_type === 'media' && `MEDIA (${effect.display_mode})`}
                            </span>
                            <span className="text-xs ml-3" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                              → {effect.target_type === 'all' ? 'ALL PLAYERS' : `${effect.target_character_ids.length} player(s)`}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => clearEffect(effect.id)}
                          className="px-3 py-1.5 rounded text-xs font-bold transition-all hover:scale-105"
                          style={{ background: 'var(--color-cyber-magenta)', color: 'white' }}
                        >
                          ■ STOP
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Target Selection */}
              <div className="glass-panel p-5" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 40%, transparent)' }}>
                <h3 className="text-xs font-bold mb-3 tracking-widest" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                  🎯 TARGET SELECTION
                </h3>
                <div className="flex gap-3 mb-3">
                  <button
                    onClick={() => setEffectTargetType('all')}
                    className="px-5 py-2 rounded-lg text-sm font-bold transition-all"
                    style={{
                      background: effectTargetType === 'all' ? 'var(--color-cyber-cyan)' : 'transparent',
                      color: effectTargetType === 'all' ? 'var(--color-cyber-darker)' : 'var(--color-cyber-cyan)',
                      border: '1px solid var(--color-cyber-cyan)',
                      fontFamily: 'var(--font-mono)'
                    }}
                  >
                    👥 ALL PLAYERS
                  </button>
                  <button
                    onClick={() => setEffectTargetType('select')}
                    className="px-5 py-2 rounded-lg text-sm font-bold transition-all"
                    style={{
                      background: effectTargetType === 'select' ? 'var(--color-cyber-yellow)' : 'transparent',
                      color: effectTargetType === 'select' ? 'white' : 'var(--color-cyber-yellow)',
                      border: '1px solid var(--color-cyber-yellow)',
                      fontFamily: 'var(--font-mono)'
                    }}
                  >
                    🎯 SELECT PLAYERS
                  </button>
                </div>
                {effectTargetType === 'select' && (
                  <div className="flex flex-wrap gap-2 pt-2" style={{ borderTop: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)' }}>
                    {characters.map(char => (
                      <button
                        key={char.id}
                        onClick={() => toggleEffectTarget(char.id)}
                        className="px-3 py-1.5 rounded-full text-xs font-bold transition-all hover:scale-105"
                        style={{
                          background: effectTargetIds.includes(char.id) ? 'var(--color-cyber-cyan)' : 'transparent',
                          color: effectTargetIds.includes(char.id) ? 'var(--color-cyber-darker)' : 'var(--color-cyber-cyan)',
                          border: `1px solid ${effectTargetIds.includes(char.id) ? 'var(--color-cyber-cyan)' : 'color-mix(in srgb, var(--color-cyber-cyan) 40%, transparent)'}`,
                          fontFamily: 'var(--font-mono)'
                        }}
                      >
                        {effectTargetIds.includes(char.id) ? '✓ ' : ''}{char.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Effect Controls Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                {/* BLACKOUT */}
                <div className="glass-panel p-5 flex flex-col" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)' }}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">⬛</span>
                    <div>
                      <h3 className="text-sm font-bold" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>BLACKOUT</h3>
                      <p className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>Solid black overlay — players see nothing</p>
                    </div>
                  </div>
                  <div className="flex-1" />
                  <button
                    onClick={() => sendEffect('blackout')}
                    className="w-full px-4 py-3 rounded-lg font-bold text-sm transition-all hover:brightness-110"
                    style={{ background: '#222', color: '#fff', border: '2px solid var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}
                  >
                    ▶ ACTIVATE
                  </button>
                </div>

                {/* GLITCH */}
                <div className="glass-panel p-5 flex flex-col" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-magenta) 30%, transparent)' }}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">📺</span>
                    <div>
                      <h3 className="text-sm font-bold" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-magenta)' }}>GLITCH</h3>
                      <p className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>Visual noise, scanlines & color distortion</p>
                    </div>
                  </div>
                  <div className="flex-1" />
                  <button
                    onClick={() => sendEffect('glitch')}
                    className="w-full px-4 py-3 rounded-lg font-bold text-sm transition-all hover:brightness-110"
                    style={{ background: 'var(--color-cyber-magenta)', color: 'white', border: 'none', fontFamily: 'var(--font-mono)' }}
                  >
                    ▶ ACTIVATE
                  </button>
                </div>

                {/* FLASH */}
                <div className="glass-panel p-5 flex flex-col" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-yellow) 30%, transparent)' }}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">💡</span>
                    <div>
                      <h3 className="text-sm font-bold" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-yellow)' }}>FLASH / BLINK</h3>
                      <p className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>Rapid flash between black and normal</p>
                    </div>
                  </div>
                  <div className="space-y-3 mb-4">
                    <div>
                      <label className="text-xs block mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                        INTERVAL: {flashInterval}ms {flashInterval <= 30 ? '⚡ EXTREME' : flashInterval <= 80 ? '🔥 FAST' : ''}
                      </label>
                      <input
                        type="range"
                        min={16}
                        max={1000}
                        step={1}
                        value={flashInterval}
                        onChange={(e) => setFlashInterval(Number(e.target.value))}
                        className="w-full"
                        style={{ accentColor: 'var(--color-cyber-yellow)' }}
                      />
                      <div className="flex justify-between text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.4, fontFamily: 'var(--font-mono)' }}>
                        <span>16ms (⚡)</span>
                        <span>1000ms</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {[
                        { label: '⚡ 16ms', val: 16 },
                        { label: '🔥 30ms', val: 30 },
                        { label: '50ms', val: 50 },
                        { label: '100ms', val: 100 },
                        { label: '200ms', val: 200 },
                        { label: '500ms', val: 500 },
                      ].map(preset => (
                        <button
                          key={preset.val}
                          onClick={() => setFlashInterval(preset.val)}
                          className="px-2 py-1 rounded text-xs font-bold transition-all"
                          style={{
                            background: flashInterval === preset.val ? 'var(--color-cyber-yellow)' : 'transparent',
                            color: flashInterval === preset.val ? 'white' : 'var(--color-cyber-cyan)',
                            border: '1px solid color-mix(in srgb, var(--color-cyber-yellow) 50%, transparent)',
                            fontFamily: 'var(--font-mono)'
                          }}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => sendEffect('flash')}
                    className="w-full px-4 py-3 rounded-lg font-bold text-sm transition-all hover:brightness-110"
                    style={{ background: 'var(--color-cyber-yellow)', color: 'white', border: 'none', fontFamily: 'var(--font-mono)' }}
                  >
                    ▶ ACTIVATE
                  </button>
                </div>

                {/* MEDIA PROJECTION */}
                <div
                  className="glass-panel p-5 flex flex-col"
                  style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)' }}
                  onPaste={handleMediaPaste}
                  onDrop={handleMediaDrop}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">🖼️</span>
                    <div>
                      <h3 className="text-sm font-bold" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>MEDIA PROJECTION</h3>
                      <p className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>Project image or video on player screens</p>
                    </div>
                  </div>
                  <div className="space-y-3 mb-4">
                    {/* File Upload */}
                    <label
                      className="block w-full p-4 rounded-lg text-center cursor-pointer transition-all hover:brightness-110"
                      style={{
                        background: 'var(--color-cyber-darker)',
                        border: `2px dashed ${mediaFile ? 'var(--color-cyber-green)' : 'color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)'}`,
                        color: 'var(--color-cyber-cyan)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '12px'
                      }}
                    >
                      <input
                        type="file"
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleMediaFileSelect(file);
                        }}
                      />
                      {mediaFile ? (
                        <span style={{ color: 'var(--color-cyber-green)' }}>
                          ✅ {mediaFile.name} ({(mediaFile.size / 1024).toFixed(0)} KB)
                        </span>
                      ) : (
                        <>
                          <div style={{ fontSize: '20px', marginBottom: '4px' }}>📁</div>
                          <div>Click, drag & drop, or <strong>Ctrl+V</strong></div>
                        </>
                      )}
                    </label>
                    {mediaFile && (
                      <button
                        onClick={() => { setMediaFile(null); setMediaPreviewUrl(''); }}
                        className="text-xs px-2 py-1 rounded"
                        style={{ color: 'var(--color-cyber-magenta)', border: '1px solid var(--color-cyber-magenta)' }}
                      >
                        ✕ Clear
                      </button>
                    )}
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-xs block mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>TYPE</label>
                        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-cyber-green)' }}>
                          <button
                            onClick={() => setMediaType('image')}
                            className="flex-1 px-3 py-1.5 text-xs font-bold transition-all"
                            style={{
                              background: mediaType === 'image' ? 'var(--color-cyber-green)' : 'transparent',
                              color: mediaType === 'image' ? 'white' : 'var(--color-cyber-cyan)'
                            }}
                          >🖼️ IMAGE</button>
                          <button
                            onClick={() => setMediaType('video')}
                            className="flex-1 px-3 py-1.5 text-xs font-bold transition-all"
                            style={{
                              background: mediaType === 'video' ? 'var(--color-cyber-green)' : 'transparent',
                              color: mediaType === 'video' ? 'white' : 'var(--color-cyber-cyan)'
                            }}
                          >🎬 VIDEO</button>
                        </div>
                      </div>
                      <div className="flex-1">
                        <label className="text-xs block mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>DISPLAY</label>
                        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-cyber-green)' }}>
                          <button
                            onClick={() => setMediaDisplayMode('fullscreen')}
                            className="flex-1 px-3 py-1.5 text-xs font-bold transition-all"
                            style={{
                              background: mediaDisplayMode === 'fullscreen' ? 'var(--color-cyber-green)' : 'transparent',
                              color: mediaDisplayMode === 'fullscreen' ? 'white' : 'var(--color-cyber-cyan)'
                            }}
                          >FULL</button>
                          <button
                            onClick={() => setMediaDisplayMode('popup')}
                            className="flex-1 px-3 py-1.5 text-xs font-bold transition-all"
                            style={{
                              background: mediaDisplayMode === 'popup' ? 'var(--color-cyber-green)' : 'transparent',
                              color: mediaDisplayMode === 'popup' ? 'white' : 'var(--color-cyber-cyan)'
                            }}
                          >POPUP</button>
                        </div>
                      </div>
                    </div>
                    {mediaPreviewUrl && (
                      <div className="p-2 rounded-lg" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)' }}>
                        <div className="text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.4, fontFamily: 'var(--font-mono)' }}>PREVIEW:</div>
                        {mediaType === 'image' ? (
                          <img src={mediaPreviewUrl} alt="Preview" style={{ maxHeight: '120px', borderRadius: '4px' }} />
                        ) : (
                          <video src={mediaPreviewUrl} style={{ maxHeight: '120px', borderRadius: '4px' }} muted controls />
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => sendEffect('media')}
                    className="w-full px-4 py-3 rounded-lg font-bold text-sm transition-all hover:brightness-110"
                    style={{
                      background: mediaUploading ? 'color-mix(in srgb, var(--color-cyber-green) 50%, transparent)' : 'var(--color-cyber-green)',
                      color: 'white',
                      border: 'none',
                      fontFamily: 'var(--font-mono)'
                    }}
                    disabled={!mediaFile || mediaUploading}
                  >
                    {mediaUploading ? '⏳ UPLOADING...' : '▶ PROJECT MEDIA'}
                  </button>
                </div>
              </div>

              {/* Auto effects info */}
              <div className="glass-panel p-4" style={{ border: '1px dashed color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)' }}>
                <h4 className="text-xs font-bold mb-2 tracking-widest" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                  ℹ️ AUTOMATIC EFFECTS
                </h4>
                <div className="space-y-1 text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6, fontFamily: 'var(--font-mono)' }}>
                  <p>• <span style={{ color: 'var(--color-cyber-magenta)' }}>HP Damage</span> — Red flash + floating damage number</p>
                  <p>• <span style={{ color: 'var(--color-cyber-green)' }}>HP Heal</span> — Green flash + floating heal number</p>
                  <p>• <span style={{ color: 'var(--color-cyber-yellow)' }}>Item Received</span> — Bottom-left popup notification (10s)</p>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════ SETTINGS TAB ═══════════════════ */}
          {activeTab === 'settings' && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="mb-2">
                <h2 className="text-xl tracking-wider" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-yellow)', textShadow: '0 0 15px rgba(255, 159, 28, 0.3)' }}>
                  ⚙️ GAME SETTINGS
                </h2>
                <p className="text-xs mt-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                  Configure campaign options and customizations
                </p>
              </div>

              {/* Landing Page Subtitle */}
              <div className="glass-panel p-6" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 40%, transparent)' }}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xl">🏠</span>
                  <h3 className="text-sm font-bold tracking-wider" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>LANDING PAGE</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.7 }}>
                      Subtitle text (shown below "DAI CITY HEROS")
                    </label>
                    <input
                      type="text"
                      value={landingSubtitle}
                      onChange={(e) => setLandingSubtitle(e.target.value)}
                      placeholder="Enter subtitle text..."
                      className="terminal-input w-full text-lg"
                    />
                    <p className="text-xs mt-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.4, fontFamily: 'var(--font-mono)' }}>
                      Preview: [ {landingSubtitle.toUpperCase()} ]
                    </p>
                  </div>
                  <button
                    onClick={saveLandingSubtitle}
                    disabled={settingsSaving}
                    className="neon-button text-sm font-bold"
                    style={{ opacity: settingsSaving ? 0.5 : 1 }}
                  >
                    {settingsSaving ? '⏳ Saving...' : '💾 Save Subtitle'}
                  </button>
                </div>
              </div>

              {/* Weight System */}
              <div className="glass-panel p-6" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-yellow) 40%, transparent)' }}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xl">⚖️</span>
                  <h3 className="text-sm font-bold tracking-wider" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-yellow)' }}>WEIGHT SYSTEM</h3>
                </div>
                <p className="text-xs mb-4" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                  Enable optional weight tracking. Items have weight, characters have carrying capacity.
                </p>
                <button
                  onClick={() => toggleWeightSystem(!weightSystemEnabled)}
                  className="px-6 py-3 rounded-lg font-bold text-sm transition-all hover:scale-105"
                  style={{
                    background: weightSystemEnabled ? 'var(--color-cyber-cyan)' : 'transparent',
                    color: weightSystemEnabled ? 'var(--color-cyber-darker)' : 'var(--color-cyber-cyan)',
                    border: `2px solid var(--color-cyber-cyan)`,
                    fontFamily: 'var(--font-mono)'
                  }}
                >
                  {weightSystemEnabled ? '✅ WEIGHT ON' : '❌ WEIGHT OFF'}
                </button>
              </div>

              {/* Invite Code */}
              <div className="glass-panel p-6" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-yellow) 40%, transparent)' }}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xl">🔗</span>
                  <h3 className="text-sm font-bold tracking-wider" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-yellow)' }}>INVITE CODE</h3>
                </div>
                <p className="text-xs mb-4" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                  Share this code with players to join your campaign. Customizable.
                </p>
                <div className="flex gap-3 items-center">
                  {inviteCodeEditing ? (
                    <>
                      <input
                        type="text"
                        value={campaignInviteCode}
                        onChange={(e) => setCampaignInviteCode(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                        className="flex-1 px-4 py-3 rounded-lg text-lg text-center"
                        style={{
                          background: 'var(--color-cyber-darker)',
                          border: '2px solid var(--color-cyber-yellow)',
                          color: 'var(--color-cyber-yellow)',
                          fontFamily: 'var(--font-mono)',
                          letterSpacing: '2px'
                        }}
                        placeholder="my-campaign-code"
                      />
                      <button
                        onClick={saveInviteCode}
                        disabled={inviteCodeSaving || !campaignInviteCode.trim()}
                        className="px-4 py-3 rounded-lg font-bold"
                        style={{ background: 'var(--color-cyber-yellow)', color: 'white', fontFamily: 'var(--font-mono)' }}
                      >
                        {inviteCodeSaving ? '⏳' : '💾 Save'}
                      </button>
                      <button
                        onClick={() => { setInviteCodeEditing(false); fetchInviteCode(); }}
                        className="px-4 py-3 rounded-lg"
                        style={{ border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 px-4 py-3 rounded-lg text-xl text-center" style={{
                        background: 'color-mix(in srgb, var(--color-cyber-yellow) 8%, transparent)',
                        border: '2px solid color-mix(in srgb, var(--color-cyber-yellow) 40%, transparent)',
                        color: 'var(--color-cyber-yellow)',
                        fontFamily: 'var(--font-mono)',
                        letterSpacing: '4px',
                        fontWeight: 'bold'
                      }}>
                        {campaignInviteCode || '...'}
                      </div>
                      <button
                        onClick={() => { navigator.clipboard.writeText(campaignInviteCode); alert('Copied to clipboard!'); }}
                        className="neon-button text-sm"
                      >
                        📋 Copy
                      </button>
                      <button
                        onClick={() => setInviteCodeEditing(true)}
                        className="px-4 py-2 rounded text-sm"
                        style={{ border: '1px solid var(--color-cyber-yellow)', color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)' }}
                      >
                        ✏️ Edit
                      </button>
                    </>
                  )}
                </div>
                <p className="text-xs mt-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.4, fontFamily: 'var(--font-mono)' }}>
                  Only letters, numbers, hyphens, and underscores. Must be unique.
                </p>
              </div>

              {/* Class Aliases */}
              <div className="glass-panel p-6" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-magenta) 40%, transparent)' }}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xl">🎭</span>
                  <h3 className="text-sm font-bold tracking-wider" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-magenta)' }}>CLASS DISPLAY NAMES & DESCRIPTIONS</h3>
                </div>
                <p className="text-xs mb-4" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                  Customize how each class appears in this campaign. Leave blank for defaults.
                </p>
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                  {CHARACTER_CLASSES.map(cls => (
                    <div key={cls.id} className="p-3 rounded-lg" style={{ background: 'color-mix(in srgb, var(--color-cyber-darker) 80%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-magenta) 20%, transparent)' }}>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs w-24 font-bold shrink-0 tracking-wider" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                          {cls.name}
                        </span>
                        <span style={{ color: 'var(--color-cyber-cyan)', opacity: 0.3 }}>→</span>
                        <input
                          type="text"
                          value={classAliases[cls.id]?.display_name || ''}
                          onChange={(e) => setClassAliases(prev => ({
                            ...prev,
                            [cls.id]: { display_name: e.target.value, description: prev[cls.id]?.description || '' }
                          }))}
                          placeholder={cls.name}
                          className="terminal-input flex-1 text-sm"
                          style={{ color: 'var(--color-cyber-magenta)' }}
                        />
                      </div>
                      <textarea
                        value={classAliases[cls.id]?.description || ''}
                        onChange={(e) => setClassAliases(prev => ({
                          ...prev,
                          [cls.id]: { display_name: prev[cls.id]?.display_name || '', description: e.target.value }
                        }))}
                        placeholder={cls.description}
                        rows={2}
                        className="terminal-input w-full text-xs resize-y"
                        style={{ lineHeight: '1.5' }}
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={saveClassAliases}
                  disabled={classAliasesSaving}
                  className="mt-4 px-6 py-2.5 rounded-lg font-bold text-sm"
                  style={{
                    background: classAliasesSaving ? 'var(--color-cyber-darker)' : 'var(--color-cyber-magenta)',
                    color: 'white',
                    fontFamily: 'var(--font-mono)',
                    opacity: classAliasesSaving ? 0.5 : 1
                  }}
                >
                  {classAliasesSaving ? '⏳ Saving...' : '💾 Save Class Names'}
                </button>
              </div>

              {/* Storage Containers */}
              <div className="glass-panel p-6" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-green) 60%, transparent)' }}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xl">📦</span>
                  <h3 className="text-sm font-bold tracking-wider" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>STORAGE CONTAINERS</h3>
                </div>
                <p className="text-xs mb-4" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                  Create containers where players can store and retrieve items. Lock to prevent access.
                </p>

                {/* Create new */}
                <div className="space-y-2 mb-4 p-4 rounded-lg" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-green) 40%, transparent)' }}>
                  <input
                    type="text"
                    value={newContainerName}
                    onChange={(e) => setNewContainerName(e.target.value)}
                    placeholder="Container name..."
                    className="terminal-input w-full text-sm"
                  />
                  <input
                    type="text"
                    value={newContainerDesc}
                    onChange={(e) => setNewContainerDesc(e.target.value)}
                    placeholder="Description (optional)..."
                    className="terminal-input w-full text-sm"
                  />
                  <button
                    onClick={createStorageContainer}
                    disabled={!newContainerName.trim()}
                    className="px-4 py-2 rounded-lg font-bold text-sm transition-all"
                    style={{
                      background: newContainerName.trim() ? 'var(--color-cyber-cyan)' : 'var(--color-cyber-darker)',
                      color: newContainerName.trim() ? 'var(--color-cyber-darker)' : 'var(--color-cyber-cyan)',
                      fontFamily: 'var(--font-mono)',
                      opacity: newContainerName.trim() ? 1 : 0.5
                    }}
                  >
                    + Create Container
                  </button>
                </div>

                {/* Container list */}
                <div className="space-y-2">
                  {storageContainers.map(container => (
                    <div key={container.id} className="p-3 rounded-lg flex items-center justify-between cursor-pointer transition-all hover:brightness-110" style={{
                      background: selectedContainer?.id === container.id ? 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)' : 'var(--color-cyber-darker)',
                      border: `1px solid ${selectedContainer?.id === container.id ? 'var(--color-cyber-cyan)' : 'color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)'}`
                    }} onClick={() => {
                      setSelectedContainer(container);
                      fetchStorageItems(container.id);
                    }}>
                      <div>
                        <div className="font-bold text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                          {container.is_locked ? '🔒' : '📦'} {container.name}
                        </div>
                        {container.description && (
                          <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>{container.description}</div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleContainerLock(container); }}
                          className="px-2 py-1 rounded text-xs transition-all hover:scale-105"
                          style={{ border: '1px solid var(--color-cyber-yellow)', color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)' }}
                        >
                          {container.is_locked ? '🔓 Unlock' : '🔒 Lock'}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteStorageContainer(container.id); }}
                          className="px-2 py-1 rounded text-xs transition-all hover:scale-105"
                          style={{ border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)' }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                  {storageContainers.length === 0 && (
                    <p className="text-sm text-center py-6" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.4, fontFamily: 'var(--font-mono)' }}>
                      No storage containers yet
                    </p>
                  )}
                </div>

                {/* Selected container contents */}
                {selectedContainer && (
                  <div className="mt-4 p-4 rounded-lg" style={{ border: '1px solid var(--color-cyber-cyan)', background: 'color-mix(in srgb, var(--color-cyber-cyan) 5%, transparent)' }}>
                    <h4 className="text-xs font-bold mb-2 tracking-wider" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                      📦 CONTENTS: {selectedContainer.name}
                    </h4>
                    {storageItems.length === 0 ? (
                      <p className="text-xs py-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>Container is empty</p>
                    ) : (
                      <div className="space-y-1">
                        {storageItems.map(si => (
                          <div key={si.id} className="flex items-center justify-between p-2 rounded" style={{ background: 'var(--color-cyber-darker)' }}>
                            <span className="text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                              {si.item ? `${getItemTypeIcon(si.item.type)} ${si.item.name}` : 'Unknown item'} ×{si.quantity}
                            </span>
                            <button
                              onClick={() => removeStorageItem(si.id)}
                              className="text-xs px-2 py-1 rounded transition-all hover:scale-105"
                              style={{ border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════ MODALS ═══════════════════ */}

          {/* Give Item Modal */}
          {showGiveItemModal && selectedCharacter && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm" onClick={() => { setShowGiveItemModal(false); setGiveItemSearch(''); setGiveItemTypeFilter('all'); setGiveItemRarityFilter('all'); }}>
              <div className="p-6 w-[850px] max-h-[85vh] overflow-hidden flex flex-col rounded-xl" style={{ background: 'var(--color-cyber-darker)', border: '2px solid var(--color-cyber-yellow)', boxShadow: 'var(--shadow-neon-yellow)' }} onClick={e => e.stopPropagation()}>
                <h3 className="text-lg mb-4 tracking-wider" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-yellow)' }}>
                  🎁 GIVE ITEM TO {selectedCharacter.name.toUpperCase()}
                </h3>
                
                {/* Filters */}
                <div className="grid grid-cols-4 gap-3 mb-3">
                  <input
                    type="text"
                    placeholder="Search by name..."
                    value={giveItemSearch}
                    onChange={e => setGiveItemSearch(e.target.value)}
                    className="col-span-2 terminal-input text-sm"
                  />
                  <select
                    value={giveItemTypeFilter}
                    onChange={e => setGiveItemTypeFilter(e.target.value)}
                    className="terminal-input text-sm"
                    style={{ borderColor: 'color-mix(in srgb, var(--color-cyber-magenta) 50%, transparent)', color: 'var(--color-cyber-magenta)' }}
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
                    className="terminal-input text-sm"
                    style={{ borderColor: 'color-mix(in srgb, var(--color-cyber-green) 60%, transparent)' }}
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

                {/* Sort */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>Sort:</span>
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
                      className="px-2 py-1 rounded text-xs transition-all"
                      style={{
                        background: giveItemSortBy === sortOption ? 'var(--color-cyber-cyan)' : 'transparent',
                        border: `1px solid ${giveItemSortBy === sortOption ? 'var(--color-cyber-cyan)' : 'color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)'}`,
                        color: giveItemSortBy === sortOption ? 'var(--color-cyber-darker)' : 'var(--color-cyber-cyan)',
                        fontFamily: 'var(--font-mono)'
                      }}
                    >
                      {sortOption.toUpperCase()} {giveItemSortBy === sortOption && (giveItemSortOrder === 'asc' ? '↑' : '↓')}
                    </button>
                  ))}
                  <span className="ml-auto text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.4, fontFamily: 'var(--font-mono)' }}>
                    {filteredGiveItems.length} items
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
                        className="p-3 rounded-lg cursor-pointer transition-all hover:brightness-110"
                        style={{
                          border: `2px solid ${isSelected ? 'var(--color-cyber-yellow)' : 'color-mix(in srgb, ' + getRarityColor(item.rarity) + ' 50%, transparent)'}`,
                          background: isSelected ? 'color-mix(in srgb, var(--color-cyber-yellow) 10%, var(--color-cyber-darker))' : 'var(--color-cyber-darker)'
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">{getItemTypeIcon(item.type)}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold" style={{ color: getRarityColor(item.rarity), fontFamily: 'var(--font-cyber)', fontSize: '13px' }}>{item.name}</span>
                              <span className="px-1.5 py-0.5 rounded text-xs" style={{ background: getRarityBgColor(item.rarity), color: getRarityColor(item.rarity) }}>{item.rarity}</span>
                              {item.price > 0 && (
                                <span className="text-xs" style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)' }}>💰 {item.price.toLocaleString()}¢</span>
                              )}
                            </div>
                            <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6, fontFamily: 'var(--font-mono)' }}>
                              {toTitleCase(item.type)}
                              {item.weapon_subtype && ` • ${toTitleCase(item.weapon_subtype)}`}
                              {item.armor_subtype && ` • ${toTitleCase(item.armor_subtype)}`}
                              {item.is_consumable && ' • Consumable'}
                              {item.is_equippable && ' • Equippable'}
                              {item.ic_cost > 0 && ` • IC: ${item.ic_cost}`}
                            </div>
                            {item.description && (
                              <div className="text-xs mt-1 line-clamp-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.4 }}>
                                {item.description}
                              </div>
                            )}
                            {hasStatMods && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {item.hp_mod !== 0 && <span className="text-xs px-1 rounded" style={{ background: 'var(--color-cyber-magenta)', color: 'white' }}>HP {item.hp_mod > 0 ? '+' : ''}{item.hp_mod}</span>}
                                {item.ac_mod !== 0 && <span className="text-xs px-1 rounded" style={{ background: 'var(--color-cyber-cyan)', color: 'var(--color-cyber-darker)' }}>AC {item.ac_mod > 0 ? '+' : ''}{item.ac_mod}</span>}
                                {item.str_mod !== 0 && <span className="text-xs px-1 rounded" style={{ background: 'var(--color-cyber-magenta)', color: 'white' }}>STR {item.str_mod > 0 ? '+' : ''}{item.str_mod}</span>}
                                {item.dex_mod !== 0 && <span className="text-xs px-1 rounded" style={{ background: 'var(--color-cyber-magenta)', color: 'white' }}>DEX {item.dex_mod > 0 ? '+' : ''}{item.dex_mod}</span>}
                                {item.con_mod !== 0 && <span className="text-xs px-1 rounded" style={{ background: 'var(--color-cyber-magenta)', color: 'white' }}>CON {item.con_mod > 0 ? '+' : ''}{item.con_mod}</span>}
                                {item.speed_mod !== 0 && <span className="text-xs px-1 rounded" style={{ background: 'var(--color-cyber-green)', color: 'white' }}>SPD {item.speed_mod > 0 ? '+' : ''}{item.speed_mod}</span>}
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
                    <div className="text-center py-8 text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.4, fontFamily: 'var(--font-mono)' }}>
                      No items found matching your filters
                    </div>
                  )}
                  {filteredGiveItems.length > 50 && (
                    <div className="text-center py-2 text-xs" style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)' }}>
                      Showing first 50 of {filteredGiveItems.length}. Use filters to narrow results.
                    </div>
                  )}
                </div>

                {/* Selected item + qty */}
                {selectedGiveItem && (
                  <div className="p-3 rounded-lg mb-4" style={{ background: 'color-mix(in srgb, var(--color-cyber-yellow) 8%, var(--color-cyber-darker))', border: '1px solid var(--color-cyber-yellow)' }}>
                    <div className="flex items-center gap-4">
                      <span className="text-2xl">{getItemTypeIcon(selectedGiveItem.type)}</span>
                      <div className="flex-1">
                        <div className="font-bold" style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-cyber)' }}>{selectedGiveItem.name}</div>
                        <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6 }}>{selectedGiveItem.description || 'No description'}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>QTY:</label>
                        <button onClick={() => setGiveItemQuantity(q => Math.max(1, q - 1))} className="w-7 h-7 rounded flex items-center justify-center text-sm" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}>−</button>
                        <NumberInput min={1} value={giveItemQuantity} onChange={v => setGiveItemQuantity(Math.max(1, v))} defaultValue={1} className="w-14 px-2 py-1 rounded text-center text-sm" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }} />
                        <button onClick={() => setGiveItemQuantity(q => q + 1)} className="w-7 h-7 rounded flex items-center justify-center text-sm" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}>+</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex gap-3 justify-between items-center pt-3" style={{ borderTop: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)' }}>
                  <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                    {selectedGiveItem ? `Ready: ${giveItemQuantity}× ${selectedGiveItem.name}` : 'Select an item'}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowGiveItemModal(false); setGiveItemSearch(''); setGiveItemTypeFilter('all'); setGiveItemRarityFilter('all'); }}
                      className="neon-button-magenta text-sm"
                    >
                      CANCEL
                    </button>
                    <button
                      onClick={handleGiveItem}
                      disabled={!selectedGiveItem}
                      className="px-5 py-2 rounded-lg text-sm font-bold transition-all hover:scale-105"
                      style={{
                        background: selectedGiveItem ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-darker)',
                        color: 'white',
                        fontFamily: 'var(--font-mono)',
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
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm" onClick={() => setShowRemoveItemModal(false)}>
              <div className="p-6 w-full max-w-md rounded-xl" style={{ background: 'var(--color-cyber-darker)', border: '2px solid var(--color-cyber-magenta)', boxShadow: 'var(--shadow-neon-magenta)' }} onClick={e => e.stopPropagation()}>
                <h3 className="text-lg mb-4 tracking-wider" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-magenta)' }}>
                  🗑️ REMOVE ITEM
                </h3>
                
                <div className="p-3 rounded-lg mb-4" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)', background: 'color-mix(in srgb, var(--color-cyber-darker) 80%, transparent)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getItemTypeIcon(removeItemTarget.item.type)}</span>
                    <div>
                      <div className="font-bold text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{removeItemTarget.item.name}</div>
                      <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>Current quantity: {removeItemTarget.quantity}</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 mb-4">
                  <label className="text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>Remove:</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setRemoveItemQuantity(Math.max(1, removeItemQuantity - 1))} className="px-3 py-1 rounded" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)' }}>−</button>
                    <NumberInput min={1} value={removeItemQuantity} onChange={v => setRemoveItemQuantity(Math.min(removeItemTarget.quantity, Math.max(1, v)))} defaultValue={1} className="w-14 px-2 py-1 rounded text-center" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }} />
                    <button onClick={() => setRemoveItemQuantity(Math.min(removeItemTarget.quantity, removeItemQuantity + 1))} className="px-3 py-1 rounded" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)' }}>+</button>
                  </div>
                  <button onClick={() => setRemoveItemQuantity(removeItemTarget.quantity)} className="px-2 py-1 rounded text-xs font-bold" style={{ background: 'color-mix(in srgb, var(--color-cyber-magenta) 20%, transparent)', border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>ALL</button>
                </div>

                <div className="text-xs mb-4" style={{ color: removeItemQuantity >= removeItemTarget.quantity ? 'var(--color-cyber-magenta)' : 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                  {removeItemQuantity >= removeItemTarget.quantity 
                    ? '⚠️ This will remove ALL of this item'
                    : `Will leave ${removeItemTarget.quantity - removeItemQuantity} remaining`}
                </div>

                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowRemoveItemModal(false)} className="neon-button text-sm">CANCEL</button>
                  <button onClick={handleRemoveItem} className="px-4 py-2 rounded-lg text-sm font-bold" style={{ background: 'var(--color-cyber-magenta)', color: 'white', fontFamily: 'var(--font-mono)' }}>
                    REMOVE {removeItemQuantity}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Link Ability to Item Modal */}
          {showLinkAbilityModal && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm" onClick={() => { setShowLinkAbilityModal(false); setLinkAbilitySearch(''); }}>
              <div className="p-6 w-full max-w-lg rounded-xl" style={{ background: 'var(--color-cyber-darker)', border: '2px solid var(--color-cyber-yellow)', boxShadow: 'var(--shadow-neon-yellow)' }} onClick={e => e.stopPropagation()}>
                <h3 className="text-lg mb-4 tracking-wider" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-yellow)' }}>
                  ⚡ LINK ABILITY TO ITEM
                </h3>
                
                <input
                  type="text"
                  placeholder="Search abilities..."
                  value={linkAbilitySearch}
                  onChange={e => setLinkAbilitySearch(e.target.value)}
                  className="terminal-input w-full mb-4"
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
                        className="p-3 rounded-lg cursor-pointer transition-all hover:brightness-110"
                        style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)', background: 'color-mix(in srgb, var(--color-cyber-darker) 80%, transparent)' }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getAbilityTypeIcon(ability.type)}</span>
                          <div>
                            <div className="text-sm font-bold" style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)' }}>{ability.name}</div>
                            <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                              {toTitleCase(ability.type)} • {toTitleCase(ability.charge_type)}
                              {ability.max_charges && <span> • {ability.max_charges} charges</span>}
                            </div>
                          </div>
                        </div>
                        <p className="text-xs mt-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.4 }}>
                          {ability.description.slice(0, 100)}{ability.description.length > 100 ? '...' : ''}
                        </p>
                      </div>
                    ))
                  }
                  {allAbilities.filter(a => 
                    a.name.toLowerCase().includes(linkAbilitySearch.toLowerCase()) &&
                    !itemLinkedAbilities.some(la => la.ability_id === a.id)
                  ).length === 0 && (
                    <div className="text-center py-8" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.4, fontFamily: 'var(--font-mono)' }}>
                      No matching abilities found
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <button onClick={() => { setShowLinkAbilityModal(false); setLinkAbilitySearch(''); }} className="neon-button-magenta text-sm">CANCEL</button>
                </div>
              </div>
            </div>
          )}

          {/* Give Ability Modal */}
          {showGiveAbilityModal && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
              <div className="p-6 w-[600px] max-h-[80vh] overflow-y-auto rounded-xl" style={{ background: 'var(--color-cyber-darker)', border: '2px solid var(--color-cyber-magenta)', boxShadow: 'var(--shadow-neon-magenta)' }}>
                <h3 className="text-lg mb-4 tracking-wider" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-magenta)' }}>
                  🎁 GIVE ABILITY TO PLAYER
                </h3>

                {!giveAbilityCharacter ? (
                  <>
                    <p className="text-sm mb-3" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>Step 1: Select a character</p>
                    <div className="max-h-[300px] overflow-y-auto space-y-2">
                      {characters.map(char => (
                        <div
                          key={char.id}
                          onClick={() => setGiveAbilityCharacter(char)}
                          className="p-3 rounded-lg cursor-pointer transition-all hover:brightness-110"
                          style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 40%, transparent)', background: 'var(--color-cyber-darker)' }}
                        >
                          <div className="text-sm font-bold" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{char.name}</div>
                          <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>{char.class} • Lvl {char.level}</div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-4 p-2 rounded-lg" style={{ background: 'color-mix(in srgb, var(--color-cyber-yellow) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyber-yellow) 30%, transparent)' }}>
                      <span className="text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>Giving to:</span>
                      <span className="font-bold" style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-cyber)' }}>{giveAbilityCharacter.name}</span>
                      <button onClick={() => setGiveAbilityCharacter(null)} className="ml-auto text-xs px-2 py-1 rounded" style={{ border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>Change</button>
                    </div>

                    <input
                      type="text"
                      placeholder="Search abilities..."
                      value={giveAbilitySearch}
                      onChange={e => setGiveAbilitySearch(e.target.value)}
                      className="terminal-input w-full text-sm mb-3"
                    />

                    <div className="max-h-[250px] overflow-y-auto space-y-2 mb-4">
                      {filteredGiveAbilities.slice(0, 20).map(ability => (
                        <div
                          key={ability.id}
                          onClick={() => setSelectedGiveAbility(ability)}
                          className="p-2 rounded-lg cursor-pointer transition-all"
                          style={{
                            border: `1px solid ${selectedGiveAbility?.id === ability.id ? 'var(--color-cyber-yellow)' : 'color-mix(in srgb, var(--color-cyber-magenta) 40%, transparent)'}`,
                            background: selectedGiveAbility?.id === ability.id ? 'color-mix(in srgb, var(--color-cyber-yellow) 15%, transparent)' : 'transparent'
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span>{getAbilityTypeIcon(ability.type)}</span>
                            <div>
                              <div className="text-sm" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>{ability.name}</div>
                              <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>{ability.type.replace('_', ' ')}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div className="flex gap-2 justify-end pt-3" style={{ borderTop: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)' }}>
                  <button
                    onClick={() => { setShowGiveAbilityModal(false); setGiveAbilityCharacter(null); setSelectedGiveAbility(null); setGiveAbilitySearch(''); }}
                    className="neon-button-magenta text-sm"
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={handleGiveAbilityToCharacter}
                    disabled={!giveAbilityCharacter || !selectedGiveAbility}
                    className="px-5 py-2 rounded-lg text-sm font-bold transition-all"
                    style={{
                      background: (giveAbilityCharacter && selectedGiveAbility) ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-darker)',
                      color: 'white',
                      fontFamily: 'var(--font-mono)',
                      opacity: (giveAbilityCharacter && selectedGiveAbility) ? 1 : 0.5
                    }}
                  >
                    GIVE ABILITY
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Create Encounter Modal */}
          {showCreateEncounterModal && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
              <div className="p-6 w-[500px] rounded-xl" style={{ background: 'var(--color-cyber-darker)', border: '2px solid var(--color-cyber-magenta)', boxShadow: 'var(--shadow-neon-magenta)' }}>
                <h3 className="text-lg mb-4 tracking-wider" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-magenta)' }}>
                  ⚔️ CREATE ENCOUNTER
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>Name *</label>
                    <input type="text" value={newEncounterName} onChange={e => setNewEncounterName(e.target.value)} placeholder="e.g., Warehouse Ambush" className="terminal-input w-full" />
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>Description</label>
                    <textarea value={newEncounterDescription} onChange={e => setNewEncounterDescription(e.target.value)} placeholder="Brief description..." rows={3} className="terminal-input w-full" />
                  </div>
                </div>
                <div className="flex gap-2 justify-end mt-6">
                  <button onClick={() => { setShowCreateEncounterModal(false); setNewEncounterName(''); setNewEncounterDescription(''); }} className="neon-button-magenta text-sm">CANCEL</button>
                  <button
                    onClick={handleCreateEncounter}
                    disabled={encounterSaving || !newEncounterName.trim()}
                    className="px-5 py-2 rounded-lg text-sm font-bold transition-all"
                    style={{ background: newEncounterName.trim() ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-darker)', color: 'white', fontFamily: 'var(--font-mono)', opacity: newEncounterName.trim() ? 1 : 0.5 }}
                  >
                    {encounterSaving ? 'CREATING...' : 'CREATE'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Add Participant Modal */}
          {showAddParticipantModal && activeEncounter && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm" onClick={() => { setShowAddParticipantModal(false); setParticipantSearchQuery(''); setParticipantTypeFilter('all'); }}>
              <div className="p-6 w-[700px] max-h-[85vh] overflow-y-auto rounded-xl" style={{ background: 'var(--color-cyber-darker)', border: '2px solid var(--color-cyber-cyan)', boxShadow: 'var(--shadow-neon-cyan)' }} onClick={e => e.stopPropagation()}>
                <h3 className="text-lg mb-4 tracking-wider" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
                  ➕ ADD COMBATANTS
                </h3>

                {/* Search + Filter */}
                <div className="flex gap-3 mb-4">
                  <input
                    type="text"
                    placeholder="Search..."
                    value={participantSearchQuery}
                    onChange={e => setParticipantSearchQuery(e.target.value)}
                    className="terminal-input flex-1"
                  />
                  <select
                    value={participantTypeFilter}
                    onChange={e => setParticipantTypeFilter(e.target.value as any)}
                    className="terminal-input"
                  >
                    <option value="all">All Types</option>
                    <option value="player">Players</option>
                    <option value="enemy">Enemies</option>
                    <option value="friendly">Friendly</option>
                    <option value="neutral">Neutral</option>
                    <option value="boss">Bosses</option>
                  </select>
                </div>

                <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-2">
                  {/* Players */}
                  {participantTypeFilter !== 'enemy' && participantTypeFilter !== 'friendly' && participantTypeFilter !== 'neutral' && participantTypeFilter !== 'boss' && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-bold tracking-widest" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>👥 PLAYERS</h4>
                        <button
                          onClick={addAllPlayersToEncounter}
                          className="px-2 py-1 rounded text-xs font-bold"
                          style={{ background: 'var(--color-cyber-cyan)', color: 'var(--color-cyber-darker)', fontFamily: 'var(--font-mono)' }}
                        >
                          ADD ALL
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {characters
                          .filter(c => !combatParticipants.some(p => p.entityId === c.id))
                          .filter(c => !participantSearchQuery || c.name.toLowerCase().includes(participantSearchQuery.toLowerCase()))
                          .map(char => (
                          <button
                            key={char.id}
                            onClick={() => addParticipantToEncounter('player', char.id)}
                            className="p-3 rounded-lg text-left transition-all hover:brightness-110"
                            style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 40%, transparent)', background: 'color-mix(in srgb, var(--color-cyber-darker) 90%, transparent)' }}
                          >
                            <div className="font-bold text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{char.name}</div>
                            <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>
                              {char.class} Lv{char.level} • ❤️ {char.current_hp}/{char.max_hp} • 🛡️ {char.ac}
                            </div>
                          </button>
                        ))}
                        {characters.filter(c => !combatParticipants.some(p => p.entityId === c.id)).filter(c => !participantSearchQuery || c.name.toLowerCase().includes(participantSearchQuery.toLowerCase())).length === 0 && (
                          <div className="col-span-2 text-center py-2 text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.4, fontFamily: 'var(--font-mono)' }}>
                            {participantSearchQuery ? 'No matching players' : 'All players already added'}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* NPCs */}
                  {participantTypeFilter !== 'player' && (
                    <div>
                      <h4 className="text-xs font-bold mb-2 tracking-widest" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>👾 NPCs & ENEMIES</h4>
                      <div className="text-xs mb-2 p-2 rounded-lg" style={{ background: 'var(--color-cyber-darker)', border: '1px dashed color-mix(in srgb, var(--color-cyber-magenta) 30%, transparent)', color: 'var(--color-cyber-magenta)', opacity: 0.7 }}>
                        💡 Use the quantity selector to add multiples
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
                              <div key={npc.id} className="p-3 rounded-lg flex items-center gap-3" style={{ border: `1px solid ${getNpcTypeColor(npc.type)}`, background: 'color-mix(in srgb, var(--color-cyber-darker) 90%, transparent)' }}>
                                <div className="flex-1">
                                  <div className="font-bold flex items-center gap-2 text-sm" style={{ color: getNpcTypeColor(npc.type), fontFamily: 'var(--font-mono)' }}>
                                    {npc.name}
                                    {currentCount > 0 && (
                                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: getNpcTypeColor(npc.type), color: 'white' }}>
                                        {currentCount} in combat
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>
                                    {npc.type} • ❤️ {npc.current_hp}/{npc.max_hp} • 🛡️ {npc.ac}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button onClick={() => setNpcQuantities(q => ({ ...q, [npc.id]: Math.max(1, qty - 1) }))} className="w-7 h-7 rounded flex items-center justify-center text-sm font-bold" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}>−</button>
                                  <input type="number" min={1} max={20} value={qty} onChange={e => setNpcQuantities(q => ({ ...q, [npc.id]: Math.max(1, Math.min(20, parseInt(e.target.value) || 1)) }))} className="w-12 text-center px-1 py-1 rounded text-sm" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }} />
                                  <button onClick={() => setNpcQuantities(q => ({ ...q, [npc.id]: Math.min(20, qty + 1) }))} className="w-7 h-7 rounded flex items-center justify-center text-sm font-bold" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}>+</button>
                                  <button onClick={() => addMultipleNpcsToEncounter(npc.id, qty)} className="px-3 py-1 rounded text-xs font-bold transition-all hover:scale-105" style={{ background: getNpcTypeColor(npc.type), color: 'white' }}>
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

                <div className="flex justify-between items-center mt-4 pt-4" style={{ borderTop: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)' }}>
                  <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>{combatParticipants.length} combatants in encounter</div>
                  <button onClick={() => { setShowAddParticipantModal(false); setParticipantSearchQuery(''); setParticipantTypeFilter('all'); }} className="neon-button text-sm font-bold">
                    DONE
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Create/Edit Mission Modal */}
          {showCreateMissionModal && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm" onClick={() => { setShowCreateMissionModal(false); resetMissionForm(); setSelectedMission(null); setRewardItemSearch(''); }}>
              <div className="p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl" style={{ background: 'var(--color-cyber-darker)', border: '2px solid var(--color-cyber-yellow)', boxShadow: 'var(--shadow-neon-yellow)' }} onClick={e => e.stopPropagation()}>
                <h3 className="text-xl mb-4 tracking-wider" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-yellow)' }}>
                  {selectedMission ? '✏️ EDIT MISSION' : '📋 NEW MISSION'}
                </h3>

                <div className="space-y-4">
                  {/* Title */}
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>Mission Title *</label>
                    <input type="text" value={missionForm.title} onChange={e => setMissionForm(f => ({ ...f, title: e.target.value }))} placeholder="Enter mission title..." className="terminal-input w-full" />
                  </div>

                  {/* Type & Difficulty */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>Type</label>
                      <select value={missionForm.type} onChange={e => setMissionForm(f => ({ ...f, type: e.target.value as MissionType }))} className="terminal-input w-full">
                        {MISSION_TYPES.map(type => (<option key={type} value={type}>{type}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>Difficulty</label>
                      <select value={missionForm.difficulty} onChange={e => setMissionForm(f => ({ ...f, difficulty: e.target.value as MissionDifficulty }))} className="terminal-input w-full">
                        {MISSION_DIFFICULTIES.map(diff => (<option key={diff} value={diff}>{diff}</option>))}
                      </select>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>Description</label>
                    <textarea value={missionForm.description} onChange={e => setMissionForm(f => ({ ...f, description: e.target.value }))} placeholder="Mission briefing..." rows={3} className="terminal-input w-full" />
                  </div>

                  {/* Objectives */}
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                      Objectives
                      <button onClick={() => setMissionForm(f => ({ ...f, objectives: [...f.objectives, ''] }))} className="ml-2 px-2 py-0.5 rounded text-xs" style={{ background: 'var(--color-cyber-cyan)', color: 'var(--color-cyber-darker)' }}>+ Add</button>
                    </label>
                    <div className="space-y-2">
                      {missionForm.objectives.map((obj, idx) => (
                        <div key={idx} className="flex gap-2">
                          <span className="w-6 h-8 flex items-center justify-center text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>{idx + 1}.</span>
                          <input type="text" value={obj} onChange={e => { const newObjs = [...missionForm.objectives]; newObjs[idx] = e.target.value; setMissionForm(f => ({ ...f, objectives: newObjs })); }} placeholder="Objective description..." className="terminal-input flex-1 text-sm" />
                          {missionForm.objectives.length > 1 && (
                            <button onClick={() => setMissionForm(f => ({ ...f, objectives: f.objectives.filter((_, i) => i !== idx) }))} className="px-2 rounded text-sm" style={{ color: 'var(--color-cyber-magenta)' }}>✕</button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Assign */}
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>Assign to (empty = party-wide)</label>
                    <div className="flex flex-wrap gap-2 p-2 rounded-lg" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)' }}>
                      {characters.map(char => (
                        <button key={char.id} onClick={() => {
                          if (missionForm.assigned_to.includes(char.id)) { setMissionForm(f => ({ ...f, assigned_to: f.assigned_to.filter(id => id !== char.id) })); }
                          else { setMissionForm(f => ({ ...f, assigned_to: [...f.assigned_to, char.id] })); }
                        }} className="px-2 py-1 rounded-full text-xs font-bold transition-all" style={{
                          background: missionForm.assigned_to.includes(char.id) ? 'var(--color-cyber-cyan)' : 'transparent',
                          color: missionForm.assigned_to.includes(char.id) ? 'var(--color-cyber-darker)' : 'var(--color-cyber-cyan)',
                          border: '1px solid var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)'
                        }}>
                          {char.name}
                        </button>
                      ))}
                      {characters.length === 0 && (<span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.4 }}>No characters available</span>)}
                    </div>
                  </div>

                  {/* Reward Items */}
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>Reward Items</label>
                    {missionForm.reward_item_ids.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2 p-2 rounded-lg" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-yellow)' }}>
                        {missionForm.reward_item_ids.map(itemId => {
                          const item = allItems.find(i => i.id === itemId);
                          if (!item) return null;
                          return (
                            <div key={itemId} className="flex items-center gap-1 px-2 py-1 rounded-full text-xs" style={{ background: getRarityColor(item.rarity), color: 'white' }}>
                              <span>{getItemTypeIcon(item.type)}</span>
                              <span className="font-bold">{item.name}</span>
                              <button onClick={() => setMissionForm(f => ({ ...f, reward_item_ids: f.reward_item_ids.filter(id => id !== itemId) }))} className="ml-1 hover:opacity-70">✕</button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="relative">
                      <input type="text" value={rewardItemSearch} onChange={e => setRewardItemSearch(e.target.value)} placeholder="Search items to add as reward..." className="terminal-input w-full" style={{ borderColor: 'color-mix(in srgb, var(--color-cyber-yellow) 50%, transparent)' }} />
                      {rewardItemSearch.trim() && (
                        <div className="absolute z-10 w-full mt-1 rounded-lg max-h-48 overflow-y-auto" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-yellow)' }}>
                          {allItems.filter(item => item.name.toLowerCase().includes(rewardItemSearch.toLowerCase()) && !missionForm.reward_item_ids.includes(item.id)).slice(0, 15).map(item => (
                            <button key={item.id} onClick={() => { setMissionForm(f => ({ ...f, reward_item_ids: [...f.reward_item_ids, item.id] })); setRewardItemSearch(''); }} className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-all hover:brightness-110" style={{ borderBottom: '1px solid color-mix(in srgb, var(--color-cyber-yellow) 15%, transparent)' }}>
                              <span>{getItemTypeIcon(item.type)}</span>
                              <span style={{ color: getRarityColor(item.rarity), fontFamily: 'var(--font-mono)' }}>{item.name}</span>
                              <span className="text-xs ml-auto" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.4 }}>{toTitleCase(item.type)} • {item.rarity}</span>
                            </button>
                          ))}
                          {allItems.filter(item => item.name.toLowerCase().includes(rewardItemSearch.toLowerCase()) && !missionForm.reward_item_ids.includes(item.id)).length === 0 && (
                            <div className="px-3 py-2 text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.4 }}>No items found</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Credits */}
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>Credit Reward 💰</label>
                    <NumberInput min={0} value={missionForm.reward_credits} onChange={v => setMissionForm(f => ({ ...f, reward_credits: v }))} placeholder="0" className="terminal-input w-full" style={{ borderColor: 'color-mix(in srgb, var(--color-cyber-yellow) 50%, transparent)', color: 'var(--color-cyber-yellow)' }} />
                  </div>

                  {/* Reward Mode */}
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>Distribution Mode</label>
                    <div className="flex gap-3 p-2 rounded-lg" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)' }}>
                      <button onClick={() => setMissionForm(f => ({ ...f, reward_mode: 'each' }))} className="flex-1 px-3 py-2 rounded-lg text-sm transition-all" style={{
                        background: missionForm.reward_mode === 'each' ? 'var(--color-cyber-cyan)' : 'transparent',
                        color: missionForm.reward_mode === 'each' ? 'var(--color-cyber-darker)' : 'var(--color-cyber-cyan)',
                        border: '1px solid var(--color-cyber-cyan)'
                      }}>
                        <div className="font-bold" style={{ fontFamily: 'var(--font-mono)' }}>Each Member</div>
                        <div className="text-xs opacity-70">All get rewards</div>
                      </button>
                      <button onClick={() => setMissionForm(f => ({ ...f, reward_mode: 'single' }))} className="flex-1 px-3 py-2 rounded-lg text-sm transition-all" style={{
                        background: missionForm.reward_mode === 'single' ? 'var(--color-cyber-magenta)' : 'transparent',
                        color: missionForm.reward_mode === 'single' ? 'white' : 'var(--color-cyber-magenta)',
                        border: '1px solid var(--color-cyber-magenta)'
                      }}>
                        <div className="font-bold" style={{ fontFamily: 'var(--font-mono)' }}>Single Recipient</div>
                        <div className="text-xs opacity-70">DM assigns on completion</div>
                      </button>
                    </div>
                    <div className="mt-1 text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.4, fontFamily: 'var(--font-mono)' }}>
                      {missionForm.reward_mode === 'each' ? '📦 Each member gets full rewards' : '🎯 Choose recipients on completion'}
                    </div>
                  </div>

                  {/* Save as Draft */}
                  {!selectedMission && (
                    <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)' }}>
                      <input type="checkbox" id="saveAsDraft" checked={missionForm.saveAsDraft} onChange={e => setMissionForm(f => ({ ...f, saveAsDraft: e.target.checked }))} className="w-5 h-5" style={{ accentColor: 'var(--color-cyber-cyan)' }} />
                      <label htmlFor="saveAsDraft" className="flex-1 cursor-pointer">
                        <div className="text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>Save as Draft</div>
                        <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.4 }}>Draft missions are hidden from players</div>
                      </label>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-4" style={{ borderTop: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)' }}>
                  <button onClick={() => { setShowCreateMissionModal(false); resetMissionForm(); setSelectedMission(null); setRewardItemSearch(''); }} className="neon-button text-sm">Cancel</button>
                  <button
                    onClick={selectedMission ? handleSaveMissionEdit : handleCreateMission}
                    disabled={missionSaving || !missionForm.title.trim()}
                    className="px-6 py-2 rounded-lg font-bold text-sm transition-all"
                    style={{ background: missionForm.title.trim() ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-darker)', color: 'white', fontFamily: 'var(--font-mono)', opacity: missionForm.title.trim() ? 1 : 0.5 }}
                  >
                    {missionSaving ? 'Saving...' : selectedMission ? 'Save Changes' : 'Create Mission'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Reward Distribution Modal */}
          {showRewardDistributionModal && selectedMission && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm" onClick={() => setShowRewardDistributionModal(false)}>
              <div className="p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl" style={{ background: 'var(--color-cyber-darker)', border: '2px solid var(--color-cyber-cyan)', boxShadow: 'var(--shadow-neon-cyan)' }} onClick={e => e.stopPropagation()}>
                <h3 className="text-xl mb-4 tracking-wider" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
                  🎁 DISTRIBUTE REWARDS
                </h3>
                <p className="text-sm mb-4" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                  Assign rewards for: <strong style={{ color: 'var(--color-cyber-yellow)' }}>{selectedMission.title}</strong>
                </p>

                {/* Item Rewards */}
                {selectedMission.reward_items && selectedMission.reward_items.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-xs font-bold mb-2 tracking-widest" style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)' }}>📦 ITEM REWARDS</h4>
                    <div className="space-y-3">
                      {selectedMission.reward_items.map(item => (
                        <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-yellow) 40%, transparent)' }}>
                          <div className="flex items-center gap-2 flex-1">
                            <span>{getItemTypeIcon(item.type)}</span>
                            <span className="font-bold" style={{ color: getRarityColor(item.rarity), fontFamily: 'var(--font-mono)' }}>{item.name}</span>
                          </div>
                          <span className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.4 }}>→</span>
                          <select
                            value={rewardDistribution[item.id] || ''}
                            onChange={e => setRewardDistribution(prev => ({ ...prev, [item.id]: e.target.value }))}
                            className="terminal-input min-w-48"
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

                {/* Credit Rewards */}
                {(selectedMission.reward_credits || 0) > 0 && (
                  <div className="mb-6">
                    <h4 className="text-xs font-bold mb-2 tracking-widest" style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)' }}>
                      💰 CREDITS: {selectedMission.reward_credits.toLocaleString()} to distribute
                    </h4>
                    <div className="space-y-2">
                      {(selectedMission.assigned_characters?.length ? selectedMission.assigned_characters : characters).map(char => (
                        <div key={char.id} className="flex items-center gap-3 p-2 rounded-lg" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-yellow) 30%, transparent)' }}>
                          <span className="flex-1 font-bold text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>{char.name}</span>
                          <NumberInput min={0} value={creditDistribution[char.id] || 0} onChange={v => setCreditDistribution(prev => ({ ...prev, [char.id]: v }))} className="w-32 px-3 py-1 rounded text-right" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-yellow)', color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)' }} />
                          <span className="text-xs" style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)' }}>credits</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 text-sm" style={{ 
                      color: Object.values(creditDistribution).reduce((a, b) => a + b, 0) === selectedMission.reward_credits 
                        ? 'var(--color-cyber-green)' 
                        : 'var(--color-cyber-magenta)',
                      fontFamily: 'var(--font-mono)'
                    }}>
                      Distributed: {Object.values(creditDistribution).reduce((a, b) => a + b, 0).toLocaleString()} / {selectedMission.reward_credits.toLocaleString()} credits
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4" style={{ borderTop: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)' }}>
                  <button onClick={() => { setShowRewardDistributionModal(false); setRewardDistribution({}); setCreditDistribution({}); }} className="neon-button text-sm">Cancel</button>
                  <button onClick={handleCompleteWithDistribution} className="px-6 py-2 rounded-lg font-bold text-sm" style={{ background: 'var(--color-cyber-cyan)', color: 'var(--color-cyber-darker)', fontFamily: 'var(--font-mono)' }}>
                    ✅ Complete & Distribute
                  </button>
                </div>
              </div>
            </div>
          )}

      </main>
    </div>
  );
}
