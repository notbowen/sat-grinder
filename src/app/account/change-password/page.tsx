import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { ChangePasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Change password" };
export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const current = await requireSession({ allowPasswordChange: true });
  return <main className="login-panel"><div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-white p-7 shadow-sm sm:p-9">
    <div className="brand-lockup mb-10"><span className="brand-mark">SG</span><span>SAT Grinder</span></div>
    <p className="eyebrow">Secure your account</p><h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold tracking-[-0.045em]">Choose a new password.</h1>
    <p className="mt-3 text-[var(--muted)]">Hi {current.user.name}. Your new password must be at least 12 characters.</p><ChangePasswordForm />
  </div></main>;
}
