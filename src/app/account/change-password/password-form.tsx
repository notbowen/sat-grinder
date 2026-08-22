"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

export function ChangePasswordForm() {
  const router = useRouter(); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(""); const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get("currentPassword") ?? ""); const newPassword = String(form.get("newPassword") ?? ""); const confirmation = String(form.get("confirmation") ?? "");
    if (newPassword !== confirmation) { setError("The new passwords do not match."); setLoading(false); return; }
    const response = await fetch("/api/account/password-changed", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword }) });
    if (!response.ok) { const result = await response.json(); setError(result.error || "The password could not be changed."); setLoading(false); return; }
    router.replace("/dashboard"); router.refresh();
  }
  return <form className="mt-8 space-y-5" onSubmit={submit}>
    <label className="form-label">Current password<input className="form-input" type="password" name="currentPassword" autoComplete="current-password" required /></label>
    <label className="form-label">New password<input className="form-input" type="password" name="newPassword" autoComplete="new-password" minLength={12} required /></label>
    <label className="form-label">Confirm new password<input className="form-input" type="password" name="confirmation" autoComplete="new-password" minLength={12} required /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="primary-button w-full" disabled={loading}>{loading ? <LoaderCircle className="size-5 animate-spin" /> : "Save new password"}</button>
  </form>;
}
