"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const form = new FormData(event.currentTarget);
    const result = await authClient.signIn.username({ username: String(form.get("username") ?? ""), password: String(form.get("password") ?? "") });
    setLoading(false);
    if (result.error) { setError(result.error.message || "That username or password was not recognized."); return; }
    router.replace("/dashboard"); router.refresh();
  }

  return <form className="mt-8 space-y-5" onSubmit={submit}>
    <label className="form-label">Username<input className="form-input" name="username" autoComplete="username" required minLength={3} autoFocus /></label>
    <label className="form-label">Password<input className="form-input" type="password" name="password" autoComplete="current-password" required /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="primary-button w-full" disabled={loading}>{loading ? <LoaderCircle className="size-5 animate-spin" /> : <>Sign in <ArrowRight className="size-5" /></>}</button>
  </form>;
}
