import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const [glitchText, setGlitchText] = useState('DAI CITY HEROS');
  const [showContent, setShowContent] = useState(false);
  const [hoverRegister, setHoverRegister] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Fade in content after mount
    setTimeout(() => setShowContent(true), 100);
    
    // Glitch effect on text
    const interval = setInterval(() => {
      const texts = ['DAI CITY HEROS', 'D4I C1TY H3R0S', 'DAI_CITY_HEROS', '다이 시티 히어로즈', 'DAI CITY HEROS'];
      setGlitchText(texts[Math.floor(Math.random() * texts.length)]);
      // Reset back quickly for glitch effect
      setTimeout(() => setGlitchText('DAI CITY HEROS'), 150);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ backgroundColor: '#0a0a0f' }}
    >
      {/* Animated background grid */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 255, 255, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          animation: 'gridMove 20s linear infinite'
        }}
      />
      
      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              backgroundColor: i % 3 === 0 ? '#00ffff' : i % 3 === 1 ? '#ff00ff' : '#ffff00',
              opacity: 0.4,
              animation: `float ${5 + Math.random() * 10}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 5}s`
            }}
          />
        ))}
      </div>

      {/* Glow effects */}
      <div 
        className="absolute w-96 h-96 rounded-full blur-3xl opacity-20"
        style={{ 
          background: 'radial-gradient(circle, #00ffff 0%, transparent 70%)',
          top: '20%',
          left: '10%',
          animation: 'pulse 4s ease-in-out infinite'
        }}
      />
      <div 
        className="absolute w-96 h-96 rounded-full blur-3xl opacity-20"
        style={{ 
          background: 'radial-gradient(circle, #ff00ff 0%, transparent 70%)',
          bottom: '20%',
          right: '10%',
          animation: 'pulse 4s ease-in-out infinite',
          animationDelay: '2s'
        }}
      />

      {/* Main content */}
      <div 
        className="relative z-10 text-center px-4"
        style={{
          opacity: showContent ? 1 : 0,
          transform: showContent ? 'translateY(0)' : 'translateY(30px)',
          transition: 'all 1s ease-out'
        }}
      >
        {/* Main title with neon effect */}
        <h1 
          className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 relative"
          style={{ 
            fontFamily: 'var(--font-cyber)',
            color: '#fff',
            textShadow: `
              0 0 10px #00ffff,
              0 0 20px #00ffff,
              0 0 40px #00ffff,
              0 0 80px #00ffff,
              0 0 120px rgba(0, 255, 255, 0.5)
            `,
            animation: 'neonFlicker 3s ease-in-out infinite'
          }}
        >
          <span style={{ 
            background: 'linear-gradient(90deg, #00ffff, #ff00ff, #ffff00, #00ffff)',
            backgroundSize: '300% 100%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: 'gradientShift 5s ease-in-out infinite'
          }}>
            {glitchText}
          </span>
        </h1>

        {/* Subtitle with typing effect style */}
        <div 
          className="mb-12 text-lg md:text-xl tracking-widest"
          style={{ 
            fontFamily: 'var(--font-mono)',
            color: '#00ffff',
            opacity: 0.7,
            animation: 'fadeInUp 1s ease-out 0.5s both'
          }}
        >
          [ ENTER THE NEON SHADOWS ]
        </div>

        {/* Login button with hover effect */}
        <button 
          onClick={() => navigate('/login')}
          className="relative px-12 py-4 text-xl font-bold tracking-wider overflow-hidden group"
          style={{ 
            fontFamily: 'var(--font-cyber)',
            background: 'transparent',
            border: '2px solid #00ffff',
            color: '#00ffff',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#00ffff';
            e.currentTarget.style.color = '#0a0a0f';
            e.currentTarget.style.boxShadow = '0 0 30px #00ffff, 0 0 60px rgba(0, 255, 255, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#00ffff';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <span className="relative z-10">⚡ JACK IN ⚡</span>
        </button>

        {/* Register link */}
        <div className="mt-8">
          <span 
            style={{ 
              fontFamily: 'var(--font-mono)',
              color: hoverRegister ? '#ff00ff' : '#888',
              textDecoration: hoverRegister ? 'underline' : 'none',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              fontSize: '0.95rem'
            }}
            onMouseEnter={() => setHoverRegister(true)}
            onMouseLeave={() => setHoverRegister(false)}
            onClick={() => navigate('/login')}
          >
            New to the city? <span style={{ color: hoverRegister ? '#00ffff' : '#aaa', fontWeight: 'bold' }}>Create an account →</span>
          </span>
        </div>

        {/* Decorative line */}
        <div 
          className="mt-16 mx-auto"
          style={{
            width: '200px',
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #00ffff, #ff00ff, #00ffff, transparent)',
            animation: 'lineGlow 2s ease-in-out infinite'
          }}
        />
        
        {/* Footer text */}
        <div 
          className="mt-6 text-xs tracking-widest"
          style={{ 
            fontFamily: 'var(--font-mono)',
            color: '#444'
          }}
        >
          // SYSTEM ONLINE // SECURE CONNECTION //
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes gridMove {
          0% { transform: translate(0, 0); }
          100% { transform: translate(50px, 50px); }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.4; }
          50% { transform: translateY(-20px) translateX(10px); opacity: 0.8; }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 0.15; transform: scale(1); }
          50% { opacity: 0.25; transform: scale(1.1); }
        }
        
        @keyframes neonFlicker {
          0%, 100% { opacity: 1; }
          92% { opacity: 1; }
          93% { opacity: 0.8; }
          94% { opacity: 1; }
          96% { opacity: 0.9; }
          97% { opacity: 1; }
        }
        
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 0.7; transform: translateY(0); }
        }
        
        @keyframes lineGlow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
