import { useEffect, useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../lib/supabase';
import type { MapSettings, Location } from '../types/map';
import { getLocationIcon, getLocationColor } from '../utils/mapUtils';

// Fix Leaflet's default icon issue with Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export interface WorldMapHandle {
  getMap: () => L.Map | null;
}

interface WorldMapProps {
  isDM?: boolean; // DM mode allows creating/editing locations
  onLocationClick?: (location: Location) => void;
  onMapClick?: (lat: number, lng: number) => void;
  selectedLocationId?: string | null;
  filterByIcon?: string; // Filter to show only specific icon type (e.g., 'city', 'shop')
  showPopups?: boolean; // Whether to show popups on marker click (default: true for DM, false for players)
  externalLocations?: Location[]; // Optional: pass locations from parent instead of fetching
}

// Component to handle map bounds restrictions
function BoundsRestrictor({ settings, isDM }: { settings: MapSettings | null; isDM: boolean }) {
  const map = useMap();
  const initialized = useRef(false);
  const minZoomForBounds = useRef<number | null>(null);

  useEffect(() => {
    // DMs should be able to pan anywhere to set up the map
    if (isDM) {
      map.setMaxBounds(null as any);
      map.setMinZoom(settings?.min_zoom || 3);
      
      // For DMs, fit to the configured bounds on first load
      if (!initialized.current && settings) {
        initialized.current = true;
        const bounds = L.latLngBounds(
          [settings.min_lat, settings.min_lng],
          [settings.max_lat, settings.max_lng]
        );
        map.fitBounds(bounds, { animate: false, padding: [20, 20] });
      }
      return;
    }
    
    // Players are restricted if lock_bounds is enabled
    if (!settings || !settings.lock_bounds) return;

    const bounds = L.latLngBounds(
      [settings.min_lat, settings.min_lng],
      [settings.max_lat, settings.max_lng]
    );

    // Set max bounds to prevent panning outside
    map.setMaxBounds(bounds);
    
    // Fit to bounds immediately on first load (only once)
    if (!initialized.current) {
      initialized.current = true;
      map.fitBounds(bounds, { animate: false });
      
      // Calculate and store the minimum zoom that fits the bounds
      // This prevents zooming out beyond the bounds
      setTimeout(() => {
        minZoomForBounds.current = map.getZoom();
        map.setMinZoom(minZoomForBounds.current);
      }, 50);
    }
    
    // Handler to keep map inside bounds on drag
    const handleMove = () => {
      map.panInsideBounds(bounds, { animate: false });
    };
    
    // Handler to prevent zooming out too far
    const handleZoom = () => {
      if (minZoomForBounds.current !== null && map.getZoom() < minZoomForBounds.current) {
        map.setZoom(minZoomForBounds.current, { animate: false });
      }
      // Also ensure we stay in bounds after zoom
      map.panInsideBounds(bounds, { animate: false });
    };

    map.on('drag', handleMove);
    map.on('zoomend', handleZoom);

    return () => {
      map.off('drag', handleMove);
      map.off('zoomend', handleZoom);
      map.setMaxBounds(null as any);
    };
  }, [map, settings, isDM]);

  return null;
}

// Component to initialize map ref only
function MapInitializer({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap();

  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);

  return null;
}

