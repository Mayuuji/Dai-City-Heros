# 📊 Supabase Database Setup Guide

## Step-by-Step Instructions

### 1. Access Supabase SQL Editor
1. Log into your Supabase dashboard at [supabase.com](https://supabase.com)
2. Select your project (or create a new one)
3. Click on **SQL Editor** in the left sidebar

### 2. Run the Schema
1. Open the file `supabase-schema.sql` in your code editor
2. Copy the **entire contents** of the file
3. Paste it into the SQL Editor in Supabase
4. Click the **RUN** button (or press Ctrl/Cmd + Enter)

### 3. Verify Table Creation
After running the SQL, verify everything was created:

1. Go to **Table Editor** in the left sidebar
2. You should see these tables:
   - ✅ profiles
   - ✅ characters
   - ✅ items
   - ✅ inventory
   - ✅ locations
   - ✅ missions
   - ✅ encounters
   - ✅ session_notes

### 4. Create Storage Buckets

#### Create STL Models Bucket
1. Click **Storage** in the left sidebar
2. Click **New bucket**
3. Name: `stl-models`
4. Make it **Public** (or set custom policies)
5. Click **Create bucket**

#### Create Map Images Bucket
1. Click **New bucket** again
2. Name: `map-images`
3. Make it **Public**
4. Click **Create bucket**

#### Configure Storage Policies (Optional)
If you want more control:

**For stl-models bucket:**
```sql
-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload STL models"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'stl-models');

-- Allow public read access
CREATE POLICY "Anyone can view STL models"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'stl-models');
```

**For map-images bucket:**
```sql
-- Allow admins to upload maps
CREATE POLICY "Admins can upload maps"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'map-images' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Allow public read access
CREATE POLICY "Anyone can view maps"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'map-images');
```

### 5. Get Your API Credentials
1. Go to **Settings** (gear icon)
2. Click **API** in the left menu
3. Copy these values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGc...` (long string)

### 6. Add Credentials to Your App
1. Open the `.env` file in your project root
2. Paste your credentials:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```
3. Save the file

### 7. Test the Connection
Run your app:
```bash
npm run dev
```

If everything is configured correctly, you should be able to:
- Sign up for a new account
- See your profile in the `profiles` table

## 🎯 What the Schema Includes

### Tables Created
| Table | Purpose |
|-------|---------|
| **profiles** | User accounts with role (player/admin) |
| **characters** | Character stats, HP, gold, 3D model URL |
| **items** | Item definitions with stat modifiers |
| **inventory** | Links characters to items |
| **locations** | Map markers and shop locations |
| **missions** | Quest tracking and rewards |
| **encounters** | DM-only combat encounters |
| **session_notes** | DM-only session notes |

### Security Features
- ✅ **Row Level Security (RLS)** enabled on all tables
- ✅ Players can only access their own data
- ✅ Admins have full access to everything
- ✅ DM-only tables hidden from players
- ✅ Automatic profile creation on signup

### Sample Data Included
The schema includes 5 starter items:
1. Neural Stim Pack (healing consumable)
2. Plasma Blade (weapon)
3. Kevlar Vest (armor)
4. Cyberware Implant (accessory)
5. Data Chip (quest item)

## 🔧 Troubleshooting

### Error: "relation already exists"
This means you've run the schema before. Either:
- Drop the existing tables first
- Or skip re-running the schema

### Error: "permission denied"
Make sure you're running the SQL as the project owner in the Supabase SQL Editor.

### Can't see tables
- Refresh the page
- Check the **Table Editor** tab
- Verify the SQL ran without errors

### Auth not working
- Make sure you've enabled Email auth in **Authentication > Providers**
- Check that your `.env` file has the correct credentials
- Restart your dev server after updating `.env`

## 🎮 Creating Your First Admin User

1. Sign up through your app (you'll be a player by default)
2. Go to Supabase **Table Editor** > **profiles**
3. Find your user row
4. Change the `role` column from `'player'` to `'admin'`
5. Click **Save**
6. Refresh your app

You now have DM powers! 🎲

## 📚 Understanding Row Level Security

**Players can:**
- ✅ View their own profile
- ✅ Create/edit their own characters
- ✅ View all items
- ✅ Manage their own inventory
- ✅ View visible locations
- ✅ View missions

**Admins can:**
- ✅ All of the above, plus:
- ✅ View and edit all profiles
- ✅ View and edit all characters
- ✅ Create/edit items
- ✅ Create/edit locations
- ✅ Manage encounters (hidden from players)
- ✅ Write session notes (hidden from players)

## 🚀 Next Steps

After completing this setup:
1. ✅ Database is configured
2. ✅ Storage buckets are ready
3. ✅ API credentials are in `.env`
4. ⏭️ Start building the UI components
5. ⏭️ Test authentication flow
6. ⏭️ Upload test assets (STL models, map images)

---

**Need help?** Check the main README.md or the Supabase documentation.
