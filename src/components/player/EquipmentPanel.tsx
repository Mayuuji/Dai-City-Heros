import { useState } from 'react';
import type { InventoryItem, EquipmentSlot } from '../../types/inventory';
import { getItemTypeIcon, getRarityColor } from '../../utils/stats';
import { supabase } from '../../lib/supabase';

interface EquipmentPanelProps {
  character: {
    id: string;
    name: string;
    carrying_capacity?: number;
    base_carrying_capacity?: number;
    portrait_url?: string;
  };
  inventory: InventoryItem[];
  weightSystemEnabled: boolean;
  onSlotClick: (slot: EquipmentSlot) => void;
  onItemClick: (item: InventoryItem) => void;
  onRefreshCharacter: () => void;
}

const EQUIPMENT_SLOTS: { slot: EquipmentSlot; label: string; emoji: string; gridArea: string }[] = [
  { slot: 'eyewear', label: 'Eyewear', emoji: '👓', gridArea: 'eyewear' },
  { slot: 'head', label: 'Head', emoji: '🎩', gridArea: 'head' },
  { slot: 'gloves', label: 'Gloves', emoji: '🧤', gridArea: 'gloves' },
  { slot: 'chest', label: 'Chest', emoji: '🛡️', gridArea: 'chest' },
  { slot: 'accessory_1', label: 'Accessory 1', emoji: '💍', gridArea: 'acc1' },
  { slot: 'accessory_2', label: 'Accessory 2', emoji: '💍', gridArea: 'acc2' },
  { slot: 'legs', label: 'Legs', emoji: '👖', gridArea: 'legs' },
  { slot: 'shoes', label: 'Shoes', emoji: '👟', gridArea: 'shoes' },
  { slot: 'weapon_primary', label: 'Primary', emoji: '⚔️', gridArea: 'wpn1' },
  { slot: 'weapon_secondary', label: 'Secondary', emoji: '🗡️', gridArea: 'wpn2' },
];

