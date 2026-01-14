# World Map System - Usage Guide

## Overview
The map system allows the DM to create a bounded world map with custom locations. Players can view and explore within the DM-defined boundaries.

## How It Works

### For DMs: Setting Up the Map

1. **Navigate to Map Editor**
   - Go to `/dm/map-editor` from your DM dashboard

2. **Set Your Locked View (IMPORTANT)**
   - Click the "SETTINGS" mode button
   - **Pan and zoom the map** to show exactly what you want players to see
   - Click **"📸 SET CURRENT VIEW AS BOUNDS"** button
   - This captures:
     - The corners of your current view (min/max lat/lng)
     - The center point of your view
     - The current zoom level
   - Click **"💾 SAVE SETTINGS"** to apply

3. **What Gets Locked**
   - **Southwest corner** (bottom-left of your view)
   - **Northeast corner** (top-right of your view)
   - **Center point** (middle of your view)
   - **Zoom level** (how zoomed in/out you are)
   - **Lock bounds toggle** (prevents players from panning outside)

4. **Create Locations**
   - Switch to "CREATE" mode
   - Click anywhere on the map to add a location
   - Fill in: Name, Description, Lore, Icon, Color, Tags
   - Toggle visibility (players only see visible locations)
   - Save the location

5. **Edit Locations**
   - Switch to "VIEW" mode
   - Click a location in the sidebar
   - Edit its properties
   - Save or Delete

### For Players: Exploring the Map

1. **Access the Map**
   - Click "🗺️ WORLD MAP" from your Player Dashboard
   - Or navigate to `/map`

2. **What You See**
   - The map opens **centered at the DM's locked position**
   - You can **pan and zoom** but only within the DM's bounds
   - You cannot see areas outside the locked bounds
   - Only visible locations appear on the map

3. **Interacting with Locations**
   - Click a location dot to see details
   - View: Name, Description, Lore, Tags, Coordinates
   - Use search to find locations by name
   - Filter by location type (city, dungeon, shop, etc.)

## Technical Details

### Database Schema
- **map_settings** table (single row)
  - `center_lat`, `center_lng`: Initial center point
  - `min_lat`, `min_lng`: Southwest corner
  - `max_lat`, `max_lng`: Northeast corner
  - `default_zoom`: Initial zoom level
  - `lock_bounds`: Whether players are restricted
  - `tile_url`: CartoDB dark_nolabels (no real-world labels)

- **locations** table
  - Position: `lat`, `lng`
  - Info: `name`, `description`, `lore`
  - Visual: `icon`, `color`
  - Filtering: `tags[]`
  - Visibility: `is_visible`, `is_discovered`

### Map Behavior

**Initial Load:**
1. Map reads `center_lat`, `center_lng`, and `default_zoom` from settings
2. MapContainer renders with these exact coordinates
3. MapInitializer component forces the view to center after 100ms
4. Players see the DM's locked view immediately

**Bounds Restriction:**
- BoundsRestrictor component reads `min_lat/lng` and `max_lat/lng`
- Creates Leaflet bounds rectangle
- Sets `maxBounds` on the map
- Triggers `panInsideBounds` on drag events
- **DMs bypass this** - isDM prop allows free panning

**Setting New Bounds:**
1. DM pans/zooms to desired view
2. Clicks "SET CURRENT VIEW AS BOUNDS"
3. Code reads `map.getBounds()` → gets current corners
4. Code reads `map.getCenter()` → gets current center
5. Code reads `map.getZoom()` → gets current zoom
6. Updates state with these values
7. DM clicks "SAVE SETTINGS"
8. Values saved to database
9. Next time map loads, it centers on these saved values

### Key Components

**WorldMap.tsx**
- Renders Leaflet MapContainer
- MapInitializer: Forces center on load
- BoundsRestrictor: Enforces player bounds
- MapClickHandler: DM click-to-create locations
- Custom dot markers with glow effects

**DMMapEditor.tsx**
- Four modes: View, Create, Edit, Settings
- handleSetCurrentView(): Captures current map state
- handleSaveSettings(): Persists to database
- Location list with search/filter

**PlayerMapView.tsx**
- Read-only map for players
- Filtered location list (only visible)
- Detail modal for lore/information
- Respects bounds restrictions

## Troubleshooting

### "Map doesn't open to my locked position"
- **Solution**: Make sure you clicked "SAVE SETTINGS" after capturing view
- Check the "CURRENT BOUNDS" panel shows your values
- Try refreshing the page

### "Players can still see areas outside bounds"
- **Solution**: Ensure `lock_bounds` is enabled (checked)
- Verify bounds were saved (check database or bounds display panel)
- Players need to refresh if they have old cached settings

### "Set Current View button doesn't work"
- **Solution**: Make sure you're in SETTINGS mode
- Wait for map to fully load before clicking
- Check browser console for errors

### "Locations aren't showing up for players"
- **Solution**: Check location's `is_visible` property is true
- Verify location is within the locked bounds
- Players need to refresh to see new locations

## Best Practices

1. **Set bounds first** before adding locations
2. **Test as a player** by opening `/map` in incognito mode
3. **Use tags** liberally for better filtering
4. **Write good lore** to make locations interesting
5. **Hide sensitive locations** until players discover them
6. **Export your data** regularly (use Export button)

## Database Setup

Run this SQL in Supabase SQL Editor:
```sql
-- See database/map-locations.sql for full schema
-- Creates map_settings and locations tables
-- Inserts default settings with CartoDB dark_nolabels tiles
-- Sets up RLS policies
-- Adds 6 sample cyberpunk locations
```

## URL Routes

- `/dm/map-editor` - DM map editor (admin only)
- `/map` - Player map view (all authenticated users)

## Next Steps

1. Run `database/map-locations.sql` in Supabase
2. Log in as admin and go to `/dm/map-editor`
3. Click SETTINGS mode
4. Pan/zoom to your desired starting area
5. Click "SET CURRENT VIEW AS BOUNDS"
6. Click "SAVE SETTINGS"
7. Create some locations
8. Test as player by going to `/map`
