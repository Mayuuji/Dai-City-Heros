# Dai City Heros — Master Implementation Guide

> **Purpose**: This document is a step-by-step specification for an AI coding agent to implement all features described below. Each phase is self-contained with database migrations, type changes, component changes, and acceptance criteria. Phases MUST be completed in order — later phases depend on earlier ones.

> **Tech Stack**: React 18 + TypeScript + Vite + Tailwind CSS v4 + Supabase (PostgreSQL). Deployed to Vercel. GitHub repo: Mayuuji/Dai-City-Heros.

> **Build Command**: `tsc && vite build` — TypeScript strict mode is enforced. All unused variables/imports cause build failures (TS6133/TS6196). Always run `npx tsc --noEmit` after changes.

> **Working Directory**: `c:\Users\mattj\OneDrive\DND\Dai City Heros`

---

## Table of Contents

1. [Phase 1: Weapon To-Hit & Damage System](#phase-1-weapon-to-hit--damage-system)
2. [Phase 2: Ability Cooldown Display](#phase-2-ability-cooldown-display)
3. [Phase 3: Combat Menu Enhancements](#phase-3-combat-menu-enhancements)
4. [Phase 4: Equipment Slot System](#phase-4-equipment-slot-system)
5. [Phase 5: Weight & Carrying Capacity](#phase-5-weight--carrying-capacity)
6. [Phase 6: Storage Containers](#phase-6-storage-containers)
7. [Phase 7: Player Dashboard Visual Overhaul](#phase-7-player-dashboard-visual-overhaul)
8. [Phase 8: Ruleset System](#phase-8-ruleset-system)

---

## Phase 1: Weapon To-Hit & Damage System

**Goal**: Weapons should store a structured to-hit modifier and damage formula (e.g. `2d6 + 4 + DEX`) instead of relying solely on weapon rank.

### 1.1 Database Migration

Create `database/weapon-stats-migration.sql`:

```sql
-- Add weapon combat stats to items table
ALTER TABLE items ADD COLUMN IF NOT EXISTS to_hit_type TEXT DEFAULT 'static' 
  CHECK (to_hit_type IN ('static', 'stat', 'skill', 'modifier'));
ALTER TABLE items ADD COLUMN IF NOT EXISTS to_hit_static INTEGER DEFAULT 0;
ALTER TABLE items ADD COLUMN IF NOT EXISTS to_hit_reference TEXT; 
  -- References a stat name (e.g. 'DEX'), a skill name (e.g. 'Hacking'), 
  -- or a custom modifier key (Phase 8). NULL if to_hit_type = 'static'.

ALTER TABLE items ADD COLUMN IF NOT EXISTS damage_dice TEXT; 
  -- Dice notation string, e.g. '2d6', '1d8', '3d4'
ALTER TABLE items ADD COLUMN IF NOT EXISTS damage_static_bonus INTEGER DEFAULT 0; 
  -- Static additive bonus, e.g. +4
ALTER TABLE items ADD COLUMN IF NOT EXISTS damage_bonus_type TEXT 
  CHECK (damage_bonus_type IN ('none', 'stat', 'skill', 'modifier'));
ALTER TABLE items ADD COLUMN IF NOT EXISTS damage_bonus_reference TEXT; 
  -- Same logic as to_hit_reference. NULL if damage_bonus_type = 'none'.
ALTER TABLE items ADD COLUMN IF NOT EXISTS damage_type TEXT; 
  -- Damage type label, e.g. 'slashing', 'fire', 'piercing', 'energy'

-- Default damage_bonus_type for existing items
UPDATE items SET damage_bonus_type = 'none' WHERE damage_bonus_type IS NULL;
ALTER TABLE items ALTER COLUMN damage_bonus_type SET DEFAULT 'none';
```

### 1.2 Type Changes

In `src/types/inventory.ts`:

```typescript
// Add to Item interface:
export type ToHitType = 'static' | 'stat' | 'skill' | 'modifier';
export type DamageBonusType = 'none' | 'stat' | 'skill' | 'modifier';

// Extend the Item interface:
export interface Item {
  // ... existing fields ...
  to_hit_type: ToHitType;
  to_hit_static: number;
  to_hit_reference: string | null;
  damage_dice: string | null;
  damage_static_bonus: number;
  damage_bonus_type: DamageBonusType;
  damage_bonus_reference: string | null;
  damage_type: string | null;
}

// Also update CreateItemInput to include these fields
```

### 1.3 Component Changes

#### DMItemCreator.tsx & DMItemEditor.tsx

When `type === 'weapon'`, show a new **"Combat Stats"** section BELOW the existing weapon_subtype selector:

```
┌─────────────────────────────────────────────┐
│ ⚔️ COMBAT STATS                             │
│                                              │
│ TO-HIT MODIFIER                              │
│ [Type: Static ▾]  [Value: +0 ___]           │
│   If "Stat": [Select stat: STR ▾]           │
│   If "Skill": [Select skill: Hacking ▾]     │
│   If "Modifier": [Modifier key: ____]       │
│                                              │
│ DAMAGE                                       │
│ [Dice: 2d6 ___] + [Static: +4 ___]          │
│ Additional Bonus: [Type: None ▾]             │
│   If "Stat/Skill/Modifier": [Reference: ▾]  │
│ Damage Type: [slashing ___]                  │
└─────────────────────────────────────────────┘
```

- The "Type" dropdown for to-hit has options: `Static`, `Stat-Based`, `Skill-Based`, `Custom Modifier`
- When `Static`: show a number input for the flat bonus
- When `Stat-Based`: show a dropdown of the 6 stats (`STR, DEX, CON, WIS, INT, CHA`). The to-hit bonus is the character's stat value.
- When `Skill-Based`: show a dropdown of `ALL_SKILLS`. The to-hit bonus is the character's skill modifier.
- When `Custom Modifier`: show a text input for the modifier key (used in Phase 8 rulesets).
- Same logic for `damage_bonus_type`
- `damage_dice` is a free text input — DM types `2d6`, `1d8+1d4`, etc.
- `damage_static_bonus` is a number input
- `damage_type` is a free text input (e.g. `slashing`, `fire`, `energy`)

Save all new fields to the `items` table on insert/update.

#### Inventory Display (PlayerDashboard.tsx inventory tab, Inventory.tsx)

When viewing a weapon item's details, display the combat stats:

```
⚔️ COMBAT STATS
To-Hit: +5 (DEX-based)        ← resolved: show the actual computed value for the character
Damage: 2d6 + 4 + DEX (+2)    ← show dice + static + bonus label + resolved value
Type: Slashing
```

Use the selected character's stats to resolve the display values. For `to_hit_type === 'stat'`, look up the character's stat value. For `'skill'`, look up the skill column value.

#### DMDashboard.tsx Items Tab

When displaying items in the items list or give-item dialogs, show a compact weapon stats badge for weapons:
```
🗡️ 2d6+4 | +5 to hit
```

### 1.4 Utility Function

In `src/utils/stats.ts`, add:

```typescript
export function resolveToHit(item: Item, character: Character): number {
  if (item.to_hit_type === 'static') return item.to_hit_static;
  if (item.to_hit_type === 'stat' && item.to_hit_reference) {
    const statKey = item.to_hit_reference.toLowerCase() as keyof Character;
    return (character[statKey] as number) || 0;
  }
  if (item.to_hit_type === 'skill' && item.to_hit_reference) {
    const skillCol = 'skill_' + item.to_hit_reference.toLowerCase().replace(/ /g, '_');
    return (character[skillCol as keyof Character] as number) || 0;
  }
  return item.to_hit_static; // fallback
}

export function formatDamage(item: Item, character?: Character): string {
  let parts: string[] = [];
  if (item.damage_dice) parts.push(item.damage_dice);
  if (item.damage_static_bonus) parts.push(`${item.damage_static_bonus > 0 ? '+' : ''}${item.damage_static_bonus}`);
  if (item.damage_bonus_type !== 'none' && item.damage_bonus_reference) {
    const label = item.damage_bonus_reference;
    if (character) {
      const resolved = resolveToHit({ ...item, to_hit_type: item.damage_bonus_type, to_hit_reference: item.damage_bonus_reference } as any, character);
      parts.push(`+ ${label}(${resolved >= 0 ? '+' : ''}${resolved})`);
    } else {
      parts.push(`+ ${label}`);
    }
  }
  return parts.join(' ') || 'No damage';
}
```

### 1.5 Acceptance Criteria

- [ ] DM can create a weapon with to-hit type (static/stat/skill/modifier) and damage formula
- [ ] DM can edit existing weapons to add combat stats
- [ ] Players see resolved to-hit and damage on weapon item details
- [ ] Existing weapons without combat stats display gracefully (show "No damage data" or similar)
- [ ] Build passes (`npx tsc --noEmit` returns 0 errors)
- [ ] Commit and push

---

## Phase 2: Ability Cooldown Display

**Goal**: Show how many rests are needed before an ability can be used again.

### 2.1 No Database Changes Required

The `character_abilities` table already has `current_charges` and the `abilities` table has `charge_type`, `max_charges`, and `charges_per_rest`.

### 2.2 Display Logic

In `src/utils/stats.ts`, add:

```typescript
export function getAbilityCooldownText(ability: Ability, currentCharges: number): string | null {
  if (ability.charge_type === 'infinite') return null; // always available
  if (currentCharges > 0) return null; // has charges, usable

  if (ability.charge_type === 'short_rest') {
    return '🔄 Recharges on Short Rest';
  }
  if (ability.charge_type === 'long_rest') {
    const chargesPerRest = ability.charges_per_rest || ability.max_charges || 1;
    const needed = Math.ceil((ability.max_charges || 1) / chargesPerRest);
    if (needed <= 1) return '🌙 Recharges on Long Rest';
    return `🌙 Needs ${needed} Long Rests to fully recharge`;
  }
  if (ability.charge_type === 'uses') {
    return '⚠️ No charges remaining (permanent)';
  }
  return null;
}
```

### 2.3 Component Changes

#### PlayerDashboard.tsx — Abilities Tab

For each ability card, below the existing charges display (`X/Y charges`), add:

```tsx
{ability.current_charges !== undefined && ability.current_charges <= 0 && (
  <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-magenta)' }}>
    {getAbilityCooldownText(ability, ability.current_charges)}
  </div>
)}
```

Show the cooldown text in magenta/red when charges are at 0.

#### DMDashboard.tsx — Player Abilities Sub-Tab

Same cooldown indicator next to the charge counter when DM is viewing a player's abilities.

#### DMEncounterManager.tsx — Combat Abilities Panel

When showing participant abilities during combat, display the cooldown warning if charges are depleted.

### 2.4 Acceptance Criteria

- [ ] Abilities with 0 charges show "Recharges on Short Rest" / "Recharges on Long Rest" etc.
- [ ] Abilities with remaining charges show no cooldown text
- [ ] Infinite abilities never show cooldown text
- [ ] Build passes
- [ ] Commit and push

---

## Phase 3: Combat Menu Enhancements

**Goal**: Add item usage on other players, per-turn status effects with auto-decrement, and move DM notes to the top.

### 3.1 Database Migration

Create `database/combat-enhancements-migration.sql`:

```sql
-- Per-turn status effects on encounter participants
CREATE TABLE IF NOT EXISTS encounter_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id),
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES encounter_participants(id) ON DELETE CASCADE,
  label TEXT NOT NULL,                    -- e.g. "Poison 3 DMG", "Stunned", "Burning"
  remaining_rounds INTEGER NOT NULL,      -- Decrements each round. 0 = expired.
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Disable RLS (same as encounter_participants)
ALTER TABLE encounter_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "encounter_statuses_all" ON encounter_statuses FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE encounter_statuses;
```

### 3.2 Type Changes

In `src/types/encounter.ts`, add:

```typescript
export interface EncounterStatus {
  id: string;
  encounter_id: string;
  participant_id: string;
  label: string;
  remaining_rounds: number;
  created_by: string | null;
  created_at: string;
}
```

### 3.3 Feature: Use Items on Other Players (DMEncounterManager.tsx)

Add an **"USE ITEM ON..."** button in the participant detail panel (right side, when a player participant is selected). Workflow:

1. DM clicks "USE ITEM" on the active participant's detail panel
2. A modal/dropdown appears showing the active participant's **consumable inventory items**
3. DM selects a consumable item
4. A second dropdown appears: **"Target: [list of player participants]"**
5. DM selects target player and clicks "APPLY"
6. Backend logic:
   - If the item has `hp_mod_type === 'heal'`: add `hp_mod` to target's `current_hp` (capped at `max_hp`). Update `characters.current_hp`.
   - If the item has stat modifiers: these would need a temporary buff system (out of scope for now — just consume and log)
   - Decrement the source player's inventory quantity. If quantity reaches 0, delete the inventory row.
   - Show a confirmation toast: `"[Player A] used [Item] on [Player B] — healed X HP"`

Implementation notes:
- Fetch the active participant's inventory: `supabase.from('inventory').select('*, item:items!inventory_item_id_fkey(*)').eq('character_id', participantCharacterId).eq('is_equipped', false)` then filter for `item.is_consumable === true`
- Apply effects to target character
- Refresh both inventories

### 3.4 Feature: Per-Turn Status Effects (DMEncounterManager.tsx)

Add a **status effects section** to each participant's card in the initiative order (left panel):

```
┌─────────────────────────────────────┐
│ 🎯 [Player Name]  ❤️ 45/60  🛡️ 16 │
│ Init: 18                            │
│ 🔴 Poison 3 DMG (2 rounds)         │  ← status badges
│ 🟡 Stunned (1 round)               │
└─────────────────────────────────────┘
```

**Adding a status**: In the participant detail panel (right side), add:
```
┌─────────────────────────────────────┐
│ + ADD STATUS EFFECT                  │
│ Label: [Poison 3 DMG          ]     │
│ Duration: [3] rounds                │
│ [ADD]                                │
└─────────────────────────────────────┘
```

- Insert into `encounter_statuses` table
- Display on the participant card as colored badges

**Auto-decrement**: When `advance_turn()` completes a full round (i.e., turn wraps back to 1 and `round_number` increments), decrement ALL `encounter_statuses.remaining_rounds` by 1 for all participants in that encounter. Delete rows where `remaining_rounds <= 0`.

Implementation approach — in the `handleNextTurn` function:
```typescript
// After advancing the turn via RPC...
const { data: updatedEncounter } = await supabase.from('encounters').select('round_number').eq('id', encounterId).single();
if (updatedEncounter && updatedEncounter.round_number > previousRoundNumber) {
  // Round advanced — decrement all statuses
  await supabase.rpc('decrement_encounter_statuses', { p_encounter_id: encounterId });
}
```

Create an RPC function in the migration:
```sql
CREATE OR REPLACE FUNCTION decrement_encounter_statuses(p_encounter_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE encounter_statuses 
  SET remaining_rounds = remaining_rounds - 1 
  WHERE encounter_id = p_encounter_id;
  
  DELETE FROM encounter_statuses 
  WHERE encounter_id = p_encounter_id AND remaining_rounds <= 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3.5 Feature: Move DM Notes to Top (DMEncounterManager.tsx & DMDashboard.tsx Encounters Tab)

Currently, participant notes are in the detail panel at the bottom/right. Move the **DM notes textareas** to the TOP of the encounter panel, above the initiative order. Layout change:

```
┌──────────────────────────────────────────────┐
│ ⚔️ ENCOUNTER: [Name]  Round: 3  Turn: 5     │
│                                              │
│ 📝 DM NOTES                                  │
│ ┌──────────────────────────────────────────┐ │
│ │ [Current participant notes textarea]     │ │
│ │ Quick notes visible at all times         │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ ┌──────────────┐ ┌────────────────────────┐ │
│ │ INITIATIVE   │ │ PARTICIPANT DETAILS    │ │
│ │ ORDER (1/3)  │ │ (2/3)                 │ │
│ │ ...          │ │ ...                    │ │
│ └──────────────┘ └────────────────────────┘ │
└──────────────────────────────────────────────┘
```

The notes textarea should auto-save with debounce (already implemented — just move its position in JSX).

### 3.6 PlayerEncounterView.tsx Changes

- Show status effect badges on each visible participant (read from `encounter_statuses` table)
- Subscribe to realtime changes on `encounter_statuses`

### 3.7 Acceptance Criteria

- [ ] DM can use a player's consumable item on another player during combat
- [ ] Item effects (healing) are applied to the target character
- [ ] Item is consumed from source player's inventory
- [ ] DM can add text-based status effects with round duration to any participant
- [ ] Status effects auto-decrement when a new round starts
- [ ] Expired status effects are automatically removed
- [ ] Status effect badges show on participant cards in initiative order
- [ ] DM notes textarea is at the top of the encounter panel
- [ ] Players can see status effect badges on participants
- [ ] Build passes
- [ ] Commit and push

---

## Phase 4: Equipment Slot System

**Goal**: Characters have specific equipment slots (head, chest, legs, eyewear, gloves, shoes, 2 accessories) and can equip weapon modifications.

### 4.1 Database Migration

Create `database/equipment-slots-migration.sql`:

```sql
-- Add equipment slot to inventory (which slot is this item equipped in?)
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS equipped_slot TEXT 
  CHECK (equipped_slot IN (
    'head', 'chest', 'legs', 'eyewear', 'gloves', 'shoes', 
    'accessory_1', 'accessory_2',
    'weapon_primary', 'weapon_secondary',
    NULL  -- NULL means not equipped in a slot (just "equipped" generically for backwards compat)
  ));

-- Add equipment slot type to items (what slot can this item go in?)
ALTER TABLE items ADD COLUMN IF NOT EXISTS slot_type TEXT 
  CHECK (slot_type IN (
    'head', 'chest', 'legs', 'eyewear', 'gloves', 'shoes', 
    'accessory', 'weapon', 'backpack', 'weapon_mod',
    NULL  -- NULL = no specific slot (consumable, generic item, etc.)
  ));

-- Weapon modifications table
CREATE TABLE IF NOT EXISTS weapon_modifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id),
  inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE, 
    -- the weapon inventory entry this mod is attached to
  mod_item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    -- the item that IS the modification
  slot_order INTEGER DEFAULT 1, -- mod slot position (1, 2, 3...)
  attached_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(inventory_id, mod_item_id)
);

ALTER TABLE weapon_modifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weapon_mods_all" ON weapon_modifications FOR ALL USING (true) WITH CHECK (true);

-- Character portrait/model image
ALTER TABLE characters ADD COLUMN IF NOT EXISTS portrait_url TEXT;
```

### 4.2 Type Changes

In `src/types/inventory.ts`:

```typescript
export type EquipmentSlot = 'head' | 'chest' | 'legs' | 'eyewear' | 'gloves' | 'shoes' | 'accessory_1' | 'accessory_2' | 'weapon_primary' | 'weapon_secondary';

export type ItemSlotType = 'head' | 'chest' | 'legs' | 'eyewear' | 'gloves' | 'shoes' | 'accessory' | 'weapon' | 'backpack' | 'weapon_mod' | null;

// Extend Item interface:
export interface Item {
  // ... existing ...
  slot_type: ItemSlotType;
}

// Extend InventoryItem interface:
export interface InventoryItem {
  // ... existing ...
  equipped_slot: EquipmentSlot | null;
}

export interface WeaponModification {
  id: string;
  inventory_id: string;
  mod_item_id: string;
  slot_order: number;
  attached_at: string;
  mod_item?: Item; // joined
}
```

### 4.3 Component Changes

#### DMItemCreator.tsx & DMItemEditor.tsx

Add a **Slot Type** dropdown to the item form (shown for all equippable items):

```
EQUIPMENT SLOT: [None ▾]
Options: Head, Chest, Legs, Eyewear, Gloves, Shoes, Accessory, Weapon, Backpack, Weapon Mod
```

- `weapon` type items automatically default to `slot_type = 'weapon'`
- `armor` type items should map to appropriate slot based on `armor_subtype`:
  - `clothes` → chest
  - `light/medium/heavy` → chest
  - `shield` → accessory

#### PlayerDashboard.tsx — New Equipment Panel

See [Phase 7](#phase-7-player-dashboard-visual-overhaul) for the full visual overhaul. The slot system is the data layer that enables it.

**Equip action changes:**
- When a player equips an item, they must choose which slot to put it in (if the item has a `slot_type`)
- If the slot is occupied, show a confirmation: "Replace [CurrentItem] with [NewItem]?"
- Set `inventory.equipped_slot` to the chosen slot
- Set `inventory.is_equipped = true`
- Unequippable items (`is_equippable = false`) cannot be placed in slots

**Weapon modification flow:**
- When viewing an equipped weapon, show "MOD SLOTS" section
- Player can drag/select `weapon_mod` type items from inventory to attach to the weapon
- Insert into `weapon_modifications` table
- Mod stat bonuses should be included in stat calculations (add to weapon's effective stats)

### 4.4 Stat Calculation Update

In `src/utils/stats.ts`, update `calculateTotalStats()`:
- When summing equipped item bonuses, also include weapon modification bonuses
- Query: For each equipped weapon in inventory, fetch `weapon_modifications` joined with `items` to get mod stat bonuses

### 4.5 Acceptance Criteria

- [ ] Items have a `slot_type` field configurable by DM
- [ ] Players can equip items into specific slots (head, chest, legs, etc.)
- [ ] Only one item per slot (except accessories which have 2 slots)
- [ ] Weapon modifications can be attached to equipped weapons
- [ ] Mod bonuses are included in stat calculations
- [ ] Characters have a `portrait_url` field
- [ ] Build passes
- [ ] Commit and push

---

## Phase 5: Weight & Carrying Capacity

**Goal**: Optional weight system — items have weight, characters have carrying capacity, backpacks increase capacity.

### 5.1 Database Migration

Create `database/weight-system-migration.sql`:

```sql
-- Add weight to items
ALTER TABLE items ADD COLUMN IF NOT EXISTS weight NUMERIC(8,2) DEFAULT 0;

-- Add carrying capacity to characters
ALTER TABLE characters ADD COLUMN IF NOT EXISTS carrying_capacity NUMERIC(8,2) DEFAULT 100;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS base_carrying_capacity NUMERIC(8,2) DEFAULT 100;

-- Campaign-level toggle for weight system
-- Uses existing game_settings table:
-- key: 'weight_system_enabled', value: { enabled: true/false }
```

### 5.2 Type Changes

```typescript
// In Item interface:
weight: number;

// In Character interface (PlayerDashboard.tsx local interface + CharacterCreation):
carrying_capacity: number;
base_carrying_capacity: number;
```

### 5.3 Component Changes

#### DMDashboard.tsx Settings Tab

Add a toggle:
```
⚖️ WEIGHT SYSTEM: [ON/OFF toggle]
```

Saves to `game_settings` as `{ key: 'weight_system_enabled', value: { enabled: true } }`.

#### DMItemCreator.tsx & DMItemEditor.tsx

Add a **Weight** number input field (shown when weight system is enabled for the campaign):
```
WEIGHT: [0.5 ___] lbs
```

#### PlayerDashboard.tsx

When weight system is enabled:
- Show a weight bar in the inventory header: `⚖️ 45.2 / 100 lbs`
- Calculate total weight: sum of `item.weight * inventory.quantity` for all inventory items
- Calculate effective capacity: `base_carrying_capacity` + bonuses from equipped `backpack` slot items
- If over capacity, show warning in red: `⚠️ OVERENCUMBERED`
- The DM can decide gameplay effects of being overencumbered (not coded — just visual warning)

#### CharacterCreation.tsx

Set `base_carrying_capacity` based on class STR or a default (100). Store in `characters` table.

### 5.4 Acceptance Criteria

- [ ] DM can toggle weight system on/off per campaign
- [ ] Items have a weight field
- [ ] Players see their current weight vs capacity
- [ ] Backpack items in equipment increase carrying capacity
- [ ] Overencumbered warning displays
- [ ] Weight system hidden when disabled
- [ ] Build passes
- [ ] Commit and push

---

## Phase 6: Storage Containers

**Goal**: DM can create storage containers that players can store items into. DM can lock/unlock containers.

### 6.1 Database Migration

Create `database/storage-containers-migration.sql`:

```sql
CREATE TABLE IF NOT EXISTS storage_containers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_locked BOOLEAN DEFAULT false,
  max_capacity NUMERIC(8,2),       -- optional weight limit
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS storage_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  container_id UUID NOT NULL REFERENCES storage_containers(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  stored_by UUID REFERENCES profiles(id),
  stored_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE storage_containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "storage_containers_read" ON storage_containers FOR SELECT USING (true);
CREATE POLICY "storage_containers_admin" ON storage_containers FOR ALL USING (
  EXISTS (SELECT 1 FROM campaign_members WHERE campaign_id = storage_containers.campaign_id AND user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "storage_items_read" ON storage_items FOR SELECT USING (true);
CREATE POLICY "storage_items_write" ON storage_items FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE storage_containers;
ALTER PUBLICATION supabase_realtime ADD TABLE storage_items;
```

### 6.2 Type Changes

```typescript
// New file: src/types/storage.ts
export interface StorageContainer {
  id: string;
  campaign_id: string;
  name: string;
  description: string | null;
  is_locked: boolean;
  max_capacity: number | null;
  created_by: string | null;
  created_at: string;
}

export interface StorageItem {
  id: string;
  container_id: string;
  item_id: string;
  quantity: number;
  stored_by: string | null;
  stored_at: string;
  item?: Item; // joined
}
```

### 6.3 Component Changes

#### DMDashboard.tsx — New Storage Management (could be a sub-section of Settings or a new tab)

Add a **STORAGE** section (either a new tab or inside settings):
- List all storage containers for the campaign
- Create new container: Name, Description, optional max capacity
- Toggle lock/unlock per container (updates `is_locked`)
- View container contents: list of items with quantities
- Add items to container directly (from the items database)

#### PlayerDashboard.tsx — Storage Access

Add a **"📦 STORAGE"** button/panel accessible from inventory:
- Lists all unlocked storage containers for the campaign
- Click to open a container and see its contents
- **Store Item**: Player selects an item from their inventory → specify quantity → item moves from `inventory` to `storage_items` (deducted from player inventory)
- **Retrieve Item**: Player selects an item from container → specify quantity → item moves from `storage_items` to `inventory`
- Locked containers show a 🔒 icon and cannot be interacted with
- If weight system is enabled, show container's current weight vs max capacity

#### Real-time Updates

Subscribe to `storage_containers` and `storage_items` changes via Supabase realtime so all players see changes immediately when the DM locks/unlocks or another player stores/retrieves.

### 6.4 Acceptance Criteria

- [ ] DM can create/delete storage containers with name and optional capacity
- [ ] DM can lock/unlock containers
- [ ] Players can see unlocked containers
- [ ] Players can store items from inventory into containers
- [ ] Players can retrieve items from containers into inventory
- [ ] Locked containers are visible but not interactable
- [ ] Real-time sync between all players
- [ ] Build passes
- [ ] Commit and push

---

## Phase 7: Player Dashboard Visual Overhaul

**Goal**: Redesign PlayerDashboard to have a sci-fi inventory screen layout inspired by the reference image. Character model in center, stats on left, inventory on right, equipment slots around character.

### 7.1 Database Changes

Uses `characters.portrait_url` added in Phase 4.

### 7.2 Layout Specification

Replace the current tab-based layout with a **three-panel layout**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ HEADER: Character Name | Class | Level | HP Bar | Credits | ⚙️ Menu    │
├──────────────┬─────────────────────────┬────────────────────────────────┤
│              │                         │                                │
│  LEFT PANEL  │     CENTER PANEL        │        RIGHT PANEL             │
│  (Stats &    │   (Character Model      │      (Inventory Grid)          │
│   Skills)    │    + Equipment Slots)    │                                │
│              │                         │                                │
│  ┌─────────┐ │    ┌─[Eyewear]──┐       │  ┌──Search/Filter─────────┐   │
│  │ STATS   │ │    │            │       │  │                        │   │
│  │ STR: +2 │ │ [Head]  [IMG]  [Acc1]  │  │  ┌────┐ ┌────┐ ┌────┐ │   │
│  │ DEX: +3 │ │    │  Portrait │       │  │  │Item│ │Item│ │Item│ │   │
│  │ CON: +1 │ │ [Gloves] │  [Acc2]     │  │  └────┘ └────┘ └────┘ │   │
│  │ WIS: +0 │ │    │     │             │  │  ┌────┐ ┌────┐ ┌────┐ │   │
│  │ INT: +1 │ │ [Chest]  │  [Wpn1]    │  │  │Item│ │Item│ │Item│ │   │
│  │ CHA: -1 │ │    │     │             │  │  └────┘ └────┘ └────┘ │   │
│  └─────────┘ │ [Legs]   │  [Wpn2]    │  │  ...                   │   │
│              │    │     │             │  │                        │   │
│  ┌─────────┐ │ [Shoes]  │             │  └────────────────────────┘   │
│  │ SKILLS  │ │    └──────┘             │                                │
│  │ Acro: +3│ │                         │  ┌──Item Details Panel────┐   │
│  │ Hack: +5│ │  ⚖️ 45/100 lbs         │  │  Selected item info    │   │
│  │ ...     │ │                         │  │  Equip/Use/Consume     │   │
│  └─────────┘ │                         │  └────────────────────────┘   │
│              │                         │                                │
├──────────────┴─────────────────────────┴────────────────────────────────┤
│ BOTTOM BAR: [⚡ Abilities] [📋 Missions] [📦 Storage] [⚔️ Combat]     │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Left Panel — Stats & Skills

- **Stats Block**: Show all 6 core stats with their computed values (base + equipment). Use color-coded modifiers (green for positive, red for negative)
- **Skills Block**: Scrollable list of 18 skills with modifiers. Group or sort alphabetically. Show proficiency indicators
- **Save Proficiencies**: Show save throw proficiencies
- **Weapon Ranks**: Show all 5 weapon type ranks with filled/empty pips (rank 0-5)
- **Compact display** — use small text, monospace font

### 7.4 Center Panel — Character Model & Equipment

- **Character Portrait**: Display `portrait_url` image. If none set, show a placeholder silhouette
- **Equipment Slots**: Arranged around the portrait image:
  - Above head: `eyewear`
  - Top: `head`
  - Left arm: `gloves`
  - Torso: `chest`
  - Right side top: `accessory_1`
  - Right side bottom: `accessory_2`
  - Below chest: `legs`
  - Bottom left: `shoes`
  - Far right: `weapon_primary`, `weapon_secondary`
- Each slot shows the equipped item's icon/emoji or a dotted outline if empty
- Clicking a slot shows the item detail in the right panel
- Clicking an empty slot filters the inventory to items that fit in that slot
- **Weight bar** at the bottom (if weight system is enabled)

#### Upload Portrait

- Add a button or click-on-portrait to upload a character image
- Use Supabase Storage bucket `character-portraits`
- Store the public URL in `characters.portrait_url`
- Alternatively, allow pasting a URL directly

### 7.5 Right Panel — Inventory

- **Search bar** + filter buttons (type, rarity)
- **Grid view** of inventory items (icon cards with name, quantity badge, rarity color border)
- Click an item to show **detail panel** below the grid:
  - Item name, type, rarity, description
  - Stat modifiers
  - Combat stats (if weapon — from Phase 1)
  - Equip/Unequip button (with slot selector)
  - Consume button (if consumable)
  - Drop/Discard button
  - If weapon: show attached mods

### 7.6 Bottom Bar — Navigation

Replace the old horizontal tabs with a bottom navigation bar:
- **⚡ Abilities**: Opens ability list overlay/modal
- **📋 Missions**: Opens mission log overlay/modal
- **📦 Storage**: Opens storage container panel (Phase 6)
- **⚔️ Combat**: Opens encounter view (if active encounter)

These open as overlays or slide-in panels rather than replacing the main view, so the player can always see their character.

### 7.7 Implementation Notes

- This is a FULL REWRITE of `PlayerDashboard.tsx`. The file is currently 2151 lines. Consider splitting into sub-components:
  - `src/components/player/StatsPanel.tsx`
  - `src/components/player/EquipmentPanel.tsx`
  - `src/components/player/InventoryPanel.tsx`
  - `src/components/player/AbilitiesModal.tsx`
  - `src/components/player/MissionsModal.tsx`
  - `src/components/player/StorageModal.tsx`
- Keep the state management in PlayerDashboard.tsx, pass props to sub-components
- Use CSS Grid for the 3-panel layout: `grid-template-columns: 250px 1fr 350px`
- Make it responsive — on mobile, stack panels vertically

### 7.8 Acceptance Criteria

- [ ] Three-panel layout: stats left, character center, inventory right
- [ ] Character portrait displayed (or placeholder)
- [ ] Equipment slots visible around character with equipped items shown
- [ ] Clicking slots interacts with inventory
- [ ] Inventory grid with search/filter
- [ ] Item detail panel with equip/consume/discard actions
- [ ] Bottom navigation bar for abilities/missions/storage/combat
- [ ] Abilities and missions accessible via overlays
- [ ] Weight bar displayed when enabled
- [ ] Responsive on smaller screens
- [ ] Build passes
- [ ] Commit and push

---

## Phase 8: Ruleset System

**Goal**: DMs can create reusable rulesets that define custom stat names, skills, classes, subclasses, level-up rewards, and custom modifiers. Campaigns are tied to a ruleset.

### ⚠️ CRITICAL: This is the most complex phase. It touches nearly every file. Plan carefully.

### 8.1 Database Migration

Create `database/rulesets-migration.sql`:

```sql
-- ============================================
-- RULESETS — Core Tables
-- ============================================

-- A ruleset is a collection of game rules
CREATE TABLE IF NOT EXISTS rulesets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  is_template BOOLEAN DEFAULT false,  -- system-provided templates
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Stat definitions (replaces hardcoded STR/DEX/CON/WIS/INT/CHA)
CREATE TABLE IF NOT EXISTS ruleset_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ruleset_id UUID NOT NULL REFERENCES rulesets(id) ON DELETE CASCADE,
  key TEXT NOT NULL,           -- internal key, e.g. 'str', 'dex', 'custom_luck'
  name TEXT NOT NULL,          -- display name, e.g. 'Strength', 'Luck'
  abbreviation TEXT NOT NULL,  -- e.g. 'STR', 'LCK'
  sort_order INTEGER DEFAULT 0,
  UNIQUE(ruleset_id, key)
);

-- Skill definitions (replaces hardcoded ALL_SKILLS)
CREATE TABLE IF NOT EXISTS ruleset_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ruleset_id UUID NOT NULL REFERENCES rulesets(id) ON DELETE CASCADE,
  key TEXT NOT NULL,            -- internal key, e.g. 'acrobatics'
  name TEXT NOT NULL,           -- display name, e.g. 'Acrobatics'
  linked_stat_key TEXT,         -- which stat this skill uses (e.g. 'dex')
  sort_order INTEGER DEFAULT 0,
  UNIQUE(ruleset_id, key)
);

-- Custom modifiers (e.g. "Hunger", "Radiation", "Sanity")
CREATE TABLE IF NOT EXISTS ruleset_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ruleset_id UUID NOT NULL REFERENCES rulesets(id) ON DELETE CASCADE,
  key TEXT NOT NULL,            -- internal key, e.g. 'hunger'
  name TEXT NOT NULL,           -- display name, e.g. 'Hunger'
  min_value INTEGER DEFAULT 0,
  max_value INTEGER DEFAULT 100,
  default_value INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  UNIQUE(ruleset_id, key)
);

-- Class definitions (replaces hardcoded CHARACTER_CLASSES)
CREATE TABLE IF NOT EXISTS ruleset_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ruleset_id UUID NOT NULL REFERENCES rulesets(id) ON DELETE CASCADE,
  key TEXT NOT NULL,            -- internal key, e.g. 'bruiser'
  name TEXT NOT NULL,           -- display name, e.g. 'Bruiser'
  description TEXT,
  hp INTEGER NOT NULL DEFAULT 20,
  ac INTEGER NOT NULL DEFAULT 14,
  cdd TEXT DEFAULT 'd8',       -- combat damage die
  speed INTEGER DEFAULT 30,
  initiative_modifier INTEGER DEFAULT 0,
  implant_capacity INTEGER DEFAULT 3,
  stat_bonuses JSONB DEFAULT '{}',    -- e.g. {"str": 2, "dex": 1}
  skill_bonuses JSONB DEFAULT '{}',   -- e.g. {"acrobatics": 3, "stealth": 2}
  save_proficiencies TEXT[] DEFAULT '{}',
  weapon_proficiencies TEXT[] DEFAULT '{}',
  armor_proficiencies TEXT[] DEFAULT '{}',
  tools TEXT[] DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  UNIQUE(ruleset_id, key)
);

-- Class starter items
CREATE TABLE IF NOT EXISTS ruleset_class_starter_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES ruleset_classes(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,     -- item to create/give on character creation
  item_type TEXT DEFAULT 'item',
  item_description TEXT,
  sort_order INTEGER DEFAULT 0
);

-- Class starter abilities  
CREATE TABLE IF NOT EXISTS ruleset_class_abilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES ruleset_classes(id) ON DELETE CASCADE,
  ability_name TEXT NOT NULL,
  ability_description TEXT,
  ability_type TEXT DEFAULT 'action',
  charge_type TEXT DEFAULT 'infinite',
  max_charges INTEGER DEFAULT 1,
  granted_at_level INTEGER DEFAULT 1,  -- what level the ability is granted
  sort_order INTEGER DEFAULT 0
);

-- Subclass definitions
CREATE TABLE IF NOT EXISTS ruleset_subclasses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES ruleset_classes(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  unlock_level INTEGER NOT NULL DEFAULT 3,  -- level at which subclass is chosen
  stat_bonuses JSONB DEFAULT '{}',
  skill_bonuses JSONB DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  UNIQUE(class_id, key)
);

-- Subclass abilities (granted when subclass is chosen or at specific levels)
CREATE TABLE IF NOT EXISTS ruleset_subclass_abilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subclass_id UUID NOT NULL REFERENCES ruleset_subclasses(id) ON DELETE CASCADE,
  ability_name TEXT NOT NULL,
  ability_description TEXT,
  ability_type TEXT DEFAULT 'action',
  charge_type TEXT DEFAULT 'infinite',
  max_charges INTEGER DEFAULT 1,
  granted_at_level INTEGER NOT NULL,
  sort_order INTEGER DEFAULT 0
);

-- Level-up rewards (class-specific)
CREATE TABLE IF NOT EXISTS ruleset_level_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES ruleset_classes(id) ON DELETE CASCADE,
  level INTEGER NOT NULL,                -- the level this reward is granted at
  reward_type TEXT NOT NULL CHECK (reward_type IN ('ability', 'stat_boost', 'skill_boost', 'hp_increase', 'feature', 'subclass_choice')),
  ability_name TEXT,                     -- if reward_type = 'ability'
  ability_description TEXT,
  stat_key TEXT,                         -- if reward_type = 'stat_boost'
  boost_amount INTEGER,                  -- for stat/skill/hp boosts
  skill_key TEXT,                        -- if reward_type = 'skill_boost'
  feature_text TEXT,                     -- if reward_type = 'feature', descriptive text
  sort_order INTEGER DEFAULT 0,
  UNIQUE(class_id, level, sort_order)
);

-- Link campaigns to rulesets
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS ruleset_id UUID REFERENCES rulesets(id);

-- Character custom modifier values (stores per-character values for custom modifiers)
CREATE TABLE IF NOT EXISTS character_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  modifier_key TEXT NOT NULL,    -- matches ruleset_modifiers.key
  current_value INTEGER NOT NULL DEFAULT 0,
  UNIQUE(character_id, modifier_key)
);

-- Character subclass selection
ALTER TABLE characters ADD COLUMN IF NOT EXISTS subclass_id UUID REFERENCES ruleset_subclasses(id);
ALTER TABLE characters ADD COLUMN IF NOT EXISTS ruleset_class_id UUID REFERENCES ruleset_classes(id);

-- Item custom modifier effects (items can modify custom modifiers)
CREATE TABLE IF NOT EXISTS item_modifier_effects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  modifier_key TEXT NOT NULL,
  modifier_value INTEGER NOT NULL DEFAULT 0,  -- positive = buff, negative = debuff
  UNIQUE(item_id, modifier_key)
);