export default function EquipmentPanel({ character, inventory, weightSystemEnabled, onSlotClick, onItemClick, onRefreshCharacter }: EquipmentPanelProps) {
  const [uploading, setUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [portraitUrlInput, setPortraitUrlInput] = useState('');

  const getEquippedInSlot = (slot: EquipmentSlot): InventoryItem | undefined => {
    return inventory.find(inv => inv.is_equipped && inv.equipped_slot === slot);
  };

  const handlePortraitUpload = async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${character.id}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from('character-portraits')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('character-portraits')
        .getPublicUrl(path);

      await supabase.from('characters').update({ portrait_url: publicUrl }).eq('id', character.id);
      onRefreshCharacter();
    } catch (err: any) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleUrlSubmit = async () => {
    if (!portraitUrlInput.trim()) return;
    try {
      await supabase.from('characters').update({ portrait_url: portraitUrlInput.trim() }).eq('id', character.id);
      onRefreshCharacter();
      setShowUrlInput(false);
      setPortraitUrlInput('');
    } catch (err: any) {
      alert('Failed to set portrait: ' + err.message);
    }
  };

  // Weight calculation
  const totalWeight = inventory.reduce((sum, inv) => sum + (inv.item?.weight || 0) * inv.quantity, 0);
  const baseCapacity = (character as any)?.carrying_capacity || (character as any)?.base_carrying_capacity || 100;
  const backpackBonus = inventory
    .filter(inv => inv.is_equipped && inv.item?.slot_type === 'backpack')
    .reduce((sum) => sum + 50, 0);
  const totalCapacity = baseCapacity + backpackBonus;
  const weightPct = Math.min(100, (totalWeight / totalCapacity) * 100);
  const overencumbered = totalWeight > totalCapacity;

  return (
    <div className="h-full flex flex-col items-center justify-center p-4">
      {/* Equipment Grid around Portrait */}
      <div
        className="relative w-full max-w-md"
        style={{
          display: 'grid',
          gridTemplateColumns: '60px 60px 1fr 60px 60px',
          gridTemplateRows: 'auto auto auto auto auto auto',
          gridTemplateAreas: `
            ".       .       eyewear .       .      "
            ".       head    head    acc1    wpn1   "
            "gloves  portrait portrait acc2   wpn2   "
            ".       chest   chest   .       .      "
            ".       legs    legs    .       .      "
            "shoes   shoes   .       .       .      "
          `,
          gap: '6px',
          alignItems: 'center',
          justifyItems: 'center'
        }}
      >
        {/* Portrait */}
        <div
          className="rounded-lg overflow-hidden relative group cursor-pointer"
          style={{
            gridArea: 'portrait',
            width: '100%',
            aspectRatio: '3/4',
            maxHeight: '280px',
            border: '2px solid var(--color-cyber-cyan)',
            background: 'color-mix(in srgb, var(--color-cyber-cyan) 5%, transparent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          onClick={() => setShowUrlInput(!showUrlInput)}
        >
          {character.portrait_url ? (
            <img
              src={character.portrait_url}
              alt={character.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-center p-4">
              <div className="text-5xl mb-2 opacity-30">👤</div>
              <div className="text-[10px] opacity-50" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                Click to set portrait
              </div>
            </div>
          )}
          {/* Upload overlay on hover */}
          <div
            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: 'rgba(0,0,0,0.6)' }}
          >
            <label className="cursor-pointer text-center">
              <div className="text-xs px-3 py-2 rounded" style={{
                background: 'var(--color-cyber-cyan)', color: 'black', fontFamily: 'var(--font-mono)'
              }}>
                {uploading ? '⏳ Uploading...' : '📷 Upload'}
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePortraitUpload(file);
                }}
                disabled={uploading}
              />
            </label>
          </div>
        </div>

        {/* Equipment Slots */}
        {EQUIPMENT_SLOTS.map(({ slot, label, emoji, gridArea }) => {
          const equipped = getEquippedInSlot(slot);
          return (
            <div
              key={slot}
              onClick={() => {
                if (equipped) {
                  onItemClick(equipped);
                } else {
                  onSlotClick(slot);
                }
              }}
              className="cursor-pointer transition-all hover:scale-110"
              style={{
                gridArea,
                width: '54px',
                height: '54px',
                border: `2px ${equipped ? 'solid' : 'dashed'} ${equipped ? getRarityColor(equipped.item?.rarity || 'Common') : 'color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)'}`,
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: equipped ? 'color-mix(in srgb, var(--color-cyber-cyan) 10%, transparent)' : 'transparent',
                position: 'relative'
              }}
              title={equipped ? `${label}: ${equipped.item?.name}` : `${label} (Empty)`}
            >
              {equipped ? (
                <>
                  <span className="text-lg">{getItemTypeIcon(equipped.item?.type || 'item')}</span>
                  <span className="text-[7px] truncate w-full text-center px-0.5" style={{
                    color: getRarityColor(equipped.item?.rarity || 'Common'), fontFamily: 'var(--font-mono)'
                  }}>
                    {equipped.item?.name?.split(' ').slice(0, 2).join(' ')}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-sm opacity-30">{emoji}</span>
                  <span className="text-[7px] opacity-40" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                    {label}
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* URL Input (toggleable) */}
      {showUrlInput && (
        <div className="mt-3 w-full max-w-md p-3 rounded" style={{ border: '1px solid var(--color-cyber-cyan)', background: 'var(--color-cyber-darker)' }}>
          <div className="text-xs mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
            Paste portrait URL:
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={portraitUrlInput}
              onChange={(e) => setPortraitUrlInput(e.target.value)}
              placeholder="https://..."
              className="flex-1 px-2 py-1 rounded text-sm"
              style={{ background: 'var(--color-cyber-dark)', border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}
            />
            <button onClick={handleUrlSubmit} className="px-3 py-1 rounded text-xs font-bold" style={{ background: 'var(--color-cyber-cyan)', color: 'black' }}>
              SET
            </button>
          </div>
        </div>
      )}

      {/* Equipment slot summary */}
      <div className="mt-3 w-full max-w-md flex justify-center gap-4">
        <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
          🛡️ {inventory.filter(inv => inv.is_equipped && inv.item?.type === 'armor').length}/1 Armor
        </div>
        <div className="text-xs" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
          ⚔️ {inventory.filter(inv => inv.is_equipped && inv.item?.type === 'weapon').length}/3 Weapons
        </div>
      </div>

      {/* Weight Bar */}
      {weightSystemEnabled && (
        <div className="mt-3 w-full max-w-md p-2 rounded" style={{
          border: `1px solid ${overencumbered ? 'var(--color-cyber-magenta)' : 'var(--color-cyber-cyan)'}`,
          background: 'color-mix(in srgb, var(--color-cyber-cyan) 5%, transparent)'
        }}>
          <div className="flex justify-between text-xs mb-1" style={{
            color: overencumbered ? 'var(--color-cyber-magenta)' : 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)'
          }}>
            <span>⚖️ {totalWeight.toFixed(1)} / {totalCapacity.toFixed(0)} lbs</span>
            {overencumbered && <span className="font-bold animate-pulse">⚠️ OVERENCUMBERED</span>}
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-cyber-darker)' }}>
            <div className="h-full rounded-full transition-all" style={{
              width: `${weightPct}%`,
              background: overencumbered ? 'var(--color-cyber-magenta)' : weightPct > 80 ? 'var(--color-cyber-yellow)' : 'var(--color-cyber-green)'
            }} />
          </div>
        </div>
      )}
    </div>
  );
}
