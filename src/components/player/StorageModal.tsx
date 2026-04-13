import type { InventoryItem } from '../../types/inventory';
import type { StorageContainer, StorageItem } from '../../types/storage';
import { getItemTypeIcon } from '../../utils/stats';
import NumberInput from '../NumberInput';

interface StorageModalProps {
  isOpen: boolean;
  onClose: () => void;
  storageContainers: StorageContainer[];
  storageItems: StorageItem[];
  selectedContainer: StorageContainer | null;
  setSelectedContainer: (c: StorageContainer | null) => void;
  onSelectContainer: (c: StorageContainer) => void;
  inventory: InventoryItem[];
  storeItemId: string | null;
  setStoreItemId: (id: string | null) => void;
  storeQuantity: number;
  setStoreQuantity: (q: number) => void;
  onStoreItem: (containerId: string) => void;
  onRetrieveItem: (storageItem: StorageItem, qty: number) => void;
}

export default function StorageModal({
  isOpen, onClose,
  storageContainers, storageItems,
  selectedContainer, setSelectedContainer,
  onSelectContainer,
  inventory,
  storeItemId, setStoreItemId,
  storeQuantity, setStoreQuantity,
  onStoreItem, onRetrieveItem
}: StorageModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50">
      <div
        className="w-full sm:max-w-lg max-h-[85vh] rounded-t-xl sm:rounded-xl overflow-hidden flex flex-col"
        style={{ background: 'var(--color-dark-bg)', border: '2px solid var(--color-cyber-green)', boxShadow: '0 0 40px rgba(0, 255, 0, 0.15)' }}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4" style={{ borderBottom: '1px solid color-mix(in srgb, var(--color-cyber-green) 30%, transparent)' }}>
          <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-green)' }}>📦 STORAGE</h3>
          <button onClick={() => { onClose(); setSelectedContainer(null); }} className="text-xl px-2" style={{ color: 'var(--color-cyber-magenta)' }}>✕</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4" style={{ scrollbarWidth: 'thin' }}>
          {!selectedContainer ? (
            /* Container list */
            <div className="space-y-2">
              {storageContainers.filter(c => !c.is_locked).length === 0 ? (
                <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>No unlocked storage containers available</p>
              ) : storageContainers.map(container => (
                <button
                  key={container.id}
                  onClick={() => {
                    if (container.is_locked) return;
                    onSelectContainer(container);
                  }}
                  disabled={container.is_locked}
                  className="w-full p-3 rounded text-left transition-all"
                  style={{
                    background: container.is_locked ? 'var(--color-cyber-darker)' : 'color-mix(in srgb, var(--color-cyber-green) 10%, transparent)',
                    border: `1px solid ${container.is_locked ? 'var(--color-text-muted)' : 'var(--color-cyber-green)'}`,
                    opacity: container.is_locked ? 0.5 : 1
                  }}
                >
                  <div className="font-bold text-sm" style={{ color: container.is_locked ? 'var(--color-text-muted)' : 'var(--color-cyber-green)', fontFamily: 'var(--font-cyber)' }}>
                    {container.is_locked ? '🔒' : '📦'} {container.name}
                  </div>
                  {container.description && (
                    <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{container.description}</div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            /* Container contents */
            <div>
              <button onClick={() => { setSelectedContainer(null); setStoreItemId(null); }}
                className="text-sm mb-3" style={{ color: 'var(--color-cyber-cyan)' }}>← Back</button>

              <h4 className="font-bold mb-3" style={{ color: 'var(--color-cyber-green)', fontFamily: 'var(--font-cyber)' }}>
                {selectedContainer.name}
              </h4>

              {/* Stored items */}
              <div className="mb-4">
                <div className="text-xs mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>STORED ITEMS:</div>
                {storageItems.length === 0 ? (
                  <p className="text-xs py-2" style={{ color: 'var(--color-text-muted)' }}>Empty</p>
                ) : (
                  <div className="space-y-1">
                    {storageItems.map(si => (
                      <div key={si.id} className="flex items-center justify-between p-2 rounded" style={{ background: 'var(--color-cyber-darker)', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)' }}>
                        <span className="text-sm" style={{ color: 'var(--color-cyber-cyan)' }}>
                          {si.item ? `${getItemTypeIcon(si.item.type)} ${si.item.name}` : 'Unknown'} ×{si.quantity}
                        </span>
                        <button onClick={() => onRetrieveItem(si, 1)}
                          className="text-xs px-2 py-1 rounded" style={{ background: 'var(--color-cyber-green)', color: 'white', fontFamily: 'var(--font-mono)' }}>
                          Take 1
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Store item */}
              <div className="p-3 rounded" style={{ border: '1px solid var(--color-cyber-yellow)', background: 'color-mix(in srgb, var(--color-cyber-yellow) 5%, transparent)' }}>
                <div className="text-xs mb-2" style={{ color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)' }}>STORE ITEM:</div>
                <select
                  value={storeItemId || ''}
                  onChange={(e) => { setStoreItemId(e.target.value || null); setStoreQuantity(1); }}
                  className="w-full px-3 py-2 rounded text-sm mb-2"
                  style={{ background: 'var(--color-cyber-dark)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}
                >
                  <option value="">-- Select item --</option>
                  {inventory.filter(inv => !inv.is_equipped).map(inv => (
                    <option key={inv.id} value={inv.id}>{inv.item?.name || 'Unknown'} (×{inv.quantity})</option>
                  ))}
                </select>
                {storeItemId && (
                  <div className="flex gap-2">
                    <NumberInput
                      min={1}
                      max={inventory.find(inv => inv.id === storeItemId)?.quantity || 1}
                      value={storeQuantity}
                      onChange={(v) => setStoreQuantity(v)}
                      className="w-20 px-2 py-1 rounded text-sm"
                      style={{ background: 'var(--color-cyber-dark)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                    />
                    <button onClick={() => onStoreItem(selectedContainer.id)}
                      className="flex-1 py-1 rounded text-sm font-bold"
                      style={{ background: 'var(--color-cyber-yellow)', color: 'white', fontFamily: 'var(--font-cyber)' }}>
                      Store
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
