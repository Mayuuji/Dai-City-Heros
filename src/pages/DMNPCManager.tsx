import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { NPC, NPCType, NPCDisposition, NPCAbility, NPCDrops } from '../types/npc';

interface Location {
  id: string;
  name: string;
}

export default function DMNPCManager() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [npcs, setNpcs] = useState<NPC[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<NPC | null>(null);
  
  // Filters
  const [typeFilter, setTypeFilter] = useState<NPCType | 'all'>('all');
  const [aliveFilter, setAliveFilter] = useState<'all' | 'alive' | 'dead'>('alive');
  
  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState<NPCType>('Neutral NPC');
  const [disposition, setDisposition] = useState<NPCDisposition>('Neutral');
  const [description, setDescription] = useState('');
  const [maxHp, setMaxHp] = useState(10);
  const [currentHp, setCurrentHp] = useState(10);
  const [ac, setAc] = useState(10);
  
  // Stats
  const [str, setStr] = useState(10);
  const [dex, setDex] = useState(10);
  const [con, setCon] = useState(10);
  const [wis, setWis] = useState(10);
  const [int, setInt] = useState(10);
  const [cha, setCha] = useState(10);
  
  // Roleplay
  const [uniqueDetails, setUniqueDetails] = useState('');
  const [speechPattern, setSpeechPattern] = useState('');
  const [mannerisms, setMannerisms] = useState('');
  const [currentProblem, setCurrentProblem] = useState('');
  const [problemInvolves, setProblemInvolves] = useState('');
  const [theirApproach, setTheirApproach] = useState('');
  const [secret, setSecret] = useState('');
  const [threeWords, setThreeWords] = useState('');
  const [voiceDirection, setVoiceDirection] = useState('');
  const [rememberBy, setRememberBy] = useState('');
  
  // Combat & Loot
  const [abilities, setAbilities] = useState<NPCAbility[]>([]);
  const [dropUsd, setDropUsd] = useState(0);
  const [dropItems, setDropItems] = useState<string[]>([]);
  
  // Other
  const [locationId, setLocationId] = useState<string>('');
  const [dmNotes, setDmNotes] = useState('');

  // Check if user is admin
  if (profile?.role !== 'admin') {
    navigate('/dashboard');
    return null;
  }

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch NPCs
      const { data: npcsData, error: npcsError } = await supabase
        .from('npcs')
        .select('*')
        .order('name');
      
      if (npcsError) throw npcsError;
      setNpcs(npcsData || []);
      
      // Fetch locations
      const { data: locationsData, error: locationsError } = await supabase
        .from('locations')
        .select('id, name')
        .order('name');
      
      if (locationsError) throw locationsError;
      setLocations(locationsData || []);
      
    } catch (err: any) {
      console.error('Error fetching data:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setType('Neutral NPC');
    setDisposition('Neutral');
    setDescription('');
    setMaxHp(10);
    setCurrentHp(10);
    setAc(10);
    setStr(10);
    setDex(10);
    setCon(10);
    setWis(10);
    setInt(10);
    setCha(10);
    setUniqueDetails('');
    setSpeechPattern('');
    setMannerisms('');
    setCurrentProblem('');
    setProblemInvolves('');
    setTheirApproach('');
    setSecret('');
    setThreeWords('');
    setVoiceDirection('');
    setRememberBy('');
    setAbilities([]);
    setDropUsd(0);
    setDropItems([]);
    setLocationId('');
    setDmNotes('');
    setEditing(null);
  };

  const loadNPCForEdit = (npc: NPC) => {
    setEditing(npc);
    setName(npc.name);
    setType(npc.type);
    setDisposition(npc.disposition);
    setDescription(npc.description || '');
    setMaxHp(npc.max_hp);
    setCurrentHp(npc.current_hp);
    setAc(npc.ac);
    setStr(npc.str);
    setDex(npc.dex);
    setCon(npc.con);
    setWis(npc.wis);
    setInt(npc.int);
    setCha(npc.cha);
    setUniqueDetails(npc.unique_details || '');
    setSpeechPattern(npc.speech_pattern || '');
    setMannerisms(npc.mannerisms || '');
    setCurrentProblem(npc.current_problem || '');
    setProblemInvolves(npc.problem_involves || '');
    setTheirApproach(npc.their_approach || '');
    setSecret(npc.secret || '');
    setThreeWords(npc.three_words || '');
    setVoiceDirection(npc.voice_direction || '');
    setRememberBy(npc.remember_by || '');
    setAbilities(npc.abilities || []);
    setDropUsd(npc.drops_on_defeat?.usd || 0);
    setDropItems(npc.drops_on_defeat?.items || []);
    setLocationId(npc.location_id || '');
    setDmNotes(npc.dm_notes || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCreateOrUpdate = async () => {
    if (!name.trim()) {
      alert('Please enter a name');
      return;
    }

    try {
      setCreating(true);

      const npcData = {
        name: name.trim(),
        type,
        disposition,
        description: description || null,
        max_hp: maxHp,
        current_hp: currentHp,
        ac,
        str, dex, con, wis, int, cha,
        unique_details: uniqueDetails || null,
        speech_pattern: speechPattern || null,
        mannerisms: mannerisms || null,
        current_problem: currentProblem || null,
        problem_involves: problemInvolves || null,
        their_approach: theirApproach || null,
        secret: secret || null,
        three_words: threeWords || null,
        voice_direction: voiceDirection || null,
        remember_by: rememberBy || null,
        abilities,
        drops_on_defeat: { usd: dropUsd, items: dropItems },
        location_id: locationId || null,
        dm_notes: dmNotes || null
      };

      if (editing) {
        // Update existing NPC
        const { error } = await supabase
          .from('npcs')
          .update(npcData)
          .eq('id', editing.id);

        if (error) throw error;
        alert(`${name} updated successfully!`);
      } else {
        // Create new NPC
        const { error } = await supabase
          .from('npcs')
          .insert(npcData);

        if (error) throw error;
        alert(`${name} created successfully!`);
      }

      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Error saving NPC:', error);
      alert(`Failed to save NPC: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (npc: NPC) => {
    if (!confirm(`Delete ${npc.name}? This cannot be undone.`)) return;

    try {
      const { error } = await supabase
        .from('npcs')
        .delete()
        .eq('id', npc.id);

      if (error) throw error;
      alert(`${npc.name} deleted successfully!`);
      fetchData();
    } catch (error: any) {
      console.error('Error deleting NPC:', error);
      alert(`Failed to delete NPC: ${error.message}`);
    }
  };

  const handleToggleAlive = async (npc: NPC) => {
    try {
      const { error } = await supabase
        .from('npcs')
        .update({ is_alive: !npc.is_alive })
        .eq('id', npc.id);

      if (error) throw error;
      fetchData();
    } catch (error: any) {
      console.error('Error toggling alive status:', error);
      alert(`Failed to update status: ${error.message}`);
    }
  };

  const handleUpdateHp = async (npc: NPC, newHp: number) => {
    try {
      const { error } = await supabase
        .from('npcs')
        .update({ current_hp: Math.max(0, Math.min(newHp, npc.max_hp)) })
        .eq('id', npc.id);

      if (error) throw error;
      fetchData();
    } catch (error: any) {
      console.error('Error updating HP:', error);
      alert(`Failed to update HP: ${error.message}`);
    }
  };

  const addAbility = () => {
    setAbilities([...abilities, { name: '', damage: null, effect: '' }]);
  };

  const updateAbility = (index: number, field: keyof NPCAbility, value: string) => {
    const updated = [...abilities];
    if (field === 'damage') {
      updated[index] = { ...updated[index], damage: value || null };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setAbilities(updated);
  };

  const removeAbility = (index: number) => {
    setAbilities(abilities.filter((_, i) => i !== index));
  };

  const addDropItem = () => {
    setDropItems([...dropItems, '']);
  };

  const updateDropItem = (index: number, value: string) => {
    const updated = [...dropItems];
    updated[index] = value;
    setDropItems(updated);
  };

  const removeDropItem = (index: number) => {
    setDropItems(dropItems.filter((_, i) => i !== index));
  };

  const getTypeColor = (type: NPCType): string => {
    switch (type) {
      case 'Boss': return 'var(--color-cyber-red)';
      case 'Mini-Boss': return 'var(--color-cyber-orange)';
      case 'Enemy': return 'var(--color-cyber-pink)';
      case 'Friendly NPC': return 'var(--color-cyber-green)';
      case 'Quest Giver': return 'var(--color-cyber-purple)';
      case 'Vendor': return 'var(--color-cyber-yellow)';
      case 'Neutral NPC': return 'var(--color-cyber-cyan)';
      case 'Civilian': return 'var(--color-cyber-blue)';
      default: return 'var(--color-cyber-cyan)';
    }
  };

  const getDispositionColor = (disposition: NPCDisposition): string => {
    switch (disposition) {
      case 'Hostile': return 'var(--color-cyber-red)';
      case 'Unfriendly': return 'var(--color-cyber-orange)';
      case 'Neutral': return 'var(--color-cyber-yellow)';
      case 'Friendly': return 'var(--color-cyber-green)';
      case 'Allied': return 'var(--color-cyber-cyan)';
      default: return 'var(--color-cyber-cyan)';
    }
  };

  const filteredNPCs = npcs.filter(npc => {
    if (typeFilter !== 'all' && npc.type !== typeFilter) return false;
    if (aliveFilter === 'alive' && !npc.is_alive) return false;
    if (aliveFilter === 'dead' && npc.is_alive) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-cyber-darker)' }}>
        <div className="glass-panel p-8 text-center">
          <div className="animate-spin w-12 h-12 border-4 rounded-full mx-auto mb-4" 
               style={{ borderColor: 'var(--color-cyber-green)', borderTopColor: 'transparent' }}></div>
          <p style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>LOADING NPCs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid-bg p-6" style={{ backgroundColor: 'var(--color-cyber-darker)' }}>
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <button
          onClick={() => navigate('/dm/dashboard')}
          className="neon-button mb-4"
          style={{ borderColor: 'var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
        >
          ← BACK TO DASHBOARD
        </button>

        <h1 className="text-4xl mb-2" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-red)' }}>
          👥 NPC & ENEMY MANAGER
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
          Create and manage NPCs and enemies with full roleplay and combat details
        </p>
      </div>

      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-6">
        {/* LEFT: Create/Edit Form */}
        <div className="space-y-6">
          <div className="glass-panel p-6" style={{ border: '2px solid var(--color-cyber-green)' }}>
            <h2 className="text-2xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-green)' }}>
              {editing ? `EDIT: ${editing.name}` : 'CREATE NPC/ENEMY'}
            </h2>

            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                  Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Razor Eddie"
                  className="w-full px-4 py-2 rounded"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                    border: '1px solid var(--color-cyber-cyan)',
                    color: 'var(--color-cyber-cyan)',
                    fontFamily: 'var(--font-mono)'
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                    Type *
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as NPCType)}
                    className="w-full px-4 py-2 rounded"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                      border: '1px solid var(--color-cyber-cyan)',
                      color: 'var(--color-cyber-cyan)',
                      fontFamily: 'var(--font-mono)'
                    }}
                  >
                    <option value="Enemy">Enemy</option>
                    <option value="Friendly NPC">Friendly NPC</option>
                    <option value="Neutral NPC">Neutral NPC</option>
                    <option value="Vendor">Vendor</option>
                    <option value="Quest Giver">Quest Giver</option>
                    <option value="Boss">Boss</option>
                    <option value="Mini-Boss">Mini-Boss</option>
                    <option value="Civilian">Civilian</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                    Disposition
                  </label>
                  <select
                    value={disposition}
                    onChange={(e) => setDisposition(e.target.value as NPCDisposition)}
                    className="w-full px-4 py-2 rounded"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                      border: '1px solid var(--color-cyber-cyan)',
                      color: 'var(--color-cyber-cyan)',
                      fontFamily: 'var(--font-mono)'
                    }}
                  >
                    <option value="Hostile">Hostile</option>
                    <option value="Unfriendly">Unfriendly</option>
                    <option value="Neutral">Neutral</option>
                    <option value="Friendly">Friendly</option>
                    <option value="Allied">Allied</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Physical appearance and general description..."
                  rows={3}
                  className="w-full px-4 py-2 rounded"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                    border: '1px solid var(--color-cyber-cyan)',
                    color: 'var(--color-cyber-cyan)',
                    fontFamily: 'var(--font-mono)',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div>
                <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                  Location
                </label>
                <select
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  className="w-full px-4 py-2 rounded"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                    border: '1px solid var(--color-cyber-cyan)',
                    color: 'var(--color-cyber-cyan)',
                    fontFamily: 'var(--font-mono)'
                  }}
                >
                  <option value="">None</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Combat Stats */}
          <div className="glass-panel p-6" style={{ border: '1px solid var(--color-cyber-red)' }}>
            <h3 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-red)' }}>
              ⚔️ COMBAT STATS
            </h3>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                  Max HP
                </label>
                <input
                  type="number"
                  value={maxHp}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setMaxHp(val);
                    setCurrentHp(val);
                  }}
                  className="w-full px-4 py-2 rounded"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-cyber-red) 10%, transparent)',
                    border: '1px solid var(--color-cyber-red)',
                    color: 'var(--color-cyber-red)',
                    fontFamily: 'var(--font-mono)'
                  }}
                />
              </div>

              <div>
                <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                  Current HP
                </label>
                <input
                  type="number"
                  value={currentHp}
                  onChange={(e) => setCurrentHp(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2 rounded"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-cyber-red) 10%, transparent)',
                    border: '1px solid var(--color-cyber-red)',
                    color: 'var(--color-cyber-red)',
                    fontFamily: 'var(--font-mono)'
                  }}
                />
              </div>

              <div>
                <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                  AC
                </label>
                <input
                  type="number"
                  value={ac}
                  onChange={(e) => setAc(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2 rounded"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                    border: '1px solid var(--color-cyber-cyan)',
                    color: 'var(--color-cyber-cyan)',
                    fontFamily: 'var(--font-mono)'
                  }}
                />
              </div>
            </div>

            {/* Core Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'STR', value: str, setter: setStr },
                { label: 'DEX', value: dex, setter: setDex },
                { label: 'CON', value: con, setter: setCon },
                { label: 'WIS', value: wis, setter: setWis },
                { label: 'INT', value: int, setter: setInt },
                { label: 'CHA', value: cha, setter: setCha },
              ].map(stat => (
                <div key={stat.label}>
                  <label className="block text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                    {stat.label}
                  </label>
                  <input
                    type="number"
                    value={stat.value}
                    onChange={(e) => stat.setter(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-1 rounded text-center"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                      border: '1px solid var(--color-cyber-cyan)',
                      color: 'var(--color-cyber-cyan)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.875rem'
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Abilities */}
          <div className="glass-panel p-6" style={{ border: '1px solid var(--color-cyber-purple)' }}>
            <h3 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-purple)' }}>
              ⚡ ABILITIES
            </h3>

            <div className="space-y-3 mb-4">
              {abilities.map((ability, index) => (
                <div key={index} className="p-3 rounded" style={{ border: '1px solid var(--color-cyber-purple)', backgroundColor: 'color-mix(in srgb, var(--color-cyber-purple) 5%, transparent)' }}>
                  <input
                    type="text"
                    value={ability.name}
                    onChange={(e) => updateAbility(index, 'name', e.target.value)}
                    placeholder="Ability Name"
                    className="w-full px-3 py-1 rounded mb-2"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--color-cyber-purple) 10%, transparent)',
                      border: '1px solid var(--color-cyber-purple)',
                      color: 'var(--color-cyber-purple)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.875rem'
                    }}
                  />
                  <input
                    type="text"
                    value={ability.damage || ''}
                    onChange={(e) => updateAbility(index, 'damage', e.target.value)}
                    placeholder="Damage (e.g., 2d6+3) - Optional"
                    className="w-full px-3 py-1 rounded mb-2"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--color-cyber-red) 10%, transparent)',
                      border: '1px solid var(--color-cyber-red)',
                      color: 'var(--color-cyber-red)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.875rem'
                    }}
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={ability.effect}
                      onChange={(e) => updateAbility(index, 'effect', e.target.value)}
                      placeholder="Effect description"
                      className="flex-1 px-3 py-1 rounded"
                      style={{
                        backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                        border: '1px solid var(--color-cyber-cyan)',
                        color: 'var(--color-cyber-cyan)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.875rem'
                      }}
                    />
                    <button
                      onClick={() => removeAbility(index)}
                      className="px-3 py-1 rounded"
                      style={{
                        backgroundColor: 'color-mix(in srgb, var(--color-cyber-red) 20%, transparent)',
                        border: '1px solid var(--color-cyber-red)',
                        color: 'var(--color-cyber-red)'
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={addAbility}
              className="neon-button w-full text-sm"
              style={{ borderColor: 'var(--color-cyber-purple)', color: 'var(--color-cyber-purple)' }}
            >
              + ADD ABILITY
            </button>
          </div>

          {/* Loot Drops */}
          <div className="glass-panel p-6" style={{ border: '1px solid var(--color-cyber-yellow)' }}>
            <h3 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-yellow)' }}>
              💰 DROPS ON DEFEAT
            </h3>

            <div className="mb-4">
              <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                USD $
              </label>
              <input
                type="number"
                value={dropUsd}
                onChange={(e) => setDropUsd(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-2 rounded"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--color-cyber-yellow) 10%, transparent)',
                  border: '1px solid var(--color-cyber-yellow)',
                  color: 'var(--color-cyber-yellow)',
                  fontFamily: 'var(--font-mono)'
                }}
              />
            </div>

            <div className="space-y-2 mb-4">
              <label className="block text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                Items
              </label>
              {dropItems.map((item, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => updateDropItem(index, e.target.value)}
                    placeholder="Item name"
                    className="flex-1 px-3 py-2 rounded"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--color-cyber-yellow) 10%, transparent)',
                      border: '1px solid var(--color-cyber-yellow)',
                      color: 'var(--color-cyber-yellow)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.875rem'
                    }}
                  />
                  <button
                    onClick={() => removeDropItem(index)}
                    className="px-3 py-2 rounded"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--color-cyber-red) 20%, transparent)',
                      border: '1px solid var(--color-cyber-red)',
                      color: 'var(--color-cyber-red)'
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={addDropItem}
              className="neon-button w-full text-sm"
              style={{ borderColor: 'var(--color-cyber-yellow)', color: 'var(--color-cyber-yellow)' }}
            >
              + ADD ITEM
            </button>
          </div>

          {/* Roleplay Details - Part 1 */}
          <div className="glass-panel p-6" style={{ border: '1px solid var(--color-cyber-cyan)' }}>
            <h3 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
              🎭 ROLEPLAY DETAILS
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                  Unique Details
                </label>
                <textarea
                  value={uniqueDetails}
                  onChange={(e) => setUniqueDetails(e.target.value)}
                  placeholder="Scars, cybernetics, clothing, memorable features..."
                  rows={2}
                  className="w-full px-4 py-2 rounded"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                    border: '1px solid var(--color-cyber-cyan)',
                    color: 'var(--color-cyber-cyan)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.875rem',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div>
                <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                  Speech Pattern
                </label>
                <textarea
                  value={speechPattern}
                  onChange={(e) => setSpeechPattern(e.target.value)}
                  placeholder="Accent, slang, formal, stutters, catchphrases..."
                  rows={2}
                  className="w-full px-4 py-2 rounded"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                    border: '1px solid var(--color-cyber-cyan)',
                    color: 'var(--color-cyber-cyan)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.875rem',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div>
                <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                  Mannerisms
                </label>
                <textarea
                  value={mannerisms}
                  onChange={(e) => setMannerisms(e.target.value)}
                  placeholder="Body language, habits, quirks, nervous ticks..."
                  rows={2}
                  className="w-full px-4 py-2 rounded"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                    border: '1px solid var(--color-cyber-cyan)',
                    color: 'var(--color-cyber-cyan)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.875rem',
                    resize: 'vertical'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Roleplay Details - Part 2 (Story) */}
          <div className="glass-panel p-6" style={{ border: '1px solid var(--color-cyber-purple)' }}>
            <h3 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-purple)' }}>
              📖 STORY DETAILS
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                  Current Problem
                </label>
                <textarea
                  value={currentProblem}
                  onChange={(e) => setCurrentProblem(e.target.value)}
                  placeholder="What's bothering them right now..."
                  rows={2}
                  className="w-full px-4 py-2 rounded"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-cyber-purple) 10%, transparent)',
                    border: '1px solid var(--color-cyber-purple)',
                    color: 'var(--color-cyber-purple)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.875rem',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div>
                <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                  Who/What It Involves
                </label>
                <input
                  type="text"
                  value={problemInvolves}
                  onChange={(e) => setProblemInvolves(e.target.value)}
                  placeholder="Related person, organization, or object..."
                  className="w-full px-4 py-2 rounded"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-cyber-purple) 10%, transparent)',
                    border: '1px solid var(--color-cyber-purple)',
                    color: 'var(--color-cyber-purple)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.875rem'
                  }}
                />
              </div>

              <div>
                <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                  Their Approach
                </label>
                <input
                  type="text"
                  value={theirApproach}
                  onChange={(e) => setTheirApproach(e.target.value)}
                  placeholder="Aggressive, cautious, diplomatic, sneaky..."
                  className="w-full px-4 py-2 rounded"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-cyber-purple) 10%, transparent)',
                    border: '1px solid var(--color-cyber-purple)',
                    color: 'var(--color-cyber-purple)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.875rem'
                  }}
                />
              </div>

              <div>
                <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-red)', fontFamily: 'var(--font-mono)' }}>
                  Secret
                </label>
                <textarea
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="Hidden information, lies, what they're hiding..."
                  rows={2}
                  className="w-full px-4 py-2 rounded"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-cyber-red) 10%, transparent)',
                    border: '1px solid var(--color-cyber-red)',
                    color: 'var(--color-cyber-red)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.875rem',
                    resize: 'vertical'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Quick Reference */}
          <div className="glass-panel p-6" style={{ border: '1px solid var(--color-cyber-green)' }}>
            <h3 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-green)' }}>
              🎯 QUICK REFERENCE
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                  Three Words
                </label>
                <input
                  type="text"
                  value={threeWords}
                  onChange={(e) => setThreeWords(e.target.value)}
                  placeholder="Gruff, Loyal, Paranoid"
                  className="w-full px-4 py-2 rounded"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-cyber-green) 10%, transparent)',
                    border: '1px solid var(--color-cyber-green)',
                    color: 'var(--color-cyber-green)',
                    fontFamily: 'var(--font-mono)'
                  }}
                />
              </div>

              <div>
                <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                  Voice Direction
                </label>
                <textarea
                  value={voiceDirection}
                  onChange={(e) => setVoiceDirection(e.target.value)}
                  placeholder="Deep and gravelly, Brooklyn accent..."
                  rows={2}
                  className="w-full px-4 py-2 rounded"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-cyber-green) 10%, transparent)',
                    border: '1px solid var(--color-cyber-green)',
                    color: 'var(--color-cyber-green)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.875rem',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div>
                <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                  Remember Them By
                </label>
                <input
                  type="text"
                  value={rememberBy}
                  onChange={(e) => setRememberBy(e.target.value)}
                  placeholder="The guy with the chrome arm who owes you"
                  className="w-full px-4 py-2 rounded"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-cyber-green) 10%, transparent)',
                    border: '1px solid var(--color-cyber-green)',
                    color: 'var(--color-cyber-green)',
                    fontFamily: 'var(--font-mono)'
                  }}
                />
              </div>
            </div>
          </div>

          {/* DM Notes */}
          <div className="glass-panel p-6" style={{ border: '1px solid var(--color-cyber-orange)' }}>
            <h3 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-orange)' }}>
              📝 DM NOTES
            </h3>

            <textarea
              value={dmNotes}
              onChange={(e) => setDmNotes(e.target.value)}
              placeholder="Private notes for the DM only..."
              rows={4}
              className="w-full px-4 py-2 rounded"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--color-cyber-orange) 10%, transparent)',
                border: '1px solid var(--color-cyber-orange)',
                color: 'var(--color-cyber-orange)',
                fontFamily: 'var(--font-mono)',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={handleCreateOrUpdate}
              disabled={creating}
              className="flex-1 neon-button text-lg py-3"
              style={{ borderColor: 'var(--color-cyber-green)', color: 'var(--color-cyber-green)' }}
            >
              {creating ? 'SAVING...' : editing ? 'UPDATE NPC' : 'CREATE NPC'}
            </button>
            {editing && (
              <button
                onClick={resetForm}
                className="neon-button px-6 py-3"
                style={{ borderColor: 'var(--color-cyber-red)', color: 'var(--color-cyber-red)' }}
              >
                CANCEL
              </button>
            )}
          </div>
        </div>

        {/* RIGHT: NPC List */}
        <div className="space-y-4">
          {/* Filters */}
          <div className="glass-panel p-4" style={{ border: '1px solid var(--color-cyber-cyan)' }}>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                  TYPE
                </label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as NPCType | 'all')}
                  className="w-full px-3 py-2 rounded text-sm"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                    border: '1px solid var(--color-cyber-cyan)',
                    color: 'var(--color-cyber-cyan)',
                    fontFamily: 'var(--font-mono)'
                  }}
                >
                  <option value="all">All Types</option>
                  <option value="Enemy">Enemy</option>
                  <option value="Friendly NPC">Friendly NPC</option>
                  <option value="Neutral NPC">Neutral NPC</option>
                  <option value="Vendor">Vendor</option>
                  <option value="Quest Giver">Quest Giver</option>
                  <option value="Boss">Boss</option>
                  <option value="Mini-Boss">Mini-Boss</option>
                  <option value="Civilian">Civilian</option>
                </select>
              </div>

              <div className="flex-1">
                <label className="block text-xs mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                  STATUS
                </label>
                <select
                  value={aliveFilter}
                  onChange={(e) => setAliveFilter(e.target.value as 'all' | 'alive' | 'dead')}
                  className="w-full px-3 py-2 rounded text-sm"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                    border: '1px solid var(--color-cyber-cyan)',
                    color: 'var(--color-cyber-cyan)',
                    fontFamily: 'var(--font-mono)'
                  }}
                >
                  <option value="all">All</option>
                  <option value="alive">Alive</option>
                  <option value="dead">Dead</option>
                </select>
              </div>
            </div>
          </div>

          {/* NPC Cards */}
          <div className="space-y-4">
            {filteredNPCs.map(npc => (
              <div
                key={npc.id}
                className="glass-panel p-4"
                style={{ border: `2px solid ${getTypeColor(npc.type)}` }}
              >
                {/* Header */}
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-xl mb-1" style={{ fontFamily: 'var(--font-cyber)', color: getTypeColor(npc.type) }}>
                      {npc.name}
                    </h3>
                    <div className="flex gap-2 flex-wrap">
                      <span
                        className="px-2 py-1 rounded text-xs"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${getTypeColor(npc.type)} 20%, transparent)`,
                          border: `1px solid ${getTypeColor(npc.type)}`,
                          color: getTypeColor(npc.type),
                          fontFamily: 'var(--font-mono)'
                        }}
                      >
                        {npc.type}
                      </span>
                      <span
                        className="px-2 py-1 rounded text-xs"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${getDispositionColor(npc.disposition)} 20%, transparent)`,
                          border: `1px solid ${getDispositionColor(npc.disposition)}`,
                          color: getDispositionColor(npc.disposition),
                          fontFamily: 'var(--font-mono)'
                        }}
                      >
                        {npc.disposition}
                      </span>
                      {!npc.is_alive && (
                        <span
                          className="px-2 py-1 rounded text-xs"
                          style={{
                            backgroundColor: 'color-mix(in srgb, var(--color-cyber-red) 20%, transparent)',
                            border: '1px solid var(--color-cyber-red)',
                            color: 'var(--color-cyber-red)',
                            fontFamily: 'var(--font-mono)'
                          }}
                        >
                          ☠️ DEAD
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* HP Bar */}
                {npc.is_alive && (
                  <div className="mb-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                        HP: {npc.current_hp} / {npc.max_hp}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                        AC: {npc.ac}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded" style={{ backgroundColor: 'color-mix(in srgb, var(--color-cyber-red) 20%, transparent)' }}>
                      <div
                        className="h-full rounded transition-all"
                        style={{
                          width: `${(npc.current_hp / npc.max_hp) * 100}%`,
                          backgroundColor: npc.current_hp > npc.max_hp * 0.5 ? 'var(--color-cyber-green)' : npc.current_hp > npc.max_hp * 0.25 ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-red)'
                        }}
                      />
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleUpdateHp(npc, npc.current_hp - 5)}
                        className="px-2 py-1 rounded text-xs"
                        style={{
                          backgroundColor: 'color-mix(in srgb, var(--color-cyber-red) 20%, transparent)',
                          border: '1px solid var(--color-cyber-red)',
                          color: 'var(--color-cyber-red)'
                        }}
                      >
                        -5
                      </button>
                      <button
                        onClick={() => handleUpdateHp(npc, npc.current_hp - 1)}
                        className="px-2 py-1 rounded text-xs"
                        style={{
                          backgroundColor: 'color-mix(in srgb, var(--color-cyber-red) 20%, transparent)',
                          border: '1px solid var(--color-cyber-red)',
                          color: 'var(--color-cyber-red)'
                        }}
                      >
                        -1
                      </button>
                      <button
                        onClick={() => handleUpdateHp(npc, npc.current_hp + 1)}
                        className="px-2 py-1 rounded text-xs"
                        style={{
                          backgroundColor: 'color-mix(in srgb, var(--color-cyber-green) 20%, transparent)',
                          border: '1px solid var(--color-cyber-green)',
                          color: 'var(--color-cyber-green)'
                        }}
                      >
                        +1
                      </button>
                      <button
                        onClick={() => handleUpdateHp(npc, npc.current_hp + 5)}
                        className="px-2 py-1 rounded text-xs"
                        style={{
                          backgroundColor: 'color-mix(in srgb, var(--color-cyber-green) 20%, transparent)',
                          border: '1px solid var(--color-cyber-green)',
                          color: 'var(--color-cyber-green)'
                        }}
                      >
                        +5
                      </button>
                      <button
                        onClick={() => handleUpdateHp(npc, npc.max_hp)}
                        className="px-2 py-1 rounded text-xs"
                        style={{
                          backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)',
                          border: '1px solid var(--color-cyber-cyan)',
                          color: 'var(--color-cyber-cyan)'
                        }}
                      >
                        FULL
                      </button>
                    </div>
                  </div>
                )}

                {/* Quick Info */}
                {npc.remember_by && (
                  <p className="text-sm mb-2" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>
                    💡 {npc.remember_by}
                  </p>
                )}
                {npc.three_words && (
                  <p className="text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', fontStyle: 'italic' }}>
                    "{npc.three_words}"
                  </p>
                )}

                {/* Abilities */}
                {npc.abilities && npc.abilities.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs mb-1" style={{ color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-mono)' }}>
                      ABILITIES:
                    </p>
                    {npc.abilities.map((ability, i) => (
                      <div key={i} className="text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                        • {ability.name} {ability.damage && `(${ability.damage})`}
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => loadNPCForEdit(npc)}
                    className="flex-1 px-3 py-2 rounded text-sm"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)',
                      border: '1px solid var(--color-cyber-cyan)',
                      color: 'var(--color-cyber-cyan)'
                    }}
                  >
                    EDIT
                  </button>
                  <button
                    onClick={() => handleToggleAlive(npc)}
                    className="px-3 py-2 rounded text-sm"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${npc.is_alive ? 'var(--color-cyber-red)' : 'var(--color-cyber-green)'} 20%, transparent)`,
                      border: `1px solid ${npc.is_alive ? 'var(--color-cyber-red)' : 'var(--color-cyber-green)'}`,
                      color: npc.is_alive ? 'var(--color-cyber-red)' : 'var(--color-cyber-green)'
                    }}
                  >
                    {npc.is_alive ? 'KILL' : 'REVIVE'}
                  </button>
                  <button
                    onClick={() => handleDelete(npc)}
                    className="px-3 py-2 rounded text-sm"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--color-cyber-red) 20%, transparent)',
                      border: '1px solid var(--color-cyber-red)',
                      color: 'var(--color-cyber-red)'
                    }}
                  >
                    DELETE
                  </button>
                </div>
              </div>
            ))}

            {filteredNPCs.length === 0 && (
              <div className="glass-panel p-8 text-center">
                <p style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)', opacity: 0.7 }}>
                  No NPCs found. Create your first NPC!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
