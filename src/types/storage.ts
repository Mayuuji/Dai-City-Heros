import type { Item } from './inventory';

export interface StorageContainer {
  id: string;
  campaign_id: string;
  name: string;
  description: string | null;
  is_locked: boolean;
  max_capacity: number | null;
  created_by: string | null;
  created_at: string;
}

export interface StorageItem {
  id: string;
  container_id: string;
  item_id: string;
  quantity: number;
  stored_by: string | null;
  stored_at: string;
  item?: Item;
}
