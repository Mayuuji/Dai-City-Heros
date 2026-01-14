# 🎮 Cyberpunk TTRPG - Feature Roadmap

## 🔴 CRITICAL - Must Fix First
- [ ] **Fix RLS Policies** - Run `database/fix-rls-policies.sql` to resolve infinite recursion error
- [ ] **Update Character Schema** - Run `database/update-character-schema.sql` for Cyberpunk RED system
- [ ] **Test Login Flow** - Verify users can create accounts and log in successfully

---

## 🟡 HIGH PRIORITY - Core Features

### Character System
- [ ] **Update PlayerDashboard to show real character data**
  - Fetch character from database
  - Display actual HP, AC, stats, USD
  - Show class name and level
  - Handle "no character" state with "Create Character" button
  
- [ ] **Character Selection** (if player has multiple characters)
  - List all characters for the user
  - Allow switching between characters
  - Set active/current character
  
- [ ] **Detailed Character Sheet View**
  - Full stats breakdown (STR, DEX, CON, WIS, INT, CHA)
  - All 18 skills with proficiency bonuses
  - Class features with charges/uses
  - Tools and equipment kits
  - Combat stats (HP, AC, CDD)
  - Saving throw proficiencies
  
- [ ] **Character Editing**
  - Edit character name
  - Update stats (for leveling up)
  - Spend USD
  - Track HP changes (damage/healing)
  - Use/restore class feature charges

### Inventory System
- [ ] **View Inventory**
  - List all items owned by character
  - Show equipped vs unequipped items
  - Display item stats and descriptions
  
- [ ] **Equip/Unequip Items**
  - Toggle equipped status
  - Apply stat modifiers when equipped
  - Remove modifiers when unequipped
  
- [ ] **Item Management**
  - Add items to inventory
  - Remove/drop items
  - Consume items (healing, etc.)
  - Track quantity for stackable items

### Item System
- [ ] **View All Items** (player can see available items)
  - Browse item catalog
  - Filter by type (weapon, armor, consumable, etc.)
  - Search items by name
  
- [ ] **Item Details Modal**
  - Show full item description
  - Display stat modifiers
  - Show price in USD
  - View rarity/type

---

## 🟢 MEDIUM PRIORITY - Gameplay Features

### Shop System
- [ ] **Shop Interface**
  - Browse items for sale
  - Filter by category
  - See item prices in USD
  
- [ ] **Purchase Items**
  - Check if player has enough USD
  - Deduct cost from character
  - Add item to inventory
  - Transaction confirmation
  
- [ ] **Location-Based Shops**
  - Different locations have different inventories
  - Some items only available at specific shops

### Mission System
- [ ] **Mission List View**
  - Show active missions
  - Display objectives and progress
  - Show rewards (USD, items, XP)
  
- [ ] **Mission Details**
  - Full mission description
  - Objective checklist
  - Location information
  
- [ ] **Mission Completion**
  - Mark objectives as complete
  - Award rewards to character
  - Move to completed missions list

### World Map
- [ ] **Custom Map Display** (React Leaflet)
  - Upload custom map image as base layer
  - Use CRS.Simple for non-geographic coordinates
  
- [ ] **Location Markers**
  - Show all visible locations on map
  - Different marker types (shop, mission, safe house, etc.)
  - Click marker to see location details
  
- [ ] **Map Navigation**
  - Pan and zoom controls
  - Center on character's location
  - Mini-map in corner of screen

---

## 🟣 DM/ADMIN TOOLS - High Priority

### God Mode
- [ ] **View All Characters**
  - List all player characters in the game
  - Filter by player/user
  - Search by character name
  
- [ ] **Edit Any Character**
  - Modify stats, HP, AC
  - Change USD amount
  - Add/remove items from inventory
  - Grant XP/level ups
  
- [ ] **Character Management**
  - Delete characters
  - Clone characters
  - Export character data

### Item Creator
- [ ] **Create New Items**
  - Form with fields: name, description, type, rarity
  - Set base stats (damage, armor, etc.)
  - Add stat modifiers (e.g., +2 DEX, +1 AC)
  - Set price in USD
  
- [ ] **Edit Existing Items**
  - Modify any item in database
  - Update prices
  - Change descriptions
  
- [ ] **Item Templates**
  - Save common item configurations
  - Quick create from templates (e.g., "Standard Pistol")

### Map Editor
- [ ] **Add Locations**
  - Place markers on world map
  - Set location name and description
  - Choose location type (shop, mission hub, etc.)
  
- [ ] **Edit Locations**
  - Move markers
  - Update descriptions
  - Set visibility (visible to all or admin-only)
  
- [ ] **Location Inventories**
  - Assign items to shop locations
  - Set stock quantities
  - Configure dynamic pricing

### Encounter Manager
- [ ] **Create Encounters**
  - Name and description
  - Add enemies with stats
  - Set difficulty rating
  
- [ ] **Encounter Templates**
  - Save common enemy groups
  - Quick deploy encounters
  
- [ ] **Active Encounters**
  - Track HP for each enemy
  - Initiative tracker
  - Combat log

### Session Notes
- [ ] **Rich Text Editor**
  - Markdown support
  - Bold, italic, lists, headers
  
- [ ] **Session Organization**
  - Create notes for each session
  - Tag notes by date or topic
  - Search notes
  
- [ ] **Private DM Notes**
  - Hidden from players (RLS enforced)
  - Link to characters/locations/encounters

---

## 🔵 ADVANCED FEATURES - Future

