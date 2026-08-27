"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

function getSafeReturnPath(searchParams: URLSearchParams) {
  const returnTo = searchParams.get("returnTo");
  if (!returnTo) return "/dashboard/";

  try {
    const returnUrl = new URL(returnTo, window.location.origin);
    if (returnUrl.origin !== window.location.origin) return "/dashboard/";
    return `${returnUrl.pathname}${returnUrl.search}${returnUrl.hash}`;
  } catch {
    return "/dashboard/";
  }
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.resolve().then(async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get("code");
      if (!code) { setError("Google did not return a valid authorization code."); return; }
      const supabase = getSupabase();
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) setError(exchangeError.message);
      else {
        const { error: profileError } = await supabase.rpc("sync_oauth_profile");
        if (profileError) setError(profileError.message);
        else router.replace(getSafeReturnPath(searchParams));
      }
    });
  }, [router]);

  return <main className="grid min-h-screen place-items-center bg-[var(--paper)] p-6">
    <div className="max-w-md rounded-2xl border border-[var(--line)] bg-white p-8 text-center">
      {error ? <><p className="form-error" role="alert">{error}</p><a href="/login/" className="secondary-button mt-5">Return to sign in</a></>
        : <><LoaderCircle className="mx-auto size-7 animate-spin text-[var(--blue)]" /><p className="mt-4 font-bold">Finishing Google sign-in…</p></>}
    </div>
  </main>;
}
