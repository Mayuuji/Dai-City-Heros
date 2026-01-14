import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import WorldMap, { type WorldMapHandle } from '../components/WorldMap';
import type { Location, MapSettings, LocationIcon, LocationColor } from '../types/map';
import type { Shop, ShopInventoryItemWithDetails } from '../types/shop';
import type { Item } from '../types/inventory';
import { ALL_LOCATION_ICONS, ALL_LOCATION_COLORS, getLocationColor } from '../utils/mapUtils';

type EditorMode = 'list' | 'create' | 'edit' | 'settings';
type RightPanelTab = 'details' | 'shops';

export default function DMMapEditor() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const worldMapRef = useRef<WorldMapHandle>(null);
  
  const [mode, setMode] = useState<EditorMode>('list');
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('details');
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [_settings, setSettings] = useState<MapSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Create/Edit form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formLore, setFormLore] = useState('');
  const [formLat, setFormLat] = useState(0);
  const [formLng, setFormLng] = useState(0);
  const [formIcon, setFormIcon] = useState<LocationIcon>('marker');
  const [formColor, setFormColor] = useState<LocationColor>('cyan');
  const [formTags, setFormTags] = useState<string>('');
  const [formVisible, setFormVisible] = useState(true);
  const [formDiscovered, setFormDiscovered] = useState(false);
  
  // Settings form state
  const [settingsMinLat, setSettingsMinLat] = useState(-90);
  const [settingsMinLng, setSettingsMinLng] = useState(-180);
  const [settingsMaxLat, setSettingsMaxLat] = useState(90);
  const [settingsMaxLng, setSettingsMaxLng] = useState(180);
  const [settingsMinZoom, setSettingsMinZoom] = useState(3);
  const [settingsMaxZoom, setSettingsMaxZoom] = useState(18);
  const [settingsDefaultZoom, setSettingsDefaultZoom] = useState(6);
  const [settingsCenterLat, setSettingsCenterLat] = useState(0);
  const [settingsCenterLng, setSettingsCenterLng] = useState(0);
  const [settingsLockBounds, setSettingsLockBounds] = useState(true);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterIcon, setFilterIcon] = useState<string>('all');

  // Shop state
  const [locationShops, setLocationShops] = useState<Shop[]>([]);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [shopInventory, setShopInventory] = useState<ShopInventoryItemWithDetails[]>([]);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [showCreateShopModal, setShowCreateShopModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newShopName, setNewShopName] = useState('');
  const [newShopDescription, setNewShopDescription] = useState('');
  const [addItemId, setAddItemId] = useState('');
  const [addItemStock, setAddItemStock] = useState(-1);
  const [addItemPrice, setAddItemPrice] = useState(0);

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
      const { data: settingsData, error: settingsError } = await supabase.from('map_settings').select('*').single();
      if (settingsError) throw settingsError;
      
      setSettings(settingsData);
      setSettingsMinLat(settingsData.min_lat);
      setSettingsMinLng(settingsData.min_lng);
      setSettingsMaxLat(settingsData.max_lat);
      setSettingsMaxLng(settingsData.max_lng);
      setSettingsMinZoom(settingsData.min_zoom);
      setSettingsMaxZoom(settingsData.max_zoom);
      setSettingsDefaultZoom(settingsData.default_zoom);
      setSettingsCenterLat(settingsData.center_lat);
      setSettingsCenterLng(settingsData.center_lng);
      setSettingsLockBounds(settingsData.lock_bounds);
      
      const { data: locationsData, error: locationsError } = await supabase.from('locations').select('*').order('name');
      if (locationsError) throw locationsError;
      setLocations(locationsData || []);

      const { data: itemsData } = await supabase.from('items').select('*').order('name');
      setAllItems(itemsData || []);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchLocationShops = async (locationId: string) => {
    try {
      const { data, error } = await supabase.from('shops').select('*').eq('location_id', locationId).order('name');
      if (error) throw error;
      setLocationShops(data || []);
    } catch (err: any) {
      console.error('Error fetching shops:', err);
    }
  };

  const fetchShopInventory = async (shopId: string) => {
    try {
      const { data, error } = await supabase.from('shop_inventory').select(`*, item:items(*)`).eq('shop_id', shopId).order('created_at');
      if (error) throw error;
      setShopInventory(data as ShopInventoryItemWithDetails[] || []);
    } catch (err: any) {
      console.error('Error fetching shop inventory:', err);
    }
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (mode === 'create') {
      setFormLat(lat);
      setFormLng(lng);
    }
  };

  const handleLocationClick = (location: Location) => {
    setSelectedLocation(location);
    setFormName(location.name);
    setFormDescription(location.description || '');
    setFormLore(location.lore || '');
    setFormLat(location.lat);
    setFormLng(location.lng);
    setFormIcon(location.icon);
    setFormColor(location.color);
    setFormTags(location.tags.join(', '));
    setFormVisible(location.is_visible);
    setFormDiscovered(location.is_discovered);
    setMode('edit');
    setRightPanelTab('details');
    fetchLocationShops(location.id);
  };

  const handleCreateLocation = async () => {
    if (!formName.trim()) { alert('Please enter a location name'); return; }
    try {
      setSaving(true);
      const tags = formTags.split(',').map(t => t.trim()).filter(t => t.length > 0);
      const { error } = await supabase.from('locations').insert({
        name: formName, description: formDescription || null, lore: formLore || null,
        lat: formLat, lng: formLng, icon: formIcon, color: formColor, tags,
        is_visible: formVisible, is_discovered: formDiscovered, created_by: profile?.id
      });
      if (error) throw error;
      alert(`Location "${formName}" created!`);
      resetForm();
      await fetchData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateLocation = async () => {
    if (!selectedLocation || !formName.trim()) { alert('Please enter a location name'); return; }
    try {
      setSaving(true);
      const tags = formTags.split(',').map(t => t.trim()).filter(t => t.length > 0);
      const { error } = await supabase.from('locations').update({
        name: formName, description: formDescription || null, lore: formLore || null,
        lat: formLat, lng: formLng, icon: formIcon, color: formColor, tags,
        is_visible: formVisible, is_discovered: formDiscovered, updated_at: new Date().toISOString()
      }).eq('id', selectedLocation.id);
      if (error) throw error;
      alert(`Location "${formName}" updated!`);
      await fetchData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLocation = async () => {
    if (!selectedLocation) return;
    if (!confirm(`Delete "${selectedLocation.name}"? This cannot be undone.`)) return;
    try {
      const { error } = await supabase.from('locations').delete().eq('id', selectedLocation.id);
      if (error) throw error;
      alert(`Location deleted.`);
      resetForm();
      await fetchData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      const { error } = await supabase.from('map_settings').update({
        min_lat: settingsMinLat, min_lng: settingsMinLng, max_lat: settingsMaxLat, max_lng: settingsMaxLng,
        min_zoom: settingsMinZoom, max_zoom: settingsMaxZoom, default_zoom: settingsDefaultZoom,
        center_lat: settingsCenterLat, center_lng: settingsCenterLng, lock_bounds: settingsLockBounds,
        updated_at: new Date().toISOString(), updated_by: profile?.id
      }).eq('id', '00000000-0000-0000-0000-000000000001');
      if (error) throw error;
      alert('Settings saved!');
      await fetchData();
      setMode('list');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSetCurrentView = () => {
    const map = worldMapRef.current?.getMap();
    if (!map) { alert('Map not ready'); return; }
    const bounds = map.getBounds();
    const center = map.getCenter();
    setSettingsMinLat(parseFloat(bounds.getSouth().toFixed(6)));
    setSettingsMinLng(parseFloat(bounds.getWest().toFixed(6)));
    setSettingsMaxLat(parseFloat(bounds.getNorth().toFixed(6)));
    setSettingsMaxLng(parseFloat(bounds.getEast().toFixed(6)));
    setSettingsCenterLat(parseFloat(center.lat.toFixed(6)));
    setSettingsCenterLng(parseFloat(center.lng.toFixed(6)));
    setSettingsDefaultZoom(map.getZoom());
    alert('View captured!');
  };

  const resetForm = () => {
    setFormName(''); setFormDescription(''); setFormLore('');
    setFormLat(0); setFormLng(0); setFormIcon('marker'); setFormColor('cyan');
    setFormTags(''); setFormVisible(true); setFormDiscovered(false);
    setSelectedLocation(null); setLocationShops([]); setSelectedShop(null);
    setShopInventory([]); setRightPanelTab('details'); setMode('list');
  };

  // Shop functions
  const handleCreateShop = async () => {
    if (!selectedLocation || !newShopName.trim()) return;
    try {
      setSaving(true);
      const { error } = await supabase.from('shops').insert({
        location_id: selectedLocation.id, name: newShopName,
        description: newShopDescription || null, is_active: true, created_by: profile?.id
      });
      if (error) throw error;
      setShowCreateShopModal(false);
      setNewShopName(''); setNewShopDescription('');
      await fetchLocationShops(selectedLocation.id);
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteShop = async (shopId: string) => {
    if (!confirm('Delete this shop?')) return;
    try {
      await supabase.from('shops').delete().eq('id', shopId);
      if (selectedLocation) await fetchLocationShops(selectedLocation.id);
      setSelectedShop(null); setShopInventory([]);
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleToggleShopActive = async (shop: Shop) => {
    try {
      await supabase.from('shops').update({ is_active: !shop.is_active }).eq('id', shop.id);
      if (selectedLocation) await fetchLocationShops(selectedLocation.id);
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleAddItemToShop = async () => {
    if (!selectedShop || !addItemId) return;
    try {
      setSaving(true);
      const { error } = await supabase.from('shop_inventory').insert({
        shop_id: selectedShop.id, item_id: addItemId,
        stock_quantity: addItemStock, price_credits: addItemPrice
      });
      if (error) throw error;
      setShowAddItemModal(false);
      setAddItemId(''); setAddItemStock(-1); setAddItemPrice(0);
      await fetchShopInventory(selectedShop.id);
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveItemFromShop = async (inventoryId: string) => {
    if (!selectedShop) return;
    try {
      await supabase.from('shop_inventory').delete().eq('id', inventoryId);
      await fetchShopInventory(selectedShop.id);
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleUpdateStock = async (inventoryId: string, newStock: number) => {
    try {
      await supabase.from('shop_inventory').update({ stock_quantity: newStock }).eq('id', inventoryId);
      if (selectedShop) await fetchShopInventory(selectedShop.id);
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleUpdatePrice = async (inventoryId: string, newPrice: number) => {
    try {
      await supabase.from('shop_inventory').update({ price_credits: newPrice }).eq('id', inventoryId);
      if (selectedShop) await fetchShopInventory(selectedShop.id);
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const filteredLocations = locations.filter(loc => {
    const matchesSearch = loc.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterIcon === 'all' || loc.icon === filterIcon;
    return matchesSearch && matchesFilter;
  });

  const getRarityColor = (rarity: string) => {
    const colors: Record<string, string> = {
      common: '#9CA3AF', uncommon: '#10B981', rare: '#3B82F6',
      epic: '#8B5CF6', legendary: '#F59E0B', unique: '#EC4899'
    };
    return colors[rarity] || colors.common;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>
          LOADING...
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b" style={{ borderColor: 'var(--color-cyber-cyan)', background: 'var(--color-cyber-darker)' }}>
        <div className="flex items-center gap-4">
          <h1 className="text-xl" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>🗺️ MAP EDITOR</h1>
          <span className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>{locations.length} locations</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMode('settings')} className="px-3 py-1.5 rounded text-sm"
            style={{ backgroundColor: mode === 'settings' ? 'var(--color-cyber-purple)' : 'transparent',
              border: '1px solid var(--color-cyber-purple)', color: mode === 'settings' ? '#0D1117' : 'var(--color-cyber-purple)' }}>
            ⚙️ Settings
          </button>
          <button onClick={() => navigate('/dm/dashboard')} className="neon-button px-4 py-1.5 text-sm">← Back</button>
        </div>
      </div>

      {/* Main 50/50 Split */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Map */}
        <div className="w-1/2 h-full border-r" style={{ borderColor: 'var(--color-cyber-cyan)' }}>
          <WorldMap ref={worldMapRef} isDM={true} onLocationClick={handleLocationClick}
            onMapClick={mode === 'create' ? handleMapClick : undefined} selectedLocationId={selectedLocation?.id} />
        </div>

        {/* RIGHT: Panel */}
        <div className="w-1/2 h-full flex flex-col overflow-hidden" style={{ background: 'var(--color-cyber-darker)' }}>
          {/* Top: Location List (always visible) */}
          <div className="h-1/3 border-b overflow-hidden flex flex-col" style={{ borderColor: 'var(--color-cyber-cyan)' }}>
            <div className="p-2 flex items-center gap-2 border-b" style={{ borderColor: 'var(--color-cyber-cyan)' }}>
              <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-2 py-1 rounded text-sm"
                style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }} />
              <select value={filterIcon} onChange={(e) => setFilterIcon(e.target.value)}
                className="px-2 py-1 rounded text-sm"
                style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}>
                <option value="all">All</option>
                {ALL_LOCATION_ICONS.map(i => <option key={i.value} value={i.value}>{i.emoji} {i.label}</option>)}
              </select>
              <button onClick={() => { resetForm(); setMode('create'); }} className="px-3 py-1 rounded text-sm"
                style={{ background: 'var(--color-cyber-green)', color: '#0D1117' }}>+ New</button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredLocations.map(loc => (
                <div key={loc.id} onClick={() => handleLocationClick(loc)}
                  className="p-2 rounded cursor-pointer flex items-center gap-2 transition-all hover:brightness-110"
                  style={{ background: selectedLocation?.id === loc.id ? `color-mix(in srgb, ${getLocationColor(loc.color)} 30%, transparent)` : 'transparent',
                    border: `1px solid ${selectedLocation?.id === loc.id ? getLocationColor(loc.color) : 'transparent'}` }}>
                  <div className="w-3 h-3 rounded-full" style={{ background: getLocationColor(loc.color), boxShadow: `0 0 6px ${getLocationColor(loc.color)}` }} />
                  <span className="flex-1 text-sm" style={{ color: getLocationColor(loc.color) }}>{loc.name}</span>
                  {!loc.is_visible && <span className="text-xs px-1 rounded" style={{ background: 'var(--color-cyber-red)', color: '#fff' }}>Hidden</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Bottom: Edit Panel */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {mode === 'settings' ? (
              /* Settings Panel */
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <h3 className="text-lg" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-purple)' }}>⚙️ MAP SETTINGS</h3>
                <button onClick={handleSetCurrentView} className="w-full py-2 rounded"
                  style={{ background: 'var(--color-cyber-cyan)', color: '#0D1117' }}>📸 Capture Current View</button>
                <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: 'var(--color-cyber-cyan)' }}>
                  <div>SW: {settingsMinLat.toFixed(2)}, {settingsMinLng.toFixed(2)}</div>
                  <div>NE: {settingsMaxLat.toFixed(2)}, {settingsMaxLng.toFixed(2)}</div>
                </div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={settingsLockBounds} onChange={(e) => setSettingsLockBounds(e.target.checked)} />
                  <span className="text-sm" style={{ color: 'var(--color-cyber-purple)' }}>Lock Player View</span>
                </label>
                <div className="flex gap-2">
                  <button onClick={handleSaveSettings} disabled={saving} className="flex-1 py-2 rounded"
                    style={{ background: 'var(--color-cyber-purple)', color: '#0D1117', opacity: saving ? 0.5 : 1 }}>
                    {saving ? 'Saving...' : 'Save Settings'}
                  </button>
                  <button onClick={() => setMode('list')} className="px-4 py-2 rounded"
                    style={{ border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}>Cancel</button>
                </div>
              </div>
            ) : mode === 'create' ? (
              /* Create Location Panel */
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <h3 className="text-lg" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-green)' }}>➕ CREATE LOCATION</h3>
                <p className="text-xs" style={{ color: 'var(--color-cyber-green)' }}>Click on the map to set coordinates</p>
                <input type="text" placeholder="Location Name *" value={formName} onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-green)', color: 'var(--color-cyber-green)' }} />
                <textarea placeholder="Description" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={2}
                  className="w-full px-3 py-2 rounded" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }} />
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" value={formLat} onChange={(e) => setFormLat(parseFloat(e.target.value))} step="0.0001" placeholder="Lat"
                    className="px-2 py-1 rounded text-sm" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }} />
                  <input type="number" value={formLng} onChange={(e) => setFormLng(parseFloat(e.target.value))} step="0.0001" placeholder="Lng"
                    className="px-2 py-1 rounded text-sm" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }} />
                </div>
                <div className="flex flex-wrap gap-1">
                  {ALL_LOCATION_ICONS.map(icon => (
                    <button key={icon.value} onClick={() => setFormIcon(icon.value)} className="px-2 py-1 rounded text-xs"
                      style={{ background: formIcon === icon.value ? 'var(--color-cyber-cyan)' : 'transparent',
                        border: '1px solid var(--color-cyber-cyan)', color: formIcon === icon.value ? '#0D1117' : 'var(--color-cyber-cyan)' }}>
                      {icon.emoji}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1">
                  {ALL_LOCATION_COLORS.map(c => (
                    <button key={c.value} onClick={() => setFormColor(c.value)} className="w-6 h-6 rounded"
                      style={{ background: getLocationColor(c.value), border: formColor === c.value ? '2px solid white' : 'none' }} />
                  ))}
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1 text-sm" style={{ color: 'var(--color-cyber-green)' }}>
                    <input type="checkbox" checked={formVisible} onChange={(e) => setFormVisible(e.target.checked)} /> Visible
                  </label>
                  <label className="flex items-center gap-1 text-sm" style={{ color: 'var(--color-cyber-purple)' }}>
                    <input type="checkbox" checked={formDiscovered} onChange={(e) => setFormDiscovered(e.target.checked)} /> Discovered
                  </label>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleCreateLocation} disabled={saving || !formName.trim()} className="flex-1 py-2 rounded"
                    style={{ background: 'var(--color-cyber-green)', color: '#0D1117', opacity: saving || !formName.trim() ? 0.5 : 1 }}>
                    {saving ? 'Creating...' : 'Create'}
                  </button>
                  <button onClick={resetForm} className="px-4 py-2 rounded"
                    style={{ border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}>Cancel</button>
                </div>
              </div>
            ) : mode === 'edit' && selectedLocation ? (
              /* Edit Location Panel with Tabs */
              <div className="flex-1 overflow-hidden flex flex-col">
                {/* Tabs */}
                <div className="flex border-b" style={{ borderColor: 'var(--color-cyber-orange)' }}>
                  <button onClick={() => setRightPanelTab('details')} className="flex-1 py-2 text-sm"
                    style={{ background: rightPanelTab === 'details' ? 'var(--color-cyber-orange)' : 'transparent',
                      color: rightPanelTab === 'details' ? '#0D1117' : 'var(--color-cyber-orange)' }}>📝 Details</button>
                  <button onClick={() => setRightPanelTab('shops')} className="flex-1 py-2 text-sm"
                    style={{ background: rightPanelTab === 'shops' ? 'var(--color-cyber-green)' : 'transparent',
                      color: rightPanelTab === 'shops' ? '#0D1117' : 'var(--color-cyber-green)' }}>🛒 Shops ({locationShops.length})</button>
                </div>
                
                {rightPanelTab === 'details' ? (
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-orange)' }}>✏️ EDIT LOCATION</h3>
                      <button onClick={handleDeleteLocation} className="text-xs px-2 py-1 rounded"
                        style={{ border: '1px solid var(--color-cyber-red)', color: 'var(--color-cyber-red)' }}>🗑️ Delete</button>
                    </div>
                    <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)}
                      className="w-full px-3 py-2 rounded" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-orange)', color: 'var(--color-cyber-orange)' }} />
                    <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={2} placeholder="Description"
                      className="w-full px-3 py-2 rounded" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }} />
                    <textarea value={formLore} onChange={(e) => setFormLore(e.target.value)} rows={3} placeholder="Lore / DM Notes"
                      className="w-full px-3 py-2 rounded" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-purple)', color: 'var(--color-cyber-purple)' }} />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" value={formLat} onChange={(e) => setFormLat(parseFloat(e.target.value))} step="0.0001"
                        className="px-2 py-1 rounded text-sm" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }} />
                      <input type="number" value={formLng} onChange={(e) => setFormLng(parseFloat(e.target.value))} step="0.0001"
                        className="px-2 py-1 rounded text-sm" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }} />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {ALL_LOCATION_ICONS.map(icon => (
                        <button key={icon.value} onClick={() => setFormIcon(icon.value)} className="px-2 py-1 rounded text-xs"
                          style={{ background: formIcon === icon.value ? 'var(--color-cyber-cyan)' : 'transparent',
                            border: '1px solid var(--color-cyber-cyan)', color: formIcon === icon.value ? '#0D1117' : 'var(--color-cyber-cyan)' }}>
                          {icon.emoji}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {ALL_LOCATION_COLORS.map(c => (
                        <button key={c.value} onClick={() => setFormColor(c.value)} className="w-6 h-6 rounded"
                          style={{ background: getLocationColor(c.value), border: formColor === c.value ? '2px solid white' : 'none' }} />
                      ))}
                    </div>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-1 text-sm" style={{ color: 'var(--color-cyber-green)' }}>
                        <input type="checkbox" checked={formVisible} onChange={(e) => setFormVisible(e.target.checked)} /> Visible
                      </label>
                      <label className="flex items-center gap-1 text-sm" style={{ color: 'var(--color-cyber-purple)' }}>
                        <input type="checkbox" checked={formDiscovered} onChange={(e) => setFormDiscovered(e.target.checked)} /> Discovered
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleUpdateLocation} disabled={saving} className="flex-1 py-2 rounded"
                        style={{ background: 'var(--color-cyber-orange)', color: '#0D1117', opacity: saving ? 0.5 : 1 }}>
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button onClick={resetForm} className="px-4 py-2 rounded"
                        style={{ border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}>Close</button>
                    </div>
                  </div>
                ) : (
                  /* Shops Tab */
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-green)' }}>🛒 SHOPS</h3>
                      <button onClick={() => setShowCreateShopModal(true)} className="text-xs px-2 py-1 rounded"
                        style={{ background: 'var(--color-cyber-green)', color: '#0D1117' }}>+ Add Shop</button>
                    </div>
                    
                    {locationShops.length === 0 ? (
                      <p className="text-sm text-center py-4" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>No shops at this location</p>
                    ) : (
                      <div className="space-y-2">
                        {locationShops.map(shop => (
                          <div key={shop.id} className="p-3 rounded" style={{ border: `1px solid ${shop.is_active ? 'var(--color-cyber-green)' : 'var(--color-cyber-red)'}` }}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-bold" style={{ color: 'var(--color-cyber-green)' }}>{shop.name}</span>
                              <div className="flex gap-1">
                                <button onClick={() => handleToggleShopActive(shop)} className="text-xs px-2 py-0.5 rounded"
                                  style={{ background: shop.is_active ? 'var(--color-cyber-green)' : 'var(--color-cyber-red)', color: '#0D1117' }}>
                                  {shop.is_active ? 'Open' : 'Closed'}
                                </button>
                                <button onClick={() => handleDeleteShop(shop.id)} className="text-xs px-2 py-0.5 rounded"
                                  style={{ border: '1px solid var(--color-cyber-red)', color: 'var(--color-cyber-red)' }}>×</button>
                              </div>
                            </div>
                            {shop.description && <p className="text-xs mb-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>{shop.description}</p>}
                            
                            <button onClick={() => { setSelectedShop(shop); fetchShopInventory(shop.id); }} className="text-xs underline"
                              style={{ color: 'var(--color-cyber-cyan)' }}>Manage Inventory →</button>
                            
                            {selectedShop?.id === shop.id && (
                              <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--color-cyber-cyan)' }}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm" style={{ color: 'var(--color-cyber-cyan)' }}>Inventory ({shopInventory.length})</span>
                                  <button onClick={() => setShowAddItemModal(true)} className="text-xs px-2 py-0.5 rounded"
                                    style={{ background: 'var(--color-cyber-cyan)', color: '#0D1117' }}>+ Add Item</button>
                                </div>
                                {shopInventory.length === 0 ? (
                                  <p className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>No items in inventory</p>
                                ) : (
                                  <div className="space-y-1">
                                    {shopInventory.map(inv => (
                                      <div key={inv.id} className="flex items-center gap-2 p-2 rounded text-xs"
                                        style={{ background: 'color-mix(in srgb, var(--color-cyber-darker) 50%, transparent)' }}>
                                        <span className="flex-1" style={{ color: getRarityColor(inv.item.rarity) }}>{inv.item.name}</span>
                                        <input type="number" value={inv.stock_quantity} onChange={(e) => handleUpdateStock(inv.id, parseInt(e.target.value))}
                                          className="w-12 px-1 py-0.5 rounded text-center" title="Stock (-1 = unlimited)"
                                          style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }} />
                                        <span style={{ color: 'var(--color-cyber-yellow)' }}>$</span>
                                        <input type="number" value={inv.price_credits} onChange={(e) => handleUpdatePrice(inv.id, parseInt(e.target.value))}
                                          className="w-16 px-1 py-0.5 rounded" title="Price"
                                          style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-yellow)', color: 'var(--color-cyber-yellow)' }} />
                                        <button onClick={() => handleRemoveItemFromShop(inv.id)} style={{ color: 'var(--color-cyber-red)' }}>×</button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>Select a location or create a new one</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Shop Modal */}
      {showCreateShopModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setShowCreateShopModal(false)}>
          <div className="glass-panel p-6 w-[400px]" style={{ border: '2px solid var(--color-cyber-green)' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-green)' }}>🛒 CREATE SHOP</h3>
            <input type="text" placeholder="Shop Name *" value={newShopName} onChange={(e) => setNewShopName(e.target.value)}
              className="w-full px-3 py-2 rounded mb-3" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-green)', color: 'var(--color-cyber-green)' }} />
            <textarea placeholder="Description" value={newShopDescription} onChange={(e) => setNewShopDescription(e.target.value)} rows={3}
              className="w-full px-3 py-2 rounded mb-4" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }} />
            <div className="flex gap-2">
              <button onClick={handleCreateShop} disabled={saving || !newShopName.trim()} className="flex-1 py-2 rounded"
                style={{ background: 'var(--color-cyber-green)', color: '#0D1117', opacity: saving || !newShopName.trim() ? 0.5 : 1 }}>
                {saving ? 'Creating...' : 'Create Shop'}
              </button>
              <button onClick={() => setShowCreateShopModal(false)} className="px-4 py-2 rounded"
                style={{ border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddItemModal && selectedShop && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setShowAddItemModal(false)}>
          <div className="glass-panel p-6 w-[500px] max-h-[80vh] overflow-y-auto" style={{ border: '2px solid var(--color-cyber-cyan)' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>📦 ADD ITEM TO {selectedShop.name.toUpperCase()}</h3>
            <select value={addItemId} onChange={(e) => setAddItemId(e.target.value)}
              className="w-full px-3 py-2 rounded mb-3" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}>
              <option value="">Select an item...</option>
              {allItems.filter(item => !shopInventory.some(inv => inv.item_id === item.id)).map(item => (
                <option key={item.id} value={item.id}>{item.name} ({item.rarity})</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-cyber-cyan)' }}>Stock (-1 = unlimited)</label>
                <input type="number" value={addItemStock} onChange={(e) => setAddItemStock(parseInt(e.target.value))}
                  className="w-full px-3 py-2 rounded" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-cyber-yellow)' }}>Price ($)</label>
                <input type="number" value={addItemPrice} onChange={(e) => setAddItemPrice(parseInt(e.target.value))}
                  className="w-full px-3 py-2 rounded" style={{ background: 'var(--color-cyber-darker)', border: '1px solid var(--color-cyber-yellow)', color: 'var(--color-cyber-yellow)' }} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleAddItemToShop} disabled={saving || !addItemId} className="flex-1 py-2 rounded"
                style={{ background: 'var(--color-cyber-cyan)', color: '#0D1117', opacity: saving || !addItemId ? 0.5 : 1 }}>
                {saving ? 'Adding...' : 'Add Item'}
              </button>
              <button onClick={() => setShowAddItemModal(false)} className="px-4 py-2 rounded"
                style={{ border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
