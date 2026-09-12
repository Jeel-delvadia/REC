import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, supabaseEnabled } from './supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // supabaseEnabled === false (no env vars set) means the whole login flow is skipped and the
  // app behaves as it did before RS-16 - matches the backend's SUPABASE_JWT_SECRET soft-gate.
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(supabaseEnabled);

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

  const value = {
    enabled: supabaseEnabled,
    session,
    loading,
    user: session?.user ?? null,
    accessToken: session?.access_token ?? null,
    signInWithPassword: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signUp: (email, password) => supabase.auth.signUp({ email, password }),
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth() must be used inside <AuthProvider>');
  return ctx;
}
