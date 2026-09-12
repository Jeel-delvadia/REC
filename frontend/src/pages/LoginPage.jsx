import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, Mail, Lock, AlertTriangle, CheckCircle2, UserCog, Building2,
  ArrowLeft, Network, ScanSearch, FileCheck2,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { fetchPlants } from '../api/client';
import { SELF_SERVICE_ROLES, ROLE_LABELS } from '../lib/permissions';
import Button from '../components/ui/Button';

const SIDE_POINTS = [
  { icon: ScanSearch, text: 'Five-check risk scoring on every certificate' },
  { icon: Network, text: 'Provenance graph across plants, meters & holders' },
  { icon: FileCheck2, text: 'SHA-256 hash-chained, tamper-evident ledger' },
];

export default function LoginPage() {
  const { signInWithPassword, signUp, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [mode, setMode] = useState(searchParams.get('mode') === 'signup' ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // RS-22: what a new account signs up *as*. registry_admin is never offered here - see
  // SELF_SERVICE_ROLES's own comment for why that's a security boundary, not an oversight.
  const [role, setRole] = useState('auditor');
  const [plantId, setPlantId] = useState('');
  const [plants, setPlants] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [signupNotice, setSignupNotice] = useState('');

  // Already signed in (e.g. followed a bookmarked /login link) - nothing to do here.
  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (mode === 'signup' && role === 'plant_operator' && plants.length === 0) {
      fetchPlants().then(setPlants).catch(() => {});
    }
  }, [mode, role]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSignupNotice('');
    if (mode === 'signup' && role === 'plant_operator' && !plantId) {
      setError('Select which plant you operate.');
      return;
    }
    setSubmitting(true);
    try {
      const { error: authError } =
        mode === 'signin'
          ? await signInWithPassword(email.trim(), password)
          : await signUp(email.trim(), password, role, role === 'plant_operator' ? plantId : null);
      if (authError) throw authError;
      if (mode === 'signup') {
        setSignupNotice('Account created. If email confirmation is on for this project, check your inbox before signing in.');
        setMode('signin');
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[var(--bg-app)]">
      {/* Left: brand panel - hidden on small screens, this is the "split screen" half */}
      <div className="hidden lg:flex lg:w-[44%] bg-[var(--brand)] relative overflow-hidden flex-col justify-between p-10 xl:p-14">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}
        />
        <Link to="/" className="relative flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg text-white tracking-tight">RECShield</span>
        </Link>

        <div className="relative">
          <h2 className="text-3xl font-bold text-white tracking-tight leading-tight" style={{ textWrap: 'balance' }}>
            Certificate integrity, verified end to end.
          </h2>
          <p className="text-sm text-white/75 mt-4 max-w-sm leading-relaxed">
            One platform for scoring, investigating and publicly verifying every Renewable
            Energy Certificate that passes through your registry.
          </p>
          <div className="mt-8 space-y-3">
            {SIDE_POINTS.map((p) => (
              <div key={p.text} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-md bg-white/15 flex items-center justify-center shrink-0">
                  <p.icon className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-sm text-white/90">{p.text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-white/50">RECShield Platform &copy; 2026</p>
      </div>

      {/* Right: form */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-sm">
          <Link to="/" className="lg:hidden flex items-center gap-2.5 mb-8 justify-center">
            <div className="w-8 h-8 rounded-lg bg-[var(--brand)] flex items-center justify-center">
              <ShieldCheck className="w-[18px] h-[18px] text-white" />
            </div>
            <span className="font-bold text-[15px] text-[var(--text-primary)] tracking-tight">RECShield</span>
          </Link>

          <Link to="/" className="hidden lg:inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-6">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to home
          </Link>

          <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
            {mode === 'signin' ? 'Sign in to your account' : 'Create your account'}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1.5">
            {mode === 'signin' ? 'Welcome back — enter your details below.' : 'A few details and you’re in.'}
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <AnimatePresence mode="wait" initial={false}>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-3 rounded-lg badge-likely_fraud flex items-center gap-2 text-xs font-medium overflow-hidden"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}
              {signupNotice && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-3 rounded-lg badge-genuine flex items-center gap-2 text-xs font-medium overflow-hidden"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{signupNotice}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label htmlFor="login-email" className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[var(--text-tertiary)]" /> Email
              </label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[var(--surface)] border border-[var(--border-strong)] focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)]/25 rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[var(--text-tertiary)]" /> Password
              </label>
              <input
                id="login-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[var(--surface)] border border-[var(--border-strong)] focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)]/25 rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors"
                placeholder="••••••••"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              />
            </div>

            {/* RS-22: role choice only matters at signup - a returning account keeps whatever
                role it was given (by itself here, or later by a registry admin). */}
            {mode === 'signup' && (
              <>
                <div>
                  <label htmlFor="login-role" className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5 flex items-center gap-1.5">
                    <UserCog className="w-3.5 h-3.5 text-[var(--text-tertiary)]" /> I am signing up as
                  </label>
                  <select
                    id="login-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-[var(--surface)] border border-[var(--border-strong)] focus:border-[var(--brand)] rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors"
                  >
                    {SELF_SERVICE_ROLES.map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-[var(--text-tertiary)] mt-1.5">
                    Need Registry Admin access instead? Ask an existing admin to grant it from User Management &mdash; it isn't self-serve.
                  </p>
                </div>

                {role === 'plant_operator' && (
                  <div>
                    <label htmlFor="login-plant" className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-[var(--text-tertiary)]" /> Which plant do you operate?
                    </label>
                    <select
                      id="login-plant"
                      value={plantId}
                      onChange={(e) => setPlantId(e.target.value)}
                      className="w-full bg-[var(--surface)] border border-[var(--border-strong)] focus:border-[var(--brand)] rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors"
                    >
                      <option value="">Select a plant…</option>
                      {plants.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}

            <Button type="submit" variant="primary" disabled={submitting} className="w-full py-2.5 justify-center">
              {submitting ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </Button>

            <button
              type="button"
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setError('');
                setSignupNotice('');
              }}
              className="w-full text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors py-1"
            >
              {mode === 'signin' ? "New here? Create an account" : 'Already have an account? Sign in'}
            </button>
          </form>

          <p className="text-center text-[11px] text-[var(--text-tertiary)] mt-6">
            Public certificate verification doesn't need an account &mdash; scan a REC's QR code directly.
          </p>
        </div>
      </div>
    </div>
  );
}
