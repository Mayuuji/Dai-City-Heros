-- Phase 6: Storage Containers Migration

CREATE TABLE IF NOT EXISTS storage_containers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_locked BOOLEAN DEFAULT false,
  max_capacity NUMERIC(8,2),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS storage_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  container_id UUID NOT NULL REFERENCES storage_containers(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  stored_by UUID REFERENCES profiles(id),
  stored_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE storage_containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "storage_containers_all" ON storage_containers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "storage_items_all" ON storage_items FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE storage_containers;
ALTER PUBLICATION supabase_realtime ADD TABLE storage_items;
