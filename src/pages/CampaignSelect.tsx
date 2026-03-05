import { useState, useEffect } from 'react';
import { useCampaign, THEME_PRESETS } from '../contexts/CampaignContext';
import { useAuth } from '../contexts/AuthContext';

// Shared style constants matching Landing/Login pages
const gold = 'rgba(200, 170, 110,';
const silver = 'rgba(160, 180, 220,';
const bg = 'linear-gradient(160deg, #0f0f14 0%, #1a1a2e 40%, #16213e 70%, #0f0f14 100%)';
const fontSerif = "'Georgia', 'Times New Roman', serif";
const fontSans = "'Segoe UI', sans-serif";

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  borderRadius: '6px',
  border: `1px solid ${gold}0.2)`,
  background: 'rgba(255, 255, 255, 0.04)',
  color: '#e8dcc8',
  fontFamily: fontSans,
  fontSize: '14px',
  outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s'
};

export default function CampaignSelect() {
  const { user } = useAuth();
  const { campaigns, campaignsLoading, selectCampaign, createCampaign, joinCampaign, refreshCampaigns } = useCampaign();
  const { signOut } = useAuth();

  const [mode, setMode] = useState<'list' | 'create' | 'join'>('list');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('cyberpunk');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    setTimeout(() => setShowContent(true), 100);
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) {
      setError('Campaign name is required');
      return;
    }
    setLoading(true);
    setError('');

    const campaign = await createCampaign(newName.trim(), newDescription.trim() || undefined);
    if (campaign) {
      const preset = THEME_PRESETS[selectedPreset];
      if (preset && campaign.theme_id) {
        const { supabase } = await import('../lib/supabase');
        await supabase
          .from('campaign_themes')
          .update(preset)
          .eq('id', campaign.theme_id);
      }
      await refreshCampaigns();
      await selectCampaign(campaign.id);
    }
    setLoading(false);
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) {
      setError('Invite code is required');
      return;
    }
    setLoading(true);
    setError('');

    const result = await joinCampaign(inviteCode.trim());
    if (!result.success) {
      setError(result.error || 'Failed to join campaign');
    }
    setLoading(false);
  };

  if (campaignsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: bg }}>
        <div className="p-8 text-center rounded-xl" style={{
          background: 'rgba(15, 15, 20, 0.7)',
          border: `1px solid ${gold}0.12)`,
          backdropFilter: 'blur(20px)'
        }}>
          <div className="animate-spin w-10 h-10 border-2 rounded-full mx-auto mb-4"
            style={{ borderColor: `${gold}0.15)`, borderTopColor: `${gold}0.7)` }} />
          <p style={{ color: `${silver}0.6)`, fontFamily: fontSans, fontSize: '14px' }}>Loading campaigns...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: bg }}>
      {/* Subtle grid */}
      <div className="absolute inset-0" style={{
        opacity: 0.06,
        backgroundImage: `linear-gradient(${gold}0.3) 1px, transparent 1px), linear-gradient(90deg, ${gold}0.3) 1px, transparent 1px)`,
        backgroundSize: '60px 60px'
      }} />

      {/* Ambient glows */}
      <div className="absolute rounded-full blur-3xl" style={{
        width: '400px', height: '400px',
        background: `radial-gradient(circle, ${gold}0.06) 0%, transparent 70%)`,
        top: '10%', left: '10%'
      }} />
      <div className="absolute rounded-full blur-3xl" style={{
        width: '400px', height: '400px',
        background: `radial-gradient(circle, ${silver}0.04) 0%, transparent 70%)`,
        bottom: '10%', right: '10%'
      }} />

      {/* Main content */}
      <div className="relative z-10 w-full max-w-lg" style={{
        opacity: showContent ? 1 : 0,
        transform: showContent ? 'translateY(0)' : 'translateY(20px)',
        transition: 'all 0.8s ease-out'
      }}>
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-4" style={{ filter: 'drop-shadow(0 0 12px rgba(200, 170, 110, 0.2))' }}>🏰</div>
          <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: fontSerif, color: '#e8dcc8', letterSpacing: '0.02em' }}>
            Your Campaigns
          </h1>
          <p className="text-sm" style={{ fontFamily: fontSans, color: `${silver}0.5)` }}>
            Select, create, or join a campaign
          </p>
        </div>

        {/* Mode Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { id: 'list' as const, label: 'MY CAMPAIGNS', icon: '📋' },
            { id: 'create' as const, label: 'CREATE', icon: '✨' },
            { id: 'join' as const, label: 'JOIN', icon: '🔗' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setMode(tab.id); setError(''); }}
              className="flex-1 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wider transition-all duration-200"
              style={{
                fontFamily: fontSans,
                background: mode === tab.id ? `${gold}0.15)` : 'transparent',
                color: mode === tab.id ? '#e8dcc8' : `${silver}0.5)`,
                border: `1px solid ${mode === tab.id ? `${gold}0.4)` : `${silver}0.15)`}`,
                letterSpacing: '0.1em'
              }}
              onMouseEnter={(e) => {
                if (mode !== tab.id) {
                  e.currentTarget.style.borderColor = `${silver}0.3)`;
                  e.currentTarget.style.color = `${silver}0.7)`;
                }
              }}
              onMouseLeave={(e) => {
                if (mode !== tab.id) {
                  e.currentTarget.style.borderColor = `${silver}0.15)`;
                  e.currentTarget.style.color = `${silver}0.5)`;
                }
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 rounded-lg text-sm" style={{
            background: 'rgba(200, 80, 80, 0.1)',
            border: '1px solid rgba(200, 80, 80, 0.3)',
            color: '#d48a8a',
            fontFamily: fontSans
          }}>
            {error}
          </div>
        )}

        {/* ── Campaign List ── */}
        {mode === 'list' && (
          <div className="space-y-3">
            {campaigns.length === 0 ? (
              <div className="p-8 text-center rounded-xl" style={{
                background: 'rgba(15, 15, 20, 0.7)',
                border: `1px solid ${gold}0.12)`,
                backdropFilter: 'blur(20px)'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🗺️</div>
                <p className="text-sm mb-5" style={{ color: `${silver}0.6)`, fontFamily: fontSans }}>
                  No campaigns yet. Create one or join with an invite code.
                </p>
                <div className="flex gap-3 justify-center">
                  <button onClick={() => setMode('create')}
                    className="px-5 py-2.5 rounded-lg font-semibold text-sm tracking-wider transition-all duration-200"
                    style={{ fontFamily: fontSans, background: `${gold}0.15)`, border: `1px solid ${gold}0.4)`, color: '#e8dcc8', letterSpacing: '0.1em' }}>
                    ✨ Create
                  </button>
                  <button onClick={() => setMode('join')}
                    className="px-5 py-2.5 rounded-lg text-sm tracking-wider transition-all duration-200"
                    style={{ fontFamily: fontSans, border: `1px solid ${silver}0.25)`, color: `${silver}0.7)`, background: 'transparent', letterSpacing: '0.1em' }}>
                    🔗 Join
                  </button>
                </div>
              </div>
            ) : (
              campaigns.map(c => (
                <button
                  key={c.id}
                  onClick={() => selectCampaign(c.id)}
                  className="w-full p-5 text-left rounded-xl transition-all duration-200"
                  style={{
                    cursor: 'pointer',
                    background: 'rgba(15, 15, 20, 0.5)',
                    border: `1px solid ${gold}0.1)`,
                    backdropFilter: 'blur(12px)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = `${gold}0.3)`;
                    e.currentTarget.style.background = 'rgba(15, 15, 20, 0.7)';
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = `${gold}0.1)`;
                    e.currentTarget.style.background = 'rgba(15, 15, 20, 0.5)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold mb-1" style={{ fontFamily: fontSerif, color: '#e8dcc8' }}>
                        {c.name}
                      </h3>
                      {c.description && (
                        <p className="text-xs mb-2" style={{ color: `${silver}0.5)`, fontFamily: fontSans }}>
                          {c.description}
                        </p>
                      )}
                      <div className="flex gap-2 mt-2">
                        {c.theme && (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{
                            background: `${gold}0.08)`, border: `1px solid ${gold}0.2)`, color: `${gold}0.7)`, fontFamily: fontSans
                          }}>
                            🎨 {c.theme.name}
                          </span>
                        )}
                        {c.owner_id === user?.id && (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{
                            background: 'rgba(200, 170, 110, 0.1)', border: '1px solid rgba(200, 170, 110, 0.25)', color: 'rgba(200, 170, 110, 0.8)', fontFamily: fontSans
                          }}>
                            👑 Owner
                          </span>
                        )}
                      </div>
                    </div>
                    <span style={{ color: `${gold}0.3)`, fontSize: '24px' }}>▸</span>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {/* ── Create Campaign ── */}
        {mode === 'create' && (
          <div className="rounded-xl p-6 space-y-5" style={{
            background: 'rgba(15, 15, 20, 0.7)',
            border: `1px solid ${gold}0.12)`,
            backdropFilter: 'blur(20px)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)'
          }}>
            <div>
              <label className="block text-xs mb-2 tracking-wider uppercase" style={{ color: `${gold}0.6)`, fontFamily: fontSans }}>
                Campaign Name *
              </label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. The Lost Kingdom" style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = `${gold}0.4)`; e.currentTarget.style.boxShadow = `0 0 0 3px ${gold}0.08)`; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = `${gold}0.2)`; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>

            <div>
              <label className="block text-xs mb-2 tracking-wider uppercase" style={{ color: `${gold}0.6)`, fontFamily: fontSans }}>
                Description
              </label>
              <textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)}
                placeholder="A brief description of your campaign..." rows={2}
                style={{ ...inputStyle, resize: 'none' as const }}
                onFocus={(e) => { e.currentTarget.style.borderColor = `${gold}0.4)`; e.currentTarget.style.boxShadow = `0 0 0 3px ${gold}0.08)`; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = `${gold}0.2)`; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>

            <div>
              <label className="block text-xs mb-3 tracking-wider uppercase" style={{ color: `${gold}0.6)`, fontFamily: fontSans }}>
                Theme Preset
              </label>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(THEME_PRESETS).map(([key, preset]) => (
                  <button key={key} onClick={() => setSelectedPreset(key)}
                    className="p-3 rounded-lg text-xs font-semibold text-center transition-all duration-200"
                    style={{
                      fontFamily: fontSans,
                      background: selectedPreset === key ? `${gold}0.15)` : 'rgba(255, 255, 255, 0.03)',
                      color: selectedPreset === key ? '#e8dcc8' : `${silver}0.5)`,
                      border: `1px solid ${selectedPreset === key ? `${gold}0.4)` : `${silver}0.1)`}`
                    }}>
                    <div className="flex gap-1 justify-center mb-1.5">
                      <span className="w-3 h-3 rounded-full inline-block" style={{ background: preset.color_primary }} />
                      <span className="w-3 h-3 rounded-full inline-block" style={{ background: preset.color_secondary }} />
                      <span className="w-3 h-3 rounded-full inline-block" style={{ background: preset.color_tertiary }} />
                    </div>
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={handleCreate} disabled={loading || !newName.trim()}
              className="w-full py-3 rounded-lg font-semibold text-sm tracking-wider transition-all duration-300"
              style={{
                fontFamily: fontSans,
                background: loading ? `${gold}0.1)` : `linear-gradient(135deg, ${gold}0.2) 0%, ${gold}0.1) 100%)`,
                border: `1px solid ${gold}0.4)`,
                color: loading ? `${gold}0.4)` : '#e8dcc8',
                cursor: loading ? 'not-allowed' : 'pointer',
                letterSpacing: '0.15em'
              }}
              onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.background = `${gold}0.25)`; e.currentTarget.style.boxShadow = `0 0 20px ${gold}0.1)`; } }}
              onMouseLeave={(e) => { if (!loading) { e.currentTarget.style.background = `linear-gradient(135deg, ${gold}0.2) 0%, ${gold}0.1) 100%)`; e.currentTarget.style.boxShadow = 'none'; } }}
            >
              {loading ? '⏳ CREATING...' : '✨ CREATE CAMPAIGN'}
            </button>
          </div>
        )}

        {/* ── Join Campaign ── */}
        {mode === 'join' && (
          <div className="rounded-xl p-6 space-y-5" style={{
            background: 'rgba(15, 15, 20, 0.7)',
            border: `1px solid ${gold}0.12)`,
            backdropFilter: 'blur(20px)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)'
          }}>
            <div>
              <label className="block text-xs mb-2 tracking-wider uppercase" style={{ color: `${gold}0.6)`, fontFamily: fontSans }}>
                Invite Code
              </label>
              <input type="text" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)}
                placeholder="Enter invite code..."
                style={{ ...inputStyle, letterSpacing: '3px', textAlign: 'center' as const, fontSize: '18px' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = `${gold}0.4)`; e.currentTarget.style.boxShadow = `0 0 0 3px ${gold}0.08)`; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = `${gold}0.2)`; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>

            <p className="text-xs" style={{ color: `${silver}0.4)`, fontFamily: fontSans }}>
              Ask your DM for the campaign invite code. You'll join as a player.
            </p>

            <button onClick={handleJoin} disabled={loading || !inviteCode.trim()}
              className="w-full py-3 rounded-lg font-semibold text-sm tracking-wider transition-all duration-300"
              style={{
                fontFamily: fontSans,
                background: loading ? `${gold}0.1)` : `linear-gradient(135deg, ${gold}0.2) 0%, ${gold}0.1) 100%)`,
                border: `1px solid ${gold}0.4)`,
                color: loading ? `${gold}0.4)` : '#e8dcc8',
                cursor: loading ? 'not-allowed' : 'pointer',
                letterSpacing: '0.15em'
              }}
              onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.background = `${gold}0.25)`; e.currentTarget.style.boxShadow = `0 0 20px ${gold}0.1)`; } }}
              onMouseLeave={(e) => { if (!loading) { e.currentTarget.style.background = `linear-gradient(135deg, ${gold}0.2) 0%, ${gold}0.1) 100%)`; e.currentTarget.style.boxShadow = 'none'; } }}
            >
              {loading ? '⏳ JOINING...' : '🔗 JOIN CAMPAIGN'}
            </button>
          </div>
        )}

        {/* Sign Out */}
        <div className="text-center mt-8">
          <button onClick={signOut}
            className="text-xs px-5 py-2 rounded-lg transition-all duration-200"
            style={{
              fontFamily: fontSans, color: 'rgba(200, 200, 200, 0.3)', border: '1px solid rgba(200, 200, 200, 0.1)',
              background: 'transparent', cursor: 'pointer', letterSpacing: '0.1em'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(200, 200, 200, 0.6)'; e.currentTarget.style.borderColor = 'rgba(200, 200, 200, 0.25)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(200, 200, 200, 0.3)'; e.currentTarget.style.borderColor = 'rgba(200, 200, 200, 0.1)'; }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
