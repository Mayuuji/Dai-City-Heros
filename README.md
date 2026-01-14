# 🌃 Cyberpunk Tabletop Companion

A full-stack web application for managing D&D-style TTRPG sessions with a cyberpunk aesthetic. Features role-based access (DM vs Player), 3D character model viewing, custom world maps, inventory management, and a 3D battle map.

## 🎨 Features

### Player Features
- 📊 **Character Dashboard**: View stats (STR, DEX, INT, etc.), HP, and gold
- 🎮 **3D Character Viewer**: View your character's STL model with rotation/zoom
- 🎒 **Inventory System**: Manage items, equip gear with stat modifiers, consume items
- 🗺️ **World Map**: Custom image-based map with location markers
- 🛍️ **Shop System**: Purchase items using gold
- 📜 **Mission Log**: Track active quests and objectives

### DM (Admin) Features
- 👑 **God Mode**: Edit any character's stats or inventory
- ⚔️ **Encounter Manager**: Create and manage combat encounters
- 🎁 **Item Creator**: Design new items with custom stat modifiers
- 📍 **Map Editor**: Add location markers to the world map
- 🎲 **3D Battle Map**: Place player STL models and enemy markers on a grid
- 📝 **Session Notes**: Keep private DM notes

## 🛠️ Tech Stack

- **Frontend**: React 18 + Vite
- **Styling**: Tailwind CSS (Cyberpunk theme)
- **3D Graphics**: Three.js + React Three Fiber + Drei
- **Mapping**: React Leaflet (CRS.Simple for custom maps)
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Routing**: React Router v6

## 🚀 Setup Instructions

### 1. Prerequisites
- Node.js 18+ and npm
- A Supabase account (free tier)

### 2. Clone and Install
```bash
cd cyberpunk-ttrpg
npm install
```

### 3. Supabase Setup

#### Create a Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Wait for it to initialize

#### Run the SQL Schema
1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Open the file `supabase-schema.sql` from this project
4. Copy and paste the entire SQL into the editor
5. Click **Run**

This will create:
- All database tables (profiles, characters, items, inventory, locations, missions, encounters, session_notes)
- Row Level Security (RLS) policies
- Indexes and triggers
- Sample seed data

#### Create Storage Buckets
1. Go to **Storage** in your Supabase dashboard
2. Create two new buckets:
   - `stl-models` (for character 3D models)
   - `map-images` (for world map images)
3. Set both buckets to **Public** or configure policies:
   - Allow authenticated users to SELECT
   - Allow authenticated users to INSERT (optional: restrict to admins only)

#### Get Your Credentials
1. Go to **Settings** > **API**
2. Copy your **Project URL**
3. Copy your **anon/public key**

### 4. Configure Environment Variables
1. Open the `.env` file in the project root
2. Add your Supabase credentials:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 5. Run the Development Server
```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## 👥 User Roles

### Creating Your First Admin
1. Sign up for a new account through the app
2. Go to your Supabase dashboard > **Table Editor** > **profiles**
3. Find your user row and change the `role` from `'player'` to `'admin'`
4. Refresh the app - you now have DM powers!

### Role Permissions
- **Player**: Can view/edit their own character, inventory, and interact with shops/missions
- **Admin (DM)**: Full access to all characters, items, locations, encounters, and private notes

## 📁 Project Structure

```
src/
├── lib/
│   └── supabase.js          # Supabase client configuration
├── contexts/
│   └── AuthContext.jsx      # Authentication state management
├── components/
│   ├── auth/                # Login/Signup components
│   ├── layout/              # Navigation and layout components
│   ├── player/              # Player-specific components
│   │   ├── CharacterSheet/
│   │   ├── STLViewer/
│   │   ├── Inventory/
│   │   ├── WorldMap/
│   │   └── Shop/
│   ├── dm/                  # DM-specific components
│   │   ├── GodMode/
│   │   ├── ItemCreator/
│   │   ├── MapEditor/
│   │   └── EncounterManager/
│   └── shared/              # Shared components
│       └── BattleMap/
├── pages/                   # Route pages
└── styles/                  # Global styles
```

## 🎨 Cyberpunk Theme

The app uses a custom Tailwind theme with:
- **Dark backgrounds**: `cyber-dark`, `cyber-darker`
- **Neon accents**: `cyber-cyan`, `cyber-magenta`, `cyber-pink`
- **Terminal fonts**: Monospace and Orbitron
- **Glassmorphism**: `.glass-panel`
- **Neon effects**: `.neon-border`, `.neon-text`
- **Glitch animations**: Applied to headers

### Custom CSS Classes
```jsx
<div className="glass-panel neon-border p-4">
  <h1 className="neon-text font-cyber">CYBERPUNK</h1>
  <button className="neon-button">CONNECT</button>
