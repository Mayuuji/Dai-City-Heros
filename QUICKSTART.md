# 🎯 Quick Start Guide

## ✅ What's Been Completed

### 1. Project Initialization ✓
- Vite + React project created
- All dependencies installed
- Tailwind CSS configured with cyberpunk theme
- PostCSS configured

### 2. Supabase Integration ✓
- Client configured in `src/lib/supabase.js`
- Environment variables template created
- Complete SQL schema ready to deploy

### 3. Database Schema ✓
Located in: `supabase-schema.sql`

**Tables Created:**
- `profiles` - User accounts with roles
- `characters` - Character stats and data
- `items` - Item definitions
- `inventory` - Character-item relationships
- `locations` - World map markers
- `missions` - Quest tracking
- `encounters` - DM-only combat data
- `session_notes` - DM-only notes

**Security:**
- Row Level Security (RLS) enabled
- Role-based access (player vs admin)
- Auto-profile creation on signup

### 4. Styling System ✓
Custom Tailwind theme with:
- Cyberpunk color palette
- Neon effects and shadows
- Glassmorphism panels
- Terminal fonts
- Glitch animations

## 🚀 Your Next Steps

### Immediate (Must Do)

1. **Setup Supabase Database**
   ```bash
   # 1. Go to supabase.com and create a project
   # 2. Open SQL Editor
   # 3. Copy and paste all of supabase-schema.sql
   # 4. Click RUN
   ```

2. **Create Storage Buckets**
   - In Supabase Dashboard > Storage
   - Create bucket: `stl-models` (public)
   - Create bucket: `map-images` (public)

3. **Add Your Credentials**
   ```bash
   # Edit .env file and add:
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

4. **Test the App**
   ```bash
   npm run dev
   # Visit http://localhost:5173
   ```

### Next Phase (Building UI)

5. **Create Authentication**
   - Build Login/Signup pages
   - Create AuthContext for state management
   - Implement protected routes

6. **Build Core Components**
   - Character sheet display
   - 3D STL viewer (React Three Fiber)
   - Inventory grid
   - World map (React Leaflet)

7. **Implement DM Tools**
   - God Mode editor
   - Item creator
   - Map editor
   - Encounter manager

## 📂 File Structure Reference

```
cyberpunk-ttrpg/
├── src/
│   ├── lib/
│   │   └── supabase.js          ← Supabase client
│   ├── App.jsx                   ← Main app component
│   └── index.css                 ← Cyberpunk styles
├── supabase-schema.sql           ← Database schema (RUN THIS!)
├── SUPABASE_SETUP.md            ← Detailed setup guide
├── README.md                     ← Full documentation
├── .env                          ← Add your credentials here
└── .env.example                  ← Template for .env
```

## 🎨 Using the Cyberpunk Theme

### Color Palette
```jsx
// Dark backgrounds
bg-cyber-dark      // #0a0e27
bg-cyber-darker    // #050816

// Neon accents
text-cyber-cyan    // #00fff9
text-cyber-magenta // #ff00ff
text-cyber-blue    // #00d9ff
text-cyber-green   // #39ff14
```

### Component Classes
```jsx
// Glass panel with blur
<div className="glass-panel p-6">
  Content
</div>

// Neon bordered element
<div className="neon-border p-4">
  Content
</div>

// Neon text with glow
<h1 className="neon-text">TITLE</h1>

// Cyberpunk button
<button className="neon-button">
  Click Me
</button>

// Terminal-style input
<input className="terminal-input" />
```

## 🔑 Key Concepts

### Role-Based Access
```javascript
// Check user role
const { data: profile } = await supabase
  .from('profiles')
  .select('role')
  .eq('id', user.id)
  .single();

if (profile.role === 'admin') {
  // Show DM features
} else {
  // Show player features
}
```

### Working with Characters
```javascript
// Get user's character
const { data: character } = await supabase
  .from('characters')
  .select('*')
  .eq('user_id', user.id)
  .single();

// Update character stats
await supabase
  .from('characters')
  .update({ current_hp: newHP })
  .eq('id', characterId);
```

### Managing Inventory
```javascript
// Get character's inventory with item details
const { data: inventory } = await supabase
  .from('inventory')
  .select(`
    *,
    items (*)
  `)
  .eq('character_id', characterId);

// Equip an item
await supabase
  .from('inventory')
  .update({ is_equipped: true })
  .eq('id', inventoryId);
```

## 🎮 Testing Your Setup

### Create a Test User
1. Start your app: `npm run dev`
2. Sign up with a test email
3. Check Supabase > Table Editor > profiles
4. Your profile should appear!

### Make Yourself Admin
1. Go to Supabase > Table Editor > profiles
2. Find your user
3. Change `role` from `'player'` to `'admin'`
4. Save
5. Refresh your app

## 📚 Helpful Resources

- **Supabase Docs**: https://supabase.com/docs
- **React Three Fiber**: https://docs.pmnd.rs/react-three-fiber
- **React Leaflet**: https://react-leaflet.js.org
- **Tailwind CSS**: https://tailwindcss.com/docs

## 🐛 Troubleshooting

### "Missing Supabase environment variables"
- Check that `.env` file exists
- Verify credentials are correct
- Restart dev server: `npm run dev`

### Can't connect to database
- Verify SQL schema was run successfully
- Check Supabase project is active
- Test credentials in Supabase dashboard

### Styles not loading
- Verify Tailwind is configured
- Check `index.css` is imported in `main.jsx`
- Clear browser cache

## 🎯 Development Tips

1. **Start Small**: Build one feature at a time
2. **Test Often**: Check Supabase dashboard frequently
3. **Use Console**: `console.log()` your queries
4. **Check RLS**: If data doesn't appear, verify RLS policies
5. **Mobile First**: Test on different screen sizes

---

**You're all set!** 🚀 Run the SQL schema and start building your cyberpunk adventure!