-- RLS policies
ALTER TABLE rulesets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rulesets_read" ON rulesets FOR SELECT USING (true);
CREATE POLICY "rulesets_write" ON rulesets FOR ALL USING (owner_id = auth.uid());

ALTER TABLE ruleset_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ruleset_stats_all" ON ruleset_stats FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE ruleset_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ruleset_skills_all" ON ruleset_skills FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE ruleset_modifiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ruleset_modifiers_all" ON ruleset_modifiers FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE ruleset_classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ruleset_classes_all" ON ruleset_classes FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE ruleset_class_starter_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ruleset_starter_items_all" ON ruleset_class_starter_items FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE ruleset_class_abilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ruleset_class_abilities_all" ON ruleset_class_abilities FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE ruleset_subclasses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ruleset_subclasses_all" ON ruleset_subclasses FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE ruleset_subclass_abilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ruleset_subclass_abilities_all" ON ruleset_subclass_abilities FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE ruleset_level_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ruleset_level_rewards_all" ON ruleset_level_rewards FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE character_modifiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "character_modifiers_all" ON character_modifiers FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE item_modifier_effects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "item_modifier_effects_all" ON item_modifier_effects FOR ALL USING (true) WITH CHECK (true);

-- Create a default "Cyberpunk" ruleset seeded with current hardcoded data
-- (This should be done as a separate seed script or handled in application code)
```

### 8.2 Seed Script: Default Cyberpunk Ruleset

Create `database/seed-default-ruleset.sql`:

This script must:
1. Create a `rulesets` row with `name = 'Cyberpunk (Default)'`, `is_template = true`
2. Insert 6 `ruleset_stats` rows: `str/Strength/STR`, `dex/Dexterity/DEX`, `con/Constitution/CON`, `wis/Wisdom/WIS`, `int/Intelligence/INT`, `cha/Charisma/CHA`
3. Insert 18 `ruleset_skills` rows matching current `ALL_SKILLS` with appropriate `linked_stat_key`
4. Insert 13 `ruleset_classes` rows matching current `CHARACTER_CLASSES` data
5. Insert starter items and abilities for each class
6. No subclasses or level rewards — those are DM-created

### 8.3 Context Changes: RulesetContext

Create `src/contexts/RulesetContext.tsx`:

```typescript
interface RulesetContextType {
  ruleset: Ruleset | null;
  stats: RulesetStat[];        // ordered list of stats
  skills: RulesetSkill[];      // ordered list of skills
  modifiers: RulesetModifier[]; // custom modifiers
  classes: RulesetClass[];     // available classes
  loading: boolean;
  
