"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase, localSupabaseAuth, supabaseConfigurationError } from "@/lib/supabase";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithLocalPassword: (email: string, password: string) => Promise<void>;
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
    // Local development only: the local Auth server has no Google provider, so
    // /login offers an email account that is created on first use.
    async signInWithLocalPassword(email, password) {
      if (!localSupabaseAuth()) throw new Error("Password sign-in is available only against a local Supabase stack.");
      setError(null);
      const supabase = getSupabase();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (!signInError) return;
      if (!/invalid login credentials/i.test(signInError.message)) { setError(signInError.message); throw signInError; }
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) { setError(signUpError.message); throw signUpError; }
      if (!data.session) {
        const message = "The local account was created without a session. Set `enable_confirmations = false` under [auth.email] in supabase/config.toml.";
        setError(message);
        throw new Error(message);
      }
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
