import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CampaignProvider, useCampaign } from './contexts/CampaignContext';
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
    return <CampaignSplash campaignName={campaign.name} />;
  }

  return <>{children}</>;
}

// Campaign title card splash screen
function CampaignSplash({ campaignName }: { campaignName: string }) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter');

  useEffect(() => {
    // Fade in
    const holdTimer = setTimeout(() => setPhase('hold'), 600);
    // Fade out
    const exitTimer = setTimeout(() => setPhase('exit'), 1800);
    return () => { clearTimeout(holdTimer); clearTimeout(exitTimer); };
  }, []);

  const opacity = phase === 'enter' ? 0 : phase === 'hold' ? 1 : 0;
  const scale = phase === 'enter' ? 0.95 : phase === 'hold' ? 1 : 1.02;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #0f0f14 0%, #1a1a2e 40%, #16213e 70%, #0f0f14 100%)' }}
    >
      {/* Warm glow behind title */}
      <div
        className="absolute rounded-full blur-3xl"
        style={{
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(200, 170, 110, 0.08) 0%, transparent 70%)',
          opacity: phase === 'hold' ? 1 : 0,
          transition: 'opacity 0.8s ease'
        }}
      />

      <div
        style={{
          opacity,
          transform: `scale(${scale})`,
          transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
          textAlign: 'center'
        }}
      >
        <div className="text-4xl mb-6" style={{ filter: 'drop-shadow(0 0 20px rgba(200, 170, 110, 0.3))' }}>
          🎲
        </div>

        <h1
          className="text-4xl md:text-6xl lg:text-7xl font-bold mb-4"
          style={{
            fontFamily: "'Georgia', 'Times New Roman', serif",
            color: '#e8dcc8',
            textShadow: '0 0 40px rgba(200, 170, 110, 0.15)',
            letterSpacing: '0.02em'
          }}
        >
          {campaignName}
        </h1>

        <div
          className="mx-auto"
          style={{
            width: '80px',
            height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(200, 170, 110, 0.4), transparent)',
            opacity: phase === 'hold' ? 1 : 0,
            transition: 'opacity 0.6s ease 0.2s'
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
