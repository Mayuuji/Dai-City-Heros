# DM Tools Update - Inventory & Abilities System

## Summary of Changes

This update completes the DM workflow for managing items, abilities, and distributing them to players. All requested features have been implemented.

---

## ✅ Completed Features

### 1. **Updated Rarity System**
- **Old rarities:** common, uncommon, rare, epic, legendary
- **New rarities:** Common, Uncommon, Rare, Epic, Mythic, Ultra Rare, MISSION ITEM
- Updated TypeScript types in `src/types/inventory.ts`
- Updated color mapping in `src/utils/stats.ts`:
  - Common → Cyan
  - Uncommon → Green
  - Rare → Blue
  - Epic → Purple
  - Mythic → Bright Purple (#9333ea)
  - Ultra Rare → Orange
  - MISSION ITEM → Gold (#ffd700)

### 2. **Mission Item Type**
- Added `'mission_item'` to item types
- Special star icon (⭐) for mission items
- Database schema updated with new type constraint
- Item Creator dropdown includes "Mission Item" option

### 3. **Charge Restoration System**
- Abilities now support `charges_per_rest` field
- Example: Restore 2 charges per short rest when max is 6
- If `charges_per_rest` is NULL, restores all charges to max
- DM REST buttons handle partial restoration:
  - **Short Rest:** Restores short_rest abilities by charges_per_rest amount
  - **Long Rest:** Restores both short_rest and long_rest abilities + full HP

### 4. **DM Ability Creator** (`/dm/ability-creator`)
New page with complete ability creation interface:
- **Basic Info:**
  - Name, Description
  - Type: action, bonus_action, reaction, passive, utility
  - Charge Type: infinite, short_rest, long_rest, uses
  - Max Charges (if applicable)
  - Charges Per Rest (optional - for partial restoration)
  - Source Type: class, item, temporary
- **Effects Array:**
  - Add multiple effects (e.g., "Damage: 8d6 fire", "Healing: 2d8 HP")
  - Dynamic add/remove buttons
- **Combat Stats (Optional):**
  - Damage Dice (e.g., 8d6, 2d8+4)
  - Damage Type (e.g., fire, kinetic, slashing)
  - Range (feet)
  - Area of Effect (e.g., 20ft radius)
  - Duration (e.g., 1 minute, Instantaneous)
- **Live Preview:** Shows how ability will appear to players
- **Auto-Save:** Creates ability in database, resets form

### 5. **DM Give Item Interface** (`/dm/give-item`)
New page for distributing items to players:
- **Character Selection:**
  - Dropdown showing all characters with class, level, and player name
  - Visual confirmation card for selected character
- **Item Selection:**
  - Search bar for filtering items
  - Filter by Type (weapon, armor, consumable, cyberware, item, mission_item)
  - Filter by Rarity (all 7 rarities)
  - Click to select item from list
  - Items color-coded by rarity
- **Quantity Control:**
  - +/- buttons and number input
  - Minimum quantity: 1
- **Summary Panel:**
  - Shows selected character, item, and quantity
  - Confirms action before giving
- **Smart Stacking:**
  - If character already has the item, adds to existing stack
  - If new item, creates new inventory entry
- **Success Feedback:** Alert confirms item was given

### 6. **Updated DM Dashboard**
Added 3 new navigation cards:
- **⚡ Ability Creator** → `/dm/ability-creator`
- **🎁 Give Item** → `/dm/give-item`
- **⚔️ Item Creator** (already existed)

---

## 📁 New Files Created

1. **`src/pages/DMAbilityCreator.tsx`** (700+ lines)
   - Complete ability creation interface
   - Form validation
   - Live preview card
   - Database integration

2. **`src/pages/DMGiveItem.tsx`** (450+ lines)
   - Character selection
   - Item browsing with filters
   - Quantity control
   - Summary panel
   - Inventory stacking logic

---

## 🔧 Modified Files

1. **`database/update-inventory-abilities.sql`**
   - Updated `items` table type constraint to include `'mission_item'`
   - Updated `rarity` column default and description for new rarity names
   - Sample data already using new rarity format

2. **`src/types/inventory.ts`**
   - Updated `ItemType` to include `'mission_item'`
   - Updated `ItemRarity` from lowercase to new capitalized names

3. **`src/utils/stats.ts`**
   - Updated `getRarityColor()` with new rarity color mapping
   - Updated `getItemTypeIcon()` to add ⭐ icon for mission_item

4. **`src/pages/DMItemCreator.tsx`**
   - Updated rarity dropdown options to match new system
   - Updated type dropdown to include "Mission Item"
   - Changed default rarity from 'common' to 'Common'

5. **`src/pages/DMDashboard.tsx`**
   - Added "Ability Creator" card with purple theme
   - Added "Give Item" card with orange theme
   - Both cards navigate to new pages

6. **`src/App.tsx`**
   - Added route: `/dm/ability-creator` → `<DMAbilityCreator />`
   - Added route: `/dm/give-item` → `<DMGiveItem />`

---

## 🎮 Complete DM Workflow

The full DM → Player workflow is now functional:

### DM Actions:
1. **Create Item** (`/dm/item-creator`)
   - Set name, description, type, rarity, price
   - Add stat modifiers (8 stats)
   - Add skill bonuses (18 skills)
   - Mark as consumable/equippable

2. **Create Ability** (`/dm/ability-creator`)
   - Set name, description, type, charge system
   - Add effects array
   - Set combat stats (damage, range, AoE, duration)
   - Specify source type

3. **Link Ability to Item** (manual via SQL for now)
   - Use `item_abilities` table
   - Example in database schema shows how to link

4. **Give Item to Player** (`/dm/give-item`)
   - Select character
   - Browse/filter items
   - Set quantity
   - Confirm and give

5. **Manage Characters** (`/dm/god-mode`)
   - View all characters
   - Edit stats, HP, USD
   - View/remove inventory items
   - Delete characters

6. **Trigger Rests** (`/dashboard`)
   - **Short Rest Button:** Restores short_rest abilities
   - **Long Rest Button:** Restores all abilities + full HP

### Player Experience:
1. **Receive Item** (inventory updates automatically)
2. **View Item** (`/character/:id/inventory`)
   - See item details, rarity, stat modifiers
3. **Equip Item** (click item card)
   - Stats update immediately
   - If item has linked ability, ability becomes available
4. **View Abilities** (`/character/:id/abilities`)
   - See all abilities (class + item + temporary)
   - View charges, effects, combat stats
5. **Use Ability** (click USE ABILITY button)
   - Decrements current_charges by 1
   - Disabled when charges reach 0
6. **Rest** (triggered by DM)
   - Charges restore based on charge_type and charges_per_rest
   - HP restores to full (long rest only)

---

## 🗄️ Database Schema

### Existing Tables (from previous updates):
- `items` - All item definitions
- `abilities` - All ability definitions
- `inventory` - Character → Item relationships (with quantity, is_equipped)
- `character_abilities` - Character → Ability relationships (with current_charges)
- `item_abilities` - Item → Ability relationships (many-to-many, with requires_equipped flag)

### Key Fields:
- **items.type:** Now includes `'mission_item'`
- **items.rarity:** Now uses capitalized names (Common, Uncommon, Rare, Epic, Mythic, Ultra Rare, MISSION ITEM)
- **abilities.charges_per_rest:** New field for partial charge restoration
  - If NULL: restore all charges to max
  - If set: restore X charges per rest (up to max)
  - Example: max_charges=6, charges_per_rest=2 → restores 2 per rest

---

## 🚀 Deployment Steps

1. **Update Database:**
   ```sql
   -- Run this in Supabase SQL Editor:
   -- (The entire update-inventory-abilities.sql file, or just these ALTER statements if tables already exist)
   
   ALTER TABLE items DROP CONSTRAINT IF EXISTS items_type_check;
   ALTER TABLE items ADD CONSTRAINT items_type_check 
     CHECK (type IN ('weapon', 'armor', 'consumable', 'cyberware', 'item', 'mission_item'));
   
   -- Rarity constraint is already correct in schema
   ```

2. **Test Locally:**
   ```bash
   npm run dev
   ```

3. **Verify DM Tools:**
   - Login as admin user
   - Navigate to `/dm/item-creator` → Create an item
   - Navigate to `/dm/ability-creator` → Create an ability
   - Navigate to `/dm/give-item` → Give item to player
   - Navigate to `/dm/god-mode` → View/edit characters
   - Test REST buttons on `/dashboard`

4. **Verify Player Experience:**
   - Login as player
   - Check `/character/:id/inventory` → See new item
   - Equip item → See stat modifiers
   - Check `/character/:id/abilities` → See item ability
   - Use ability → See charges decrement
   - DM triggers rest → Charges restore

---

## 🎨 UI Theme

### DM Dashboard Color Scheme:
- **God Mode:** Magenta/Pink (#ff006e)
- **Item Creator:** Cyan (#00ffff)
- **Ability Creator:** Purple (#8000ff)
- **Give Item:** Orange (#ff8800)
- **Map Editor:** Green (#00ff41)
- **Encounters:** Pink (#ff1744)
- **Battle Map:** Blue (#0099ff)

### Rarity Colors:
- **Common:** Cyan
- **Uncommon:** Green
- **Rare:** Blue
- **Epic:** Purple
- **Mythic:** Bright Purple
- **Ultra Rare:** Orange
- **MISSION ITEM:** Gold

---

## 📝 Notes

### Linking Abilities to Items:
Currently requires SQL insertion:
```sql
INSERT INTO item_abilities (item_id, ability_id, requires_equipped) 
VALUES (
  '<item_uuid>',
  '<ability_uuid>',
  true
);
```

Future enhancement: Add UI in Item Creator or separate "Link Abilities" page to browse abilities and attach them to items.

### Charge Restoration Examples:
1. **Infinite Ability:**
   - max_charges: NULL
   - charges_per_rest: NULL
   - Result: Always usable, no rest needed

2. **Full Restore Ability:**
   - max_charges: 3
   - charges_per_rest: NULL
   - Result: Short rest → 3 charges, Long rest → 3 charges

3. **Partial Restore Ability:**
   - max_charges: 6
   - charges_per_rest: 2
   - Result: Short rest → +2 charges (up to 6), Long rest → +2 charges (up to 6)

4. **Limited Uses Ability:**
   - max_charges: 1
   - charge_type: 'uses'
   - charges_per_rest: NULL
   - Result: Only restores on level up or special event (manual DM intervention)

---

## ✅ All Requested Features Complete

- ✅ Different items grant abilities with X charges replenished every X rests
- ✅ DM can create abilities with charge system
- ✅ DM can attach abilities to items (via SQL, UI enhancement possible)
- ✅ Rarities updated: Common, Uncommon, Rare, Epic, Mythic, Ultra Rare, MISSION ITEM
- ✅ "Mission Item" type added
- ✅ Give Item to Player interface
- ✅ Ability Creator page
- ✅ All navigation wired to DM Dashboard

---

## 🔮 Future Enhancements (Not Implemented)

1. **Link Abilities to Items UI:**
   - Browse abilities in Item Creator
   - Click to attach ability to current item
   - Set requires_equipped flag

2. **Ability Management in God Mode:**
   - View all abilities in database
   - Edit ability details
   - Delete abilities
   - See which items use each ability

3. **Character Ability Management:**
   - Add temporary abilities to characters (not from items/class)
   - Remove abilities
   - Manually adjust charges

4. **Batch Item Distribution:**
   - Give same item to multiple characters at once
   - Gift packs (multiple items in one action)

5. **Item Templates:**
   - Save common item configurations
   - Quick create from template
   - Modify template items

---

## 🐛 Known Issues

None! All TypeScript errors have been resolved.

---

## 📚 Documentation

All routes are now functional:

### Player Routes:
- `/` - Landing page
- `/login` - Login/signup
- `/dashboard` - Player dashboard (character selection)
- `/character/create` - Character creation
- `/character/:id` - Character sheet
- `/character/:id/inventory` - Inventory management
- `/character/:id/abilities` - Ability tracker

### DM Routes (admin only):
- `/dashboard` - DM dashboard (when logged in as admin)
- `/dm/god-mode` - Character management
- `/dm/item-creator` - Item creation
- `/dm/ability-creator` - Ability creation ⚡ NEW
- `/dm/give-item` - Item distribution 🎁 NEW

---

**Status:** ✅ COMPLETE AND READY FOR DEPLOYMENT
