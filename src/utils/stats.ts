// Utilities for calculating character stats including item modifiers

import type { InventoryItem, CharacterStats, StatModifiers } from '../types/inventory';

/**
 * Calculate total character stats including base stats and equipped item modifiers
 */
export function calculateTotalStats(
  baseStats: {
    str: number;
    dex: number;
    con: number;
    wis: number;
    int: number;
    cha: number;
    max_hp: number;
    ac: number;
  },
  inventory: InventoryItem[]
): CharacterStats {
  // Get all equipped items
  const equippedItems = inventory.filter(inv => inv.is_equipped && inv.item);
  
  // Sum up all stat modifiers from equipped items
  const modifiers: StatModifiers = {
    str_mod: 0,
    dex_mod: 0,
    con_mod: 0,
    wis_mod: 0,
    int_mod: 0,
    cha_mod: 0,
    hp_mod: 0,
    ac_mod: 0,
    speed_mod: 0,
    init_mod: 0,
    ic_mod: 0
  };
  
  const skillBonuses: { [key: string]: number } = {};
  
  for (const inv of equippedItems) {
    if (!inv.item) continue;
    
    modifiers.str_mod += inv.item.str_mod || 0;
    modifiers.dex_mod += inv.item.dex_mod || 0;
    modifiers.con_mod += inv.item.con_mod || 0;
    modifiers.wis_mod += inv.item.wis_mod || 0;
    modifiers.int_mod += inv.item.int_mod || 0;
    modifiers.cha_mod += inv.item.cha_mod || 0;
    modifiers.hp_mod += inv.item.hp_mod || 0;
    modifiers.ac_mod += inv.item.ac_mod || 0;
    
    // Merge skill modifiers
    if (inv.item.skill_mods) {
      for (const [skill, bonus] of Object.entries(inv.item.skill_mods)) {
        skillBonuses[skill] = (skillBonuses[skill] || 0) + bonus;
      }
    }
  }
  
  return {
    ...modifiers,
    base_str: baseStats.str,
    base_dex: baseStats.dex,
    base_con: baseStats.con,
    base_wis: baseStats.wis,
    base_int: baseStats.int,
    base_cha: baseStats.cha,
    base_hp: baseStats.max_hp,
    base_ac: baseStats.ac,
    
    total_str: baseStats.str + modifiers.str_mod,
    total_dex: baseStats.dex + modifiers.dex_mod,
    total_con: baseStats.con + modifiers.con_mod,
    total_wis: baseStats.wis + modifiers.wis_mod,
    total_int: baseStats.int + modifiers.int_mod,
    total_cha: baseStats.cha + modifiers.cha_mod,
    total_hp: baseStats.max_hp + modifiers.hp_mod,
    total_ac: baseStats.ac + modifiers.ac_mod,
    
    skill_bonuses: skillBonuses
  };
}

/**
 * Calculate stat modifier from stat value (D&D formula)
 */
export function calculateStatModifier(stat: number): number {
  return Math.floor((stat - 10) / 2);
}

/**
 * Format modifier with + or - sign
 */
export function formatModifier(modifier: number): string {
  return modifier >= 0 ? `+${modifier}` : `${modifier}`;
}

/**
 * Get color for item rarity text
 */
export function getRarityColor(rarity: string): string {
  const colors: { [key: string]: string } = {
    'Common': '#FFFFFF',      // Tier 1 - White
    'Uncommon': '#4ADE80',    // Tier 2 - Green
    'Rare': '#38BDF8',        // Tier 3 - Blue/Cyan
    'Epic': '#A855F7',        // Tier 4 - Purple
    'Mythic': '#FB923C',      // Tier 5 - Orange
    'Ultra Rare': '#FB923C',  // Tier 5 - Orange (same as Mythic)
    'MISSION ITEM': '#FACC15' // Gold/Yellow
  };
  return colors[rarity] || colors['Common'];
}

/**
 * Get background color for rarity badge (darker/transparent version)
 */
export function getRarityBgColor(rarity: string): string {
  const colors: { [key: string]: string } = {
    'Common': 'rgba(255, 255, 255, 0.15)',
    'Uncommon': 'rgba(74, 222, 128, 0.2)',
    'Rare': 'rgba(56, 189, 248, 0.2)',
    'Epic': 'rgba(168, 85, 247, 0.2)',
    'Mythic': 'rgba(251, 146, 60, 0.2)',
    'Ultra Rare': 'rgba(251, 146, 60, 0.2)',
    'MISSION ITEM': 'rgba(250, 204, 21, 0.2)'
  };
  return colors[rarity] || colors['Common'];
}

/**
 * Get icon for item type
 */
export function getItemTypeIcon(type: string): string {
  const icons: { [key: string]: string } = {
    weapon: '⚔️',
    armor: '🛡️',
    consumable: '💊',
    cyberware: '🔌',
    item: '📦',
    mission_item: '⭐'
  };
  return icons[type] || icons.item;
}

/**
 * Get icon for ability type
 */
export function getAbilityTypeIcon(type: string): string {
  const icons: { [key: string]: string } = {
    action: '⚡',
    bonus_action: '⚡',
    reaction: '🛡️',
    passive: '🌟',
    utility: '🔧'
  };
  return icons[type] || '✨';
}

/**
 * Get charge type display text
 */
export function getChargeTypeText(chargeType: string, maxCharges: number | null): string {
  if (chargeType === 'infinite') return 'Unlimited';
  if (chargeType === 'short_rest') return `${maxCharges || 1} / Short Rest`;
  if (chargeType === 'long_rest') return `${maxCharges || 1} / Long Rest`;
  if (chargeType === 'uses') return `${maxCharges || 1} Uses`;
  return 'Unknown';
}

/**
 * Check if ability can be used (has charges remaining)
 */
export function canUseAbility(ability: { charge_type: string; current_charges?: number }): boolean {
  if (ability.charge_type === 'infinite') return true;
  return (ability.current_charges || 0) > 0;
}

/**
 * Restore charges based on rest type
 */
export function restoreCharges(
  chargeType: string,
  maxCharges: number | null,
  chargesPerRest: number | null,
  restType: 'short_rest' | 'long_rest'
): number {
  // Infinite charges are always full
  if (chargeType === 'infinite') return maxCharges || 0;
  
  // If it's a 'uses' type, don't restore on rest
  if (chargeType === 'uses') return 0;
  
  // Short rest abilities restore on short or long rest
  if (chargeType === 'short_rest') {
    return chargesPerRest || maxCharges || 0;
  }
  
  // Long rest abilities only restore on long rest
  if (chargeType === 'long_rest' && restType === 'long_rest') {
    return chargesPerRest || maxCharges || 0;
  }
  
  return 0;
}

/**
 * Calculate total value of inventory (sum of all item prices)
 */
export function calculateInventoryValue(inventory: InventoryItem[]): number {
  return inventory.reduce((total, inv) => {
    if (inv.item) {
      return total + (inv.item.price * inv.quantity);
    }
    return total;
  }, 0);
}

/**
 * Group inventory items by type
 */
export function groupInventoryByType(inventory: InventoryItem[]): { [type: string]: InventoryItem[] } {
  return inventory.reduce((groups, inv) => {
    if (!inv.item) return groups;
    const type = inv.item.type;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(inv);
    return groups;
  }, {} as { [type: string]: InventoryItem[] });
}