// Component to handle map click events
function MapClickHandler({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      if (onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

// Custom marker icon creator - simple colored dots based on location type
function createCustomIcon(location: Location): L.DivIcon {
  const color = getLocationColor(location.color);
  
  // Get a unique color based on the location icon type for visual differentiation
  const typeColors: Record<string, string> = {
    'marker': color,
    'city': '#00D4FF',      // Cyan for cities
    'dungeon': '#FF3366',   // Red for dungeons/combat
    'shop': '#00FF88',      // Green for shops
    'quest': '#FFD700',     // Gold for quests
    'danger': '#FF0000',    // Bright red for danger
    'safe-zone': '#00FF88'  // Green for safe zones
  };
  
  const dotColor = typeColors[location.icon] || color;
  
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 14px;
        height: 14px;
        background: ${dotColor};
        border: 2px solid rgba(255,255,255,0.9);
        border-radius: 50%;
        box-shadow: 0 0 8px ${dotColor}, 0 0 16px ${dotColor}80, 0 1px 3px rgba(0,0,0,0.4);
        transform: translate(-50%, -50%);
      "></div>
    `,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10]
  });
}

const WorldMap = forwardRef<WorldMapHandle, WorldMapProps>(({ isDM = false, onLocationClick, onMapClick, selectedLocationId: _selectedLocationId, filterByIcon, showPopups, externalLocations }, ref) => {
  const [settings, setSettings] = useState<MapSettings | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<L.Map | null>(null);

  // Expose the map instance to parent components
  useImperativeHandle(ref, () => ({
    getMap: () => mapRef.current
  }));

  useEffect(() => {
    // If external locations are provided, use them instead of fetching
    if (externalLocations) {
      setLocations(externalLocations);
    }
  }, [externalLocations]);

  useEffect(() => {
    fetchMapData();
  }, [isDM]);

  const fetchMapData = async () => {
    try {
      setLoading(true);

      // Fetch map settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('map_settings')
        .select('*')
        .single();

      if (settingsError) {
        console.error('Error fetching map settings:', settingsError);
      } else {
        setSettings(settingsData);
      }

      // Only fetch locations if external locations are not provided
      if (!externalLocations) {
        // Fetch locations (DMs see all, players see only visible)
        const locationsQuery = supabase
          .from('locations')
          .select('*');

        if (!isDM) {
          locationsQuery.eq('is_visible', true);
        }

        const { data: locationsData, error: locationsError } = await locationsQuery;

        if (locationsError) {
          console.error('Error fetching locations:', locationsError);
        } else {
          setLocations(locationsData || []);
        }
      }

    } catch (err: any) {
      console.error('Error fetching map data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-cyber-darker)' }}>
        <div className="text-xl" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>
          LOADING MAP...
        </div>
      </div>
    );
  }

  // Calculate initial center from settings (BoundsRestrictor will fit bounds on load)
  const initialCenter: [number, number] = [settings.center_lat, settings.center_lng];

  // Use external locations if provided, otherwise use fetched locations
  const locationsToDisplay = externalLocations || locations;

  // Debug logging
  console.log('WorldMap: externalLocations:', externalLocations?.length, 'internal locations:', locations.length);
  console.log('WorldMap: locationsToDisplay:', locationsToDisplay);

  // Filter locations - exclude invalid coordinates (0,0 or null)
  // Also filter by icon if filterByIcon is provided
  const displayedLocations = locationsToDisplay.filter(loc => {
    // Exclude locations with no/invalid coordinates
    if (!loc.lat || !loc.lng || (loc.lat === 0 && loc.lng === 0)) {
      console.log('WorldMap: Filtering out location with invalid coords:', loc.name, loc.lat, loc.lng);
      return false;
    }
    // Apply icon filter if specified
    if (filterByIcon && filterByIcon !== 'all' && loc.icon !== filterByIcon) {
      return false;
    }
    return true;
  });

  console.log('WorldMap: displayedLocations:', displayedLocations.length, displayedLocations);

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={initialCenter}
        zoom={settings.min_zoom}
        minZoom={settings.min_zoom}
        maxZoom={settings.max_zoom}
        style={{ height: '100%', width: '100%', backgroundColor: '#0a0a0f' }}
        zoomControl={true}
      >
        <TileLayer
          attribution={settings.tile_attribution}
          url={settings.tile_url}
          maxZoom={19}
          minZoom={3}
        />
        
        <MapInitializer mapRef={mapRef} />
        <BoundsRestrictor settings={settings} isDM={isDM} />
        {isDM && onMapClick && <MapClickHandler onMapClick={onMapClick} />}
        
        {displayedLocations.map((location) => {
          // Determine if popups should be shown - default to true for DM, false for players
          const shouldShowPopup = showPopups !== undefined ? showPopups : isDM;
          
          return (
            <Marker
              key={location.id}
              position={[location.lat, location.lng]}
              icon={createCustomIcon(location)}
              eventHandlers={{
                click: () => {
                  if (onLocationClick) {
                    onLocationClick(location);
                  }
                }
              }}
            >
              {shouldShowPopup && (
                <Popup>
                  <div 
                    className="p-2"
                    style={{ 
                      backgroundColor: 'var(--color-cyber-darker)',
                      border: `1px solid ${getLocationColor(location.color)}`,
                      borderRadius: '4px',
                      minWidth: '200px'
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{getLocationIcon(location.icon)}</span>
                      <h3 
                        className="text-lg"
                        style={{ 
                          color: getLocationColor(location.color),
                          fontFamily: 'var(--font-cyber)'
                        }}
                      >
                        {location.name}
                      </h3>
                    </div>
                    
                    {location.description && (
                      <p 
                        className="text-sm mb-2"
                        style={{ 
                          color: 'var(--color-cyber-cyan)',
                          fontFamily: 'var(--font-mono)',
                          opacity: 0.8
                        }}
                      >
                        {location.description}
                      </p>
                    )}
                    
                    {location.tags && location.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {location.tags.map(tag => (
                          <span
                            key={tag}
                            className="text-xs px-2 py-1 rounded"
                            style={{
                              backgroundColor: 'color-mix(in srgb, var(--color-cyber-purple) 20%, transparent)',
                              border: '1px solid var(--color-cyber-purple)',
                              color: 'var(--color-cyber-purple)',
                              fontFamily: 'var(--font-mono)'
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    {isDM && !location.is_visible && (
                      <div 
                        className="text-xs px-2 py-1 rounded"
                        style={{
                          backgroundColor: 'color-mix(in srgb, var(--color-cyber-red) 20%, transparent)',
                          border: '1px solid var(--color-cyber-red)',
                          color: 'var(--color-cyber-red)',
                          fontFamily: 'var(--font-mono)'
                        }}
                      >
                        HIDDEN FROM PLAYERS
                      </div>
                    )}
                    
                    <button
                      onClick={() => onLocationClick?.(location)}
                      className="w-full mt-2 px-3 py-1 rounded text-sm"
                      style={{
                        backgroundColor: 'color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)',
                        border: '1px solid var(--color-cyber-cyan)',
                        color: 'var(--color-cyber-cyan)',
                        fontFamily: 'var(--font-mono)'
                      }}
                    >
                      VIEW DETAILS
                    </button>
                  </div>
                </Popup>
              )}
            </Marker>
          );
        })}
      </MapContainer>

      {/* Cyberpunk overlay border */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          border: '2px solid var(--color-cyber-cyan)',
          boxShadow: 'inset 0 0 20px rgba(0, 240, 255, 0.2)'
        }}
      />

      {/* Custom CSS for map styling */}
      <style>{`
        .leaflet-container {
          font-family: var(--font-mono);
          background: #0a0a0f !important;
        }
        
        .leaflet-popup-content-wrapper {
          background: var(--color-cyber-darker) !important;
          border: 1px solid var(--color-cyber-cyan) !important;
          border-radius: 4px !important;
          box-shadow: 0 0 20px rgba(0, 240, 255, 0.3) !important;
        }
        
        .leaflet-popup-tip {
          background: var(--color-cyber-darker) !important;
          border: 1px solid var(--color-cyber-cyan) !important;
        }
        
        .leaflet-control-zoom {
          border: 1px solid var(--color-cyber-cyan) !important;
          border-radius: 4px !important;
          overflow: hidden;
        }
        
        .leaflet-control-zoom a {
          background: var(--color-cyber-darker) !important;
          border-bottom: 1px solid var(--color-cyber-cyan) !important;
          color: var(--color-cyber-cyan) !important;
          font-family: var(--font-cyber) !important;
        }
        
        .leaflet-control-zoom a:hover {
          background: color-mix(in srgb, var(--color-cyber-cyan) 20%, var(--color-cyber-darker)) !important;
        }
        
        .leaflet-control-zoom a:last-child {
          border-bottom: none !important;
        }
        
        .custom-marker {
          background: transparent !important;
          border: none !important;
        }
        
        .map-tiles {
          filter: brightness(0.7) contrast(1.2) hue-rotate(180deg);
        }
      `}</style>
    </div>
  );
});

WorldMap.displayName = 'WorldMap';

export default WorldMap;
