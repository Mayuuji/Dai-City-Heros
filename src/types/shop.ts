// Shop system types

export interface Shop {
  id: string;
  location_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
  updated_at: string;
}

export interface ShopInventoryItem {
  id: string;
  shop_id: string;
  item_id: string;
  stock_quantity: number; // -1 for unlimited
  price_credits: number;
  price_item_id: string | null; // Item required as payment (barter)
  price_item_quantity: number; // How many of the barter item needed
  created_at: string;
  updated_at: string;
}

// Extended type that includes item details
export interface ShopInventoryItemWithDetails extends ShopInventoryItem {
  item: {
    id: string;
    name: string;
    description: string | null;
    type: string;
    rarity: string;
    price: number;
    is_consumable: boolean;
    is_equippable: boolean;
    stack_size: number;
    // Stat modifiers
    ac_mod: number;
    hp_mod: number;
    hp_mod_type: string;
    str_mod: number;
    dex_mod: number;
    con_mod: number;
    wis_mod: number;
    int_mod: number;
    cha_mod: number;
    speed_mod: number;
    init_mod: number;
    ic_mod: number;
    // Skill modifiers
    skill_mods: { [skillName: string]: number } | null;
    // Subtypes
    armor_subtype: string | null;
    weapon_subtype: string | null;
    ic_cost: number;
    // Item abilities (if fetched)
    abilities?: Array<{
      ability?: {
        id: string;
        name: string;
        description: string;
        type: string;
        damage_dice: string | null;
        damage_type: string | null;
        range_feet: number | null;
        area_of_effect: string | null;
        duration: string | null;
        effects: string[];
      };
    }>;
  };
  price_item?: {
    id: string;
    name: string;
    rarity: string;
  } | null;
}

// For displaying shop with location info
export interface ShopWithLocation extends Shop {
  location: {
    id: string;
    name: string;
    icon: string;
    color: string;
  };
}
