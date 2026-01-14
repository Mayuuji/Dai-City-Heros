import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
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

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  // Route to appropriate dashboard based on role
  // Admin role is for DMs/Game Masters
  if (profile.role === 'admin') {
    return <DMDashboard />;
  }

  return <PlayerDashboard />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route 
            path="/character/create" 
            element={
              <ProtectedRoute>
                <CharacterCreation />
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
                <Inventory />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/character/:id/abilities" 
            element={
              <ProtectedRoute>
                <Abilities />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <DashboardRouter />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dm" 
            element={
              <ProtectedRoute>
                <DMDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dm/god-mode" 
            element={
              <ProtectedRoute>
                <DMGodMode />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dm/item-creator" 
            element={
              <ProtectedRoute>
                <DMItemCreator />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dm/ability-creator" 
            element={
              <ProtectedRoute>
                <DMAbilityCreator />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dm/give-item" 
            element={
              <ProtectedRoute>
                <DMGiveItem />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dm/ability-manager" 
            element={
              <ProtectedRoute>
                <DMAbilityManager />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dm/item-editor" 
            element={
              <ProtectedRoute>
                <DMItemEditor />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dm/map-editor" 
            element={
              <ProtectedRoute>
                <DMMapEditor />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dm/shops" 
            element={
              <ProtectedRoute>
                <DMShopManager />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dm/missions" 
            element={
              <ProtectedRoute>
                <DMMissionManager />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dm/npcs" 
            element={
              <ProtectedRoute>
                <DMNPCManager />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dm/encounters" 
            element={
              <ProtectedRoute>
                <DMEncounterManager />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/map" 
            element={
              <ProtectedRoute>
                <PlayerMapView />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/shop/:shopId" 
            element={
              <ProtectedRoute>
                <PlayerShop />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/missions" 
            element={
              <ProtectedRoute>
                <PlayerMissionLog />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/encounter" 
            element={
              <ProtectedRoute>
                <PlayerEncounterView />
              </ProtectedRoute>
            } 
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
