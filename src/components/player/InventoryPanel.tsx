import type { InventoryItem, EquipmentSlot } from '../../types/inventory';
import { getRarityColor, getItemTypeIcon, formatWeaponToHit, formatWeaponDamage } from '../../utils/stats';
import { formatToHit } from '../../data/characterClasses';

interface Character {
  id: string;
  [key: string]: any;
}

interface ComputedStats {
  icRemaining: number;
  equippedArmorCount: number;
  equippedWeaponCount: number;
  [key: string]: any;
}

interface InventoryPanelProps {
  character: Character;
  inventory: InventoryItem[];
  computedStats: ComputedStats;
  filteredInventory: InventoryItem[];
  inventorySearch: string;
  setInventorySearch: (v: string) => void;
  inventoryTypeFilter: string;
  setInventoryTypeFilter: (v: string) => void;
  inventoryRarityFilter: string;
  setInventoryRarityFilter: (v: string) => void;
  inventorySort: string;
  setInventorySort: (v: any) => void;
  inventoryViewMode: 'grid' | 'list';
  setInventoryViewMode: (v: 'grid' | 'list') => void;
  selectedInventoryItem: InventoryItem | null;
  setSelectedInventoryItem: (item: InventoryItem | null) => void;
  onEquipToggle: (itemId: string, currentlyEquipped: boolean) => void;
  onConsume: (itemId: string, item: any, quantity: number) => void;
  getSlotLabel: (slot: EquipmentSlot) => string;
  slotFilter?: EquipmentSlot | null;
  onClearSlotFilter?: () => void;
}