  // Helper functions
  getStatName(key: string): string;      // e.g. 'str' → 'Strength'
  getStatAbbrev(key: string): string;    // e.g. 'str' → 'STR'
  getSkillName(key: string): string;     // e.g. 'acrobatics' → 'Acrobatics'
  getModifierName(key: string): string;  // e.g. 'hunger' → 'Hunger'
}
```

This context loads the campaign's ruleset data once and provides it everywhere. Every component that currently references hardcoded `STATS`, `ALL_SKILLS`, or `CHARACTER_CLASSES` must switch to using this context.

### 8.4 Ruleset Editor — New Page

Create `src/pages/RulesetEditor.tsx`:

This is a **DM-only page** (route: `/dm/ruleset-editor`) with tabbed sections:

#### Tab: Stats
- List current stat definitions (key, name, abbreviation)
- Add/remove/reorder stats
- Default: 6 D&D stats. DM can rename or add custom ones (e.g. "Luck", "Tech")

#### Tab: Skills
- List current skill definitions
- Each skill has: name, linked stat
- Add/remove/reorder skills
- Ability to add operation type: the skill value is the base value + or - the linked stat

#### Tab: Classes
- List all classes with expandable detail
- Each class editor:
  - Name, description, HP, AC, CDD, Speed, Init, IC
  - Stat bonuses (dropdowns for each stat defined in Stats tab)
  - Skill proficiencies/bonuses
  - Starter items (list with add/remove)
  - Starter abilities (list with add/remove)
  - Weapon/armor proficiencies
  - Save proficiencies
  - Tools

#### Tab: Subclasses
- Grouped by parent class
- Each subclass:
  - Name, description, unlock level
  - Stat bonuses
  - Skill bonuses
  - Abilities (with granted_at_level)

#### Tab: Level Rewards
- Table: Class × Level grid
- For each class, define what happens at each level (2-20):
  - New ability
  - Stat boost
  - Skill boost
  - HP increase
  - Feature (text)
  - Subclass choice (at what level?)

#### Tab: Custom Modifiers
- List of custom modifiers (name, key, min, max, default)
- Add/remove modifiers
- These appear on character sheets and can be modified by items

### 8.5 Campaign Creation Changes

In **CampaignContext.tsx** `createCampaign()` and **CampaignSelect.tsx**:

1. When DM clicks "Create Campaign", show an additional step: **"Select Ruleset"**
2. Options:
   - **Use existing ruleset** — dropdown of rulesets the DM owns + templates
   - **Create new ruleset** — opens `RulesetEditor` inline or navigates to it
   - **Clone from template** — copies a template ruleset for customization
3. Store `ruleset_id` on the `campaigns` row

### 8.6 Character Creation Changes

`CharacterCreation.tsx` must be rewritten to use the ruleset:

1. Fetch the campaign's ruleset
2. Load `ruleset_classes` instead of hardcoded `CHARACTER_CLASSES`
3. Show class selection using the ruleset-defined classes
4. On creation:
   - Set stats based on `ruleset_classes.stat_bonuses` mapped to `ruleset_stats.key`
   - Set skills based on `ruleset_classes.skill_bonuses` mapped to `ruleset_skills.key`
   - Create starter items from `ruleset_class_starter_items`
   - Grant starter abilities from `ruleset_class_abilities` where `granted_at_level = 1`
   - Initialize custom modifier values from `ruleset_modifiers.default_value` → insert into `character_modifiers`
   - Store `ruleset_class_id` on the character

### 8.7 Dynamic Character Data Model

The current `characters` table has hardcoded `str/dex/con/wis/int/cha` and `skill_*` columns. With dynamic rulesets, we need to handle characters that might have different stat/skill sets.

**Approach — Hybrid (recommended for minimal disruption)**:

Keep the existing columns for backward compatibility but add:

```sql
ALTER TABLE characters ADD COLUMN IF NOT EXISTS custom_stats JSONB DEFAULT '{}';
-- e.g. {"luck": 3, "tech": 2}

