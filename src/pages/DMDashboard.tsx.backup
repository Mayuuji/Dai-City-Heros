import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function DMDashboard() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [restingShort, setRestingShort] = useState(false);
  const [restingLong, setRestingLong] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleShortRest = async () => {
    if (!confirm('Trigger SHORT REST for all players? This will restore short rest abilities.')) return;
    
    try {
      setRestingShort(true);
      
      // Restore charges for short_rest abilities
      const { data: abilities, error: fetchError } = await supabase
        .from('character_abilities')
        .select(`
          *,
          ability:abilities (charge_type, max_charges, charges_per_rest)
        `)
        .in('ability:abilities.charge_type', ['short_rest']);
      
      if (fetchError) throw fetchError;
      
      // Update each ability
      for (const charAbility of abilities || []) {
        if (!charAbility.ability) continue;
        
        const restoreAmount = charAbility.ability.charges_per_rest || charAbility.ability.max_charges || 0;
        
        await supabase
          .from('character_abilities')
          .update({ current_charges: restoreAmount })
          .eq('id', charAbility.id);
      }
      
      alert(`SHORT REST complete! Restored charges for ${abilities?.length || 0} abilities.`);
      
    } catch (err: any) {
      console.error('Error during short rest:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setRestingShort(false);
    }
  };

  const handleLongRest = async () => {
    if (!confirm('Trigger LONG REST for all players? This will restore ALL abilities and full HP.')) return;
    
    try {
      setRestingLong(true);
      
      // Restore charges for both short_rest and long_rest abilities
      const { data: abilities, error: fetchError } = await supabase
        .from('character_abilities')
        .select(`
          *,
          ability:abilities (charge_type, max_charges, charges_per_rest)
        `)
        .in('ability:abilities.charge_type', ['short_rest', 'long_rest']);
      
      if (fetchError) throw fetchError;
      
      // Update each ability
      for (const charAbility of abilities || []) {
        if (!charAbility.ability) continue;
        
        const restoreAmount = charAbility.ability.charges_per_rest || charAbility.ability.max_charges || 0;
        
        await supabase
          .from('character_abilities')
          .update({ current_charges: restoreAmount })
          .eq('id', charAbility.id);
      }
      
      // Restore all characters to full HP
      const { data: characters, error: charError } = await supabase
        .from('characters')
        .select('id, max_hp');
      
      if (charError) throw charError;
      
      for (const char of characters || []) {
        await supabase
          .from('characters')
          .update({ current_hp: char.max_hp })
          .eq('id', char.id);
      }
      
      alert(`LONG REST complete! Restored charges for ${abilities?.length || 0} abilities and healed ${characters?.length || 0} characters to full HP.`);
      
    } catch (err: any) {
      console.error('Error during long rest:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setRestingLong(false);
    }
  };

  return (
    <div className="min-h-screen grid-bg" style={{ backgroundColor: 'var(--color-cyber-darker)' }}>
      {/* Header */}
      <div className="glass-panel" style={{ borderRadius: 0, border: '2px solid var(--color-cyber-magenta)' }}>
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl neon-text" style={{ fontFamily: 'var(--font-cyber)' }}>
            👑 DM CONTROL CENTER
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>
              ADMIN: {profile?.username || 'DM'}
            </span>
            <button onClick={handleSignOut} className="neon-button-magenta text-sm">
              LOGOUT
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Welcome */}
        <div className="glass-panel p-6 mb-6" style={{ border: '2px solid var(--color-cyber-magenta)' }}>
          <h2 className="text-xl mb-2" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-magenta)' }}>
            DUNGEON MASTER MODE ACTIVE
          </h2>
          <p className="text-sm" style={{ color: 'var(--color-cyber-magenta)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
            Access Level: ADMIN // Full System Control Enabled
          </p>
        </div>

        {/* DM Tools Grid */}
        <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-6">
          {/* God Mode */}
          <div className="glass-panel p-6" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-magenta) 30%, transparent)' }}>
            <h3 className="text-lg mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-magenta)' }}>
              🔮 GOD MODE
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
              Edit any character's stats, inventory, and resources
            </p>
            <button 
              onClick={() => navigate('/dm/god-mode')}
              className="neon-button-magenta w-full text-sm"
            >
              OPEN GOD MODE
            </button>
          </div>

          {/* Item Creator */}
          <div className="glass-panel p-6" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)' }}>
            <h3 className="text-lg mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
              ⚔️ ITEM CREATOR
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
              Design new items with custom stats and modifiers
            </p>
            <button 
              onClick={() => navigate('/dm/item-creator')}
              className="neon-button w-full text-sm"
            >
              CREATE ITEM
            </button>
          </div>

          {/* Item Editor */}
          <div className="glass-panel p-6" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-orange) 30%, transparent)' }}>
            <h3 className="text-lg mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-orange)' }}>
              ✏️ ITEM EDITOR
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
              Edit existing items and their linked abilities
            </p>
            <button 
              onClick={() => navigate('/dm/item-editor')}
              className="neon-button w-full text-sm"
              style={{ borderColor: 'var(--color-cyber-orange)', color: 'var(--color-cyber-orange)' }}
            >
              EDIT ITEMS
            </button>
          </div>

          {/* Ability Creator */}
          <div className="glass-panel p-6" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-purple) 30%, transparent)' }}>
            <h3 className="text-lg mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-purple)' }}>
              ⚡ ABILITY CREATOR
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
              Create abilities with charges and effects
            </p>
            <button 
              onClick={() => navigate('/dm/ability-creator')}
              className="neon-button w-full text-sm"
              style={{ borderColor: 'var(--color-cyber-purple)', color: 'var(--color-cyber-purple)' }}
            >
              CREATE ABILITY
            </button>
          </div>

          {/* Give Item */}
          <div className="glass-panel p-6" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-orange) 30%, transparent)' }}>
            <h3 className="text-lg mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-orange)' }}>
              🎁 GIVE ITEM
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
              Award items to players
            </p>
            <button 
              onClick={() => navigate('/dm/give-item')}
              className="neon-button w-full text-sm"
              style={{ borderColor: 'var(--color-cyber-orange)', color: 'var(--color-cyber-orange)' }}
            >
              GIVE ITEM
            </button>
          </div>

          {/* Ability Manager */}
          <div className="glass-panel p-6" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-pink) 30%, transparent)' }}>
            <h3 className="text-lg mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-pink)' }}>
              🧠 ABILITY MANAGER
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
              View all abilities and their links
            </p>
            <button 
              onClick={() => navigate('/dm/ability-manager')}
              className="neon-button w-full text-sm"
              style={{ borderColor: 'var(--color-cyber-pink)', color: 'var(--color-cyber-pink)' }}
            >
              MANAGE ABILITIES
            </button>
          </div>

          {/* Map Editor */}
          <div className="glass-panel p-6" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-green) 30%, transparent)' }}>
            <h3 className="text-lg mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-green)' }}>
              🗺️ MAP EDITOR
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
              Create locations, set bounds, control world map
            </p>
            <button 
              onClick={() => navigate('/dm/map-editor')}
              className="neon-button w-full text-sm" 
              style={{ borderColor: 'var(--color-cyber-green)', color: 'var(--color-cyber-green)' }}
            >
              EDIT MAP
            </button>
          </div>

          {/* Shop Manager */}
          <div className="glass-panel p-6" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-green) 30%, transparent)' }}>
            <h3 className="text-lg mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-green)' }}>
              🛍️ SHOP MANAGER
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
              Create shops, manage inventory, set prices
            </p>
            <button 
              onClick={() => navigate('/dm/shops')}
              className="neon-button w-full text-sm" 
              style={{ borderColor: 'var(--color-cyber-green)', color: 'var(--color-cyber-green)' }}
            >
              MANAGE SHOPS
            </button>
          </div>

          {/* Mission Manager */}
          <div className="glass-panel p-6" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)' }}>
            <h3 className="text-lg mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
              📋 MISSION MANAGER
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
              Create missions, assign to players, distribute rewards
            </p>
            <button 
              onClick={() => navigate('/dm/missions')}
              className="neon-button w-full text-sm" 
              style={{ borderColor: 'var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
            >
              MANAGE MISSIONS
            </button>
          </div>

          {/* NPC & Enemy Manager */}
          <div className="glass-panel p-6" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-orange) 30%, transparent)' }}>
            <h3 className="text-lg mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-orange)' }}>
              👥 NPC & ENEMY MANAGER
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
              Create NPCs and enemies with full roleplay details
            </p>
            <button 
              onClick={() => navigate('/dm/npcs')}
              className="neon-button w-full text-sm" 
              style={{ borderColor: 'var(--color-cyber-orange)', color: 'var(--color-cyber-orange)' }}
            >
              MANAGE NPCs
            </button>
          </div>

          {/* Encounter Manager */}
          <div className="glass-panel p-6" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-pink) 30%, transparent)' }}>
            <h3 className="text-lg mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-pink)' }}>
              ⚔️ ENCOUNTERS
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
              Manage combat encounters and enemy stats
            </p>
            <button 
              onClick={() => navigate('/dm/encounters')}
              className="neon-button w-full text-sm" 
              style={{ borderColor: 'var(--color-cyber-pink)', color: 'var(--color-cyber-pink)' }}
            >
              MANAGE ENCOUNTERS
            </button>
          </div>

          {/* Session Notes */}
          <div className="glass-panel p-6" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-purple) 30%, transparent)' }}>
            <h3 className="text-lg mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-purple)' }}>
              📝 SESSION NOTES
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
              Keep private notes for your campaign
            </p>
            <button className="neon-button w-full text-sm" style={{ borderColor: 'var(--color-cyber-purple)', color: 'var(--color-cyber-purple)' }}>
              OPEN NOTES
            </button>
          </div>

          {/* Battle Map */}
          <div className="glass-panel p-6" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-blue) 30%, transparent)' }}>
            <h3 className="text-lg mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-blue)' }}>
              🎲 3D BATTLE MAP
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
              Place characters and enemies on the grid
            </p>
            <button className="neon-button w-full text-sm" style={{ borderColor: 'var(--color-cyber-blue)', color: 'var(--color-cyber-blue)' }}>
              OPEN BATTLE MAP
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-4 gap-4">
          <div className="glass-panel p-4 text-center" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)' }}>
            <div className="text-3xl mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>
              0
            </div>
            <div className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
              Active Players
            </div>
          </div>

          <div className="glass-panel p-4 text-center" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-magenta) 30%, transparent)' }}>
            <div className="text-3xl mb-2" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-cyber)' }}>
              5
            </div>
            <div className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
              Total Items
            </div>
          </div>

          <div className="glass-panel p-4 text-center" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-green) 30%, transparent)' }}>
            <div className="text-3xl mb-2" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-cyber)' }}>
              0
            </div>
            <div className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
              Active Missions
            </div>
          </div>

          <div className="glass-panel p-4 text-center" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-purple) 30%, transparent)' }}>
            <div className="text-3xl mb-2" style={{ color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-cyber)' }}>
              0
            </div>
            <div className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
              Encounters
            </div>
          </div>
        </div>

        {/* Rest Controls */}
        <div className="grid md:grid-cols-2 gap-6 mt-6">
          <div className="glass-panel p-6" style={{ border: '2px solid var(--color-cyber-green)' }}>
            <h3 className="text-xl mb-2" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-green)' }}>
              ⏱️ SHORT REST
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
              Restore short rest abilities for all players
            </p>
            <button 
              onClick={handleShortRest}
              disabled={restingShort}
              className="neon-button w-full"
              style={{ 
                borderColor: 'var(--color-cyber-green)', 
                color: 'var(--color-cyber-green)',
                opacity: restingShort ? 0.5 : 1
              }}
            >
              {restingShort ? 'RESTING...' : 'TRIGGER SHORT REST'}
            </button>
          </div>

          <div className="glass-panel p-6" style={{ border: '2px solid var(--color-cyber-blue)' }}>
            <h3 className="text-xl mb-2" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-blue)' }}>
              🌙 LONG REST
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
              Restore ALL abilities and full HP for all players
            </p>
            <button 
              onClick={handleLongRest}
              disabled={restingLong}
              className="neon-button w-full"
              style={{ 
                borderColor: 'var(--color-cyber-blue)', 
                color: 'var(--color-cyber-blue)',
                opacity: restingLong ? 0.5 : 1
              }}
            >
              {restingLong ? 'RESTING...' : 'TRIGGER LONG REST'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
