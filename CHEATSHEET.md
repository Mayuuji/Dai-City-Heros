# 🎮 Commands Cheat Sheet

Quick reference for common commands and code snippets.

## 📦 NPM Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Install dependencies
npm install

# Install a new package
npm install package-name

# Install a dev dependency
npm install -D package-name
```

## 🗄️ Supabase Quick Queries

### Authentication

```javascript
import { supabase } from './lib/supabase';

// Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password',
  options: {
    data: {
      username: 'PlayerOne'
    }
  }
});

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
});

// Sign out
await supabase.auth.signOut();

// Get current user
const { data: { user } } = await supabase.auth.getUser();
```

### Profiles

```javascript
// Get current user's profile
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', user.id)
  .single();

// Update profile
await supabase
  .from('profiles')
  .update({ username: 'NewName' })
  .eq('id', user.id);
```

### Characters

```javascript
// Get user's character
const { data: character } = await supabase
  .from('characters')
  .select('*')
  .eq('user_id', user.id)
  .single();

// Create a character
await supabase
  .from('characters')
  .insert({
    user_id: user.id,
    name: 'CyberNinja',
    class: 'Netrunner',
    stats: {
      strength: 10,
      dexterity: 15,
      intelligence: 18,
      constitution: 12,
      wisdom: 14,
      charisma: 8
    },
    max_hp: 100,
    current_hp: 100,
    gold: 500
  });

// Update HP
await supabase
  .from('characters')
  .update({ current_hp: newHP })
  .eq('id', characterId);

// Update stats (JSONB)
await supabase
  .from('characters')
  .update({ 
    stats: { ...currentStats, strength: 12 }
  })
  .eq('id', characterId);
```

### Items

```javascript
// Get all items
const { data: items } = await supabase
  .from('items')
  .select('*');

// Get items by type
const { data: weapons } = await supabase
  .from('items')
  .select('*')
  .eq('item_type', 'weapon');

// Create item (Admin only)
await supabase
  .from('items')
  .insert({
    name: 'Plasma Rifle',
    description: 'High-tech energy weapon',
    item_type: 'weapon',
    stat_modifiers: { strength: 2, dexterity: 1 },
    cost: 300,
    rarity: 'rare',
    is_equippable: true
  });
```

### Inventory

```javascript
// Get character's inventory with item details
const { data: inventory } = await supabase
  .from('inventory')
  .select(`
    *,
    items (*)
  `)
  .eq('character_id', characterId);

// Add item to inventory
await supabase
  .from('inventory')
  .insert({
    character_id: characterId,
    item_id: itemId,
    quantity: 1
  });

// Equip item
await supabase
  .from('inventory')
  .update({ is_equipped: true })
  .eq('id', inventoryId);

// Remove item (consume)
await supabase
  .from('inventory')
  .delete()
  .eq('id', inventoryId);

// Decrease quantity
await supabase
  .from('inventory')
  .update({ quantity: currentQuantity - 1 })
  .eq('id', inventoryId);
```

### Locations

```javascript
// Get all visible locations
const { data: locations } = await supabase
  .from('locations')
  .select('*')
  .eq('is_visible', true);

// Get shop locations
const { data: shops } = await supabase
  .from('locations')
  .select('*')
  .eq('location_type', 'shop');

// Create location (Admin only)
await supabase
  .from('locations')
  .insert({
    name: 'Tech Bazaar',
    description: 'Black market tech vendor',
    map_x: 100,
    map_y: 150,
    location_type: 'shop',
    shop_inventory: [itemId1, itemId2],
    is_visible: true
  });
```

### Missions

```javascript
// Get all missions
const { data: missions } = await supabase
  .from('missions')
  .select('*');

// Get active missions
const { data: activeMissions } = await supabase
  .from('missions')
  .select('*')
  .eq('status', 'active');

// Update mission status (Admin)
await supabase
  .from('missions')
  .update({ status: 'completed' })
  .eq('id', missionId);
```

### Encounters (Admin Only)

```javascript
// Get active encounter
const { data: encounter } = await supabase
  .from('encounters')
  .select('*')
  .eq('is_active', true)
  .single();

// Create encounter
await supabase
  .from('encounters')
  .insert({
    name: 'Gang Ambush',
    description: 'Street thugs attack!',
    enemy_list: [
      { name: 'Thug 1', hp: 30, ac: 12, position: [5, 5] },
      { name: 'Thug 2', hp: 30, ac: 12, position: [7, 5] }
    ],
    is_active: true,
    dm_notes: 'They want the data chip'
  });
