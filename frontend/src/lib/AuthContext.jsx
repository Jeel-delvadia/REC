import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, supabaseEnabled } from './supabaseClient';
import { fetchMe } from '../api/client';

const AuthContext = createContext(null);

// RS-21 (§9.5): matches the backend's own soft-gate default (app/core/auth.py's local-dev
// fallback) - with Supabase unconfigured there's no real user to scope down to, so the app
// behaves exactly as it did before RBAC existed: full access, nothing hidden.
const UNGATED_ROLE = { role: 'registry_admin', plantId: null };

export function AuthProvider({ children }) {
  // supabaseEnabled === false (no env vars set) means the whole login flow is skipped and the
  // app behaves as it did before RS-16 - matches the backend's SUPABASE_JWT_SECRET soft-gate.
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(supabaseEnabled);
  const [roleInfo, setRoleInfo] = useState(supabaseEnabled ? null : UNGATED_ROLE);
  const [roleLoading, setRoleLoading] = useState(supabaseEnabled);

  useEffect(() => {
    if (!supabaseEnabled) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabaseEnabled) return;
    if (!session) {
      setRoleInfo(null);
      return;
    }
    // RS-21: once signed in, learn our own role/plant so the UI can hide nav items and
    // action buttons the caller isn't permitted to use - the backend is still the real
    // enforcement point (this is UX only, never a security boundary on its own).
    let cancelled = false;
    setRoleLoading(true);
    fetchMe()
      .then((me) => {
        if (!cancelled) setRoleInfo({ role: me.role, plantId: me.plant_id });
      })
      .catch(() => {
        if (!cancelled) setRoleInfo(null);
      })
      .finally(() => {
        if (!cancelled) setRoleLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  const value = {
    enabled: supabaseEnabled,
    session,
    loading,
    user: session?.user ?? null,
    accessToken: session?.access_token ?? null,
    // While Supabase is enabled and the real role hasn't loaded yet, `role` stays null rather
    // than defaulting to something permissive - a role-gated button should stay hidden during
    // that brief window, not flash visible and then disappear once the real (lesser) role lands.
    role: roleInfo?.role ?? (supabaseEnabled ? null : UNGATED_ROLE.role),
    plantId: roleInfo?.plantId ?? null,
    roleLoading,
    signInWithPassword: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    // RS-22: `role`/`plantId` land in the new account's user_metadata, which Supabase embeds
    // into every access token that account gets afterward - the backend reads it back out of
    // the JWT (app/core/auth.py's _resolve_profile) the first time this account makes an
    // authenticated request, and only then, to set its initial role. registry_admin is never
    // accepted through this path no matter what's passed here - see SELF_SERVICE_ROLES there.
    signUp: (email, password, role, plantId) =>
      supabase.auth.signUp({
        email,
        password,
        options: { data: plantId ? { role, plant_id: plantId } : { role } },
      }),
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth() must be used inside <AuthProvider>');
  return ctx;
}
