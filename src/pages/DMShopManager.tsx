import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Shop, ShopInventoryItemWithDetails, ShopWithLocation } from '../types/shop';
import type { Location } from '../types/map';
import type { Item } from '../types/item';

export default function DMShopManager() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [shops, setShops] = useState<ShopWithLocation[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [shopInventory, setShopInventory] = useState<ShopInventoryItemWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Create shop form
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLocationId, setCreateLocationId] = useState('');
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createActive, setCreateActive] = useState(false);
  
  // Add item form
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [addItemId, setAddItemId] = useState('');
  const [addStock, setAddStock] = useState(1);
  const [addPrice, setAddPrice] = useState(0);

  useEffect(() => {
    if (profile?.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    fetchData();
  }, [profile, navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch shops with location details
      const { data: shopsData, error: shopsError } = await supabase
        .from('shops')
        .select(`
          *,
          location:locations(id, name, icon, color)
        `)
        .order('name');
      
      if (shopsError) throw shopsError;
      setShops(shopsData as ShopWithLocation[] || []);
      
      // Fetch all locations
      const { data: locationsData, error: locationsError } = await supabase
        .from('locations')
        .select('*')
        .order('name');
      
      if (locationsError) throw locationsError;
      setLocations(locationsData || []);
      
      // Fetch all items
      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select('*')
        .order('name');
      
      if (itemsError) throw itemsError;
      setAllItems(itemsData || []);
      
    } catch (err: any) {
      console.error('Error fetching data:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchShopInventory = async (shopId: string) => {
    try {
      const { data, error } = await supabase
        .from('shop_inventory')
        .select(`
          *,
          item:items(*)
        `)
        .eq('shop_id', shopId)
        .order('created_at');
      
      if (error) throw error;
      setShopInventory(data as ShopInventoryItemWithDetails[] || []);
      
    } catch (err: any) {
      console.error('Error fetching inventory:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleSelectShop = (shop: Shop) => {
    setSelectedShop(shop);
    fetchShopInventory(shop.id);
  };

  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('shops')
        .insert({
          location_id: createLocationId,
          name: createName,
          description: createDescription,
          is_active: createActive,
          created_by: profile?.id
        });
      
      if (error) throw error;
      
      alert('Shop created successfully!');
      setShowCreateModal(false);
      setCreateLocationId('');
      setCreateName('');
      setCreateDescription('');
      setCreateActive(false);
      await fetchData();
      
    } catch (err: any) {
      console.error('Error creating shop:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (shop: Shop) => {
    try {
      const { error } = await supabase
        .from('shops')
        .update({ is_active: !shop.is_active })
        .eq('id', shop.id);
      
      if (error) throw error;
      
      await fetchData();
      if (selectedShop?.id === shop.id) {
        setSelectedShop({ ...shop, is_active: !shop.is_active });
      }
      
    } catch (err: any) {
      console.error('Error toggling shop:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleDeleteShop = async (shopId: string) => {
    if (!confirm('Delete this shop? All inventory will be removed.')) return;
    
    try {
      const { error } = await supabase
        .from('shops')
        .delete()
        .eq('id', shopId);
      
      if (error) throw error;
      
      alert('Shop deleted!');
      if (selectedShop?.id === shopId) {
        setSelectedShop(null);
        setShopInventory([]);
      }
      await fetchData();
      
    } catch (err: any) {
      console.error('Error deleting shop:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShop) return;
    
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('shop_inventory')
        .insert({
          shop_id: selectedShop.id,
          item_id: addItemId,
          stock_quantity: addStock,
          price_credits: addPrice
        });
      
      if (error) throw error;
      
      alert('Item added to shop!');
      setShowAddItemModal(false);
      setAddItemId('');
      setAddStock(1);
      setAddPrice(0);
      await fetchShopInventory(selectedShop.id);
      
    } catch (err: any) {
      console.error('Error adding item:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateInventoryItem = async (invItem: ShopInventoryItemWithDetails, updates: { stock_quantity?: number; price_credits?: number }) => {
    try {
      const { error } = await supabase
        .from('shop_inventory')
        .update(updates)
        .eq('id', invItem.id);
      
      if (error) throw error;
      
      await fetchShopInventory(selectedShop!.id);
      
    } catch (err: any) {
      console.error('Error updating item:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleRemoveItem = async (invItemId: string) => {
    if (!confirm('Remove this item from the shop?')) return;
    
    try {
      const { error } = await supabase
        .from('shop_inventory')
        .delete()
        .eq('id', invItemId);
      
      if (error) throw error;
      
      await fetchShopInventory(selectedShop!.id);
      
    } catch (err: any) {
      console.error('Error removing item:', err);
      alert(`Error: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <div className="text-2xl" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>
          LOADING SHOPS...
        </div>
      </div>
    );
  }

  // Filter locations that don't have shops yet
  const availableLocations = locations.filter(
    loc => !shops.some(shop => shop.location_id === loc.id)
  );

  // Filter items not already in current shop
  const availableItems = selectedShop
    ? allItems.filter(item => !shopInventory.some(inv => inv.item_id === item.id))
    : [];

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-[1800px] mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl mb-2" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-green)' }}>
              🛍️ SHOP MANAGER
            </h1>
            <p className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
              Create and manage shops • {shops.length} shops configured
            </p>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="neon-button px-6 py-2"
              style={{ backgroundColor: 'var(--color-cyber-green)', color: 'var(--color-cyber-darker)' }}
            >
              + CREATE SHOP
            </button>
            <button
              onClick={() => navigate('/dm/dashboard')}
              className="neon-button px-6 py-2"
            >
              ← BACK
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          {/* Left: Shop List */}
          <div className="lg:col-span-1">
            <div className="glass-panel p-6" style={{ border: '2px solid var(--color-cyber-green)' }}>
              <h2 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-green)' }}>
                SHOPS ({shops.length})
              </h2>
              
              <div className="space-y-2 max-h-[700px] overflow-y-auto pr-2">
                {shops.map(shop => (
                  <div
                    key={shop.id}
                    onClick={() => handleSelectShop(shop)}
                    className={`p-3 rounded cursor-pointer transition-all ${
                      selectedShop?.id === shop.id ? 'scale-105' : ''
                    }`}
                    style={{
                      backgroundColor: selectedShop?.id === shop.id
                        ? 'color-mix(in srgb, var(--color-cyber-green) 20%, transparent)'
                        : 'color-mix(in srgb, var(--color-cyber-green) 10%, transparent)',
                      border: `1px solid ${selectedShop?.id === shop.id ? 'var(--color-cyber-green)' : 'var(--color-cyber-cyan)'}`
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="text-sm font-bold mb-1" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-cyber)' }}>
                          {shop.name}
                        </div>
                        <div className="text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                          📍 {shop.location?.name || 'Unknown Location'}
                        </div>
                      </div>
                      
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleActive(shop);
                          }}
                          className="text-xs px-2 py-1 rounded"
                          style={{
                            backgroundColor: shop.is_active ? 'var(--color-cyber-green)' : 'var(--color-cyber-red)',
                            color: 'var(--color-cyber-darker)',
                            fontFamily: 'var(--font-mono)'
                          }}
                        >
                          {shop.is_active ? 'OPEN' : 'CLOSED'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteShop(shop.id);
                          }}
                          className="text-xs px-2 py-1 rounded"
                          style={{
                            backgroundColor: 'var(--color-cyber-red)',
                            color: 'white',
                            fontFamily: 'var(--font-mono)'
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    
                    {shop.description && (
                      <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6, fontFamily: 'var(--font-mono)' }}>
                        {shop.description.substring(0, 60)}...
                      </div>
                    )}
                  </div>
                ))}
                
                {shops.length === 0 && (
                  <div className="text-center py-8" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                    No shops created yet
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Shop Inventory */}
          <div className="lg:col-span-2">
            {selectedShop ? (
              <div className="glass-panel p-6" style={{ border: '2px solid var(--color-cyber-green)' }}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-2xl mb-1" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-green)' }}>
                      {selectedShop.name}
                    </h2>
                    <p className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                      {shopInventory.length} items in stock
                    </p>
                  </div>
                  
                  <button
                    onClick={() => setShowAddItemModal(true)}
                    className="neon-button px-4 py-2"
                    style={{ backgroundColor: 'var(--color-cyber-cyan)', color: 'var(--color-cyber-darker)' }}
                  >
                    + ADD ITEM
                  </button>
                </div>
                
                <div className="space-y-2 max-h-[650px] overflow-y-auto">
                  {shopInventory.map(invItem => (
                    <div
                      key={invItem.id}
                      className="p-4 rounded"
                      style={{
                        backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                        border: '1px solid var(--color-cyber-cyan)'
                      }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="text-lg mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>
                            {invItem.item.name}
                          </div>
                          {invItem.item.description && (
                            <div className="text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                              {invItem.item.description}
                            </div>
                          )}
                        </div>
                        
                        <button
                          onClick={() => handleRemoveItem(invItem.id)}
                          className="text-sm px-2 py-1 rounded"
                          style={{
                            backgroundColor: 'var(--color-cyber-red)',
                            color: 'white',
                            fontFamily: 'var(--font-mono)'
                          }}
                        >
                          REMOVE
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                            STOCK (-1 = Unlimited)
                          </label>
                          <input
                            type="number"
                            value={invItem.stock_quantity}
                            onChange={(e) => handleUpdateInventoryItem(invItem, { stock_quantity: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 rounded"
                            style={{
                              backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                              border: '1px solid var(--color-cyber-cyan)',
                              color: 'var(--color-cyber-cyan)',
                              fontFamily: 'var(--font-mono)'
                            }}
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                            PRICE (USD $)
                          </label>
                          <input
                            type="number"
                            value={invItem.price_credits}
                            onChange={(e) => handleUpdateInventoryItem(invItem, { price_credits: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 rounded"
                            style={{
                              backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                              border: '1px solid var(--color-cyber-cyan)',
                              color: 'var(--color-cyber-cyan)',
                              fontFamily: 'var(--font-mono)'
                            }}
                          />
                        </div>
                      </div>
                      
                      <div className="flex gap-2 mt-2 text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
                        <span style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>
                          Category: {invItem.item.category}
                        </span>
                        <span style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>
                          Rarity: {invItem.item.rarity}
                        </span>
                      </div>
                    </div>
                  ))}
                  
                  {shopInventory.length === 0 && (
                    <div className="text-center py-8" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                      No items in shop. Click "+ ADD ITEM" to stock the shelves.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="glass-panel p-12 text-center" style={{ border: '2px solid var(--color-cyber-green)' }}>
                <div className="text-6xl mb-4">🛍️</div>
                <h3 className="text-2xl mb-2" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-green)' }}>
                  NO SHOP SELECTED
                </h3>
                <p style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                  Select a shop from the list to manage its inventory
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Shop Modal */}
      {showCreateModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.9)' }}
          onClick={() => setShowCreateModal(false)}
        >
          <div 
            className="glass-panel p-6 max-w-md w-full"
            style={{ border: '2px solid var(--color-cyber-green)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-green)' }}>
              CREATE NEW SHOP
            </h2>
            
            <form onSubmit={handleCreateShop} className="space-y-4">
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                  LOCATION
                </label>
                <select
                  required
                  value={createLocationId}
                  onChange={(e) => setCreateLocationId(e.target.value)}
                  className="w-full px-3 py-2 rounded"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                    border: '1px solid var(--color-cyber-cyan)',
                    color: 'var(--color-cyber-cyan)',
                    fontFamily: 'var(--font-mono)'
                  }}
                >
                  <option value="">Select a location...</option>
                  {availableLocations.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                  SHOP NAME
                </label>
                <input
                  required
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g., Chrome Street Arsenal"
                  className="w-full px-3 py-2 rounded"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                    border: '1px solid var(--color-cyber-cyan)',
                    color: 'var(--color-cyber-cyan)',
                    fontFamily: 'var(--font-mono)'
                  }}
                />
              </div>
              
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                  DESCRIPTION
                </label>
                <textarea
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  placeholder="Describe the shop..."
                  rows={3}
                  className="w-full px-3 py-2 rounded"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                    border: '1px solid var(--color-cyber-cyan)',
                    color: 'var(--color-cyber-cyan)',
                    fontFamily: 'var(--font-mono)'
                  }}
                />
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="createActive"
                  checked={createActive}
                  onChange={(e) => setCreateActive(e.target.checked)}
                  className="cursor-pointer"
                />
                <label htmlFor="createActive" className="cursor-pointer" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                  Shop is Active (players can access)
                </label>
              </div>
              
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 neon-button py-2"
                  style={{ backgroundColor: 'var(--color-cyber-green)', color: 'var(--color-cyber-darker)' }}
                >
                  {saving ? 'CREATING...' : 'CREATE SHOP'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 neon-button py-2"
                >
                  CANCEL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddItemModal && selectedShop && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.9)' }}
          onClick={() => setShowAddItemModal(false)}
        >
          <div 
            className="glass-panel p-6 max-w-md w-full"
            style={{ border: '2px solid var(--color-cyber-cyan)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
              ADD ITEM TO SHOP
            </h2>
            
            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                  ITEM
                </label>
                <select
                  required
                  value={addItemId}
                  onChange={(e) => setAddItemId(e.target.value)}
                  className="w-full px-3 py-2 rounded"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                    border: '1px solid var(--color-cyber-cyan)',
                    color: 'var(--color-cyber-cyan)',
                    fontFamily: 'var(--font-mono)'
                  }}
                >
                  <option value="">Select an item...</option>
                  {availableItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.category})
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                  STOCK QUANTITY (-1 for unlimited)
                </label>
                <input
                  required
                  type="number"
                  value={addStock}
                  onChange={(e) => setAddStock(parseInt(e.target.value))}
                  min={-1}
                  className="w-full px-3 py-2 rounded"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                    border: '1px solid var(--color-cyber-cyan)',
                    color: 'var(--color-cyber-cyan)',
                    fontFamily: 'var(--font-mono)'
                  }}
                />
              </div>
              
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                  PRICE (USD $)
                </label>
                <input
                  required
                  type="number"
                  value={addPrice}
                  onChange={(e) => setAddPrice(parseInt(e.target.value))}
                  min={0}
                  className="w-full px-3 py-2 rounded"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                    border: '1px solid var(--color-cyber-cyan)',
                    color: 'var(--color-cyber-cyan)',
                    fontFamily: 'var(--font-mono)'
                  }}
                />
              </div>
              
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 neon-button py-2"
                  style={{ backgroundColor: 'var(--color-cyber-cyan)', color: 'var(--color-cyber-darker)' }}
                >
                  {saving ? 'ADDING...' : 'ADD ITEM'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddItemModal(false)}
                  className="flex-1 neon-button py-2"
                >
                  CANCEL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
