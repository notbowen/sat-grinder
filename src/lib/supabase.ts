"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

let browserClient: SupabaseClient<Database> | undefined;

export function getSupabase() {
  if (browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  }
  browserClient = createClient<Database>(url, publishableKey, {
    auth: {
      flowType: "pkce",
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return browserClient;
}

// True only for a `pnpm dev:local` dev server, which points the client at the
// local Supabase stack and exports NEXT_PUBLIC_SUPABASE_LOCAL=true. This is the
// runtime guard; what keeps the local sign-in form out of production bundles is
// the equivalent module-level constant in the login form, which the minifier can
// fold away.
export function localSupabaseAuth() {
  return process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_SUPABASE_LOCAL === "true";
}

export function supabaseConfigurationError() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ? null
    : "This deployment is missing its public Supabase configuration.";
}
