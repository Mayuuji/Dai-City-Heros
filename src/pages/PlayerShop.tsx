import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Shop, ShopInventoryItemWithDetails } from '../types/shop';

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
  usd: number; // Player's bank balance (dollars)
}

export default function PlayerShop() {
  const { shopId } = useParams<{ shopId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [shop, setShop] = useState<Shop | null>(null);
  const [inventory, setInventory] = useState<ShopInventoryItemWithDetails[]>([]);
  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ShopInventoryItemWithDetails | null>(null);

  useEffect(() => {
    fetchData();
  }, [shopId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch shop
      const { data: shopData, error: shopError } = await supabase
        .from('shops')
        .select('*')
        .eq('id', shopId)
        .eq('is_active', true)
        .single();
      
      if (shopError) throw shopError;
      setShop(shopData);
      
      // Fetch shop inventory
      const { data: invData, error: invError } = await supabase
        .from('shop_inventory')
        .select(`
          *,
          item:items(*)
        `)
        .eq('shop_id', shopId);
      
      if (invError) throw invError;
      setInventory(invData as ShopInventoryItemWithDetails[] || []);
      
      // Fetch player's character
      const { data: charData, error: charError } = await supabase
        .from('characters')
        .select('*')
        .eq('user_id', profile?.id)
        .single();
      
      if (charError) throw charError;
      setCharacter(charData);
      
    } catch (err: any) {
      console.error('Error fetching data:', err);
      alert(`Error: ${err.message}`);
      navigate('/map');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedItem || !character) return;
    
    const price = selectedItem.price_credits || 0;
    const currentBank = character.usd || 0;
    
    // Check if player has enough money in their bank
    if (currentBank < price) {
      alert('Insufficient funds in your bank!');
      return;
    }
    
    // Check if item is in stock
    if (selectedItem.stock_quantity === 0) {
      alert('Item out of stock!');
      return;
    }
    
    try {
      setPurchasing(true);
      
      // Start transaction
      // 1. Deduct money from character's bank
      const { error: updateBankError } = await supabase
        .from('characters')
        .update({ 
          usd: currentBank - price 
        })
        .eq('id', character.id);
      
      if (updateBankError) throw updateBankError;
      
      // 2. Add item to character inventory
      const { error: addItemError } = await supabase
        .from('inventory')
        .insert({
          character_id: character.id,
          item_id: selectedItem.item_id,
          quantity: 1,
          is_equipped: false,
          current_uses: null
        });
      
      if (addItemError) {
        // If adding item fails, refund money to bank
        await supabase
          .from('characters')
          .update({ usd: character.usd })
          .eq('id', character.id);
        throw addItemError;
      }
      
      // 3. Update shop stock (if not unlimited)
      if (selectedItem.stock_quantity !== -1) {
        const { error: updateStockError } = await supabase
          .from('shop_inventory')
          .update({ 
            stock_quantity: selectedItem.stock_quantity - 1 
          })
          .eq('id', selectedItem.id);
        
        if (updateStockError) {
          // Transaction failed, but items already added - we'll leave it
          // In a real app, you'd want proper transaction handling
          console.error('Failed to update stock:', updateStockError);
        }
      }
      
      alert(`Purchased ${selectedItem.item.name} for $${price}!`);
      setSelectedItem(null);
      
      // Refresh data
      await fetchData();
      
    } catch (err: any) {
      console.error('Error purchasing item:', err);
      alert(`Purchase failed: ${err.message}`);
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <div className="text-2xl" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>
          LOADING SHOP...
        </div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl mb-2" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-red)' }}>
            SHOP UNAVAILABLE
          </h2>
          <p style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
            This shop is currently closed.
          </p>
          <button
            onClick={() => navigate('/map')}
            className="neon-button mt-4 px-6 py-2"
          >
            ← BACK TO MAP
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-[1400px] mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl mb-2" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-green)' }}>
              🛍️ {shop.name}
            </h1>
            {shop.description && (
              <p className="text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.8, fontFamily: 'var(--font-mono)' }}>
                {shop.description}
              </p>
            )}
            <p className="text-sm" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
              💰 Your Bank: ${character?.usd || 0}
            </p>
          </div>
          
          <button
            onClick={() => navigate('/map')}
            className="neon-button px-6 py-2"
          >
            ← BACK TO MAP
          </button>
        </div>

        {/* Shop Inventory Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {inventory.map(invItem => {
            const price = invItem.price_credits || 0;
            const canAfford = (character?.usd || 0) >= price;
            const inStock = invItem.stock_quantity === -1 || invItem.stock_quantity > 0;
            
            return (
              <div
                key={invItem.id}
                className="glass-panel p-4"
                style={{
                  border: `2px solid ${canAfford && inStock ? 'var(--color-cyber-green)' : 'var(--color-cyber-red)'}`,
                  opacity: inStock ? 1 : 0.5
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="text-lg mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>
                      {invItem.item.name}
                    </h3>
                    <div className="flex gap-2 mb-2">
                      <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-cyber-purple)', color: 'white', fontFamily: 'var(--font-mono)' }}>
                        {invItem.item.type}
                      </span>
                      <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-cyber-cyan)', color: 'var(--color-cyber-darker)', fontFamily: 'var(--font-mono)' }}>
                        {invItem.item.rarity}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-2xl font-bold" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-cyber)' }}>
                      ${price}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                      USD
                    </div>
                  </div>
                </div>
                
                {invItem.item.description && (
                  <p className="text-sm mb-3" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.8, fontFamily: 'var(--font-mono)', lineHeight: '1.4' }}>
                    {invItem.item.description}
                  </p>
                )}
                
                <div className="flex items-center justify-between mb-3 text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
                  <span style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>
                    Price: ${invItem.item.price}
                  </span>
                  <span style={{ color: invItem.stock_quantity === 0 ? 'var(--color-cyber-red)' : 'var(--color-cyber-green)' }}>
                    {invItem.stock_quantity === -1 ? '∞ In Stock' : `${invItem.stock_quantity} Left`}
                  </span>
                </div>
                
                <button
                  onClick={() => setSelectedItem(invItem)}
                  disabled={!canAfford || !inStock}
                  className="w-full neon-button py-2"
                  style={{
                    backgroundColor: canAfford && inStock ? 'var(--color-cyber-green)' : 'var(--color-cyber-red)',
                    color: 'var(--color-cyber-darker)',
                    opacity: canAfford && inStock ? 1 : 0.5,
                    cursor: canAfford && inStock ? 'pointer' : 'not-allowed'
                  }}
                >
                  {!inStock ? 'OUT OF STOCK' : !canAfford ? 'INSUFFICIENT FUNDS' : 'BUY NOW'}
                </button>
              </div>
            );
          })}
        </div>
        
        {inventory.length === 0 && (
          <div className="glass-panel p-12 text-center" style={{ border: '2px solid var(--color-cyber-green)' }}>
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-2xl mb-2" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-green)' }}>
              SHOP EMPTY
            </h3>
            <p style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
              Nothing for sale at the moment. Check back later!
            </p>
          </div>
        )}
      </div>

      {/* Purchase Confirmation Modal */}
      {selectedItem && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.9)' }}
          onClick={() => setSelectedItem(null)}
        >
          <div 
            className="glass-panel p-6 max-w-md w-full"
            style={{ border: '2px solid var(--color-cyber-green)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-green)' }}>
              CONFIRM PURCHASE
            </h2>
            
            <div className="mb-4">
              <div className="text-xl mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>
                {selectedItem.item.name}
              </div>
              {selectedItem.item.description && (
                <p className="text-sm mb-3" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.8, fontFamily: 'var(--font-mono)' }}>
                  {selectedItem.item.description}
                </p>
              )}
            </div>
            
            <div className="p-4 rounded mb-4" style={{ backgroundColor: 'color-mix(in srgb, var(--color-cyber-green) 10%, transparent)', border: '1px solid var(--color-cyber-green)' }}>
              <div className="flex justify-between mb-2" style={{ fontFamily: 'var(--font-mono)' }}>
                <span style={{ color: 'var(--color-cyber-cyan)' }}>Price:</span>
                <span style={{ color: 'var(--color-cyber-green)', fontWeight: 'bold' }}>${selectedItem.price_credits || 0}</span>
              </div>
              <div className="flex justify-between mb-2" style={{ fontFamily: 'var(--font-mono)' }}>
                <span style={{ color: 'var(--color-cyber-cyan)' }}>Your Bank:</span>
                <span style={{ color: 'var(--color-cyber-cyan)' }}>${character?.usd || 0}</span>
              </div>
              <div className="border-t pt-2" style={{ borderColor: 'var(--color-cyber-green)' }}>
                <div className="flex justify-between" style={{ fontFamily: 'var(--font-mono)' }}>
                  <span style={{ color: 'var(--color-cyber-cyan)' }}>After Purchase:</span>
                  <span style={{ color: 'var(--color-cyber-green)', fontWeight: 'bold' }}>
                    ${(character?.usd || 0) - (selectedItem.price_credits || 0)}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handlePurchase}
                disabled={purchasing}
                className="flex-1 neon-button py-3"
                style={{ backgroundColor: 'var(--color-cyber-green)', color: 'var(--color-cyber-darker)' }}
              >
                {purchasing ? 'PROCESSING...' : 'CONFIRM PURCHASE'}
              </button>
              <button
                onClick={() => setSelectedItem(null)}
                disabled={purchasing}
                className="flex-1 neon-button py-3"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
