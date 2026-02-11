// World Map Types

export interface MapSettings {
  id: string;
  min_lat: number;
  min_lng: number;
  max_lat: number;
  max_lng: number;
  min_zoom: number;
  max_zoom: number;
  default_zoom: number;
  center_lat: number;
  center_lng: number;
  lock_bounds: boolean;
  tile_url: string;
  tile_attribution: string;
  updated_at: string;
  updated_by: string | null;
}

export interface Location {
  id: string;
  name: string;
  description: string | null;
  lore: string | null;
  lat: number;
  lng: number;
  icon: 'marker' | 'city' | 'dungeon' | 'shop' | 'quest' | 'danger' | 'safe-zone' | 'region';
  color: 'cyan' | 'purple' | 'pink' | 'green' | 'orange' | 'red' | 'blue' | 'yellow';
  tags: string[];
  is_visible: boolean;
  is_discovered: boolean;
  created_at: string;
  created_by: string | null;
  updated_at: string;
}

export type LocationIcon = Location['icon'];
export type LocationColor = Location['color'];
