import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Item } from '../types/inventory';
import { getRarityColor, getItemTypeIcon } from '../utils/stats';

interface Character {
  id: string;
  name: string;
  level: number;
  class: string;
  profile?: {
    username: string;
  };
}

export default function DMGiveItem() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [characters, setCharacters] = useState<Character[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterRarity, setFilterRarity] = useState<string>('all');
  
  const [loading, setLoading] = useState(true);
  const [giving, setGiving] = useState(false);

  // Check if user is admin
  if (profile?.role !== 'admin') {
    navigate('/dashboard');
    return null;
  }

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load all characters (without profiles for now - we'll get usernames separately)
      const { data: charactersData, error: charError } = await supabase
        .from('characters')
        .select('id, name, level, class, user_id')
        .order('name');

      if (charError) throw charError;
      
      // Get unique user IDs
      const userIds = [...new Set((charactersData || []).map((c: any) => c.user_id))];
      
      // Fetch profiles for these users
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', userIds);
      
      // Create a map of user_id to username
      const userMap = new Map((profilesData || []).map((p: any) => [p.id, p.username]));
      
      // Merge the data
      const enrichedCharacters = (charactersData || []).map((char: any) => ({
        ...char,
        profile: {
          username: userMap.get(char.user_id) || 'Unknown'
        }
      }));

      // Load all items
      const { data: itemsData, error: itemError } = await supabase
        .from('items')
        .select('*')
        .order('name');

      if (itemError) throw itemError;

      setCharacters(enrichedCharacters as any);
      setItems(itemsData || []);
    } catch (error: any) {
      console.error('Error loading data:', error);
      alert(`Failed to load data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGiveItem = async () => {
    if (!selectedCharacterId || !selectedItemId) {
      alert('Please select both a character and an item');
      return;
    }

    if (quantity < 1) {
      alert('Quantity must be at least 1');
      return;
    }

    try {
      setGiving(true);

      // Check if character already has this item
      const { data: existingData, error: checkError } = await supabase
        .from('inventory')
        .select('quantity')
        .eq('character_id', selectedCharacterId)
        .eq('item_id', selectedItemId)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingData) {
        // Update existing stack
        const { error: updateError } = await supabase
          .from('inventory')
          .update({ quantity: existingData.quantity + quantity })
          .eq('character_id', selectedCharacterId)
          .eq('item_id', selectedItemId);

        if (updateError) throw updateError;
      } else {
        // Add new item
        const { error: insertError } = await supabase
          .from('inventory')
          .insert({
            character_id: selectedCharacterId,
            item_id: selectedItemId,
            quantity,
            is_equipped: false
          });

        if (insertError) throw insertError;
      }

      const character = characters.find(c => c.id === selectedCharacterId);
      const item = items.find(i => i.id === selectedItemId);
      
      alert(`Successfully gave ${quantity}x "${item?.name}" to ${character?.name}!`);
      
      // Reset form
      setSelectedItemId('');
      setQuantity(1);
    } catch (error: any) {
      console.error('Error giving item:', error);
      alert(`Failed to give item: ${error.message}`);
    } finally {
      setGiving(false);
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (item.description?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || item.type === filterType;
    const matchesRarity = filterRarity === 'all' || item.rarity === filterRarity;
    return matchesSearch && matchesType && matchesRarity;
  });

  const selectedCharacter = characters.find(c => c.id === selectedCharacterId);
  const selectedItem = items.find(i => i.id === selectedItemId);

  if (loading) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center" style={{ backgroundColor: 'var(--color-cyber-darker)' }}>
        <div className="neon-text text-xl">LOADING...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid-bg" style={{ backgroundColor: 'var(--color-cyber-darker)' }}>
      {/* Header */}
      <div className="glass-panel" style={{ borderRadius: 0, border: '2px solid var(--color-cyber-cyan)' }}>
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <button onClick={() => navigate('/dashboard')} className="neon-button text-sm">
            ← BACK TO DASHBOARD
          </button>
          <h1 className="text-2xl neon-text" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
            🎁 GIVE ITEM TO PLAYER
          </h1>
          <div className="w-32"></div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Selection Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Character Selection */}
            <div className="glass-panel p-6" style={{ border: '1px solid var(--color-cyber-cyan)' }}>
              <h2 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
                SELECT CHARACTER
              </h2>
              
              <select
                value={selectedCharacterId}
                onChange={(e) => setSelectedCharacterId(e.target.value)}
                className="w-full px-4 py-3 rounded text-lg"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                  border: '2px solid var(--color-cyber-cyan)',
                  color: 'var(--color-cyber-cyan)',
                  fontFamily: 'var(--font-mono)'
                }}
              >
                <option value="">-- Select a Character --</option>
                {characters.map(char => (
                  <option key={char.id} value={char.id}>
                    {char.name} (Level {char.level} {char.class}) - Player: {(char.profile as any)?.username || 'Unknown'}
                  </option>
                ))}
              </select>

              {selectedCharacter && (
                <div className="mt-4 p-4 rounded" style={{
                  backgroundColor: 'color-mix(in srgb, var(--color-cyber-green) 10%, transparent)',
                  border: '1px solid var(--color-cyber-green)'
                }}>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">🎮</span>
                    <div>
                      <h3 className="font-bold" style={{ color: 'var(--color-cyber-green)' }}>
                        {selectedCharacter.name}
                      </h3>
                      <p className="text-sm" style={{ color: 'var(--color-cyber-cyan)' }}>
                        Level {selectedCharacter.level} {selectedCharacter.class}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Item Selection */}
            <div className="glass-panel p-6" style={{ border: '1px solid var(--color-cyber-cyan)' }}>
              <h2 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
                SELECT ITEM
              </h2>
              
              {/* Search and Filters */}
              <div className="space-y-3 mb-4">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search items..."
                  className="w-full px-4 py-2 rounded"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                    border: '1px solid var(--color-cyber-cyan)',
                    color: 'var(--color-cyber-cyan)',
                    fontFamily: 'var(--font-mono)'
                  }}
                />

                <div className="grid md:grid-cols-2 gap-3">
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-4 py-2 rounded"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                      border: '1px solid var(--color-cyber-cyan)',
                      color: 'var(--color-cyber-cyan)',
                      fontFamily: 'var(--font-mono)'
                    }}
                  >
                    <option value="all">All Types</option>
                    <option value="weapon">Weapon</option>
                    <option value="armor">Armor</option>
                    <option value="consumable">Consumable</option>
                    <option value="cyberware">Cyberware</option>
                    <option value="item">Item</option>
                    <option value="mission_item">Mission Item</option>
                  </select>

                  <select
                    value={filterRarity}
                    onChange={(e) => setFilterRarity(e.target.value)}
                    className="px-4 py-2 rounded"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                      border: '1px solid var(--color-cyber-cyan)',
                      color: 'var(--color-cyber-cyan)',
                      fontFamily: 'var(--font-mono)'
                    }}
                  >
                    <option value="all">All Rarities</option>
                    <option value="Common">Common</option>
                    <option value="Uncommon">Uncommon</option>
                    <option value="Rare">Rare</option>
                    <option value="Epic">Epic</option>
                    <option value="Mythic">Mythic</option>
                    <option value="Ultra Rare">Ultra Rare</option>
                    <option value="MISSION ITEM">MISSION ITEM</option>
                  </select>
                </div>
              </div>

              {/* Item List */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredItems.length === 0 ? (
                  <p className="text-center py-4" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>
                    No items found
                  </p>
                ) : (
                  filteredItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedItemId(item.id)}
                      className={`w-full text-left p-3 rounded transition-all ${
                        selectedItemId === item.id ? 'ring-2' : ''
                      }`}
                      style={{
                        backgroundColor: selectedItemId === item.id
                          ? 'color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)'
                          : 'color-mix(in srgb, var(--color-cyber-cyan) 5%, transparent)',
                        border: `1px solid ${selectedItemId === item.id ? 'var(--color-cyber-cyan)' : getRarityColor(item.rarity)}`
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{getItemTypeIcon(item.type)}</span>
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <h3 className="font-bold" style={{ color: 'var(--color-cyber-cyan)' }}>
                              {item.name}
                            </h3>
                            <span className="text-xs px-2 py-1 rounded" style={{
                              backgroundColor: `color-mix(in srgb, ${getRarityColor(item.rarity)} 20%, transparent)`,
                              color: getRarityColor(item.rarity)
                            }}>
                              {item.rarity}
                            </span>
                          </div>
                          {item.description && (
                            <p className="text-sm mt-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>
                              {item.description}
                            </p>
                          )}
                          <p className="text-xs mt-1" style={{ color: 'var(--color-cyber-orange)' }}>
                            💰 {item.price} USD
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Quantity */}
            {selectedItemId && (
              <div className="glass-panel p-6" style={{ border: '1px solid var(--color-cyber-cyan)' }}>
                <h2 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
                  QUANTITY
                </h2>
                
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-4 py-2 rounded neon-button"
                    style={{ fontSize: '20px' }}
                  >
                    −
                  </button>
                  
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    min={1}
                    className="flex-1 px-4 py-2 rounded text-center text-xl"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                      border: '2px solid var(--color-cyber-cyan)',
                      color: 'var(--color-cyber-cyan)',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 'bold'
                    }}
                  />
                  
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-4 py-2 rounded neon-button"
                    style={{ fontSize: '20px' }}
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {/* Give Button */}
            <button
              onClick={handleGiveItem}
              disabled={giving || !selectedCharacterId || !selectedItemId}
              className="w-full neon-button py-4 text-xl disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontFamily: 'var(--font-cyber)' }}
            >
              {giving ? 'GIVING...' : '🎁 GIVE ITEM'}
            </button>
          </div>

          {/* Right: Summary */}
          <div className="lg:col-span-1">
            <div className="glass-panel p-6 sticky top-4" style={{ border: '1px solid var(--color-cyber-cyan)' }}>
              <h2 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
                SUMMARY
              </h2>
              
              {selectedCharacterId && selectedItemId ? (
                <div className="space-y-4">
                  {/* Character */}
                  <div className="p-4 rounded" style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-cyber-green) 10%, transparent)',
                    border: '1px solid var(--color-cyber-green)'
                  }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>
                      GIVING TO:
                    </p>
                    <p className="font-bold" style={{ color: 'var(--color-cyber-green)' }}>
                      {selectedCharacter?.name}
                    </p>
                    <p className="text-sm" style={{ color: 'var(--color-cyber-cyan)' }}>
                      {selectedCharacter?.class} • Level {selectedCharacter?.level}
                    </p>
                  </div>

                  {/* Item */}
                  <div className="p-4 rounded" style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                    border: `1px solid ${selectedItem ? getRarityColor(selectedItem.rarity) : 'var(--color-cyber-cyan)'}`
                  }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>
                      ITEM:
                    </p>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{selectedItem && getItemTypeIcon(selectedItem.type)}</span>
                      <p className="font-bold" style={{ color: 'var(--color-cyber-cyan)' }}>
                        {selectedItem?.name}
                      </p>
                    </div>
                    {selectedItem?.rarity && (
                      <span className="text-xs px-2 py-1 rounded inline-block" style={{
                        backgroundColor: `color-mix(in srgb, ${getRarityColor(selectedItem.rarity)} 20%, transparent)`,
                        color: getRarityColor(selectedItem.rarity)
                      }}>
                        {selectedItem.rarity}
                      </span>
                    )}
                  </div>

                  {/* Quantity */}
                  <div className="p-4 rounded" style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-cyber-orange) 10%, transparent)',
                    border: '1px solid var(--color-cyber-orange)'
                  }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>
                      QUANTITY:
                    </p>
                    <p className="text-2xl font-bold" style={{ color: 'var(--color-cyber-orange)' }}>
                      ×{quantity}
                    </p>
                  </div>

                  <div className="text-xs space-y-1 pt-4" style={{
                    borderTop: '1px solid var(--color-cyber-cyan)',
                    color: 'var(--color-cyber-cyan)',
                    opacity: 0.7
                  }}>
                    <p>✓ Item will be added to character's inventory</p>
                    <p>✓ If item exists, quantity will stack</p>
                    <p>✓ Player will see it immediately</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>
                  <p className="text-sm">Select a character and item to see summary</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
