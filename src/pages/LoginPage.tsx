import { useState, useEffect, FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  borderRadius: '6px',
  border: '1px solid rgba(200, 170, 110, 0.2)',
  background: 'rgba(255, 255, 255, 0.04)',
  color: '#e8dcc8',
  fontFamily: "'Segoe UI', sans-serif",
  fontSize: '14px',
  outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s'
};

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const { signIn, signUp, user, profile } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in with a loaded profile
  useEffect(() => {
    if (user && profile) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, profile, navigate]);

  // Check URL params to see if we should show register form
  useEffect(() => {
    if (searchParams.get('register') === 'true') {
      setIsLogin(false);
    }
  }, [searchParams]);

  useEffect(() => {
    setTimeout(() => setShowForm(true), 100);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) throw error;
        navigate('/dashboard');
      } else {
        if (!username.trim()) {
          throw new Error('Username is required');
        }
        const { error } = await signUp(email, password, username);
        if (error) throw error;
        setError('Account created! Check your email to confirm, or you may be logged in automatically.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #0f0f14 0%, #1a1a2e 40%, #16213e 70%, #0f0f14 100%)' }}
    >
      {/* Subtle grid */}
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.06,
          backgroundImage: `
            linear-gradient(rgba(200, 170, 110, 0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(200, 170, 110, 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px'
        }}
      />

      {/* Ambient glows */}
      <div
        className="absolute rounded-full blur-3xl"
        style={{
          width: '400px', height: '400px',
          background: 'radial-gradient(circle, rgba(200, 170, 110, 0.06) 0%, transparent 70%)',
          top: '10%', left: '10%'
        }}
      />
      <div
        className="absolute rounded-full blur-3xl"
        style={{
          width: '400px', height: '400px',
          background: 'radial-gradient(circle, rgba(160, 180, 220, 0.04) 0%, transparent 70%)',
          bottom: '10%', right: '10%'
        }}
      />

      {/* Form card */}
      <div
        className="relative z-10 w-full max-w-md"
        style={{
          opacity: showForm ? 1 : 0,
          transform: showForm ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.8s ease-out'
        }}
      >
        <div
          className="rounded-xl p-8"
          style={{
            background: 'rgba(15, 15, 20, 0.7)',
            border: '1px solid rgba(200, 170, 110, 0.12)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)'
          }}
        >
          {/* Header */}
          <div className="text-center mb-8">
            <div className="text-3xl mb-3" style={{ filter: 'drop-shadow(0 0 12px rgba(200, 170, 110, 0.2))' }}>🎲</div>
            <h1
              className="text-2xl font-bold mb-1"
              style={{
                fontFamily: "'Georgia', 'Times New Roman', serif",
                color: '#e8dcc8',
                letterSpacing: '0.02em'
              }}
            >
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h1>
            <p
              className="text-sm"
              style={{
                fontFamily: "'Segoe UI', sans-serif",
                color: 'rgba(160, 180, 220, 0.5)'
              }}
            >
              {isLogin ? 'Sign in to your adventure' : 'Begin your journey'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div>
                <label
                  className="block text-xs mb-2 tracking-wider uppercase"
                  style={{ color: 'rgba(200, 170, 110, 0.6)', fontFamily: "'Segoe UI', sans-serif" }}
                >
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  style={inputStyle}
                  placeholder="Choose a username"
                  required={!isLogin}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(200, 170, 110, 0.4)';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(200, 170, 110, 0.08)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(200, 170, 110, 0.2)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>
            )}

            <div>
              <label
                className="block text-xs mb-2 tracking-wider uppercase"
                style={{ color: 'rgba(200, 170, 110, 0.6)', fontFamily: "'Segoe UI', sans-serif" }}
              >
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                placeholder="you@example.com"
                required
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(200, 170, 110, 0.4)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(200, 170, 110, 0.08)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(200, 170, 110, 0.2)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            <div>
              <label
                className="block text-xs mb-2 tracking-wider uppercase"
                style={{ color: 'rgba(200, 170, 110, 0.6)', fontFamily: "'Segoe UI', sans-serif" }}
              >
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
                placeholder="••••••••"
                required
                minLength={6}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(200, 170, 110, 0.4)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(200, 170, 110, 0.08)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(200, 170, 110, 0.2)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            {error && (
              <div
                className="p-3 rounded-lg text-sm"
                style={{
                  backgroundColor: error.includes('Check your email') ? 'rgba(100, 180, 100, 0.1)' : 'rgba(200, 80, 80, 0.1)',
                  border: `1px solid ${error.includes('Check your email') ? 'rgba(100, 180, 100, 0.3)' : 'rgba(200, 80, 80, 0.3)'}`,
                  color: error.includes('Check your email') ? '#8fbc8f' : '#d48a8a',
                  fontFamily: "'Segoe UI', sans-serif"
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg text-sm font-semibold tracking-wider transition-all duration-300"
              style={{
                fontFamily: "'Segoe UI', sans-serif",
                background: loading
                  ? 'rgba(200, 170, 110, 0.1)'
                  : 'linear-gradient(135deg, rgba(200, 170, 110, 0.2) 0%, rgba(200, 170, 110, 0.1) 100%)',
                border: '1px solid rgba(200, 170, 110, 0.4)',
                color: loading ? 'rgba(232, 220, 200, 0.4)' : '#e8dcc8',
                cursor: loading ? 'not-allowed' : 'pointer',
                letterSpacing: '0.15em'
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.background = 'rgba(200, 170, 110, 0.25)';
                  e.currentTarget.style.boxShadow = '0 0 20px rgba(200, 170, 110, 0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(200, 170, 110, 0.2) 0%, rgba(200, 170, 110, 0.1) 100%)';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            >
              {loading ? 'PROCESSING...' : isLogin ? 'SIGN IN' : 'CREATE ACCOUNT'}
            </button>
          </form>

          {/* Toggle */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="text-sm transition-all duration-200"
              style={{
                fontFamily: "'Segoe UI', sans-serif",
                color: 'rgba(160, 180, 220, 0.5)',
                background: 'none',
                border: 'none',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'rgba(160, 180, 220, 0.8)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'rgba(160, 180, 220, 0.5)';
              }}
            >
              {isLogin ? "Don't have an account? Create one" : 'Already have an account? Sign in'}
            </button>
          </div>

          {/* Back link */}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="text-xs transition-all duration-200"
              style={{
                fontFamily: "'Segoe UI', sans-serif",
                color: 'rgba(200, 200, 200, 0.25)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                letterSpacing: '0.1em'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(200, 200, 200, 0.5)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(200, 200, 200, 0.25)'; }}
            >
              ← Back to home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}