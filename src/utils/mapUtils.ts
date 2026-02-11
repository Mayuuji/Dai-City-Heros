// Map utility functions

import type { LocationIcon, LocationColor } from '../types/map';

// Get icon emoji for location type
export function getLocationIcon(icon: LocationIcon): string {
  const icons: Record<LocationIcon, string> = {
    marker: '📍',
    city: '🏙️',
    dungeon: '⚔️',
    shop: '🛒',
    quest: '⭐',
    danger: '☠️',
    'safe-zone': '🛡️',
    region: '🌐'
  };
  return icons[icon] || icons.marker;
}

// Get color hex for location color
// Using actual hex values for Leaflet markers (CSS variables don't work in DivIcon inline styles)
export function getLocationColor(color: LocationColor): string {
  const colors: Record<LocationColor, string> = {
    cyan: '#00D4FF',
    purple: '#BD00FF',
    pink: '#FF007F',
    green: '#00FF88',
    orange: '#FF8800',
    red: '#FF3366',
    blue: '#0088FF',
    yellow: '#FFD700'
  };
  return colors[color] || colors.cyan;
}

// Get all available icons
export const ALL_LOCATION_ICONS: { value: LocationIcon; label: string; emoji: string }[] = [
  { value: 'region', label: 'Region', emoji: '🌐' },
  { value: 'marker', label: 'Generic Marker', emoji: '📍' },
  { value: 'city', label: 'City/Settlement', emoji: '🏙️' },
  { value: 'dungeon', label: 'Dungeon/Combat', emoji: '⚔️' },
  { value: 'shop', label: 'Shop/Vendor', emoji: '🛒' },
  { value: 'quest', label: 'Quest Location', emoji: '⭐' },
  { value: 'danger', label: 'Dangerous Area', emoji: '☠️' },
  { value: 'safe-zone', label: 'Safe Zone', emoji: '🛡️' }
];

// Minimum zoom level required for non-region icons to appear on the map
export const LOCATION_ZOOM_THRESHOLD = 8;

// Get all available colors
export const ALL_LOCATION_COLORS: { value: LocationColor; label: string }[] = [
  { value: 'cyan', label: 'Cyan' },
  { value: 'purple', label: 'Purple' },
  { value: 'pink', label: 'Pink' },
  { value: 'green', label: 'Green' },
  { value: 'orange', label: 'Orange' },
  { value: 'red', label: 'Red' },
  { value: 'blue', label: 'Blue' },
  { value: 'yellow', label: 'Yellow' }
];
