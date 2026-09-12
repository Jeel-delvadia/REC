import React, { useState } from 'react';
import { Shield, Mail, Lock, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

export default function LoginPage() {
  const { signInWithPassword, signUp } = useAuth();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [signupNotice, setSignupNotice] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSignupNotice('');
    setSubmitting(true);
    try {
      const { error: authError } =
        mode === 'signin'
          ? await signInWithPassword(email.trim(), password)
          : await signUp(email.trim(), password);
      if (authError) throw authError;
      if (mode === 'signup') {
        setSignupNotice('Account created. If email confirmation is on for this project, check your inbox before signing in.');
        setMode('signin');
      }
      // On success in 'signin' mode, AuthContext's onAuthStateChange fires and the app re-renders past this page.
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-600 to-cyan-400 shadow-xl shadow-sky-500/20 mb-2">
            <Shield className="w-8 h-8 text-slate-950" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            REC<span className="text-sky-400">Shield</span>
          </h1>
          <p className="text-xs text-slate-400">Auditor sign-in</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-panel p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {signupNotice && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{signupNotice}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-sky-400" /> Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl px-3 py-2 text-sm text-slate-200 outline-none"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-purple-400" /> Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl px-3 py-2 text-sm text-slate-200 outline-none"
              placeholder="••••••••"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-slate-950 font-extrabold text-sm transition-all disabled:opacity-50"
          >
            {submitting ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError('');
              setSignupNotice('');
            }}
            className="w-full text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            {mode === 'signin' ? "New auditor? Create an account" : 'Already have an account? Sign in'}
          </button>
        </form>

        <p className="text-center text-[11px] text-slate-600">
          Public certificate verification doesn't need an account &mdash; scan a REC's QR code directly.
        </p>
      </div>
    </div>
  );
}