</div>
```

## 📦 Database Schema Overview

### Core Tables
- **profiles**: User accounts with role (player/admin)
- **characters**: Character stats, HP, gold, STL URL
- **items**: Item definitions with stat modifiers
- **inventory**: Links characters to items with equipped status
- **locations**: Map markers with coordinates and shop inventories
- **missions**: Quest tracking with rewards
- **encounters**: DM-only combat encounter data
- **session_notes**: DM-only session notes

### Security
All tables use **Row Level Security (RLS)**:
- Players can only see/edit their own data
- Admins have full access to all data
- Sensitive DM data (encounters, notes) is hidden from players

## 🎮 Development Progress

- [x] Project setup with Vite + React + TypeScript + Tailwind
- [x] Supabase integration with full schema
- [x] Cyberpunk styling system with custom theme
- [x] **Authentication system (Login/Signup/Logout)**
- [x] **Role-based routing (Player vs DM dashboards)**
- [x] **Landing page with feature preview**
- [ ] Character creation form
- [ ] Character sheet with real data from database
- [ ] 3D STL viewer component
- [ ] Inventory management with equip/consume
- [ ] World map with React Leaflet
- [ ] Shop interface
- [ ] DM tools (God Mode, Item Creator)
- [ ] 3D Battle Map with grid
- [ ] Real-time updates via Supabase subscriptions

## 🧪 Testing the App

### Test Authentication Flow
1. Start the dev server: `npm run dev`
2. Visit `http://localhost:5174/`
3. Click "LOGIN / REGISTER" button
4. Create a new account (will default to 'player' role)
5. You'll be redirected to the Player Dashboard
6. Test logout button

### Test DM Access
To test DM features, you need to manually update a user's role in Supabase:
1. Go to Supabase Dashboard → Table Editor → `profiles`
2. Find your user and change `role` from 'player' to 'admin'
3. Log out and log back in
4. You should now see the DM Dashboard with admin tools

### Current Routes
- `/` - Landing page with project info
- `/login` - Authentication (Login/Signup toggle)
- `/dashboard` - Auto-routes to Player or DM dashboard based on role
- `/dm` - Direct DM dashboard access (admin only)

## 🔧 Common Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## 📝 Next Steps

1. ✅ **Database is ready** - SQL schema deployed to Supabase
2. ✅ **Credentials configured** - `.env.local` file set up
3. ✅ **Authentication working** - Login/Signup/Logout functional
4. ✅ **Role-based dashboards** - Player and DM views created
5. ⏭️ **Character creation** - Build form to create first character
6. ⏭️ **Fetch real data** - Connect dashboards to Supabase queries
7. ⏭️ **Create storage buckets** - Set up `stl-models` and `map-images` in Supabase
8. ⏭️ **Upload test assets** - Add a sample STL model and map image

## 🤝 Contributing

This is a personal project, but feel free to fork and customize for your own campaigns!

## 📄 License

MIT License - Use freely for your tabletop adventures!

---

**Built with ⚡ by a cyberpunk enthusiast for the ultimate TTRPG experience**