ALTER TABLE characters ADD COLUMN IF NOT EXISTS custom_skills JSONB DEFAULT '{}';
-- e.g. {"hacking_advanced": 4}
```

For the 6 core stats + 18 core skills, continue using the existing columns. For any additional stats/skills defined in a ruleset beyond those, use the JSONB columns.

The `RulesetContext` provides the helpers to read the right value:
```typescript
function getCharacterStat(character: Character, statKey: string): number {
  // Check if it's a standard stat column
  if (['str','dex','con','wis','int','cha'].includes(statKey)) {
    return character[statKey as keyof Character] as number;
  }
  // Otherwise check custom_stats JSONB
  return character.custom_stats?.[statKey] ?? 0;
}
```

Same for skills.

### 8.8 Item System Integration

Items need to be able to modify custom stats/skills/modifiers:

- The existing `str_mod`, `dex_mod`, etc. columns handle the 6 core stats
- For custom stats: use the new `item_modifier_effects` table
- `DMItemCreator.tsx` and `DMItemEditor.tsx` must read the campaign's ruleset and show modifier fields for all custom modifiers

When calculating equipped item bonuses in `stats.ts`, also query `item_modifier_effects` and apply those to `character_modifiers` values.

### 8.9 Files That Need Ruleset-Aware Updates

Every file that imports from `src/data/characterClasses.ts` or references hardcoded stat/skill names:

| File | What to Change |
|---|---|
| `src/data/characterClasses.ts` | Keep as fallback. Add `getRulesetClasses()` async function that fetches from DB. |
| `src/pages/CharacterCreation.tsx` | Use RulesetContext for classes, stats, skills |
| `src/pages/DMDashboard.tsx` | Use RulesetContext for stat/skill labels in player view |
| `src/pages/PlayerDashboard.tsx` | Use RulesetContext for stat/skill display |
| `src/pages/DMGodMode.tsx` | Use RulesetContext for editable stat fields |
| `src/pages/DMItemCreator.tsx` | Show modifier fields from ruleset |
| `src/pages/DMItemEditor.tsx` | Same as above |
| `src/pages/DMEncounterManager.tsx` | Show correct stat labels |
| `src/pages/PlayerEncounterView.tsx` | Show correct stat labels |
| `src/pages/DMNPCManager.tsx` | Stats might use ruleset definitions |
| `src/utils/stats.ts` | `calculateTotalStats()` must be ruleset-aware |
| `src/utils/useClassAliases.ts` | May be replaced by RulesetContext class names |
| `src/components/AbilityBrowser.tsx` | If it references class names |

### 8.10 Level-Up Flow (New Feature)

Create a **Level Up** action in DMDashboard.tsx (Players tab):

1. DM clicks "LEVEL UP" on a character
2. System checks `ruleset_level_rewards` for the character's class at `character.level + 1`
3. Shows what rewards the character gets:
   - New abilities → auto-added to `character_abilities`
   - Stat boost → applied to character stats
   - Skill boost → applied to character skills
   - HP increase → added to max_hp
   - Feature → shown as text, stored in `class_features`
   - Subclass choice → show subclass picker (if level matches `unlock_level`)
4. DM confirms → `characters.level` incremented, rewards applied

### 8.11 Acceptance Criteria

- [ ] `rulesets` table and all related tables are created
- [ ] Default Cyberpunk ruleset is seeded with current game data
- [ ] DM can create/edit rulesets via RulesetEditor page
- [ ] Campaign creation requires selecting a ruleset
- [ ] Character creation uses ruleset-defined classes/stats/skills
- [ ] Custom modifiers appear on character sheets
- [ ] Items can modify custom modifiers
- [ ] Level-up applies class-specific rewards from the ruleset
- [ ] Subclass selection works at the configured level
- [ ] All existing functionality continues to work with the default ruleset
- [ ] Build passes
- [ ] Commit and push

---

## Appendix A: File Structure After All Phases

```
src/
  components/
    AbilityBrowser.tsx
    NumberInput.tsx
    PlayerEffectsOverlay.tsx
    player/                    ← NEW (Phase 7)
      StatsPanel.tsx
      EquipmentPanel.tsx
      InventoryPanel.tsx
      AbilitiesModal.tsx
      MissionsModal.tsx
      StorageModal.tsx
  contexts/
    AuthContext.tsx
    CampaignContext.tsx
    RulesetContext.tsx          ← NEW (Phase 8)
  data/
    characterClasses.ts        (kept as fallback)
  lib/
    supabase.ts
  pages/
    Abilities.tsx
    CampaignSelect.tsx
    CharacterCreation.tsx      (modified Phase 8)
    CharacterSheet.tsx
    DMAbilityCreator.tsx
    DMAbilityManager.tsx
    DMDashboard.tsx            (modified Phase 3, 4, 5, 6, 8)
    DMEncounterManager.tsx     (modified Phase 3)
    DMGiveItem.tsx
    DMGodMode.tsx              (modified Phase 8)
    DMItemCreator.tsx          (modified Phase 1, 4, 5, 8)
    DMItemEditor.tsx           (modified Phase 1, 4, 5, 8)
    DMMissionManager.tsx
    DMNPCManager.tsx
    Inventory.tsx              (modified Phase 1)
    LandingPage.tsx
    LoginPage.tsx
    PlayerDashboard.tsx        (REWRITTEN Phase 7)
    PlayerEncounterView.tsx    (modified Phase 3)
    PlayerMissionLog.tsx
    RulesetEditor.tsx          ← NEW (Phase 8)
    RulesPage.tsx
  types/
    encounter.ts               (modified Phase 3)
    inventory.ts               (modified Phase 1, 4, 5)
    mission.ts
    npc.ts
    storage.ts                 ← NEW (Phase 6)
    ruleset.ts                 ← NEW (Phase 8)
  utils/
    stats.ts                   (modified Phase 1, 2, 4, 8)
    useClassAliases.ts
