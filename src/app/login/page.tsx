import type { Metadata } from "next";
import { Wordmark } from "@/components/app-shell";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-brand">
        <Wordmark />
        <div>
          <p className="eyebrow">Digital SAT · medium and hard only</p>
          <h1 className="login-brand-title mt-5">Turn hard questions into <em>familiar</em> ones.</h1>
          <p className="login-brand-copy">Bluebook-style questions, instant feedback, and a review queue that brings back every miss until you get it right.</p>
        </div>
        <div className="login-brand-foot"><span>Reading &amp; Writing</span><span>Math</span><span>Medium + hard</span><span>Stats with denominators</span></div>
      </section>
      <section className="login-panel">
        <div className="login-form-card">
          <p className="eyebrow">Welcome</p>
          <h2 className="display-2">Sign in</h2>
          <p className="lede mt-4" style={{ fontSize: ".95rem" }}>Use Google to start or pick up where you left off.</p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