export default function InventoryPanel({
  character,
  inventory,
  filteredInventory,
  inventorySearch, setInventorySearch,
  inventoryTypeFilter, setInventoryTypeFilter,
  inventoryRarityFilter, setInventoryRarityFilter,
  inventorySort, setInventorySort,
  inventoryViewMode, setInventoryViewMode,
  selectedInventoryItem, setSelectedInventoryItem,
  onEquipToggle,
  onConsume,
  getSlotLabel,
  slotFilter,
  onClearSlotFilter
}: InventoryPanelProps) {
  const inventoryTypes = [...new Set(inventory.map(inv => inv.item?.type).filter(Boolean))];
  const inventoryRarities = [...new Set(inventory.map(inv => inv.item?.rarity).filter(Boolean))];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center mb-2 px-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
            📦 INVENTORY
          </h3>
          {slotFilter && (
            <span className="text-[10px] px-2 py-0.5 rounded flex items-center gap-1" style={{
              background: 'var(--color-cyber-yellow)', color: 'black', fontFamily: 'var(--font-mono)'
            }}>
              {getSlotLabel(slotFilter)}
              <button onClick={onClearSlotFilter} className="ml-1 font-bold">✕</button>
            </span>
          )}
        </div>
        <div className="text-[10px]" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
          {inventory.length} items • {inventory.filter(i => i.is_equipped).length} equipped
        </div>
      </div>

      {/* Search & Filters */}
      <div className="p-2 rounded mb-2 space-y-2" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-green) 40%, transparent)', background: 'color-mix(in srgb, var(--color-cyber-green) 3%, transparent)' }}>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search..."
              value={inventorySearch}
              onChange={(e) => setInventorySearch(e.target.value)}
              className="w-full px-2 py-1 rounded text-xs"
              style={{
                background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)',
                color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)'
              }}
            />
            {inventorySearch && (
              <button onClick={() => setInventorySearch('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px]" style={{ color: 'var(--color-cyber-cyan)' }}>✕</button>
            )}
          </div>
          <div className="flex rounded overflow-hidden" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-green) 40%, transparent)' }}>
            <button onClick={() => setInventoryViewMode('grid')} className="px-2 py-1 text-xs"
              style={{ background: inventoryViewMode === 'grid' ? 'var(--color-cyber-green)' : 'transparent', color: inventoryViewMode === 'grid' ? 'black' : 'var(--color-cyber-cyan)' }}>▦</button>
            <button onClick={() => setInventoryViewMode('list')} className="px-2 py-1 text-xs"
              style={{ background: inventoryViewMode === 'list' ? 'var(--color-cyber-green)' : 'transparent', color: inventoryViewMode === 'list' ? 'black' : 'var(--color-cyber-cyan)' }}>☰</button>
          </div>
        </div>
        <div className="flex gap-1 flex-wrap">
          <select value={inventoryTypeFilter} onChange={(e) => setInventoryTypeFilter(e.target.value)} className="px-2 py-0.5 rounded text-[10px]"
            style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
            <option value="all">All Types</option>
            {inventoryTypes.map(type => <option key={type} value={type}>{getItemTypeIcon(type as any)} {type}</option>)}
          </select>
          <select value={inventoryRarityFilter} onChange={(e) => setInventoryRarityFilter(e.target.value)} className="px-2 py-0.5 rounded text-[10px]"
            style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
            <option value="all">All Rarities</option>
            {inventoryRarities.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={inventorySort} onChange={(e) => setInventorySort(e.target.value)} className="px-2 py-0.5 rounded text-[10px]"
            style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
            <option value="equipped">Equipped First</option>
            <option value="name">Name</option>
            <option value="type">Type</option>
            <option value="rarity">Rarity</option>
          </select>
          {(inventorySearch || inventoryTypeFilter !== 'all' || inventoryRarityFilter !== 'all') && (
            <button onClick={() => { setInventorySearch(''); setInventoryTypeFilter('all'); setInventoryRarityFilter('all'); }}
              className="px-2 py-0.5 rounded text-[10px]" style={{ border: '1px solid var(--color-cyber-magenta)', color: 'var(--color-cyber-magenta)' }}>Clear</button>
          )}
        </div>
      </div>

      {/* Results count */}
      {filteredInventory.length !== inventory.length && (
        <div className="text-[10px] mb-1 px-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
          {filteredInventory.length}/{inventory.length} items
        </div>
      )}

      {/* Inventory Grid/List */}
      <div className="flex-1 overflow-y-auto min-h-0" style={{ scrollbarWidth: 'thin' }}>
        {inventory.length === 0 ? (
          <div className="text-center py-8" style={{ border: '2px dashed color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)', borderRadius: '8px' }}>
            <div className="text-3xl mb-2">📦</div>
            <p className="text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>EMPTY</p>
          </div>
        ) : filteredInventory.length === 0 ? (
          <div className="text-center py-4" style={{ border: '2px dashed color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)', borderRadius: '8px' }}>
            <p className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>No items match</p>
          </div>
        ) : (
          <div className={inventoryViewMode === 'grid' ? 'grid grid-cols-2 gap-2 p-0.5' : 'space-y-1 p-0.5'}>
            {filteredInventory.map(inv => {
              const item = inv.item!;
              const isSelected = selectedInventoryItem?.id === inv.id;
              return inventoryViewMode === 'grid' ? (
                <div key={inv.id} onClick={() => setSelectedInventoryItem(isSelected ? null : inv)}
                  className="p-2 rounded cursor-pointer transition-all hover:scale-[1.02]"
                  style={{
                    border: `2px solid ${isSelected ? getRarityColor(item.rarity) : inv.is_equipped ? 'var(--color-cyber-green)' : 'color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)'}`,
                    background: isSelected ? 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)' : inv.is_equipped ? 'color-mix(in srgb, var(--color-cyber-green) 8%, transparent)' : 'transparent'
                  }}>
                  <div className="flex items-start gap-1.5 mb-1">
                    <span className="text-lg">{getItemTypeIcon(item.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[11px] truncate" style={{ color: getRarityColor(item.rarity), fontFamily: 'var(--font-cyber)' }}>{item.name}</div>
                      <div className="text-[9px]" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6 }}>{item.type}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] px-1 py-0.5 rounded" style={{ color: getRarityColor(item.rarity) }}>{item.rarity}</span>
                    {inv.is_equipped && (
                      <span className="text-[9px] px-1 py-0.5 rounded font-bold" style={{ background: 'var(--color-cyber-yellow)', color: 'white' }}>
                        {inv.equipped_slot ? getSlotLabel(inv.equipped_slot).split(' ').pop() : '✓'}
                      </span>
                    )}
                    {inv.quantity > 1 && <span className="text-[9px]" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>×{inv.quantity}</span>}
                  </div>
                </div>
              ) : (
                <div key={inv.id} onClick={() => setSelectedInventoryItem(isSelected ? null : inv)}
                  className="p-2 rounded cursor-pointer transition-all flex items-center gap-2"
                  style={{
                    border: `1px solid ${isSelected ? getRarityColor(item.rarity) : inv.is_equipped ? 'var(--color-cyber-green)' : 'color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)'}`,
                    background: isSelected ? 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)' : inv.is_equipped ? 'color-mix(in srgb, var(--color-cyber-green) 8%, transparent)' : 'transparent'
                  }}>
                  <span className="text-lg">{getItemTypeIcon(item.type)}</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-xs truncate block" style={{ color: getRarityColor(item.rarity), fontFamily: 'var(--font-cyber)' }}>{item.name}</span>
                  </div>
                  <span className="text-[9px]" style={{ color: getRarityColor(item.rarity) }}>{item.rarity}</span>
                  {inv.quantity > 1 && <span className="text-[9px]" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>×{inv.quantity}</span>}
                  {inv.is_equipped && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: 'var(--color-cyber-yellow)', color: 'white' }}>
                      {inv.equipped_slot ? getSlotLabel(inv.equipped_slot) : 'EQUIPPED'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Item Detail Panel */}
      <div className="mt-2 p-3 rounded border flex-shrink-0" style={{
        borderColor: selectedInventoryItem?.item ? getRarityColor(selectedInventoryItem.item.rarity) : 'color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)',
        maxHeight: '300px', overflowY: 'auto'
      }}>
        {selectedInventoryItem?.item ? (
          <ItemDetailView
            inv={selectedInventoryItem}
            character={character}
            onEquipToggle={onEquipToggle}
            onConsume={onConsume}
          />
        ) : (
          <div className="text-center py-3">
            <p className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>Select an item to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* Item Detail sub-component */
function ItemDetailView({ inv, character, onEquipToggle, onConsume }: {
  inv: InventoryItem;
  character: Character;
  onEquipToggle: (id: string, equipped: boolean) => void;
  onConsume: (id: string, item: any, qty: number) => void;
}) {
  const item = inv.item!;
  const isWeapon = item.type === 'weapon';
  const weaponType = item.weapon_subtype?.toLowerCase() || '';
  const rankKey = isWeapon ? `weapon_rank_${weaponType}` : null;
  const rank = rankKey ? (character[rankKey] as number) ?? 0 : 0;
  const isProficient = rank > 0;

  return (
    <>
      <div className="flex items-start gap-2 mb-2">
        <span className="text-2xl">{getItemTypeIcon(item.type)}</span>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm" style={{ color: getRarityColor(item.rarity), fontFamily: 'var(--font-cyber)' }}>{item.name}</div>
          <div className="text-[10px]" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
            {item.type} • {item.rarity}
            {item.weapon_subtype && ` • ${item.weapon_subtype}`}
            {item.armor_subtype && ` • ${item.armor_subtype}`}
          </div>
        </div>
        {inv.is_equipped && (
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-cyber-green)', color: 'white', fontWeight: 'bold' }}>EQUIPPED</span>
        )}
      </div>

      {/* Weapon combat stats */}
      {isWeapon && (
        <div className="flex flex-wrap gap-1 mb-2">
          {weaponType && (
            <span className="text-[10px] px-2 py-0.5 rounded font-bold" style={{ background: isProficient ? 'var(--color-cyber-green)' : 'var(--color-cyber-magenta)', color: 'white', fontFamily: 'var(--font-mono)' }}>
              🎯 {formatToHit(rank)} {!isProficient && '(NP)'}
            </span>
          )}
          {(item.to_hit_type && item.to_hit_type !== 'static' || (item.to_hit_static || 0) !== 0) && (
            <span className="text-[10px] px-2 py-0.5 rounded font-bold" style={{ background: 'color-mix(in srgb, var(--color-cyber-yellow) 30%, transparent)', border: '1px solid var(--color-cyber-yellow)', color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)' }}>
              🎯 {formatWeaponToHit(item, character as unknown as Record<string, unknown>)}
            </span>
          )}
          {item.damage_dice && (
            <span className="text-[10px] px-2 py-0.5 rounded font-bold" style={{ background: 'color-mix(in srgb, var(--color-cyber-red, #EF4444) 30%, transparent)', border: '1px solid var(--color-cyber-red, #EF4444)', color: 'var(--color-cyber-red, #EF4444)', fontFamily: 'var(--font-mono)' }}>
              💥 {formatWeaponDamage(item, character as unknown as Record<string, unknown>)}
            </span>
          )}
          {item.damage_type && (
            <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
              🔥 {item.damage_type}
            </span>
          )}
        </div>
      )}

      {item.description && (
        <p className="text-[11px] mb-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.8 }}>{item.description}</p>
      )}

      {/* Stat mods grid */}
      <div className="grid grid-cols-3 gap-1 mb-2">
        {[
          { label: '🛡️ AC', val: item.ac_mod }, { label: '❤️ HP', val: item.hp_mod },
          { label: '💪 STR', val: item.str_mod }, { label: '🎯 DEX', val: item.dex_mod },
          { label: '🏋️ CON', val: item.con_mod }, { label: '🧠 WIS', val: item.wis_mod },
          { label: '📚 INT', val: item.int_mod }, { label: '✨ CHA', val: item.cha_mod },
          { label: '⚡ SPD', val: item.speed_mod }, { label: '🎲 INIT', val: item.init_mod },
          { label: '🔧 IC', val: item.ic_mod }
        ].filter(m => m.val && m.val !== 0).map(m => (
          <div key={m.label} className="text-[10px] flex justify-between" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
            <span>{m.label}</span>
            <span style={{ color: (m.val || 0) > 0 ? 'var(--color-cyber-green)' : 'var(--color-cyber-magenta)' }}>
              {(m.val || 0) > 0 ? '+' : ''}{m.val}
            </span>
          </div>
        ))}
      </div>

      {/* Item abilities */}
      {item.abilities && item.abilities.length > 0 && (
        <div className="mb-2 p-2 rounded" style={{ background: 'rgba(189, 0, 255, 0.1)', border: '1px solid var(--color-cyber-purple)' }}>
          <div className="text-[10px] font-bold mb-1" style={{ color: 'var(--color-cyber-purple)', fontFamily: 'var(--font-mono)' }}>⚡ ABILITIES</div>
          {item.abilities.map((ia: any, i: number) => ia.ability && (
            <div key={i} className="text-[10px]" style={{ color: 'var(--color-cyber-cyan)' }}>
              • {ia.ability.name}{ia.ability.damage_dice ? ` (${ia.ability.damage_dice})` : ''}
            </div>
          ))}
        </div>
      )}

      {/* Qty & Value */}
      <div className="flex justify-between text-[10px] mb-2 pt-1" style={{ borderTop: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
        <span>Qty: {inv.quantity}</span>
        <span>Value: ${item.price?.toLocaleString() || 0}</span>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        {item.is_equippable && (
          <button onClick={() => onEquipToggle(inv.id, inv.is_equipped)}
            className="flex-1 py-1.5 rounded font-bold text-xs transition-all"
            style={{
              background: inv.is_equipped ? 'transparent' : 'var(--color-cyber-yellow)',
              color: inv.is_equipped ? 'var(--color-cyber-cyan)' : 'white',
              border: `2px solid ${inv.is_equipped ? 'var(--color-cyber-cyan)' : 'var(--color-cyber-yellow)'}`,
              fontFamily: 'var(--font-cyber)'
            }}>
            {inv.is_equipped ? 'UNEQUIP' : 'EQUIP'}
          </button>
        )}
        {item.is_consumable && (
          <button onClick={() => onConsume(inv.id, item, inv.quantity)}
            className="flex-1 py-1.5 rounded font-bold text-xs transition-all"
            style={{ background: 'var(--color-cyber-magenta)', color: 'white', border: '2px solid var(--color-cyber-magenta)', fontFamily: 'var(--font-cyber)' }}>
            🍴 CONSUME
          </button>
        )}
      </div>

      {/* Consume info */}
      {item.is_consumable && item.hp_mod !== 0 && (
        <div className="mt-1 text-[10px] text-center" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>
          {item.hp_mod_type === 'max_hp'
            ? `Permanently ${item.hp_mod > 0 ? '+' : ''}${item.hp_mod} Max HP`
            : `${item.hp_mod > 0 ? 'Heals' : 'Damages'} ${Math.abs(item.hp_mod)} HP`}
        </div>
      )}
    </>
  );
}
