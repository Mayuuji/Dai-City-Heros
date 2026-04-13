import type { Ability, InventoryItem } from '../../types/inventory';
import { getAbilityCooldownText, getRarityColor, getItemTypeIcon, formatWeaponToHit, formatWeaponDamage } from '../../utils/stats';
import { formatToHit } from '../../data/characterClasses';

interface Character {
  [key: string]: any;
}

interface AbilitiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  abilities: Ability[];
  equippedGear: InventoryItem[];
  character: Character;
}

export default function AbilitiesModal({ isOpen, onClose, abilities, equippedGear, character }: AbilitiesModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50">
      <div
        className="w-full sm:max-w-2xl max-h-[85vh] rounded-t-xl sm:rounded-xl overflow-hidden flex flex-col"
        style={{ background: 'var(--color-dark-bg)', border: '2px solid var(--color-cyber-cyan)', boxShadow: '0 0 40px rgba(0, 255, 255, 0.15)' }}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4" style={{ borderBottom: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)' }}>
          <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>⚡ ABILITIES</h3>
          <button onClick={onClose} className="text-xl px-2" style={{ color: 'var(--color-cyber-magenta)' }}>✕</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6" style={{ scrollbarWidth: 'thin' }}>
          {/* Abilities List */}
          {abilities.length === 0 ? (
            <div className="text-center py-8" style={{ border: '2px dashed color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)', borderRadius: '8px' }}>
              <p className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>No abilities available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {abilities.map(ability => (
                <div key={ability.id} className="p-3 rounded" style={{ border: '1px solid var(--color-cyber-green)', background: 'color-mix(in srgb, var(--color-cyber-cyan) 5%, transparent)' }}>
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex-1">
                      <div className="font-bold text-sm" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-cyber)' }}>{ability.name}</div>
                      <div className="text-[10px] flex items-center gap-1 flex-wrap" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                        <span>{ability.type.toUpperCase().replace('_', ' ')}</span>
                        {ability.source === 'class' && (
                          <span className="px-1.5 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-green) 20%, transparent)', color: 'var(--color-cyber-cyan)' }}>🎓 CLASS</span>
                        )}
                        {ability.source === 'item' && (
                          <span className="px-1.5 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-green) 20%, transparent)', color: 'var(--color-cyber-cyan)' }}>📦 {ability.item_name}</span>
                        )}
                      </div>
                    </div>
                    {ability.charge_type !== 'infinite' && (
                      <div className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-cyber-cyan)', color: 'black', fontFamily: 'var(--font-mono)' }}>
                        {ability.current_charges || 0}/{ability.max_charges || 0}
                      </div>
                    )}
                  </div>
                  {(() => {
                    const cooldownText = getAbilityCooldownText(ability, ability.current_charges || 0);
                    return cooldownText ? (
                      <div className="text-[10px] px-1.5 py-0.5 mb-1 rounded" style={{
                        background: (ability.current_charges || 0) <= 0 ? 'color-mix(in srgb, var(--color-cyber-magenta) 20%, transparent)' : 'color-mix(in srgb, var(--color-cyber-yellow) 15%, transparent)',
                        color: (ability.current_charges || 0) <= 0 ? 'var(--color-cyber-magenta)' : 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)'
                      }}>{cooldownText}</div>
                    ) : null;
                  })()}
                  <p className="text-[11px] mb-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.8 }}>{ability.description}</p>
                  {(ability.damage_dice || ability.range_feet) && (
                    <div className="flex flex-wrap gap-1">
                      {ability.damage_dice && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-green) 20%, transparent)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>🎲 {ability.damage_dice}</span>
                      )}
                      {ability.range_feet && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-green) 20%, transparent)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>📏 {ability.range_feet}ft</span>
                      )}
                    </div>
                  )}
                  {ability.effects && ability.effects.length > 0 && (
                    <div className="mt-1.5 pt-1.5" style={{ borderTop: '1px solid color-mix(in srgb, var(--color-cyber-green) 20%, transparent)' }}>
                      <div className="text-[10px]" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>EFFECTS:</div>
                      {ability.effects.map((effect: string, i: number) => (
                        <div key={i} className="text-[10px]" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.8 }}>• {effect}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Equipped Gear Section */}
          {equippedGear.length > 0 && (
            <div>
              <h4 className="text-sm font-bold mb-3" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>🔧 EQUIPPED GEAR</h4>
              <div className="space-y-3">
                {equippedGear.map(inv => {
                  const item = inv.item!;
                  const isWeapon = item.type === 'weapon';
                  const weaponType = item.weapon_subtype?.toLowerCase() || '';
                  const rankKey = isWeapon ? `weapon_rank_${weaponType}` : null;
                  const rank = rankKey ? (character[rankKey] as number) ?? 0 : 0;
                  const isProficient = rank > 0;

                  const statMods: { label: string; icon: string; value: number }[] = [];
                  if (item.ac_mod !== 0) statMods.push({ label: 'AC', icon: '🛡️', value: item.ac_mod });
                  if (item.hp_mod !== 0) statMods.push({ label: 'HP', icon: '❤️', value: item.hp_mod });
                  if (item.str_mod !== 0) statMods.push({ label: 'STR', icon: '💪', value: item.str_mod });
                  if (item.dex_mod !== 0) statMods.push({ label: 'DEX', icon: '🎯', value: item.dex_mod });
                  if (item.con_mod !== 0) statMods.push({ label: 'CON', icon: '🫀', value: item.con_mod });
                  if (item.wis_mod !== 0) statMods.push({ label: 'WIS', icon: '👁️', value: item.wis_mod });
                  if (item.int_mod !== 0) statMods.push({ label: 'INT', icon: '🧠', value: item.int_mod });
                  if (item.cha_mod !== 0) statMods.push({ label: 'CHA', icon: '✨', value: item.cha_mod });
                  if (item.speed_mod !== 0) statMods.push({ label: 'SPD', icon: '👟', value: item.speed_mod });
                  if (item.init_mod !== 0) statMods.push({ label: 'INIT', icon: '⚡', value: item.init_mod });

                  return (
                    <div key={inv.id} className="p-3 rounded" style={{ border: `1px solid ${getRarityColor(item.rarity)}`, background: 'color-mix(in srgb, var(--color-cyber-cyan) 5%, transparent)' }}>
                      <div className="flex items-start gap-2 mb-2">
                        <span className="text-2xl">{getItemTypeIcon(item.type)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm" style={{ color: getRarityColor(item.rarity), fontFamily: 'var(--font-cyber)' }}>{item.name}</div>
                          <div className="text-[10px]" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                            {item.type}{item.weapon_subtype ? ` • ${item.weapon_subtype}` : ''}{item.armor_subtype ? ` • ${item.armor_subtype}` : ''} • {item.rarity}
                          </div>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: 'var(--color-cyber-green)', color: 'white' }}>EQUIPPED</span>
                      </div>
                      {item.description && <p className="text-[11px] mb-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.85 }}>{item.description}</p>}
                      {isWeapon && (
                        <div className="mb-2 flex flex-wrap gap-1">
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
                      {statMods.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {statMods.map(mod => (
                            <span key={mod.label} className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{
                              background: 'color-mix(in srgb, var(--color-cyber-green) 20%, transparent)',
                              color: mod.value > 0 ? 'var(--color-cyber-green)' : 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)'
                            }}>
                              {mod.icon} {mod.label} {mod.value > 0 ? '+' : ''}{mod.value}
                            </span>
                          ))}
                        </div>
                      )}
                      {item.abilities && item.abilities.length > 0 && (
                        <div className="pt-2" style={{ borderTop: '1px solid color-mix(in srgb, var(--color-cyber-green) 20%, transparent)' }}>
                          <div className="text-[10px] font-bold mb-1" style={{ color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>GRANTS:</div>
                          <div className="flex flex-wrap gap-1">
                            {item.abilities.map((ia: any, i: number) => ia.ability && (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: 'color-mix(in srgb, var(--color-cyber-magenta) 15%, transparent)', color: 'var(--color-cyber-magenta)', fontFamily: 'var(--font-mono)' }}>
                                ⚡ {ia.ability.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
