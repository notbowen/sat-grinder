import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentSession()) redirect("/dashboard");
  return (
    <main className="login-page">
      <section className="login-brand">
        <div className="brand-lockup"><span className="brand-mark">SG</span><span>SAT Grinder</span></div>
        <div className="max-w-xl"><p className="eyebrow text-white/60">Practice with purpose</p><h1 className="mt-4 font-[family-name:var(--font-display)] text-5xl font-bold tracking-[-0.055em] text-white sm:text-6xl">Turn hard questions into familiar ones.</h1><p className="mt-5 max-w-lg text-lg leading-8 text-white/65">Work through medium and hard SAT questions by topic, get immediate feedback, and keep every miss in rotation until you own it.</p></div>
        <div className="flex gap-6 text-sm font-semibold text-white/55"><span>Reading & Writing</span><span>Math</span><span>Medium + hard</span></div>
      </section>
      <section className="login-panel"><div className="w-full max-w-md"><p className="eyebrow">Welcome back</p><h2 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-bold tracking-[-0.045em]">Ready for another round?</h2><p className="mt-3 text-[var(--muted)]">Sign in with the username your administrator created.</p><LoginForm /></div></section>
    </main>
  );
}
