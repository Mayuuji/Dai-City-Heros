# 👥 NPC & Enemy System Documentation

## Overview
Comprehensive system for managing NPCs (Non-Player Characters) and enemies with full combat stats, roleplay details, and story hooks.

## Features Implemented

### ✅ Database Schema (`database/npcs-enemies.sql`)

#### Enums
- **npc_type**: Enemy, Friendly NPC, Neutral NPC, Vendor, Quest Giver, Boss, Mini-Boss, Civilian
- **npc_disposition**: Hostile, Unfriendly, Neutral, Friendly, Allied

#### npcs Table
**Combat Stats:**
- Health (max_hp, current_hp)
- Armor Class (ac)
- Core Stats (STR, DEX, CON, WIS, INT, CHA)

**Roleplay Details:**
- Description (physical appearance)
- Unique Details (scars, cybernetics, clothing)
- Speech Pattern (accent, slang, formal speech)
- Mannerisms (body language, habits, quirks)

**Story Details:**
- Current Problem (what's bothering them)
- Who/What It Involves (related person/organization)
- Their Approach (aggressive, cautious, diplomatic, etc.)
- Secret (hidden information)

**Quick Reference:**
- Three Words (quick personality summary)
- Voice Direction (voice acting guidance)
- Remember Them By (memorable hook)

**Combat & Loot:**
- Abilities (JSONB array: name, damage, effect)
- Drops on Defeat (USD and items)

**Other:**
- Location (where they can be found)
- Is Alive (track if killed)
- Is Active (currently in play)
- DM Notes (private DM information)

### ✅ TypeScript Types (`src/types/npc.ts`)
- NPCType enum
- NPCDisposition enum
- NPCAbility interface
- NPCDrops interface
- NPC interface
- NPCWithLocation interface

### ✅ DM NPC Manager (`src/pages/DMNPCManager.tsx`)

**Left Panel - Create/Edit Form:**
1. **Basic Info**
   - Name, Type, Disposition
   - Description
   - Location assignment

2. **Combat Stats**
   - Max HP, Current HP, AC
   - All 6 core stats (STR, DEX, CON, WIS, INT, CHA)

3. **Abilities**
   - Dynamic list of abilities
   - Each ability: Name, Damage (optional), Effect
   - Add/Remove buttons

4. **Loot Drops**
   - USD amount
   - Dynamic list of items
   - Add/Remove items

5. **Roleplay Details**
   - Unique Details
   - Speech Pattern
   - Mannerisms

6. **Story Details**
   - Current Problem
   - Who/What It Involves
   - Their Approach
   - Secret (highlighted in red)

7. **Quick Reference**
   - Three Words
   - Voice Direction
   - Remember Them By

8. **DM Notes**
   - Private notes for DM only

**Right Panel - NPC List:**
- Filters:
  - Type (all types or specific)
  - Status (all, alive, dead)
  
- NPC Cards showing:
  - Name with color-coded type badge
  - Disposition badge
  - HP bar with current/max HP
  - AC display
  - Quick HP adjustment buttons (-5, -1, +1, +5, FULL)
  - Remember By text
  - Three Words summary
  - Abilities list
  - Actions: EDIT, KILL/REVIVE, DELETE

### ✅ Sample Data
Includes 3 example NPCs:
1. **Razor Eddie** (Enemy/Hostile)
   - Street samurai with mantis blades
   - Secret: Working with NCPD
   - Abilities: Mantis Blade Slash, Cyber Sprint

2. **Doc Rivera** (Friendly NPC/Friendly)
   - Elderly ripperdoc
   - Secret: Former Militech employee
   - Provides healing and cyberware

3. **Takashi "The Viper" Yamada** (Boss/Hostile)
   - Tyger Claw lieutenant
   - Secret: Dying from cyberware rejection
   - 3-phase boss fight with multiple abilities

### ✅ Integration
- Route added: `/dm/npcs`
- DM Dashboard card: "NPC & ENEMY MANAGER" (orange theme)
- RLS policies: DMs see all, players see only active/alive NPCs (no secrets)

## Usage Guide

### Creating an NPC

1. Navigate to DM Dashboard → "MANAGE NPCs"
2. Fill in basic info (name, type, disposition)
3. Set combat stats (HP, AC, core stats)
4. Add abilities (optional):
   - Click "+ ADD ABILITY"
   - Fill in name, damage, and effect
5. Set loot drops (for enemies):
   - Enter USD amount
   - Click "+ ADD ITEM" for each item drop
6. Fill roleplay details:
   - Unique Details: "Chrome mantis blades, burn scars"
   - Speech Pattern: "Short sentences, street slang"
   - Mannerisms: "Never makes eye contact, spits when talking"
7. Add story hooks:
   - Current Problem: "Gang leader holding sister hostage"
   - Who/What It Involves: "Tyger Claws gang and sister Maya"
   - Their Approach: "Strike first, ask questions never"
   - Secret: "Working with NCPD to bring down gang"
8. Fill quick reference:
   - Three Words: "Violent, Conflicted, Desperate"
   - Voice Direction: "Raspy smoker voice, Brooklyn meets Neo-Tokyo"
   - Remember By: "The mantis blade guy with red bandana"
9. Add DM notes (optional)
10. Click "CREATE NPC"

### Managing NPCs in Combat

**HP Tracking:**
- Visual HP bar shows current/max health
- Quick buttons: -5, -1, +1, +5, FULL
- Color-coded: Green (>50%), Yellow (25-50%), Red (<25%)

**Status Management:**
- KILL button: Marks NPC as dead (shows ☠️ DEAD badge)
- REVIVE button: Brings NPC back to life
- Dead NPCs can be filtered out or shown

### Editing NPCs

1. Find NPC in right panel
2. Click "EDIT" button
3. Form populates with current data
4. Make changes
5. Click "UPDATE NPC"
6. Click "CANCEL" to stop editing

### Filtering NPCs

**By Type:**
- All Types
- Enemy
- Friendly NPC
- Neutral NPC
- Vendor
- Quest Giver
- Boss
- Mini-Boss
- Civilian

**By Status:**
- All
- Alive
- Dead

## Color Coding

### Type Colors
- **Boss**: Red
- **Mini-Boss**: Orange
- **Enemy**: Pink
- **Friendly NPC**: Green
- **Quest Giver**: Purple
- **Vendor**: Yellow
- **Neutral NPC**: Cyan
- **Civilian**: Blue

### Disposition Colors
- **Hostile**: Red
- **Unfriendly**: Orange
- **Neutral**: Yellow
- **Friendly**: Green
- **Allied**: Cyan

## Best Practices

### For Enemies
- Always fill combat stats
- Add at least 1-2 abilities
- Set loot drops (USD + items)
- Quick reference is optional but helpful

### For Friendly NPCs
- Focus on roleplay details
- Current Problem = quest hook
- Secret = plot twist potential
- Voice Direction helps with consistency

### For Bosses
- High HP (100-200+)
- Multiple abilities (3-5)
- Interesting secret
- DM Notes for phase transitions

## Database Execution

Run this SQL in Supabase SQL Editor:

```bash
# Navigate to database folder
cd database

# Copy file to clipboard or run in Supabase
cat npcs-enemies.sql
```

Paste into Supabase SQL Editor and execute.

## Security

### Row Level Security (RLS)
- **Players**: Can view active, alive NPCs (no DM notes or secrets visible)
- **Admins (DMs)**: Full access to all NPCs including secrets and DM notes

### Hidden from Players
- Secret field
- DM Notes field
- Dead NPCs (is_alive = false)
- Inactive NPCs (is_active = false)

## Future Enhancements

### Potential Features
- [ ] NPC relationship map
- [ ] Initiative tracker integration
- [ ] Dialogue trees
- [ ] Quest assignment to NPCs
- [ ] NPC inventories
- [ ] Faction affiliations
- [ ] NPC portraits/images
- [ ] Export to PDF character sheets
- [ ] Random NPC generator
- [ ] Voice clips/audio notes

### Encounter System Integration
- Link NPCs to encounters
- Track NPC participation in battles
- Auto-add NPCs to encounter grids
- Save NPC states between encounters

## Examples

### Street Thug (Enemy)
```
Name: Viper Gang Goon
Type: Enemy
Disposition: Hostile
HP: 25 / AC: 12
STR:12 DEX:14 CON:13 WIS:8 INT:8 CHA:9

Unique: Neon snake tattoo on neck
Speech: Broken English, lots of cursing
Mannerisms: Twitchy, always checking exits
Problem: Boss threatened to zero him if he fails
Secret: Actually just desperate for USD to pay medical bills
Three Words: Desperate, Violent, Scared
Voice: High-pitched, nervous
Remember: The twitchy guy with snake tattoo

Abilities:
- Pipe Swing (1d6+2): Basic melee attack
- Dirty Fighting: Target makes CON save or stunned 1 round

Drops: 50 USD, Rusty Pipe, Viper Gang Colors
```

### Quest Giver (Friendly NPC)
```
Name: Cipher
Type: Quest Giver
Disposition: Friendly
HP: 30 / AC: 13
STR:9 DEX:16 CON:11 WIS:14 INT:17 CHA:12

Unique: Glowing blue cybereyes, never blinks
Speech: Technical jargon, speaks in code sometimes
Mannerisms: Drums fingers constantly, stares intensely
Problem: Someone is hunting netrunners in the city
Problem Involves: Arasaka's Blackwall Division
Approach: Gather info first, avoid direct confrontation
Secret: Used to work for Arasaka, knows their systems
Three Words: Paranoid, Brilliant, Haunted
Voice: Monotone, matter-of-fact, slight glitching
Remember: The netrunner with glowing eyes who never blinks

DM Notes: Will reveal Arasaka connection after party proves trustworthy. Can provide backdoor access codes.
```

## Files Modified/Created

### New Files
1. `database/npcs-enemies.sql` - Database schema
2. `src/types/npc.ts` - TypeScript interfaces
3. `src/pages/DMNPCManager.tsx` - NPC management UI (1086 lines)
4. `NPC_SYSTEM.md` - This documentation

### Modified Files
1. `src/App.tsx` - Added `/dm/npcs` route
2. `src/pages/DMDashboard.tsx` - Added NPC Manager card

## Success Criteria

✅ DMs can create NPCs with all requested fields
✅ Combat stats tracking (HP, AC, stats)
✅ Roleplay details (speech, mannerisms, etc.)
✅ Story hooks (problem, secret, approach)
✅ Quick reference (three words, voice, remember by)
✅ Ability system with damage and effects
✅ Loot drops configuration
✅ HP tracking with quick adjustment buttons
✅ Kill/Revive functionality
✅ Edit existing NPCs
✅ Delete NPCs
✅ Filter by type and status
✅ Color-coded type and disposition
✅ RLS hides secrets from players
✅ Sample data included
✅ Integration with DM Dashboard

---

**System Complete! Ready for use.** 🎉