```

## 🎨 Styling Quick Reference

### Cyberpunk Colors

```jsx
// Backgrounds
<div className="bg-cyber-darker">      {/* #050816 */}
<div className="bg-cyber-dark">        {/* #0a0e27 */}

// Text Colors
<span className="text-cyber-cyan">    {/* #00fff9 */}
<span className="text-cyber-magenta">  {/* #ff00ff */}
<span className="text-cyber-blue">     {/* #00d9ff */}
<span className="text-cyber-green">    {/* #39ff14 */}
<span className="text-cyber-pink">     {/* #ff006e */}
```

### Component Styles

```jsx
// Glass panel
<div className="glass-panel p-6">
  Content
</div>

// Neon border
<div className="neon-border p-4">
  Content
</div>

// Neon text with glow
<h1 className="neon-text font-cyber text-3xl">
  CYBERPUNK
</h1>

// Button (cyan)
<button className="neon-button">
  Click Me
</button>

// Button (magenta)
<button className="neon-button-magenta">
  Click Me
</button>

// Terminal input
<input 
  className="terminal-input w-full"
  placeholder="Enter command..."
/>

// Stat bar (HP, XP, etc)
<div className="stat-bar">
  <div className="stat-bar-fill" style={{ width: '75%' }} />
</div>

// Grid background
<div className="grid-bg min-h-screen">
  Content
</div>

// Glitch effect
<h1 className="glitch">
  GLITCHING TEXT
</h1>
```

### Fonts

```jsx
// Monospace (default body font)
<p className="font-mono">Terminal text</p>

// Orbitron (cyberpunk headers)
<h1 className="font-cyber">CYBERPUNK</h1>
```

## ⚡ React Three Fiber Basics

```jsx
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';

function Scene() {
  return (
    <Canvas camera={{ position: [0, 5, 10], fov: 50 }}>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      
      {/* Controls */}
      <OrbitControls />
      
      {/* Environment */}
      <Environment preset="night" />
      
      {/* Your 3D objects */}
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#00fff9" />
      </mesh>
    </Canvas>
  );
}
```

## 🗺️ React Leaflet Basics

```jsx
import { MapContainer, ImageOverlay, Marker, Popup } from 'react-leaflet';
import { CRS } from 'leaflet';
import 'leaflet/dist/leaflet.css';

const bounds = [[0, 0], [1000, 1000]];
const mapUrl = '/path-to-your-map-image.jpg';

function WorldMap() {
  return (
    <MapContainer
      crs={CRS.Simple}
      bounds={bounds}
      style={{ height: '600px', width: '100%' }}
      zoom={0}
    >
      <ImageOverlay url={mapUrl} bounds={bounds} />
      
      <Marker position={[500, 500]}>
        <Popup>
          Location Name
        </Popup>
      </Marker>
    </MapContainer>
  );
}
```

## 🔐 Protected Routes

```jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';

function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, profile, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  
  if (!user) return <Navigate to="/login" />;
  
  if (requireAdmin && profile?.role !== 'admin') {
    return <Navigate to="/dashboard" />;
  }

  return children;
}

// Usage:
<Route 
  path="/dm" 
  element={
    <ProtectedRoute requireAdmin>
      <DMDashboard />
    </ProtectedRoute>
  } 
/>
```

## 🎯 Real-time Subscriptions

```javascript
// Subscribe to character changes
const channel = supabase
  .channel('character-changes')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'characters',
      filter: `id=eq.${characterId}`
    },
    (payload) => {
      console.log('Character updated:', payload.new);
      // Update your state
    }
  )
  .subscribe();

// Clean up
return () => {
  supabase.removeChannel(channel);
};
```

## 📤 File Upload (Storage)

```javascript
// Upload STL model
const file = event.target.files[0];
const filePath = `${user.id}/${file.name}`;

const { data, error } = await supabase.storage
  .from('stl-models')
  .upload(filePath, file);

if (!error) {
  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('stl-models')
    .getPublicUrl(filePath);
  
  // Save URL to character
  await supabase
    .from('characters')
    .update({ stl_url: publicUrl })
    .eq('id', characterId);
}
```

## 🐛 Debugging Tips

```javascript
// Log Supabase queries
const { data, error } = await supabase
  .from('characters')
  .select('*');

console.log('Data:', data);
console.log('Error:', error);

// Check auth state
const { data: { session } } = await supabase.auth.getSession();
console.log('Session:', session);

// Test RLS policies
// If you can't see data, check:
// 1. Are you authenticated?
// 2. Does your role have permission?
// 3. Is RLS enabled on the table?
```

---

**Pro tip**: Bookmark this file! You'll use these snippets constantly. 🚀
