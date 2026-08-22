"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, KeyRound, LoaderCircle, UserPlus } from "lucide-react";

type ManagedUser = { id: string; name: string; username: string | null; role: string | null; banned: boolean | null; mustChangePassword: boolean; createdAt: Date };

export function UserAdmin({ users, currentUserId }: { users: ManagedUser[]; currentUserId: string }) {
  const router = useRouter(); const [error, setError] = useState(""); const [loading, setLoading] = useState("");
  async function call(body: unknown, key: string) {
    setLoading(key); setError(""); const response = await fetch("/api/admin/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const data = await response.json(); setLoading("");
    if (!response.ok) { setError(data.error || "The account could not be updated."); return false; }
    router.refresh(); return true;
  }
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const ok = await call({ action: "create", username: form.get("username"), name: form.get("name"), password: form.get("password") }, "create"); if (ok) event.currentTarget.reset();
  }
  async function resetPassword(account: ManagedUser) {
    const password = window.prompt(`Enter a temporary password for @${account.username} (at least 12 characters):`); if (!password) return;
    await call({ action: "reset-password", userId: account.id, password }, `reset:${account.id}`);
  }
  return <div className="mt-8 grid gap-7 lg:grid-cols-[360px_minmax(0,1fr)]">
    <form className="h-fit rounded-2xl border border-[var(--line)] bg-white p-6" onSubmit={create}><span className="feedback-icon bg-[var(--blue)] text-white"><UserPlus className="size-5" /></span><h2 className="section-title mt-5">Create an account</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">The user must replace this temporary password after signing in.</p><div className="mt-6 space-y-4"><label className="form-label">Display name<input className="form-input" name="name" required maxLength={80} /></label><label className="form-label">Username<input className="form-input" name="username" required pattern="[a-zA-Z0-9._-]{3,30}" /></label><label className="form-label">Temporary password<input className="form-input" name="password" type="password" required minLength={12} /></label></div><button className="primary-button mt-6 w-full" disabled={loading === "create"}>{loading === "create" ? <LoaderCircle className="size-5 animate-spin" /> : "Create user"}</button>{error && <p className="form-error mt-4" role="alert">{error}</p>}</form>
    <section><div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">{users.map((account, index) => <div key={account.id} className={`user-row ${index ? "border-t border-[var(--line)]" : ""}`}><span className="grid size-10 place-items-center rounded-full bg-[var(--paper-deep)] font-bold">{account.name.slice(0, 1).toUpperCase()}</span><div className="min-w-0"><p className="truncate font-bold">{account.name} {account.role === "admin" && <span className="ml-1 rounded-full bg-[var(--gold-soft)] px-2 py-1 text-[.65rem] uppercase tracking-wider text-[var(--gold-dark)]">admin</span>}</p><p className="mt-1 truncate text-sm text-[var(--muted)]">@{account.username} · {account.banned ? "disabled" : account.mustChangePassword ? "password change required" : "active"}</p></div><div className="ml-auto flex gap-2"><button className="icon-button" onClick={() => resetPassword(account)} disabled={loading === `reset:${account.id}`} aria-label={`Reset password for ${account.name}`}>{loading === `reset:${account.id}` ? <LoaderCircle className="size-4 animate-spin" /> : <KeyRound className="size-4" />}</button><button className={`icon-button ${account.banned ? "text-[var(--green)]" : "text-[var(--coral-dark)]"}`} onClick={() => call({ action: "set-disabled", userId: account.id, disabled: !account.banned }, `ban:${account.id}`)} disabled={account.id === currentUserId || loading === `ban:${account.id}`} aria-label={`${account.banned ? "Enable" : "Disable"} ${account.name}`}><Ban className="size-4" /></button></div></div>)}</div></section>
  </div>;
}
