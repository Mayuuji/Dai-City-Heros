import { useState, useEffect, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CampaignProvider, useCampaign, CampaignTheme, DEFAULT_THEME } from './contexts/CampaignContext';
import { supabase } from './lib/supabase';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import CampaignSelect from './pages/CampaignSelect';
import PlayerDashboard from './pages/PlayerDashboard';
import DMDashboard from './pages/DMDashboard';
import CharacterCreation from './pages/CharacterCreation';
import Inventory from './pages/Inventory';
import Abilities from './pages/Abilities';
import DMGodMode from './pages/DMGodMode';
import DMItemCreator from './pages/DMItemCreator';
import DMAbilityCreator from './pages/DMAbilityCreator';
import DMGiveItem from './pages/DMGiveItem';
import DMAbilityManager from './pages/DMAbilityManager';
import DMItemEditor from './pages/DMItemEditor';
import DMMapEditor from './pages/DMMapEditor';
import PlayerMapView from './pages/PlayerMapView';
import DMShopManager from './pages/DMShopManager';
import PlayerShop from './pages/PlayerShop';
import DMMissionManager from './pages/DMMissionManager';
import PlayerMissionLog from './pages/PlayerMissionLog';
import DMNPCManager from './pages/DMNPCManager';
import DMEncounterManager from './pages/DMEncounterManager';
import PlayerEncounterView from './pages/PlayerEncounterView';
import RulesPage from './pages/RulesPage';
import ChatBox from './components/ChatBox';
import './index.css';

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(160deg, #0f0f14 0%, #1a1a2e 40%, #16213e 70%, #0f0f14 100%)' }}>
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-2 rounded-full mx-auto mb-4" 
               style={{ 
                 borderColor: 'rgba(200, 170, 110, 0.2)',
                 borderTopColor: 'rgba(200, 170, 110, 0.7)'
               }}>
          </div>
          <p style={{ color: 'rgba(200, 170, 110, 0.5)', fontFamily: "'Segoe UI', sans-serif", fontSize: '14px' }}>
            Loading...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Role-based dashboard router
function DashboardRouter() {
  const { profile } = useAuth();
  const { campaignRole } = useCampaign();

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  // Use campaign-level role; fall back to profile role for the default campaign
  const role = campaignRole || profile.role;

  if (role === 'admin') {
    return <DMDashboard />;
  }

  return <PlayerDashboard />;
}

// Campaign gate - redirects to campaign selection if no campaign is chosen
function CampaignGate({ children }: { children: React.ReactNode }) {
  const { campaignId, campaignsLoading, campaign, showingSplash } = useCampaign();

  if (campaignsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(160deg, #0f0f14 0%, #1a1a2e 40%, #16213e 70%, #0f0f14 100%)' }}>
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-2 rounded-full mx-auto mb-4"
               style={{ borderColor: 'rgba(200, 170, 110, 0.2)', borderTopColor: 'rgba(200, 170, 110, 0.7)' }}>
          </div>
          <p style={{ color: 'rgba(200, 170, 110, 0.5)', fontFamily: "'Segoe UI', sans-serif", fontSize: '14px' }}>
            Loading campaigns...
          </p>
        </div>
      </div>
    );
  }

  if (!campaignId) {
    return <CampaignSelect />;
  }

  // Campaign splash screen
  if (showingSplash && campaign) {
    const splashTheme: CampaignTheme = campaign.theme
      ? { ...DEFAULT_THEME, ...campaign.theme }
      : DEFAULT_THEME;
    return <CampaignSplash campaign={campaign} theme={splashTheme} />;
  }

  return <>
    {children}
    <ChatBox />
  </>;
}

// Campaign title card splash screen
function CampaignSplash({ campaign, theme }: { campaign: { id: string; name: string }; theme: CampaignTheme }) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter');
  const [subtitle, setSubtitle] = useState('');

  useEffect(() => {
    const fetchSubtitle = async () => {
      const { data } = await supabase
        .from('game_settings')
        .select('value')
        .eq('campaign_id', campaign.id)
        .eq('key', 'landing_subtitle')
        .single();
      if (data?.value?.text) {
        setSubtitle(data.value.text);
      }
    };
    fetchSubtitle();
  }, [campaign.id]);

  useEffect(() => {
    const holdTimer = setTimeout(() => setPhase('hold'), 400);
    const exitTimer = setTimeout(() => setPhase('exit'), 4000);
    return () => { clearTimeout(holdTimer); clearTimeout(exitTimer); };
  }, []);

  const opacity = phase === 'enter' ? 0 : phase === 'hold' ? 1 : 0;
  const scale = phase === 'enter' ? 0.95 : phase === 'hold' ? 1 : 1.02;

  const primaryColor = theme.color_primary;
  const secondaryColor = theme.color_secondary;
  const bgDark = theme.color_bg_dark;
  const bgDarker = theme.color_bg_darker;
  const textColor = theme.color_text || 'var(--color-text)';
  const mutedColor = theme.color_text_muted || 'var(--color-text-muted)';
  const headingFont = theme.font_heading;

  const toRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Detect theme type from name
  const themeName = (theme.name || '').toLowerCase();
  const isCyberpunk = themeName.includes('cyberpunk');

  // Generate stable random particles
  const particles = useMemo(() => {
    return Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      duration: Math.random() * 8 + 6,
      delay: Math.random() * 5,
      drift: (Math.random() - 0.5) * 30,
    }));
  }, []);

  // Lightning bolts for cyberpunk
  const lightningBolts = useMemo(() => {
    if (!isCyberpunk) return [];
    return Array.from({ length: 5 }, (_, i) => ({
      id: i,
      x: 10 + Math.random() * 80,
      delay: Math.random() * 4 + 1,
      duration: 0.15 + Math.random() * 0.1,
      opacity: 0.3 + Math.random() * 0.5,
    }));
  }, [isCyberpunk]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: `linear-gradient(160deg, ${bgDarker} 0%, ${bgDark} 40%, ${bgDarker} 100%)` }}
    >
      {/* ── Inline Keyframes ── */}
      <style>{`
        @keyframes splash-particle-rise {
          0% { transform: translateY(0) translateX(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(-100vh) translateX(var(--drift)); opacity: 0; }
        }
        @keyframes splash-particle-float {
          0% { transform: translateY(0) translateX(0); opacity: 0; }
          15% { opacity: 0.7; }
          85% { opacity: 0.7; }
          100% { transform: translateY(-30px) translateX(var(--drift)); opacity: 0; }
        }
        @keyframes splash-lightning-flash {
          0%, 100% { opacity: 0; }
          5% { opacity: var(--bolt-opacity); }
          10% { opacity: 0; }
          12% { opacity: var(--bolt-opacity); }
          15% { opacity: 0; }
        }
        @keyframes splash-scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
      `}</style>

      {/* ── Cyberpunk: Lightning Bolts ── */}
      {isCyberpunk && lightningBolts.map(bolt => (
        <div key={bolt.id} style={{
          position: 'absolute',
          left: `${bolt.x}%`,
          top: 0,
          width: '2px',
          height: '100%',
          background: `linear-gradient(180deg, transparent 0%, ${toRgba(primaryColor, 0.8)} 30%, ${toRgba(secondaryColor, 0.6)} 50%, ${toRgba(primaryColor, 0.8)} 70%, transparent 100%)`,
          boxShadow: `0 0 15px 5px ${toRgba(primaryColor, 0.4)}, 0 0 30px 10px ${toRgba(primaryColor, 0.2)}`,
          animation: `splash-lightning-flash ${bolt.duration * 8}s ${bolt.delay}s infinite`,
          ['--bolt-opacity' as string]: bolt.opacity,
          zIndex: 1,
          pointerEvents: 'none' as const,
        }} />
      ))}

      {/* ── Cyberpunk: Horizontal scanline ── */}
      {isCyberpunk && (
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '2px',
          background: `linear-gradient(90deg, transparent, ${toRgba(primaryColor, 0.3)}, transparent)`,
          animation: 'splash-scanline 3s linear infinite',
          zIndex: 2,
          pointerEvents: 'none' as const,
        }} />
      )}

      {/* ── Cyberpunk: Glitch overlay ── */}
      {isCyberpunk && (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, ${toRgba(primaryColor, 0.02)} 2px, ${toRgba(primaryColor, 0.02)} 4px)`,
          pointerEvents: 'none' as const,
          zIndex: 2,
        }} />
      )}

      {/* ── Particles (all themes) ── */}
      {particles.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            bottom: isCyberpunk ? `${p.y * 0.3}%` : `-5%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            borderRadius: '50%',
            background: isCyberpunk
              ? (p.id % 3 === 0 ? primaryColor : p.id % 3 === 1 ? secondaryColor : toRgba(primaryColor, 0.5))
              : toRgba(primaryColor, 0.4 + p.size * 0.1),
            boxShadow: isCyberpunk
              ? `0 0 ${p.size * 2}px ${p.id % 2 === 0 ? primaryColor : secondaryColor}`
              : `0 0 ${p.size * 2}px ${toRgba(primaryColor, 0.3)}`,
            animation: `${isCyberpunk ? 'splash-particle-float' : 'splash-particle-rise'} ${p.duration}s ${p.delay}s infinite`,
            ['--drift' as string]: `${p.drift}px`,
            pointerEvents: 'none' as const,
            zIndex: 3,
          }}
        />
      ))}

      {/* ── Glow behind title ── */}
      <div
        className="absolute rounded-full blur-3xl"
        style={{
          width: '600px',
          height: '600px',
          background: `radial-gradient(circle, ${toRgba(primaryColor, isCyberpunk ? 0.15 : 0.1)} 0%, transparent 70%)`,
          opacity: phase === 'hold' ? 1 : 0,
          transition: 'opacity 1s ease',
          zIndex: 4,
        }}
      />

      {/* ── Title content ── */}
      <div
        style={{
          opacity,
          transform: `scale(${scale})`,
          transition: 'all 1s cubic-bezier(0.16, 1, 0.3, 1)',
          textAlign: 'center',
          padding: '0 2rem',
          zIndex: 10,
          position: 'relative',
        }}
      >
        <h1
          className="text-4xl md:text-6xl lg:text-7xl font-bold mb-4"
          style={{
            fontFamily: headingFont,
            color: textColor,
            textShadow: isCyberpunk
              ? `0 0 20px ${toRgba(primaryColor, 0.6)}, 0 0 60px ${toRgba(primaryColor, 0.3)}, 0 0 100px ${toRgba(secondaryColor, 0.15)}`
              : `0 0 40px ${toRgba(primaryColor, 0.2)}`,
            letterSpacing: isCyberpunk ? '0.08em' : '0.02em',
          }}
        >
          {campaign.name}
        </h1>

        {subtitle && (
          <p
            className="text-lg md:text-xl mb-4 tracking-wider"
            style={{
              fontFamily: theme.font_body,
              color: mutedColor,
              opacity: phase === 'hold' ? 1 : 0,
              transition: 'opacity 0.8s ease 0.3s',
            }}
          >
            {subtitle}
          </p>
        )}

        <div
          className="mx-auto"
          style={{
            width: '80px',
            height: '1px',
            background: `linear-gradient(90deg, transparent, ${toRgba(primaryColor, 0.5)}, transparent)`,
            opacity: phase === 'hold' ? 1 : 0,
            transition: 'opacity 0.6s ease 0.4s',
          }}
        />
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CampaignProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route 
            path="/campaigns" 
            element={
              <ProtectedRoute>
                <CampaignSelect />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/character/create" 
            element={
              <ProtectedRoute>
                <CampaignGate>
                  <CharacterCreation />
                </CampaignGate>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/character/:id" 
            element={<Navigate to="/dashboard" replace />}
          />
          <Route 
            path="/character/:id/inventory" 
            element={
              <ProtectedRoute>
                <CampaignGate>
                  <Inventory />
                </CampaignGate>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/character/:id/abilities" 
            element={
              <ProtectedRoute>
                <CampaignGate>
                  <Abilities />
                </CampaignGate>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <CampaignGate>
                  <DashboardRouter />
                </CampaignGate>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dm" 
            element={
              <ProtectedRoute>
                <CampaignGate>
                  <DMDashboard />
                </CampaignGate>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dm/god-mode" 
            element={
              <ProtectedRoute>
                <CampaignGate>
                  <DMGodMode />
                </CampaignGate>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dm/item-creator" 
            element={
              <ProtectedRoute>
                <CampaignGate>
                  <DMItemCreator />
                </CampaignGate>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dm/ability-creator" 
            element={
              <ProtectedRoute>
                <CampaignGate>
                  <DMAbilityCreator />
                </CampaignGate>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dm/give-item" 
            element={
              <ProtectedRoute>
                <CampaignGate>
                  <DMGiveItem />
                </CampaignGate>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dm/ability-manager" 
            element={
              <ProtectedRoute>
                <CampaignGate>
                  <DMAbilityManager />
                </CampaignGate>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dm/item-editor" 
            element={
              <ProtectedRoute>
                <CampaignGate>
                  <DMItemEditor />
                </CampaignGate>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dm/map-editor" 
            element={
              <ProtectedRoute>
                <CampaignGate>
                  <DMMapEditor />
                </CampaignGate>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dm/shops" 
            element={
              <ProtectedRoute>
                <CampaignGate>
                  <DMShopManager />
                </CampaignGate>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dm/missions" 
            element={
              <ProtectedRoute>
                <CampaignGate>
                  <DMMissionManager />
                </CampaignGate>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dm/npcs" 
            element={
              <ProtectedRoute>
                <CampaignGate>
                  <DMNPCManager />
                </CampaignGate>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dm/encounters" 
            element={
              <ProtectedRoute>
                <CampaignGate>
                  <DMEncounterManager />
                </CampaignGate>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/map" 
            element={
              <ProtectedRoute>
                <CampaignGate>
                  <PlayerMapView />
                </CampaignGate>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/shop/:shopId" 
            element={
              <ProtectedRoute>
                <CampaignGate>
                  <PlayerShop />
                </CampaignGate>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/missions" 
            element={
              <ProtectedRoute>
                <CampaignGate>
                  <PlayerMissionLog />
                </CampaignGate>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/encounter" 
            element={
              <ProtectedRoute>
                <CampaignGate>
                  <PlayerEncounterView />
                </CampaignGate>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/rules" 
            element={
              <ProtectedRoute>
                <RulesPage />
              </ProtectedRoute>
            } 
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </CampaignProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
