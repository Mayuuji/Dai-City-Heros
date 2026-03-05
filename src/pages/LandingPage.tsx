import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const [showContent, setShowContent] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width / 2) / rect.width;
      const y = (e.clientY - rect.top - rect.height / 2) / rect.height;
      setMousePos({ x, y });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    setTimeout(() => setShowContent(true), 100);
  }, []);

  return (
    <div
      ref={containerRef}
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #0f0f14 0%, #1a1a2e 40%, #16213e 70%, #0f0f14 100%)' }}
    >
      {/* Subtle grid background */}
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.08,
          backgroundImage: `
            linear-gradient(rgba(200, 170, 110, 0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(200, 170, 110, 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          transform: `translate(${mousePos.x * 15}px, ${mousePos.y * 15}px)`,
          transition: 'transform 0.15s ease-out'
        }}
      />

      {/* Ambient glow — warm gold */}
      <div
        className="absolute rounded-full blur-3xl"
        style={{
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(200, 170, 110, 0.08) 0%, transparent 70%)',
          top: '15%',
          left: '15%',
          transform: `translate(${mousePos.x * 30}px, ${mousePos.y * 30}px)`,
          transition: 'transform 0.2s ease-out',
          animation: 'landingPulse 6s ease-in-out infinite'
        }}
      />
      {/* Ambient glow — cool silver */}
      <div
        className="absolute rounded-full blur-3xl"
        style={{
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(160, 180, 220, 0.06) 0%, transparent 70%)',
          bottom: '15%',
          right: '15%',
          transform: `translate(${mousePos.x * -30}px, ${mousePos.y * -30}px)`,
          transition: 'transform 0.2s ease-out',
          animation: 'landingPulse 6s ease-in-out infinite',
          animationDelay: '3s'
        }}
      />

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full"
            style={{
              left: `${(i * 17 + 8) % 100}%`,
              top: `${(i * 23 + 12) % 100}%`,
              backgroundColor: i % 2 === 0 ? 'rgba(200, 170, 110, 0.4)' : 'rgba(160, 180, 220, 0.3)',
              animation: `landingFloat ${7 + (i % 4) * 2}s ease-in-out infinite`,
              animationDelay: `${(i % 5) * 0.8}s`
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div
        className="relative z-10 text-center px-4 max-w-2xl"
        style={{
          opacity: showContent ? 1 : 0,
          transform: showContent ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 1.2s ease-out'
        }}
      >
        {/* D20 icon */}
        <div
          className="text-6xl mb-6"
          style={{
            filter: 'drop-shadow(0 0 20px rgba(200, 170, 110, 0.3))',
            animation: 'landingFloat 4s ease-in-out infinite'
          }}
        >
          🎲
        </div>

        {/* Title */}
        <h1
          className="text-4xl md:text-6xl lg:text-7xl font-bold mb-4 tracking-tight"
          style={{
            fontFamily: "'Georgia', 'Times New Roman', serif",
            color: '#e8dcc8',
            textShadow: '0 0 40px rgba(200, 170, 110, 0.2)',
            letterSpacing: '0.02em'
          }}
        >
          Dungeons &amp; Dragons
        </h1>

        {/* Subtitle */}
        <p
          className="text-xl md:text-2xl mb-2 tracking-widest uppercase"
          style={{
            fontFamily: "'Segoe UI', sans-serif",
            color: 'rgba(160, 180, 220, 0.7)',
            fontWeight: 300,
            letterSpacing: '0.3em'
          }}
        >
          Virtual Tabletop
        </p>

        {/* Divider */}
        <div
          className="mx-auto my-8"
          style={{
            width: '120px',
            height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(200, 170, 110, 0.5), transparent)'
          }}
        />

        {/* Tagline */}
        <p
          className="text-sm mb-10 tracking-wider"
          style={{
            fontFamily: "'Segoe UI', sans-serif",
            color: 'rgba(200, 200, 200, 0.4)',
            fontWeight: 300
          }}
        >
          Roll initiative. Shape your story.
        </p>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button
            onClick={() => navigate('/login')}
            className="px-10 py-3.5 text-base font-semibold tracking-wider rounded transition-all duration-300"
            style={{
              fontFamily: "'Segoe UI', sans-serif",
              background: 'linear-gradient(135deg, rgba(200, 170, 110, 0.15) 0%, rgba(200, 170, 110, 0.05) 100%)',
              border: '1px solid rgba(200, 170, 110, 0.4)',
              color: '#e8dcc8',
              cursor: 'pointer',
              letterSpacing: '0.15em'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(200, 170, 110, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(200, 170, 110, 0.7)';
              e.currentTarget.style.boxShadow = '0 0 30px rgba(200, 170, 110, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(200, 170, 110, 0.15) 0%, rgba(200, 170, 110, 0.05) 100%)';
              e.currentTarget.style.borderColor = 'rgba(200, 170, 110, 0.4)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            SIGN IN
          </button>

          <button
            onClick={() => navigate('/login?register=true')}
            className="px-10 py-3.5 text-base tracking-wider rounded transition-all duration-300"
            style={{
              fontFamily: "'Segoe UI', sans-serif",
              background: 'transparent',
              border: '1px solid rgba(160, 180, 220, 0.25)',
              color: 'rgba(160, 180, 220, 0.7)',
              cursor: 'pointer',
              letterSpacing: '0.15em'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(160, 180, 220, 0.5)';
              e.currentTarget.style.color = 'rgba(160, 180, 220, 0.9)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(160, 180, 220, 0.25)';
              e.currentTarget.style.color = 'rgba(160, 180, 220, 0.7)';
            }}
          >
            CREATE ACCOUNT
          </button>
        </div>
      </div>

      {/* Footer */}
      <div
        className="absolute bottom-6 text-center"
        style={{
          fontFamily: "'Segoe UI', sans-serif",
          color: 'rgba(200, 200, 200, 0.15)',
          fontSize: '11px',
          letterSpacing: '0.2em'
        }}
      >
        TABLETOP COMPANION
      </div>

      <style>{`
        @keyframes landingFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        @keyframes landingPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
