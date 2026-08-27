"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase, supabaseConfigurationError } from "@/lib/supabase";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const configurationError = supabaseConfigurationError();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!configurationError);
  const [error, setError] = useState<string | null>(configurationError);

  useEffect(() => {
    if (configurationError) return;
    const supabase = getSupabase();
    let mounted = true;
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return;
      setSession(data.session);
      setError(sessionError?.message ?? null);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, [configurationError]);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    loading,
    error,
    async signInWithGoogle() {
      setError(null);
      const returnTo = window.location.href;
      const callbackUrl = new URL("/auth/callback/", returnTo);
      callbackUrl.searchParams.set("returnTo", returnTo);
      const { error: authError } = await getSupabase().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl.toString(),
          scopes: "openid email profile",
        },
      });
      if (authError) { setError(authError.message); throw authError; }
    },
    async signOut() {
      const { error: authError } = await getSupabase().auth.signOut();
      if (authError) { setError(authError.message); throw authError; }
    },
  }), [error, loading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
