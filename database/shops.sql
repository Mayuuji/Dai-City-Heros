-- Shop System
-- DMs can create shops attached to locations
-- Players can browse and purchase items from active shops

-- Drop existing tables
DROP TABLE IF EXISTS shop_inventory CASCADE;
DROP TABLE IF EXISTS shops CASCADE;

-- Shops table (one shop per location)
CREATE TABLE shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to location
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  
  -- Shop details
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Shop status
  is_active BOOLEAN DEFAULT false, -- Can players access this shop?
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One shop per location
  CONSTRAINT unique_location_shop UNIQUE(location_id)
);

-- Shop Inventory table (items available in each shop)
CREATE TABLE shop_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to shop and item
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  
  -- Stock and pricing
  stock_quantity INTEGER NOT NULL DEFAULT 1, -- -1 for unlimited
  price_credits INTEGER NOT NULL DEFAULT 0, -- Cost in credits
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One item type per shop (can't have duplicate items in same shop)
  CONSTRAINT unique_shop_item UNIQUE(shop_id, item_id),
  CONSTRAINT stock_quantity_check CHECK (stock_quantity >= -1)
);

-- Indexes
CREATE INDEX idx_shops_location ON shops(location_id);
CREATE INDEX idx_shops_active ON shops(is_active);
CREATE INDEX idx_shop_inventory_shop ON shop_inventory(shop_id);
CREATE INDEX idx_shop_inventory_item ON shop_inventory(item_id);

-- Row Level Security

-- Shops: Players can view active shops, admins can manage all
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view active shops"
  ON shops FOR SELECT
  USING (is_active = true OR EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  ));

CREATE POLICY "Admins can manage shops"
  ON shops FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  ));

-- Shop Inventory: Players can view items in active shops, admins can manage
ALTER TABLE shop_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view active shop inventory"
  ON shop_inventory FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM shops 
    WHERE shops.id = shop_inventory.shop_id 
    AND shops.is_active = true
  ) OR EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  ));

CREATE POLICY "Admins can manage shop inventory"
  ON shop_inventory FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  ));

-- Allow authenticated users to UPDATE stock_quantity (for purchases)
CREATE POLICY "Players can update shop stock on purchase"
  ON shop_inventory FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Comments
COMMENT ON TABLE shops IS 'Shops attached to map locations where players can purchase items';
COMMENT ON TABLE shop_inventory IS 'Items available for purchase in each shop';
COMMENT ON COLUMN shops.is_active IS 'If true, players can access this shop';
COMMENT ON COLUMN shop_inventory.stock_quantity IS 'Number of items in stock. -1 means unlimited stock';
COMMENT ON COLUMN shop_inventory.price_credits IS 'Cost in credits to purchase this item';

-- Sample shop at Chrome Street Market
DO $$
DECLARE
  chrome_market_location_id UUID;
  chrome_shop_id UUID;
  basic_pistol_id UUID;
  combat_knife_id UUID;
  medkit_id UUID;
BEGIN
  -- Get Chrome Street Market location ID
  SELECT id INTO chrome_market_location_id 
  FROM locations 
  WHERE name = 'Chrome Street Market' 
  LIMIT 1;
  
  -- Only create shop if location exists
  IF chrome_market_location_id IS NOT NULL THEN
    -- Create shop at Chrome Street Market
    INSERT INTO shops (location_id, name, description, is_active)
    VALUES (
      chrome_market_location_id,
      'Chrome Street Arsenal',
      'The finest weapons and gear for runners. All sales are final. We don''t ask questions.',
      true
    )
    RETURNING id INTO chrome_shop_id;
    
    -- Get some item IDs (these are examples - adjust based on your actual items)
    -- We'll try to find items by name, but won't fail if they don't exist
    
    -- Try to find items and add them to shop if they exist
    BEGIN
      SELECT id INTO basic_pistol_id FROM items WHERE LOWER(name) LIKE '%pistol%' LIMIT 1;
      IF basic_pistol_id IS NOT NULL THEN
        INSERT INTO shop_inventory (shop_id, item_id, stock_quantity, price_credits)
        VALUES (chrome_shop_id, basic_pistol_id, 5, 500);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Item doesn't exist, skip
      NULL;
    END;
    
    BEGIN
      SELECT id INTO combat_knife_id FROM items WHERE LOWER(name) LIKE '%knife%' LIMIT 1;
      IF combat_knife_id IS NOT NULL THEN
        INSERT INTO shop_inventory (shop_id, item_id, stock_quantity, price_credits)
        VALUES (chrome_shop_id, combat_knife_id, 10, 150);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    
    BEGIN
      SELECT id INTO medkit_id FROM items WHERE LOWER(name) LIKE '%medkit%' OR LOWER(name) LIKE '%med kit%' LIMIT 1;
      IF medkit_id IS NOT NULL THEN
        INSERT INTO shop_inventory (shop_id, item_id, stock_quantity, price_credits)
        VALUES (chrome_shop_id, medkit_id, -1, 100); -- Unlimited stock
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    
  END IF;
END $$;
