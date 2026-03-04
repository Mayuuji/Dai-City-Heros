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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-cyber-darker)' }}>
        <div className="glass-panel p-8 text-center">
          <div className="animate-spin w-12 h-12 border-4 rounded-full mx-auto mb-4" 
               style={{ 
                 borderColor: 'color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)',
                 borderTopColor: 'var(--color-cyber-cyan)'
               }}>
          </div>
          <p style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
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
  const { campaignId, campaignsLoading } = useCampaign();

  if (campaignsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-cyber-darker)' }}>
        <div className="glass-panel p-8 text-center">
          <div className="animate-spin w-12 h-12 border-4 rounded-full mx-auto mb-4"
               style={{
                 borderColor: 'color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)',
                 borderTopColor: 'var(--color-cyber-cyan)'
               }}>
          </div>
          <p style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
            Loading campaigns...
          </p>
        </div>
      </div>
    );
  }

  if (!campaignId) {
    return <CampaignSelect />;
  }

  return <>{children}</>;
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
