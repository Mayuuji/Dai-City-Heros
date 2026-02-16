import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface GameEffect {
  id: string;
  effect_type: 'blackout' | 'flash' | 'glitch' | 'media' | 'clear';
  target_type: 'all' | 'select';
  target_character_ids: string[];
  display_mode: 'fullscreen' | 'popup';
  media_url: string | null;
  media_type: 'image' | 'video' | null;
  flash_interval_ms: number;
  flash_duration_s: number;
  is_active: boolean;
}

interface ItemNotification {
  id: string;
  itemName: string;
  quantity: number;
  action: 'added' | 'removed';
  timestamp: number;
}

interface HpChangeEffect {
  id: string;
  amount: number; // negative = damage, positive = heal
  timestamp: number;
}

interface PlayerEffectsOverlayProps {
  characterId: string | null;
}

export default function PlayerEffectsOverlay({ characterId }: PlayerEffectsOverlayProps) {
  // Active screen effects
  const [activeEffects, setActiveEffects] = useState<GameEffect[]>([]);
  
  // Item notifications
  const [itemNotifications, setItemNotifications] = useState<ItemNotification[]>([]);
  
  // HP change effects
  const [hpChangeEffects, setHpChangeEffects] = useState<HpChangeEffect[]>([]);
  
  // Flash state
  const [flashVisible, setFlashVisible] = useState(false);
  const flashTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flashEndRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Track previous HP for change detection
  const prevHpRef = useRef<number | null>(null);
  
  // Track previous inventory for item notifications
  const prevInventoryRef = useRef<Map<string, { name: string; quantity: number }>>(new Map());

  // Random flash offset per user (so flashes aren't synchronized)
  const flashOffsetRef = useRef(Math.random() * 500);

  // Subscribe to game_effects table changes
  useEffect(() => {
    if (!characterId) return;

    // Fetch current active effects
    const fetchActiveEffects = async () => {
      const { data } = await supabase
        .from('game_effects')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (data) {
        const relevant = data.filter((e: GameEffect) => 
          e.target_type === 'all' || e.target_character_ids.includes(characterId)
        );
        setActiveEffects(relevant);
      }
    };

    fetchActiveEffects();

    const channel = supabase
      .channel(`game-effects-${characterId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'game_effects'
      }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const effect = payload.new as GameEffect;
          if (effect.is_active && (effect.target_type === 'all' || effect.target_character_ids.includes(characterId))) {
            if (effect.effect_type === 'clear') {
              setActiveEffects([]);
            } else {
              setActiveEffects(prev => {
                const filtered = prev.filter(e => e.id !== effect.id);
                return [...filtered, effect];
              });
            }
          } else {
            // Effect no longer targets this player or is inactive
            setActiveEffects(prev => prev.filter(e => e.id !== effect.id));
          }
        } else if (payload.eventType === 'DELETE') {
          const oldEffect = payload.old as { id: string };
          setActiveEffects(prev => prev.filter(e => e.id !== oldEffect.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [characterId]);

  // Flash effect logic with random offset
  useEffect(() => {
    const flashEffect = activeEffects.find(e => e.effect_type === 'flash');
    
    if (flashEffect) {
      const interval = flashEffect.flash_interval_ms || 200;
      const offset = flashOffsetRef.current;
      
      // Add random jitter to each flash cycle (±30% of interval)
      const startFlashing = () => {
        const jitter = interval * 0.3 * (Math.random() * 2 - 1);
        const actualInterval = Math.max(50, interval + jitter + offset * 0.1);
        
        flashTimerRef.current = setInterval(() => {
          setFlashVisible(prev => !prev);
        }, actualInterval);
      };

      // Delay start by random offset
      setTimeout(startFlashing, offset);

      // Auto-end after duration
      if (flashEffect.flash_duration_s > 0) {
        flashEndRef.current = setTimeout(() => {
          if (flashTimerRef.current) clearInterval(flashTimerRef.current);
          setFlashVisible(false);
        }, flashEffect.flash_duration_s * 1000);
      }

      return () => {
        if (flashTimerRef.current) clearInterval(flashTimerRef.current);
        if (flashEndRef.current) clearTimeout(flashEndRef.current);
        setFlashVisible(false);
      };
    } else {
      if (flashTimerRef.current) clearInterval(flashTimerRef.current);
      setFlashVisible(false);
    }
  }, [activeEffects]);

  // HP change detection via realtime character updates
  useEffect(() => {
    if (!characterId) return;

    const hpChannel = supabase
      .channel(`hp-effects-${characterId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'characters',
        filter: `id=eq.${characterId}`
      }, (payload) => {
        const newHp = (payload.new as any).current_hp;
        const oldHp = prevHpRef.current;
        
        if (oldHp !== null && newHp !== oldHp) {
          const diff = newHp - oldHp;
          const effectId = `hp_${Date.now()}_${Math.random()}`;
          setHpChangeEffects(prev => [...prev, { id: effectId, amount: diff, timestamp: Date.now() }]);
          
          // Auto-remove after animation
          setTimeout(() => {
            setHpChangeEffects(prev => prev.filter(e => e.id !== effectId));
          }, 2000);
        }
        prevHpRef.current = newHp;
      })
      .subscribe();

    // Initialize prevHp
    const initHp = async () => {
      const { data } = await supabase
        .from('characters')
        .select('current_hp')
        .eq('id', characterId)
        .single();
      if (data) prevHpRef.current = data.current_hp;
    };
    initHp();

    return () => {
      supabase.removeChannel(hpChannel);
    };
  }, [characterId]);

  // Inventory change detection for item notifications
  useEffect(() => {
    if (!characterId) return;

    const fetchCurrentInventory = async () => {
      const { data } = await supabase
        .from('inventory')
        .select('id, quantity, item:items(name)')
        .eq('character_id', characterId);
      
      const newMap = new Map<string, { name: string; quantity: number }>();
      data?.forEach((inv: any) => {
        newMap.set(inv.id, { name: inv.item?.name || 'Unknown Item', quantity: inv.quantity });
      });
      
      // Compare with previous
      if (prevInventoryRef.current.size > 0) {
        // Check for new items or increased quantities
        newMap.forEach((newItem, id) => {
          const oldItem = prevInventoryRef.current.get(id);
          if (!oldItem) {
            // New item
            addItemNotification(newItem.name, newItem.quantity, 'added');
          } else if (newItem.quantity > oldItem.quantity) {
            addItemNotification(newItem.name, newItem.quantity - oldItem.quantity, 'added');
          }
        });
        // Check for removed items or decreased quantities
        prevInventoryRef.current.forEach((oldItem, id) => {
          const newItem = newMap.get(id);
          if (!newItem) {
            addItemNotification(oldItem.name, oldItem.quantity, 'removed');
          } else if (newItem.quantity < oldItem.quantity) {
            addItemNotification(oldItem.name, oldItem.quantity - newItem.quantity, 'removed');
          }
        });
      }
      
      prevInventoryRef.current = newMap;
    };

    // Initial fetch
    fetchCurrentInventory();

    const invChannel = supabase
      .channel(`inv-effects-${characterId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'inventory',
        filter: `character_id=eq.${characterId}`
      }, () => {
        fetchCurrentInventory();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(invChannel);
    };
  }, [characterId]);

  const addItemNotification = useCallback((itemName: string, quantity: number, action: 'added' | 'removed') => {
    const id = `item_${Date.now()}_${Math.random()}`;
    const notification: ItemNotification = { id, itemName, quantity, action, timestamp: Date.now() };
    setItemNotifications(prev => [...prev, notification]);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      setItemNotifications(prev => prev.filter(n => n.id !== id));
    }, 10000);
  }, []);

  // Auto-cleanup old notifications
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setItemNotifications(prev => prev.filter(n => now - n.timestamp < 10000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const hasBlackout = activeEffects.some(e => e.effect_type === 'blackout');
  const hasGlitch = activeEffects.some(e => e.effect_type === 'glitch');
  const mediaEffect = activeEffects.find(e => e.effect_type === 'media');

  return (
    <>
      {/* BLACKOUT OVERLAY */}
      {hasBlackout && (
        <div className="effect-blackout" style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: '#000', pointerEvents: 'all'
        }} />
      )}

      {/* FLASH OVERLAY */}
      {flashVisible && (
        <div className="effect-flash" style={{
          position: 'fixed', inset: 0, zIndex: 99998,
          background: '#000', pointerEvents: 'none',
          animation: 'flashIn 0.05s ease-in'
        }} />
      )}

      {/* GLITCH OVERLAY */}
      {hasGlitch && (
        <div className="effect-glitch-overlay" style={{
          position: 'fixed', inset: 0, zIndex: 99997,
          pointerEvents: 'none', overflow: 'hidden'
        }}>
          <div className="glitch-scanlines" />
          <div className="glitch-noise" />
          <div className="glitch-shift" />
        </div>
      )}

      {/* MEDIA PROJECTION - FULLSCREEN */}
      {mediaEffect && mediaEffect.display_mode === 'fullscreen' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99996,
          background: 'rgba(0,0,0,0.95)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'all'
        }}>
          {mediaEffect.media_type === 'video' ? (
            <video
              src={mediaEffect.media_url || ''}
              autoPlay
              loop
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            />
          ) : (
            <img
              src={mediaEffect.media_url || ''}
              alt="DM Projection"
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            />
          )}
        </div>
      )}

      {/* MEDIA PROJECTION - POPUP */}
      {mediaEffect && mediaEffect.display_mode === 'popup' && (
        <div style={{
          position: 'fixed',
          top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          zIndex: 99996,
          maxWidth: '80vw', maxHeight: '80vh',
          borderRadius: '12px', overflow: 'hidden',
          border: '2px solid var(--color-cyber-cyan)',
          boxShadow: '0 0 40px rgba(0, 255, 255, 0.3), 0 0 80px rgba(0, 255, 255, 0.1)',
          pointerEvents: 'all',
          background: '#000'
        }}>
          <div style={{
            padding: '8px 16px',
            background: 'var(--color-cyber-darker)',
            borderBottom: '1px solid var(--color-cyber-cyan)',
            fontFamily: 'var(--font-cyber)',
            color: 'var(--color-cyber-cyan)',
            fontSize: '12px',
            textAlign: 'center'
          }}>
            ⚡ DM BROADCAST
          </div>
          {mediaEffect.media_type === 'video' ? (
            <video
              src={mediaEffect.media_url || ''}
              autoPlay
              loop
              style={{ maxWidth: '80vw', maxHeight: 'calc(80vh - 40px)', display: 'block' }}
            />
          ) : (
            <img
              src={mediaEffect.media_url || ''}
              alt="DM Projection"
              style={{ maxWidth: '80vw', maxHeight: 'calc(80vh - 40px)', display: 'block' }}
            />
          )}
        </div>
      )}

      {/* HP CHANGE EFFECTS */}
      {hpChangeEffects.map(effect => (
        <div key={effect.id}>
          {/* Full-screen color flash */}
          <div style={{
            position: 'fixed', inset: 0, zIndex: 99990,
            background: effect.amount < 0
              ? 'rgba(255, 0, 0, 0.25)'
              : 'rgba(0, 255, 0, 0.2)',
            pointerEvents: 'none',
            animation: 'hpFlash 2s ease-out forwards'
          }} />
          {/* Damage/Heal number */}
          <div style={{
            position: 'fixed',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 99991,
            pointerEvents: 'none',
            animation: 'hpNumber 2s ease-out forwards'
          }}>
            <span style={{
              fontSize: 'clamp(48px, 10vw, 96px)',
              fontWeight: 'bold',
              fontFamily: 'var(--font-cyber)',
              color: effect.amount < 0 ? '#ff3333' : '#33ff33',
              textShadow: effect.amount < 0
                ? '0 0 20px rgba(255,0,0,0.8), 0 0 40px rgba(255,0,0,0.5), 0 0 60px rgba(255,0,0,0.3)'
                : '0 0 20px rgba(0,255,0,0.8), 0 0 40px rgba(0,255,0,0.5), 0 0 60px rgba(0,255,0,0.3)',
              WebkitTextStroke: '2px rgba(0,0,0,0.5)'
            }}>
              {effect.amount > 0 ? '+' : ''}{effect.amount} HP
            </span>
          </div>
        </div>
      ))}

      {/* ITEM NOTIFICATIONS - Bottom Left */}
      <div style={{
        position: 'fixed',
        bottom: '20px', left: '20px',
        zIndex: 99980,
        display: 'flex', flexDirection: 'column-reverse',
        gap: '8px', maxWidth: '350px',
        pointerEvents: 'none'
      }}>
        {itemNotifications.map(notification => (
          <div
            key={notification.id}
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              background: 'rgba(13, 17, 23, 0.95)',
              border: `1px solid ${notification.action === 'added' ? 'var(--color-cyber-green)' : 'var(--color-cyber-magenta)'}`,
              boxShadow: notification.action === 'added'
                ? '0 0 15px rgba(0, 255, 100, 0.2)'
                : '0 0 15px rgba(255, 0, 100, 0.2)',
              animation: 'itemSlideIn 0.3s ease-out, itemFadeOut 0.5s ease-in 9.5s forwards',
              fontFamily: 'var(--font-mono)',
              pointerEvents: 'auto'
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px'
            }}>
              <span style={{ fontSize: '18px' }}>
                {notification.action === 'added' ? '📦' : '❌'}
              </span>
              <div>
                <div style={{
                  color: notification.action === 'added' ? 'var(--color-cyber-green)' : 'var(--color-cyber-magenta)',
                  fontSize: '12px', fontWeight: 'bold'
                }}>
                  {notification.action === 'added' ? 'ITEM RECEIVED' : 'ITEM REMOVED'}
                </div>
                <div style={{
                  color: 'var(--color-cyber-cyan)', fontSize: '14px'
                }}>
                  {notification.itemName} {notification.quantity > 1 ? `x${notification.quantity}` : ''}
                </div>
              </div>
            </div>
            {/* Progress bar showing time remaining */}
            <div style={{
              marginTop: '8px', height: '2px', borderRadius: '1px',
              background: 'color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%', borderRadius: '1px',
                background: notification.action === 'added' ? 'var(--color-cyber-green)' : 'var(--color-cyber-magenta)',
                animation: 'notifTimer 10s linear forwards'
              }} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
