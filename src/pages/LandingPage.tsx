import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const [glitchText, setGlitchText] = useState('CYBERPUNK');
  const navigate = useNavigate();

  useEffect(() => {
    // Glitch effect on text
    const interval = setInterval(() => {
      const texts = ['CYBERPUNK', 'CYB3RPUNK', 'CYBERPU₦K', 'CYBERPUNK'];
      setGlitchText(texts[Math.floor(Math.random() * texts.length)]);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen grid-bg" style={{ backgroundColor: 'var(--color-cyber-darker)' }}>
      {/* Header */}
      <div className="container mx-auto px-4 py-8">
        <div className="glass-panel neon-border p-8 text-center">
          <h1 className="text-6xl neon-text mb-4 glitch" style={{ fontFamily: 'var(--font-cyber)' }}>
            {glitchText}
          </h1>
          <h2 className="text-2xl mb-2" style={{ color: 'var(--color-cyber-magenta)' }}>
            TABLETOP COMPANION
          </h2>
          <p className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
            System Status: ONLINE // Version 1.0.0
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="mt-8 flex justify-center gap-4">
          <button onClick={() => navigate('/login')} className="neon-button" style={{ fontFamily: 'var(--font-cyber)' }}>
            LOGIN / REGISTER
          </button>
          <button className="neon-button-magenta" style={{ fontFamily: 'var(--font-cyber)' }}>
            VIEW DOCS
          </button>
        </div>

        {/* Main Content */}
        <div className="mt-8 grid md:grid-cols-2 gap-6">
          {/* Project Status */}
          <div className="glass-panel p-6" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)' }}>
            <h3 className="text-xl mb-4 flex items-center" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
              <span className="w-2 h-2 rounded-full mr-3 animate-pulse" style={{ backgroundColor: 'var(--color-cyber-green)' }}></span>
              PROJECT STATUS
            </h3>
            <div className="space-y-3 text-sm" style={{ fontFamily: 'var(--font-mono)' }}>
              <div className="flex justify-between items-center">
                <span style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>React + Vite</span>
                <span style={{ color: 'var(--color-cyber-green)' }}>✓ READY</span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>Tailwind CSS</span>
                <span style={{ color: 'var(--color-cyber-green)' }}>✓ CONFIGURED</span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>Authentication</span>
                <span style={{ color: 'var(--color-cyber-green)' }}>✓ READY</span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>Database</span>
                <span style={{ color: 'var(--color-cyber-green)' }}>✓ CONNECTED</span>
              </div>
            </div>
          </div>

          {/* Next Steps */}
          <div className="glass-panel p-6" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-magenta) 30%, transparent)' }}>
            <h3 className="text-xl mb-4 flex items-center" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-magenta)' }}>
              <span className="w-2 h-2 rounded-full mr-3 animate-pulse" style={{ backgroundColor: 'var(--color-cyber-magenta)' }}></span>
              GET STARTED
            </h3>
            <ol className="space-y-3 text-sm list-decimal list-inside" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>
              <li>Create an account or login</li>
              <li>Create your character</li>
              <li>Join your campaign</li>
              <li>Start your adventure</li>
            </ol>
          </div>
        </div>

        {/* Feature Preview */}
        <div className="mt-8 glass-panel p-6" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 30%, transparent)' }}>
          <h3 className="text-xl mb-6 text-center" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
            FEATURES
          </h3>
          <div className="grid md:grid-cols-3 gap-4">
            {/* Player Features */}
            <div className="rounded p-4" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-cyan) 20%, transparent)' }}>
              <h4 className="text-sm mb-3" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-cyan)' }}>
                👤 PLAYER MODE
              </h4>
              <ul className="space-y-2 text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>
                <li>• Character Dashboard</li>
                <li>• 3D Model Viewer</li>
                <li>• Inventory System</li>
                <li>• World Map</li>
                <li>• Shop Interface</li>
                <li>• Mission Log</li>
              </ul>
            </div>

            {/* DM Features */}
            <div className="rounded p-4" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-magenta) 20%, transparent)' }}>
              <h4 className="text-sm mb-3" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-magenta)' }}>
                👑 DM MODE
              </h4>
              <ul className="space-y-2 text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-cyber-magenta)', opacity: 0.7 }}>
                <li>• God Mode Editor</li>
                <li>• Item Creator</li>
                <li>• Map Editor</li>
                <li>• Encounter Manager</li>
                <li>• Session Notes</li>
                <li>• 3D Battle Map</li>
              </ul>
            </div>

            {/* Technical */}
            <div className="rounded p-4" style={{ border: '1px solid color-mix(in srgb, var(--color-cyber-purple) 20%, transparent)' }}>
              <h4 className="text-sm mb-3" style={{ fontFamily: 'var(--font-cyber)', color: 'var(--color-cyber-purple)' }}>
                ⚡ TECH FEATURES
              </h4>
              <ul className="space-y-2 text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-cyber-purple)', opacity: 0.7 }}>
                <li>• Real-time updates</li>
                <li>• Role-based access</li>
                <li>• Secure authentication</li>
                <li>• Cloud storage</li>
                <li>• Mobile responsive</li>
                <li>• Dark mode optimized</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.4, fontFamily: 'var(--font-mono)' }}>
            // ENCRYPTED CONNECTION ESTABLISHED //
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.4, fontFamily: 'var(--font-mono)' }}>
            [ SYSTEM READY FOR DEPLOYMENT ]
          </p>
        </div>
      </div>
    </div>
  );
}
