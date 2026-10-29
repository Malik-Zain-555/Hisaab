import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { googleSignIn, emailSignIn, emailSignUp } from '../lib/auth';
import { Button, Input, Card, BrandLogo } from '../ui';
import { ShieldCheck, Mail, Lock, User, ArrowRight, Sparkles } from 'lucide-react';

export const AuthScreen: React.FC = () => {
  const { showToast } = useApp();
  const [isLoading, setIsLoading] = useState(false);
  const [showEmailAuth, setShowEmailAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  // Email form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [authError, setAuthError] = useState('');

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setAuthError('');
    try {
      const res = await googleSignIn();
      if (res?.user) {
        showToast({
          type: 'success',
          message: `Welcome, ${res.user.displayName || 'friend'}!`,
        });
      }
    } catch (err: any) {
      const msg = err.message || 'Could not sign in with Google.';
      setAuthError(msg);
      showToast({ type: 'error', message: msg });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setIsLoading(true);
    setAuthError('');
    try {
      if (authMode === 'signup') {
        if (!displayName.trim()) {
          setAuthError('Please enter your full name.');
          setIsLoading(false);
          return;
        }
        const user = await emailSignUp(email.trim(), password, displayName.trim());
        showToast({ type: 'success', message: `Account created for ${user.displayName}!` });
      } else {
        const user = await emailSignIn(email.trim(), password);
        showToast({ type: 'success', message: `Welcome back, ${user.displayName || user.email}!` });
      }
    } catch (err: any) {
      let msg = err.message || 'Authentication failed.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        msg = 'Invalid email or password.';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'An account already exists with this email. Please sign in instead.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters.';
      }
      setAuthError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative text-[var(--tx)] flex flex-col justify-between p-6 sm:p-10">
      {/* Animated Drifting Orbs + Dot Grid Background */}
      <div className="bg" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>

      {/* Top Header */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <BrandLogo size="md" />
          <div>
            <h1 className="text-xl font-extrabold font-heading tracking-tight text-[var(--tx)]">
              Hisaab
            </h1>
            <p className="text-[11px] text-[var(--mu)] -mt-0.5 font-medium">
              Smart Split &amp; Khata
            </p>
          </div>
        </div>
      </div>

      {/* Main Form Area */}
      <div className="max-w-md w-full mx-auto my-auto py-6 space-y-6 relative z-10">
        <Card className="space-y-5">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold font-heading tracking-tight text-[var(--tx)]">
              {showEmailAuth
                ? authMode === 'signup'
                  ? 'Create your account'
                  : 'Welcome back'
                : 'Sign in to your Hisaab'}
            </h2>
            <p className="text-xs sm:text-sm text-[var(--mu)] max-w-sm mx-auto">
              {showEmailAuth
                ? authMode === 'signup'
                  ? 'Set up your profile, track shared expenses, and connect with friends.'
                  : 'Enter your credentials to access your shared ledgers.'
                : 'Sign in with your Google or email account to track expenses and connect with friends.'}
            </p>
          </div>

          {/* Invite Welcome Badge */}
          {typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('invite') && (
            <div className="card t-em !p-3.5 text-center space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--em)]">
                Personal Invitation
              </span>
              <p className="text-xs font-bold text-[var(--tx)]">
                Salam! You were invited by @{new URLSearchParams(window.location.search).get('invite')}
              </p>
              <p className="text-[11px] text-[var(--mu)]">
                Sign in below to connect instantly and track shared expenses together.
              </p>
            </div>
          )}

          {authError && (
            <div className="p-3.5 rounded-[16px] bg-[var(--ro)]/15 border border-[var(--ro)]/30 text-[var(--ro)] text-xs font-semibold text-center">
              {authError}
            </div>
          )}

          {/* Primary Auth Actions */}
          {!showEmailAuth ? (
            <div className="space-y-3.5">
              {/* Google Sign In */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="btn s w-full !h-12 justify-center gap-3 text-sm font-bold disabled:opacity-60"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{isLoading ? 'Connecting...' : 'Continue with Google'}</span>
              </button>

              {/* Divider */}
              <div className="relative flex items-center justify-center py-1">
                <div className="border-t border-[var(--line)] w-full" />
                <span className="px-3 text-[11px] font-semibold text-[var(--mu)] uppercase">
                  or
                </span>
              </div>

              {/* Switch to Email Form */}
              <Button
                variant="outline"
                size="lg"
                fullWidth
                onClick={() => setShowEmailAuth(true)}
                icon={<Mail className="w-4 h-4 text-[var(--em)]" />}
              >
                Continue with Email &amp; Password
              </Button>
            </div>
          ) : (
            /* Email Form */
            <div className="space-y-4">
              {/* Toggle Sign In / Sign Up */}
              <div className="seg">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signin');
                    setAuthError('');
                  }}
                  className={authMode === 'signin' ? 'on' : ''}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signup');
                    setAuthError('');
                  }}
                  className={authMode === 'signup' ? 'on' : ''}
                >
                  Create account
                </button>
              </div>

              <form onSubmit={handleEmailSubmit} className="space-y-3.5">
                {authMode === 'signup' && (
                  <Input
                    label="Full name"
                    placeholder="e.g. Zain Ahmed"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    leftIcon={<User className="w-4 h-4" />}
                  />
                )}

                <Input
                  label="Email address"
                  type="email"
                  placeholder="name@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  leftIcon={<Mail className="w-4 h-4" />}
                />

                <Input
                  label="Password"
                  type="password"
                  placeholder="••••••••"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4" />}
                />

                <div className="pt-2 space-y-2">
                  <Button
                    type="submit"
                    fullWidth
                    size="lg"
                    variant="primary"
                    isLoading={isLoading}
                  >
                    {authMode === 'signup' ? 'Sign up & Create profile' : 'Sign in'}
                  </Button>

                  <button
                    type="button"
                    onClick={() => setShowEmailAuth(false)}
                    className="btn g sm w-full justify-center"
                  >
                    ← Back to other options
                  </button>
                </div>
              </form>
            </div>
          )}
        </Card>
      </div>

      {/* Bottom Footer info */}
      <div className="max-w-md w-full mx-auto text-center space-y-2 pb-2 relative z-10">
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-[var(--mu)]">
          <ShieldCheck className="w-3.5 h-3.5 text-[var(--em)]" />
          <span>Authenticated with Firebase. No default mock data.</span>
        </div>
      </div>
    </div>
  );
};

