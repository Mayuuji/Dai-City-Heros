import { useState, useEffect, FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [hoverToggle, setHoverToggle] = useState(false);

  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  // Check URL params to see if we should show register form
  useEffect(() => {
    if (searchParams.get('register') === 'true') {
      setIsLogin(false);
    }
  }, [searchParams]);

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
        // Show success message - user should check email OR they'll be auto-logged in
        setError('Account created! Check your email to confirm, or you may be logged in automatically.');
        // Don't auto-navigate - let the auth state change handle it if user is confirmed
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid-bg flex items-center justify-center p-4" style={{ backgroundColor: 'var(--color-cyber-darker)' }}>
      <div className="glass-panel neon-border p-8 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl neon-text mb-2 glitch" style={{ fontFamily: 'var(--font-cyber)' }}>
            {isLogin ? 'ACCESS TERMINAL' : 'NEW USER REGISTRATION'}
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.7 }}>
            {isLogin ? 'Enter credentials to proceed' : 'Create your account'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
                USERNAME
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="terminal-input w-full"
                placeholder="Enter username..."
                required={!isLogin}
              />
            </div>
          )}

          <div>
            <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
              EMAIL
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="terminal-input w-full"
              placeholder="user@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-2" style={{ color: 'var(--color-cyber-cyan)', fontFamily: 'var(--font-mono)' }}>
              PASSWORD
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="terminal-input w-full"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          {error && (
            <div
              className="p-3 rounded text-sm"
              style={{
                backgroundColor: error.includes('Check your email') ? 'rgba(57, 255, 20, 0.1)' : 'rgba(255, 0, 110, 0.1)',
                border: `1px solid ${error.includes('Check your email') ? 'var(--color-cyber-green)' : 'var(--color-cyber-pink)'}`,
                color: error.includes('Check your email') ? 'var(--color-cyber-green)' : 'var(--color-cyber-pink)',
                fontFamily: 'var(--font-mono)'
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="neon-button w-full"
            style={{ fontFamily: 'var(--font-cyber)', opacity: loading ? 0.5 : 1 }}
          >
            {loading ? 'PROCESSING...' : isLogin ? 'LOGIN' : 'REGISTER'}
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
            onMouseEnter={() => setHoverToggle(true)}
            onMouseLeave={() => setHoverToggle(false)}
            className="text-sm transition-all"
            style={{ 
              color: hoverToggle ? '#ff3333' : 'var(--color-cyber-cyan)', 
              opacity: hoverToggle ? 1 : 0.7, 
              fontFamily: 'var(--font-mono)',
              textDecoration: hoverToggle ? 'underline' : 'none',
              fontWeight: hoverToggle ? 'bold' : 'normal'
            }}
          >
            {isLogin ? "Don't have an account? Register" : 'Already have an account? Login'}
          </button>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs" style={{ color: 'var(--color-cyber-cyan)', opacity: 0.4, fontFamily: 'var(--font-mono)' }}>
            // SECURE CONNECTION ESTABLISHED //
          </p>
        </div>
      </div>
    </div>
  );
}