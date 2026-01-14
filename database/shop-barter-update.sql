-- Add barter support to shop_inventory
-- Items can now be priced with credits AND/OR another item

-- Add price_item_id column for barter pricing
ALTER TABLE shop_inventory 
ADD COLUMN IF NOT EXISTS price_item_id UUID REFERENCES items(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS price_item_quantity INTEGER DEFAULT 1;

-- Add comment
COMMENT ON COLUMN shop_inventory.price_item_id IS 'Optional: Item required as payment instead of or in addition to credits';
COMMENT ON COLUMN shop_inventory.price_item_quantity IS 'Quantity of the price_item required for purchase';

-- Create index for barter lookups
CREATE INDEX IF NOT EXISTS idx_shop_inventory_price_item ON shop_inventory(price_item_id);
