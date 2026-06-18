import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import type { Theme } from '../types';
import './Login.css';

type Mode = 'login' | 'signup' | 'forgot';

const THEME_CYCLE: Theme[] = ['light', 'dark', 'system'];

const Login: React.FC = () => {
  const { user, signInEmail, signUpEmail, signInGoogle, resetPassword } = useAuth();
  const { theme, setTheme } = useTheme();

  const [mode, setMode] = useState<Mode>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [developerBadgeExpanded, setDeveloperBadgeExpanded] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  // Already logged in → go home
  if (user) return <Navigate to="/" replace />;

  const cycleTheme = () => {
    const idx = THEME_CYCLE.indexOf(theme);
    setTheme(THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]);
  };

  const clearMessages = () => { setError(''); setInfo(''); };

  const friendlyError = (code: string) => {
    switch (code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Invalid email or password.';
      case 'auth/email-already-in-use':
        return 'An account with this email already exists.';
      case 'auth/weak-password':
        return 'Password must be at least 6 characters.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please try again later.';
      case 'auth/popup-closed-by-user':
        return 'Google sign-in was cancelled.';
      default:
        return 'Something went wrong. Please try again.';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (mode === 'forgot') {
      if (!email.trim()) { setError('Please enter your email address.'); return; }
      setLoading(true);
      try {
        await resetPassword(email.trim());
        setInfo('Password reset email sent! Check your inbox or spam.');
        setEmail('');
      } catch (err: any) {
        setError(friendlyError(err.code));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!email.trim() || !password) { setError('Please fill in all fields.'); return; }

    if (mode === 'signup') {
      if (!displayName.trim()) { setError('Please enter your name.'); return; }
      if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
      if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await signInEmail(email.trim(), password);
      } else {
        await signUpEmail(email.trim(), password, displayName.trim());
      }
    } catch (err: any) {
      setError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    clearMessages();
    setLoading(true);
    try {
      await signInGoogle();
    } catch (err: any) {
      setError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next: Mode) => {
    clearMessages();
    setPassword('');
    setConfirmPassword('');
    setMode(next);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDeveloperBadgeExpanded(false);
    }, 3000);

    return () => window.clearTimeout(timer);
  }, []);

  const titles: Record<Mode, string> = {
    login: 'Welcome back',
    signup: 'Create account',
    forgot: 'Reset password',
  };

  const subtitles: Record<Mode, string> = {
    login: 'Sign in to your billing system',
    signup: 'Start managing your bills today',
    forgot: 'Enter your email to receive a reset link',
  };

  return (
    <div className="login-page">
      {/* Theme toggle */}
      <button className="login-theme-btn" onClick={cycleTheme} title={`Theme: ${theme}`}>
        {theme === 'light' && (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        )}
        {theme === 'dark' && (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
        {theme === 'system' && (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        )}
      </button>

      <div className="login-card fade-in">
        {/* Brand */}
        <div className="login-brand">
          <div className="login-brand-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-store" aria-hidden="true">
              <path d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5" />
              <path d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244" />
              <path d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05" />
            </svg>
          </div>
          <span>Invoice Billing System</span>
        </div>

        <h1 className="login-title">{titles[mode]}</h1>
        <p className="login-subtitle">{subtitles[mode]}</p>

        {/* Alerts */}
        {error && (
          <div className="login-alert login-alert-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            {error}
          </div>
        )}
        {info && (
          <div className="login-alert login-alert-success">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            {info}
          </div>
        )}

        {/* Google button (not on forgot) */}
        {mode !== 'forgot' && (
          <>
            <button className="login-google-btn" onClick={handleGoogle} disabled={loading} type="button">
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <div className="login-divider">
              <span>or</span>
            </div>
          </>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="login-form" noValidate>
          {mode === 'signup' && (
            <div className="login-field">
              <label>Full Name</label>
              <input
                type="text"
                className="input"
                placeholder="Enter your name"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                autoComplete="name"
                disabled={loading}
              />
            </div>
          )}

          <div className="login-field">
            <label>Email Address</label>
            <input
              type="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              disabled={loading}
            />
          </div>

          {mode !== 'forgot' && (
            <div className="login-field">
              <div className="login-field-header">
                <label>Password</label>
                {mode === 'login' && (
                  <button type="button" className="login-link-btn" onClick={() => switchMode('forgot')}>
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="login-password-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input"
                  placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter your password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="login-eye-btn"
                  onClick={() => setShowPassword(v => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          )}

          {mode === 'signup' && (
            <div className="login-field">
              <label>Confirm Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                className="input"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                disabled={loading}
              />
            </div>
          )}

          <button type="submit" className="btn btn-primary login-submit-btn" disabled={loading}>
            {loading ? (
              <span className="login-spinner" />
            ) : mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
          </button>
        </form>

        {/* Footer links */}
        <div className="login-footer">
          {mode === 'login' && (
            <p>Don't have an account?{' '}
              <button className="login-link-btn" onClick={() => switchMode('signup')}>Sign up</button>
            </p>
          )}
          {mode === 'signup' && (
            <p>Already have an account?{' '}
              <button className="login-link-btn" onClick={() => switchMode('login')}>Sign in</button>
            </p>
          )}
          {mode === 'forgot' && (
            <p>
              <button className="login-link-btn" onClick={() => switchMode('login')}>← Back to sign in</button>
            </p>
          )}
        </div>
      </div>

      <a
        className={`login-developer-badge ${developerBadgeExpanded ? 'login-developer-badge-expanded' : ''}`}
        href="https://www.bibekchandsah.com.np/"
        target="_blank"
        rel="noopener noreferrer"
        title="Developer: Bibek Chandsah"
        aria-label="Open developer website"
      >
        <img
          src="https://bibekchandsah.github.io/kiitcse/assets/image/developer.jpg"
          alt="Developer"
          className="login-developer-badge-image"
        />
        <span className="login-developer-badge-text">Developed by Bibek</span>
      </a>
    </div>
  );
};

export default Login;