```

## Appendix B: Database Migration Run Order

Run these in Supabase SQL Editor in this exact order:

1. `database/weapon-stats-migration.sql` (Phase 1)
2. `database/combat-enhancements-migration.sql` (Phase 3)
3. `database/equipment-slots-migration.sql` (Phase 4)
4. `database/weight-system-migration.sql` (Phase 5)
5. `database/storage-containers-migration.sql` (Phase 6)
6. `database/rulesets-migration.sql` (Phase 8)
7. `database/seed-default-ruleset.sql` (Phase 8)

## Appendix C: Route Updates (App.tsx)

```typescript
// Add these routes:
<Route path="/dm/ruleset-editor" element={<ProtectedRoute><CampaignGate><RulesetEditor /></CampaignGate></ProtectedRoute>} />
```

## Appendix D: Implementation Priority & Estimated Effort

| Phase | Name | Priority | Estimated Complexity | Dependencies |
|---|---|---|---|---|
| 1 | Weapon To-Hit & Damage | HIGH | Medium | None |
| 2 | Ability Cooldown Display | HIGH | Low | None |
| 3 | Combat Menu Enhancements | HIGH | High | None |
| 4 | Equipment Slot System | MEDIUM | High | None |
| 5 | Weight & Carrying Capacity | MEDIUM | Medium | Phase 4 (backpack slot) |
| 6 | Storage Containers | MEDIUM | Medium | Phase 5 (weight optional) |
| 7 | Player Dashboard Overhaul | HIGH | Very High | Phase 4, 5, 6 |
| 8 | Ruleset System | HIGH | Very High | Phase 1, 4 |

**Total estimate: ~5000-8000 lines of new/modified code across 30+ files.**

---

*Generated for the Dai City Heros TTRPG Campaign Manager — April 2026*
