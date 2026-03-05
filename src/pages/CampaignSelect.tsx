import { useState } from 'react';
import { useCampaign, THEME_PRESETS, DEFAULT_THEME, applyTheme } from '../contexts/CampaignContext';
import { useAuth } from '../contexts/AuthContext';

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

  // Preview theme on hover
  const previewTheme = (presetKey: string) => {
    const preset = THEME_PRESETS[presetKey];
    if (preset) {
      applyTheme({ ...DEFAULT_THEME, ...preset });
    }
  };

  const resetTheme = () => {
    applyTheme(DEFAULT_THEME);
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      setError('Campaign name is required');
      return;
    }
    setLoading(true);
    setError('');

    const campaign = await createCampaign(newName.trim(), newDescription.trim() || undefined);
    if (campaign) {
      // Apply preset theme if not default
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, var(--color-cyber-dark) 0%, var(--color-cyber-darker) 50%, var(--color-cyber-dark) 100%)', backgroundAttachment: 'fixed' }}>
        <div className="glass-panel p-8 text-center">
          <div className="animate-spin w-12 h-12 border-4 rounded-full mx-auto mb-4"
            style={{ borderColor: 'color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)', borderTopColor: 'var(--color-cyber-cyan)' }} />
          <p style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>Loading campaigns...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(180deg, var(--color-cyber-dark) 0%, var(--color-cyber-darker) 50%, var(--color-cyber-dark) 100%)', backgroundAttachment: 'fixed' }}>
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl mb-2" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
            CAMPAIGNS
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.6, fontFamily: 'var(--font-mono)' }}>
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
              className="flex-1 px-3 py-2 rounded text-xs font-bold"
              style={{
                background: mode === tab.id ? 'var(--color-cyber-cyan)' : 'transparent',
                color: mode === tab.id ? 'white' : 'var(--color-cyber-cyan)',
                border: '1px solid var(--color-cyber-cyan)',
                fontFamily: 'var(--font-mono)'
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 rounded text-sm" style={{ background: 'color-mix(in srgb, var(--color-cyber-red) 15%, transparent)', border: '1px solid var(--color-cyber-red)', color: 'var(--color-cyber-red)', fontFamily: 'var(--font-mono)' }}>
            {error}
          </div>
        )}

        {/* ── Campaign List ── */}
        {mode === 'list' && (
          <div className="space-y-3">
            {campaigns.length === 0 ? (
              <div className="glass-panel p-8 text-center">
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🗺️</div>
                <p className="text-sm mb-4" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                  No campaigns yet. Create one or join with an invite code.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setMode('create')}
                    className="px-4 py-2 rounded font-bold text-sm"
                    style={{ background: 'var(--color-cyber-cyan)', color: 'white' }}
                  >
                    ✨ Create Campaign
                  </button>
                  <button
                    onClick={() => setMode('join')}
                    className="px-4 py-2 rounded font-bold text-sm"
                    style={{ border: '1px solid var(--color-cyber-cyan)', color: 'var(--color-cyber-cyan)' }}
                  >
                    🔗 Join Campaign
                  </button>
                </div>
              </div>
            ) : (
              campaigns.map(c => (
                <button
                  key={c.id}
                  onClick={() => selectCampaign(c.id)}
                  className="w-full glass-panel p-4 text-left transition-all hover:scale-[1.01]"
                  style={{ cursor: 'pointer', border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 40%, transparent)' }}
                  onMouseEnter={() => c.theme && applyTheme({ ...DEFAULT_THEME, ...c.theme })}
                  onMouseLeave={resetTheme}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
                        {c.name}
                      </h3>
                      {c.description && (
                        <p className="text-xs mt-1" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>
                          {c.description}
                        </p>
                      )}
                      <div className="flex gap-3 mt-2">
                        {c.theme && (
                          <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-cyan) 15%, transparent)', color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                            🎨 {c.theme.name}
                          </span>
                        )}
                        {c.owner_id === user?.id && (
                          <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--color-cyber-yellow) 15%, transparent)', color: 'var(--color-cyber-yellow)', fontFamily: 'var(--font-mono)' }}>
                            👑 Owner
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-2xl" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5 }}>▸</span>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {/* ── Create Campaign ── */}
        {mode === 'create' && (
          <div className="glass-panel p-6 space-y-4" style={{ border: '1px solid var(--color-cyber-cyan)' }}>
            <div>
              <label className="text-xs block mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                CAMPAIGN NAME *
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Shadows of Neo-Tokyo"
                className="w-full px-3 py-2 rounded text-sm"
                style={{
                  background: 'var(--color-cyber-darker)',
                  border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)',
                  color: 'var(--color-cyber-cyan)',
                  fontFamily: 'var(--font-mono)'
                }}
              />
            </div>

            <div>
              <label className="text-xs block mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                DESCRIPTION
              </label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="A brief description of your campaign..."
                rows={2}
                className="w-full px-3 py-2 rounded text-sm resize-none"
                style={{
                  background: 'var(--color-cyber-darker)',
                  border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)',
                  color: 'var(--color-cyber-cyan)',
                  fontFamily: 'var(--font-mono)'
                }}
              />
            </div>

            <div>
              <label className="text-xs block mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                THEME PRESET
              </label>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(THEME_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedPreset(key)}
                    onMouseEnter={() => previewTheme(key)}
                    onMouseLeave={resetTheme}
                    className="p-2 rounded text-xs font-bold text-center"
                    style={{
                      background: selectedPreset === key ? 'var(--color-cyber-cyan)' : 'var(--color-cyber-darker)',
                      color: selectedPreset === key ? 'white' : 'var(--color-cyber-cyan)',
                      border: `1px solid ${selectedPreset === key ? 'var(--color-cyber-cyan)' : 'color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)'}`,
                      fontFamily: 'var(--font-mono)'
                    }}
                  >
                    <div className="flex gap-1 justify-center mb-1">
                      <span className="w-3 h-3 rounded-full inline-block" style={{ background: preset.color_primary }} />
                      <span className="w-3 h-3 rounded-full inline-block" style={{ background: preset.color_secondary }} />
                      <span className="w-3 h-3 rounded-full inline-block" style={{ background: preset.color_tertiary }} />
                    </div>
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={loading || !newName.trim()}
              className="w-full px-4 py-3 rounded font-bold text-sm"
              style={{
                background: loading ? 'color-mix(in srgb, var(--color-cyber-cyan) 50%, transparent)' : 'var(--color-cyber-cyan)',
                color: 'white',
                fontFamily: 'var(--font-mono)'
              }}
            >
              {loading ? '⏳ Creating...' : '✨ CREATE CAMPAIGN'}
            </button>
          </div>
        )}

        {/* ── Join Campaign ── */}
        {mode === 'join' && (
          <div className="glass-panel p-6 space-y-4" style={{ border: '1px solid var(--color-cyber-cyan)' }}>
            <div>
              <label className="text-xs block mb-1" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                INVITE CODE
              </label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="Enter invite code..."
                className="w-full px-3 py-2 rounded text-sm"
                style={{
                  background: 'var(--color-cyber-darker)',
                  border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)',
                  color: 'var(--color-cyber-cyan)',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '2px',
                  textAlign: 'center',
                  fontSize: '16px'
                }}
              />
            </div>

            <p className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>
              Ask your DM for the campaign invite code. You'll join as a player.
            </p>

            <button
              onClick={handleJoin}
              disabled={loading || !inviteCode.trim()}
              className="w-full px-4 py-3 rounded font-bold text-sm"
              style={{
                background: loading ? 'color-mix(in srgb, var(--color-cyber-cyan) 50%, transparent)' : 'var(--color-cyber-cyan)',
                color: 'white',
                fontFamily: 'var(--font-mono)'
              }}
            >
              {loading ? '⏳ Joining...' : '🔗 JOIN CAMPAIGN'}
            </button>
          </div>
        )}

        {/* Sign Out */}
        <div className="text-center mt-6">
          <button
            onClick={signOut}
            className="text-xs px-4 py-2 rounded"
            style={{ color: 'var(--color-cyber-cyan)', opacity: 0.5, border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)', fontFamily: 'var(--font-mono)' }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
