import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import WorldMap from '../components/WorldMap';
import type { Location } from '../types/map';
import type { Shop } from '../types/shop';
import { getLocationIcon, getLocationColor, ALL_LOCATION_ICONS } from '../utils/mapUtils';

export default function PlayerMapView() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [locations, setLocations] = useState<Location[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterIcon, setFilterIcon] = useState<string>('all');
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    fetchLocations();
    fetchShops();
  }, []);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      
      // Fetch only visible locations
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('is_visible', true)
        .order('name');
      
      if (error) throw error;
      setLocations(data || []);
      
    } catch (err: any) {
      console.error('Error fetching locations:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchShops = async () => {
    try {
      // Fetch active shops
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .eq('is_active', true);
      
      if (error) throw error;
      setShops(data || []);
      
    } catch (err: any) {
      console.error('Error fetching shops:', err);
    }
  };

  const handleLocationClick = (location: Location) => {
    setSelectedLocation(location);
    setShowDetailModal(true);
  };

  const handleAccessShop = (locationId: string) => {
    const shop = shops.find(s => s.location_id === locationId);
    if (shop) {
      navigate(`/shop/${shop.id}`);
    }
  };

  const locationHasShop = (locationId: string) => {
    return shops.some(s => s.location_id === locationId);
  };

  const closeModal = () => {
    setShowDetailModal(false);
    setSelectedLocation(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <div className="text-2xl" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>
          LOADING MAP...
        </div>
      </div>
    );
  }

  const filteredLocations = locations.filter(loc => {
    const matchesSearch = loc.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterIcon === 'all' || loc.icon === filterIcon;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-[1800px] mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl mb-2" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
              🗺️ WORLD MAP
            </h1>
            <p className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
              Explore discovered locations • {locations.length} locations available
            </p>
          </div>
          
          <button
            onClick={() => navigate('/dashboard')}
            className="neon-button px-6 py-2"
          >
            ← BACK
          </button>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          {/* Map */}
          <div className="lg:col-span-2">
            <div className="glass-panel p-2" style={{ border: '2px solid var(--color-cyber-cyan)', height: '700px' }}>
              <WorldMap
                isDM={false}
                onLocationClick={handleLocationClick}
                filterByIcon={filterIcon}
              />
            </div>
          </div>

          {/* Location List */}
          <div className="lg:col-span-1">
            <div className="glass-panel p-6" style={{ border: '2px solid var(--color-cyber-cyan)' }}>
              <h2 className="text-xl mb-4" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
                LOCATIONS ({filteredLocations.length})
              </h2>
              
              {/* Search and Filter */}
              <div className="space-y-3 mb-4">
                <input
                  type="text"
                  placeholder="Search locations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 rounded"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                    border: '1px solid var(--color-cyber-cyan)',
                    color: 'var(--color-cyber-cyan)',
                    fontFamily: 'var(--font-mono)'
                  }}
                />
                
                <select
                  value={filterIcon}
                  onChange={(e) => setFilterIcon(e.target.value)}
                  className="w-full px-3 py-2 rounded"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)',
                    border: '1px solid var(--color-cyber-cyan)',
                    color: 'var(--color-cyber-cyan)',
                    fontFamily: 'var(--font-mono)'
                  }}
                >
                  <option value="all">All Types</option>
                  {ALL_LOCATION_ICONS.map(icon => (
                    <option key={icon.value} value={icon.value}>
                      {icon.emoji} {icon.label}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Location List */}
              <div className="space-y-2 max-h-[550px] overflow-y-auto pr-2">
                {filteredLocations.map(location => (
                  <div
                    key={location.id}
                    onClick={() => handleLocationClick(location)}
                    className="p-3 rounded cursor-pointer transition-all hover:brightness-110"
                    style={{
                      backgroundColor: 'color-mix(in srgb, ' + getLocationColor(location.color) + ' 10%, transparent)',
                      border: `1px solid ${getLocationColor(location.color)}`
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{
                          backgroundColor: getLocationColor(location.color),
                          boxShadow: `0 0 10px ${getLocationColor(location.color)}`
                        }}
                      />
                      <div className="flex-1">
                        <div className="text-sm" style={{ color: getLocationColor(location.color), fontFamily: 'var(--font-cyber)' }}>
                          {location.name}
                        </div>
                        {location.tags.length > 0 && (
                          <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                            {location.tags.slice(0, 3).join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-1">
                      {locationHasShop(location.id) && (
                        <span className="text-xs px-2 py-1 rounded inline-block" style={{ backgroundColor: 'var(--color-cyber-green)', color: 'var(--color-cyber-darker)', fontFamily: 'var(--font-mono)' }}>
                          🛍️ SHOP
                        </span>
                      )}
                      {location.is_discovered && (
                        <span className="text-xs px-2 py-1 rounded inline-block" style={{ backgroundColor: 'var(--color-cyber-cyan)', color: 'var(--color-cyber-darker)', fontFamily: 'var(--font-mono)' }}>
                          DISCOVERED
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                
                {filteredLocations.length === 0 && (
                  <div className="text-center py-8" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
                    No locations found
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Location Detail Modal */}
      {showDetailModal && selectedLocation && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.9)' }}
          onClick={closeModal}
        >
          <div 
            className="glass-panel p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            style={{ border: `2px solid ${getLocationColor(selectedLocation.color)}` }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div 
                  className="w-6 h-6 rounded-full"
                  style={{
                    backgroundColor: getLocationColor(selectedLocation.color),
                    boxShadow: `0 0 20px ${getLocationColor(selectedLocation.color)}`
                  }}
                />
                <h2 className="text-3xl" style={{ fontFamily: 'var(--font-cyber)', color: getLocationColor(selectedLocation.color) }}>
                  {selectedLocation.name}
                </h2>
              </div>
              <button
                onClick={closeModal}
                className="text-2xl"
                style={{ color: 'var(--color-cyber-cyan)' }}
              >
                ✕
              </button>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              {selectedLocation.tags.map(tag => (
                <span 
                  key={tag}
                  className="text-xs px-2 py-1 rounded"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)',
                    border: '1px solid var(--color-cyber-cyan)',
                    color: 'var(--color-cyber-cyan)',
                    fontFamily: 'var(--font-mono)'
                  }}
                >
                  {tag}
                </span>
              ))}
              {selectedLocation.is_discovered && (
                <span 
                  className="text-xs px-2 py-1 rounded"
                  style={{
                    backgroundColor: 'var(--color-cyber-green)',
                    color: 'var(--color-cyber-darker)',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 'bold'
                  }}
                >
                  ✓ DISCOVERED
                </span>
              )}
            </div>

            {/* Description */}
            {selectedLocation.description && (
              <div className="mb-4">
                <h3 className="text-lg mb-2" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
                  DESCRIPTION
                </h3>
                <p style={{ color: 'var(--color-cyber-cyan)', opacity: 0.9, fontFamily: 'var(--font-mono)', lineHeight: '1.6' }}>
                  {selectedLocation.description}
                </p>
              </div>
            )}

            {/* Lore */}
            {selectedLocation.lore && (
              <div className="mb-4">
                <h3 className="text-lg mb-2" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
                  LORE
                </h3>
                <p style={{ color: 'var(--color-cyber-cyan)', opacity: 0.8, fontFamily: 'var(--font-mono)', lineHeight: '1.6', fontStyle: 'italic' }}>
                  {selectedLocation.lore}
                </p>
              </div>
            )}

            {/* Coordinates */}
            <div className="p-3 rounded mb-4" style={{ backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 5%, transparent)', border: '1px solid var(--color-cyber-cyan)' }}>
              <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                COORDINATES: {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}
              </div>
            </div>

            {/* Shop Access */}
            {locationHasShop(selectedLocation.id) && (
              <button
                onClick={() => handleAccessShop(selectedLocation.id)}
                className="w-full neon-button mb-2 py-3"
                style={{
                  backgroundColor: 'var(--color-cyber-green)',
                  color: 'var(--color-cyber-darker)',
                  fontFamily: 'var(--font-cyber)'
                }}
              >
                🛍️ ENTER SHOP
              </button>
            )}

            <button
              onClick={closeModal}
              className="neon-button w-full"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
