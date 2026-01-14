# Shop System

## Overview
The shop system allows the DM to create shops at specific map locations where players can browse and purchase items using credits. Shops can be toggled active/inactive by the DM.

## Database Schema

### `shops` Table
```sql
- id: UUID (primary key)
- location_id: UUID (foreign key to locations, unique)
- name: TEXT (shop name)
- description: TEXT (shop description)
- is_active: BOOLEAN (whether shop is currently accessible to players)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### `shop_inventory` Table
```sql
- id: UUID (primary key)
- shop_id: UUID (foreign key to shops)
- item_id: UUID (foreign key to items)
- stock_quantity: INTEGER (stock count, -1 for unlimited)
- price_credits: INTEGER (price in credits)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### Stock System
- **-1**: Unlimited stock (doesn't decrement on purchase)
- **0**: Out of stock (cannot purchase)
- **Positive integers**: Finite stock (decrements on purchase)

### RLS Policies
- **Players**: Can SELECT from shops where `is_active = true`
- **Players**: Can SELECT from shop_inventory for active shops
- **Admins**: Full CRUD access to all shops and inventory

## DM Workflow

### Creating a Shop
1. Navigate to DM Dashboard → **SHOP MANAGER**
2. Click **CREATE SHOP** button
3. Fill in the form:
   - **Location**: Select from locations without existing shops
   - **Name**: Shop name (e.g., "Chrome Street Arsenal")
   - **Description**: Shop description/lore
   - **Shop is Active**: Toggle whether shop is immediately accessible
4. Click **CREATE** to save

### Managing Shop Inventory
1. Select a shop from the sidebar
2. Click **ADD ITEM** to add new items:
   - Select item from dropdown (only shows items not already in shop)
   - Set stock quantity:
     - Enter `-1` for unlimited stock
     - Enter `0` or positive integers for finite stock
   - Set price in credits
3. **Inline Editing**:
   - Click on stock or price fields to edit directly
   - Changes save automatically
4. Click **REMOVE** to delete items from inventory

### Toggle Shop Active/Inactive
- Click the **OPEN/CLOSED** toggle on any shop card
- When **CLOSED** (inactive), players cannot see or access the shop
- When **OPEN** (active), shop appears on map with 🛍️ badge

### Deleting Shops
- Click **DELETE** on any shop card
- This removes the shop and all associated inventory

## Player Workflow

### Finding Shops
1. Navigate to **MAP** from Player Dashboard
2. Look for locations with the **🛍️ SHOP** badge
3. Click on a location with a shop

### Accessing a Shop
1. In the location detail modal, click **🛍️ ENTER SHOP**
2. You'll be taken to the shop interface

### Browsing Items
- Items are displayed in a grid layout
- Each item card shows:
  - Item name
  - Category and rarity
  - Description
  - Price in credits
  - Stock status (if limited)

### Purchasing Items
1. Click **BUY NOW** on an item card (button will be disabled if insufficient credits or out of stock)
2. Review the confirmation modal showing:
   - Current credits
   - Item price
   - Credits after purchase
3. Click **CONFIRM PURCHASE**
4. Transaction will:
   - Deduct credits from your character
   - Add item to your inventory
   - Decrement shop stock (if not unlimited)

### Error Handling
- **Insufficient Credits**: Button disabled with red "INSUFFICIENT CREDITS" text
- **Out of Stock**: Button disabled with red "OUT OF STOCK" text
- **Transaction Failure**: System attempts rollback and displays error message

## Transaction Flow

### Purchase Transaction
1. **Validation**:
   - Check if player has sufficient credits
   - Check if item is in stock (stock > 0 or stock = -1)

2. **Database Updates** (in order):
   - `UPDATE characters SET credits = credits - price`
   - `INSERT INTO inventory (character_id, item_id, quantity)`
   - `UPDATE shop_inventory SET stock_quantity = stock_quantity - 1` (only if stock ≠ -1)

3. **Error Handling**:
   - If any step fails, attempt rollback
   - Display error message to player
   - Log error for debugging

## Routes

### DM Routes
- `/dm/shops` - DM Shop Manager interface

### Player Routes
- `/shop/:shopId` - Player shop interface for specific shop

## Integration with Map System
- Shops are linked to locations via `location_id` foreign key
- One shop per location (enforced by UNIQUE constraint)
- Active shops display 🛍️ badge on location cards
- Location detail modal shows "ENTER SHOP" button for shop locations
- Navigation from map to shop preserves context

## Setup Instructions

### 1. Run Database Migration
Execute `database/shops.sql` in Supabase SQL Editor to:
- Create `shops` and `shop_inventory` tables
- Set up RLS policies
- Create sample shop at Chrome Street Market (if location exists)

### 2. Verify Routes
Routes are already added to `App.tsx`:
- `/dm/shops` → DMShopManager
- `/shop/:shopId` → PlayerShop

### 3. Access Shop Manager
DM can access via Dashboard → **SHOP MANAGER** card

## Future Enhancements

### Potential Features
1. **Batch Restocking**: DM can quickly restock all items in a shop
2. **Quantity Selection**: Players can buy multiple items at once
3. **Shop Categories/Filters**: Filter by weapon type, armor, consumables, etc.
4. **Sales & Discounts**: Temporary price reductions set by DM
5. **Shop Reputation**: Unlock better items based on player actions
6. **Barter System**: Trade items instead of credits
7. **Shopkeeper NPCs**: Add dialogue and personalities to shops
8. **Purchase History**: Track player purchases for analytics
9. **Dynamic Pricing**: Prices change based on supply/demand
10. **Shop Themes**: Visual customization per shop type

## Troubleshooting

### Shop Not Appearing on Map
- Verify shop `is_active = true` in DM Shop Manager
- Check that location_id exists in locations table
- Ensure player has discovered the location (if discovery system enabled)

### Purchase Failed
- Verify player has sufficient credits
- Check item stock in DM Shop Manager
- Ensure RLS policies are correctly configured
- Check browser console for detailed error messages

### Cannot Add Item to Shop
- Item may already be in shop inventory (check existing items)
- Verify item exists in items table
- Check for database constraint violations

### Shop Not Saving
- Verify location is not already associated with another shop
- Check that all required fields are filled
- Ensure user has admin role for RLS policy access