### 3D Character Viewer
- [ ] **STL Model Upload**
  - Upload .stl files to Supabase Storage
  - File size validation (max 50MB)
  - Associate with character
  
- [ ] **Three.js Viewer Component**
  - Load and parse STL files
  - Orbit controls (rotate, zoom, pan)
  - Lighting and materials
  
- [ ] **Viewer Controls**
  - Toggle wireframe mode
  - Change background color
  - Screenshot/snapshot

### 3D Battle Map
- [ ] **Grid System**
  - Configurable grid size (e.g., 5ft squares)
  - Toggle grid visibility
  - Snap to grid option
  
- [ ] **Model Placement**
  - Drag player STL models onto grid
  - Place enemy tokens/markers
  - Rotate and scale models
  
- [ ] **Measurement Tools**
  - Measure distance between points
  - Area of effect overlays (circles, cones, etc.)
  
- [ ] **DM Controls**
  - Move any piece
  - Add/remove fog of war
  - Save/load battle states

### Real-Time Features
- [ ] **Supabase Realtime Subscriptions**
  - Listen for character changes
  - Update UI when DM edits data
  - Notify on new missions/items
  
- [ ] **Live Session Mode**
  - All players in same "room"
  - Shared initiative tracker
  - DM can broadcast messages
  - Player actions visible to DM in real-time

### Advanced Character Features
- [ ] **Leveling System**
  - XP tracking
  - Level up interface
  - Stat increases on level up
  - New class features at milestones
  
- [ ] **Character Background**
  - Rich text biography
  - Backstory editor
  - Character portrait upload
  
- [ ] **Achievement System**
  - Track player accomplishments
  - Award badges/titles
  - Leaderboards (optional)

### Storage & Media
- [ ] **Supabase Storage Buckets**
  - Create `stl-models` bucket for character models
  - Create `map-images` bucket for world maps
  - Create `portraits` bucket for character avatars
  
- [ ] **Storage Policies**
  - Public read access
  - Authenticated upload
  - Admin full access
  
- [ ] **File Management UI**
  - Upload interface with drag-drop
  - File browser
  - Delete unused files

### UI/UX Improvements
- [ ] **Loading States**
  - Skeleton loaders for data fetching
  - Progress bars for file uploads
  
- [ ] **Error Handling**
  - Toast notifications for errors
  - Retry failed requests
  - Offline mode detection
  
- [ ] **Mobile Responsive**
  - Optimize dashboard for mobile
  - Touch-friendly controls
  - Collapsible sidebars
  
- [ ] **Accessibility**
  - ARIA labels
  - Keyboard navigation
  - Screen reader support
  
- [ ] **Themes**
  - Additional color schemes (green, orange, etc.)
  - Light mode (for accessibility)
  - Custom theme creator

---

## 🛠️ TECHNICAL IMPROVEMENTS

### Performance
- [ ] **Database Indexing**
  - Index frequently queried fields
  - Optimize RLS policies
  
- [ ] **Lazy Loading**
  - Code splitting for routes
  - Load images on demand
  
- [ ] **Caching**
  - Cache static data (item catalog)
  - Service worker for offline support

### Testing
- [ ] **Unit Tests**
  - Test utility functions
  - Test character stat calculations
  
- [ ] **Integration Tests**
  - Test Supabase queries
  - Test authentication flow
  
- [ ] **E2E Tests**
  - Test full user flows
  - Test critical paths (login, character creation, etc.)

### Documentation
- [ ] **User Guide**
  - How to create a character
  - How to use the shop
  - How to complete missions
  
- [ ] **DM Guide**
  - How to create items
  - How to manage encounters
  - Best practices for sessions
  
- [ ] **Developer Docs**
  - Setup instructions
  - Architecture overview
  - Contribution guidelines

### DevOps
- [ ] **Environment Variables**
  - Separate dev/staging/prod configs
  
- [ ] **CI/CD Pipeline**
  - Automated testing on push
  - Auto-deploy to Vercel/Netlify
  
- [ ] **Monitoring**
  - Error tracking (Sentry)
  - Analytics (Posthog, Plausible)
  - Performance monitoring

---

## 📊 Priority Summary

| Priority | Features | Estimated Time |
|----------|----------|----------------|
| 🔴 Critical | Fix RLS, Update Schema, Test Login | 30 minutes |
| 🟡 High | Character System, Inventory, Items | 2-3 days |
| 🟢 Medium | Shop, Missions, World Map | 2-3 days |
| 🟣 DM Tools | God Mode, Item Creator, Map Editor | 3-4 days |
| 🔵 Advanced | 3D Features, Real-time, Advanced | 1-2 weeks |
| 🛠️ Technical | Performance, Testing, DevOps | Ongoing |

**Total Estimated Time to MVP**: ~2 weeks of focused development
**Full Feature Complete**: ~4-6 weeks

---

## ✅ Recently Completed

- [x] Project initialization (Vite, React, TypeScript, Tailwind)
- [x] Supabase integration and client setup
- [x] Cyberpunk theme with custom CSS variables
- [x] Authentication system (signup, login, logout)
- [x] Role-based routing (player vs admin)
- [x] Landing page with glitch effects
- [x] Login/Signup page
- [x] Player Dashboard skeleton
- [x] DM Dashboard skeleton
- [x] Database schema with 8 tables
- [x] Cyberpunk RED character system (13 classes)
- [x] Character creation form
- [x] Character classes data structure (all 13 classes with features)
- [x] SQL schema for stats, skills, and class features

---

**Last Updated**: December 16, 2025
**Current Phase**: Character System Implementation
**Next Up**: Update PlayerDashboard to show real character data
