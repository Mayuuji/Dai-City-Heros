import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { InventoryItem } from '../types/inventory';
import { formatModifier } from '../utils/stats';

interface Character {
  id: string;
  user_id: string;
  name: string;
  class: string;
  level: number;
  current_hp: number;
  max_hp: number;
  ac: number;
  str: number;
  dex: number;
  con: number;
  wis: number;
  int: number;
  cha: number;
  usd: number;
}

interface Profile {
  id: string;
  username: string;
  role: string;
}

export default function DMGodMode() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [characters, setCharacters] = useState<Character[]>([]);
  const [profiles, setProfiles] = useState<{ [key: string]: Profile }>({});
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  useEffect(() => {
    // Check if user is admin
    if (profile?.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    fetchAllCharacters();
  }, [profile]);

  const fetchAllCharacters = async () => {
    try {
      setLoading(true);
      
      // Fetch all characters
      const { data: chars, error: charError } = await supabase
        .from('characters')
        .select('*')
        .order('name');
      
      if (charError) throw charError;
      setCharacters(chars || []);
      
      // Fetch all profiles
      const { data: profs, error: profError } = await supabase
        .from('profiles')
        .select('*');
      
      if (profError) throw profError;
      
      // Create profile lookup map
      const profileMap: { [key: string]: Profile } = {};
      (profs || []).forEach(p => {
        profileMap[p.id] = p;
      });
      setProfiles(profileMap);
      
    } catch (err: any) {
      console.error('Error fetching characters:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchCharacterInventory = async (characterId: string) => {
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select(`
          *,
          item:items (*)
        `)
        .eq('character_id', characterId);
      
      if (error) throw error;
      setInventory(data || []);
    } catch (err: any) {
      console.error('Error fetching inventory:', err);
    }
  };

  const handleSelectCharacter = (char: Character) => {
    setSelectedCharacter(char);
    setEditMode(false);
    fetchCharacterInventory(char.id);
  };

  const handleSaveCharacter = async () => {
    if (!selectedCharacter) return;
    
    try {
      const { error } = await supabase
        .from('characters')
        .update({
          name: selectedCharacter.name,
          level: selectedCharacter.level,
          current_hp: selectedCharacter.current_hp,
          max_hp: selectedCharacter.max_hp,
          ac: selectedCharacter.ac,
          str: selectedCharacter.str,
          dex: selectedCharacter.dex,
          con: selectedCharacter.con,
          wis: selectedCharacter.wis,
          int: selectedCharacter.int,
          cha: selectedCharacter.cha,
          usd: selectedCharacter.usd
        })
        .eq('id', selectedCharacter.id);
      
      if (error) throw error;
      
      // Update local state
      setCharacters(prev => 
        prev.map(c => c.id === selectedCharacter.id ? selectedCharacter : c)
      );
      
      setEditMode(false);
      alert('Character updated successfully!');
      
    } catch (err: any) {
      console.error('Error saving character:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleDeleteCharacter = async (char: Character) => {
    if (!confirm(`Delete ${char.name}? This cannot be undone!`)) return;
    
    try {
      const { error } = await supabase
        .from('characters')
        .delete()
        .eq('id', char.id);
      
      if (error) throw error;
      
      setCharacters(prev => prev.filter(c => c.id !== char.id));
      if (selectedCharacter?.id === char.id) {
        setSelectedCharacter(null);
      }
      
      alert('Character deleted');
      
    } catch (err: any) {
      console.error('Error deleting character:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleRemoveItem = async (invItem: InventoryItem) => {
    if (!confirm(`Remove ${invItem.item?.name}?`)) return;
    
    try {
      const { error } = await supabase
        .from('inventory')
        .delete()
        .eq('id', invItem.id);
      
      if (error) throw error;
      
      setInventory(prev => prev.filter(i => i.id !== invItem.id));
      alert('Item removed');
      
    } catch (err: any) {
      console.error('Error removing item:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const filteredCharacters = characters.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    profiles[c.user_id]?.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center grid-bg" style={{ backgroundColor: 'var(--color-cyber-darker)' }}>
        <div className="glass-panel p-8 text-center">
          <div className="animate-spin w-12 h-12 border-4 rounded-full mx-auto mb-4" 
               style={{ 
                 borderColor: 'color-mix(in srgb, var(--color-cyber-magenta) 30%, transparent)',
                 borderTopColor: 'var(--color-cyber-magenta)'
               }}>
          </div>
          <p style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>
            Loading characters...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid-bg" style={{ backgroundColor: 'var(--color-cyber-darker)' }}>
      {/* Header */}
      <div className="glass-panel" style={{ borderRadius: 0, border: '2px solid var(--color-cyber-magenta)' }}>
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <button onClick={() => navigate('/dashboard')} className="neon-button-magenta text-sm">
            ← BACK TO DASHBOARD
          </button>
          <h1 className="text-2xl neon-text" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-magenta)' }}>
            🔮 GOD MODE
          </h1>
          <div className="w-32"></div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Character List */}
          <div className="lg:col-span-1">
            <div className="glass-panel p-6 mb-4" style={{ border: '1px solid var(--color-cyber-magenta)' }}>
              <h2 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-magenta)' }}>
                ALL CHARACTERS ({characters.length})
              </h2>
              
              {/* Search */}
              <input
                type="text"
                placeholder="Search characters or players..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 rounded mb-4"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                  border: '1px solid var(--color-cyber-cyan)',
                  color: 'var(--color-cyber-cyan)',
                  fontFamily: 'var(--font-mono)'
                }}
              />
              
              {/* Character List */}
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredCharacters.map(char => (
                  <div
                    key={char.id}
                    onClick={() => handleSelectCharacter(char)}
                    className="p-3 rounded cursor-pointer transition-all hover:brightness-110"
                    style={{
                      backgroundColor: selectedCharacter?.id === char.id 
                        ? 'color-mix(in srgb, var(--color-cyber-magenta) 20%, transparent)'
                        : 'color-mix(in srgb, var(--color-cyber-cyan) 5%, transparent)',
                      border: selectedCharacter?.id === char.id 
                        ? '1px solid var(--color-cyber-magenta)'
                        : '1px solid color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)'
                    }}
                  >
                    <div className="text-sm mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>
                      {char.name}
                    </div>
                    <div className="flex justify-between items-center text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                      <span>Lv{char.level} {char.class}</span>
                      <span>{profiles[char.user_id]?.username || 'Unknown'}</span>
                    </div>
                    <div className="text-xs mt-1" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>
                      HP: {char.current_hp}/{char.max_hp} • ${char.usd.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Character Details */}
          <div className="lg:col-span-2">
            {selectedCharacter ? (
              <>
                {/* Character Info */}
                <div className="glass-panel p-6 mb-6" style={{ border: '2px solid var(--color-cyber-magenta)' }}>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      {editMode ? (
                        <input
                          type="text"
                          value={selectedCharacter.name}
                          onChange={(e) => setSelectedCharacter({ ...selectedCharacter, name: e.target.value })}
                          className="text-2xl px-2 py-1 rounded"
                          style={{
                            backgroundColor: 'color-mix(in srgb, var(--color-cyber-magenta) 10%, transparent)',
                            border: '1px solid var(--color-cyber-magenta)',
                            color: 'var(--color-cyber-magenta)',
                            fontFamily: 'var(--font-cyber)'
                          }}
                        />
                      ) : (
                        <h2 className="text-2xl" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-magenta)' }}>
                          {selectedCharacter.name}
                        </h2>
                      )}
                      <p className="text-sm mt-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                        Player: {profiles[selectedCharacter.user_id]?.username || 'Unknown'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {editMode ? (
                        <>
                          <button onClick={handleSaveCharacter} className="neon-button-magenta text-sm">
                            SAVE
                          </button>
                          <button onClick={() => setEditMode(false)} className="neon-button text-sm">
                            CANCEL
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setEditMode(true)} className="neon-button-magenta text-sm">
                            EDIT
                          </button>
                          <button 
                            onClick={() => handleDeleteCharacter(selectedCharacter)}
                            className="text-sm px-4 py-2 rounded"
                            style={{ 
                              border: '1px solid var(--color-cyber-pink)', 
                              color: 'var(--color-cyber-pink)',
                              fontFamily: 'var(--font-mono)'
                            }}
                          >
                            DELETE
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Basic Info */}
                    <div>
                      <h3 className="text-sm mb-3" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>
                        BASIC INFO
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                            Level
                          </span>
                          {editMode ? (
                            <input
                              type="number"
                              value={selectedCharacter.level}
                              onChange={(e) => setSelectedCharacter({ ...selectedCharacter, level: parseInt(e.target.value) || 1 })}
                              className="w-20 px-2 py-1 rounded text-center"
                              style={{
                                backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                                border: '1px solid var(--color-cyber-cyan)',
                                color: 'var(--color-cyber-cyan)',
                                fontFamily: 'var(--font-mono)'
                              }}
                            />
                          ) : (
                            <span className="text-lg" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                              {selectedCharacter.level}
                            </span>
                          )}
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                            Class
                          </span>
                          <span className="text-sm" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>
                            {selectedCharacter.class}
                          </span>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                            USD
                          </span>
                          {editMode ? (
                            <input
                              type="number"
                              value={selectedCharacter.usd}
                              onChange={(e) => setSelectedCharacter({ ...selectedCharacter, usd: parseInt(e.target.value) || 0 })}
                              className="w-32 px-2 py-1 rounded text-right"
                              style={{
                                backgroundColor: 'color-mix(in srgb, var(--color-cyber-green) 10%, transparent)',
                                border: '1px solid var(--color-cyber-green)',
                                color: 'var(--color-cyber-green)',
                                fontFamily: 'var(--font-mono)'
                              }}
                            />
                          ) : (
                            <span className="text-lg" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)' }}>
                              ${selectedCharacter.usd.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Combat Stats */}
                    <div>
                      <h3 className="text-sm mb-3" style={{ color: 'var(--color-cyber-pink)', fontFamily: 'var(--font-cyber)' }}>
                        COMBAT STATS
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                            Current HP
                          </span>
                          {editMode ? (
                            <input
                              type="number"
                              value={selectedCharacter.current_hp}
                              onChange={(e) => setSelectedCharacter({ ...selectedCharacter, current_hp: parseInt(e.target.value) || 0 })}
                              className="w-20 px-2 py-1 rounded text-center"
                              style={{
                                backgroundColor: 'color-mix(in srgb, var(--color-cyber-pink) 10%, transparent)',
                                border: '1px solid var(--color-cyber-pink)',
                                color: 'var(--color-cyber-pink)',
                                fontFamily: 'var(--font-mono)'
                              }}
                            />
                          ) : (
                            <span className="text-lg" style={{ color: 'var(--color-cyber-pink)', fontFamily: 'var(--font-mono)' }}>
                              {selectedCharacter.current_hp}
                            </span>
                          )}
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                            Max HP
                          </span>
                          {editMode ? (
                            <input
                              type="number"
                              value={selectedCharacter.max_hp}
                              onChange={(e) => setSelectedCharacter({ ...selectedCharacter, max_hp: parseInt(e.target.value) || 1 })}
                              className="w-20 px-2 py-1 rounded text-center"
                              style={{
                                backgroundColor: 'color-mix(in srgb, var(--color-cyber-pink) 10%, transparent)',
                                border: '1px solid var(--color-cyber-pink)',
                                color: 'var(--color-cyber-pink)',
                                fontFamily: 'var(--font-mono)'
                              }}
                            />
                          ) : (
                            <span className="text-lg" style={{ color: 'var(--color-cyber-pink)', fontFamily: 'var(--font-mono)' }}>
                              {selectedCharacter.max_hp}
                            </span>
                          )}
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                            AC
                          </span>
                          {editMode ? (
                            <input
                              type="number"
                              value={selectedCharacter.ac}
                              onChange={(e) => setSelectedCharacter({ ...selectedCharacter, ac: parseInt(e.target.value) || 10 })}
                              className="w-20 px-2 py-1 rounded text-center"
                              style={{
                                backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                                border: '1px solid var(--color-cyber-cyan)',
                                color: 'var(--color-cyber-cyan)',
                                fontFamily: 'var(--font-mono)'
                              }}
                            />
                          ) : (
                            <span className="text-lg" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                              {selectedCharacter.ac}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Ability Scores */}
                  <div className="mt-6">
                    <h3 className="text-sm mb-3" style={{ color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-cyber)' }}>
                      ABILITY SCORES
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[
                        { label: 'STR', key: 'str' as keyof Character },
                        { label: 'DEX', key: 'dex' as keyof Character },
                        { label: 'CON', key: 'con' as keyof Character },
                        { label: 'WIS', key: 'wis' as keyof Character },
                        { label: 'INT', key: 'int' as keyof Character },
                        { label: 'CHA', key: 'cha' as keyof Character }
                      ].map(stat => (
                        <div key={stat.label} className="flex justify-between items-center p-2 rounded" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-purple) 30%, transparent)' }}>
                          <span className="text-sm" style={{ color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-mono)' }}>
                            {stat.label}
                          </span>
                          {editMode ? (
                            <input
                              type="number"
                              value={selectedCharacter[stat.key] as number}
                              onChange={(e) => setSelectedCharacter({ ...selectedCharacter, [stat.key]: parseInt(e.target.value) || 10 })}
                              className="w-16 px-2 py-1 rounded text-center"
                              style={{
                                backgroundColor: 'color-mix(in srgb, var(--color-cyber-purple) 10%, transparent)',
                                border: '1px solid var(--color-cyber-purple)',
                                color: 'var(--color-cyber-purple)',
                                fontFamily: 'var(--font-mono)'
                              }}
                            />
                          ) : (
                            <span className="text-lg" style={{ color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-mono)' }}>
                              {selectedCharacter[stat.key] as number}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Inventory */}
                <div className="glass-panel p-6" style={{ border: '1px solid var(--color-cyber-cyan)' }}>
                  <h3 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
                    INVENTORY ({inventory.length} items)
                  </h3>
                  {inventory.length > 0 ? (
                    <div className="space-y-2">
                      {inventory.map(inv => (
                        <div
                          key={inv.id}
                          className="flex justify-between items-center p-3 rounded"
                          style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)' }}
                        >
                          <div className="flex items-center gap-3">
                            <div>
                              <div className="text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                                {inv.item?.name}
                              </div>
                              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                                <span>{inv.item?.type.toUpperCase()}</span>
                                {inv.quantity > 1 && <span>x{inv.quantity}</span>}
                                {inv.is_equipped && (
                                  <span className="px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-cyber-green)', color: 'var(--color-cyber-darker)' }}>
                                    EQUIPPED
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveItem(inv)}
                            className="text-xs px-3 py-1 rounded"
                            style={{ 
                              border: '1px solid var(--color-cyber-pink)', 
                              color: 'var(--color-cyber-pink)',
                              fontFamily: 'var(--font-mono)'
                            }}
                          >
                            REMOVE
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-center" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                      No items in inventory
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="glass-panel p-12 text-center">
                <p className="text-lg" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>
                  Select a character to view details
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
