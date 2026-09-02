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
          <p className="eyebrow">Digital SAT · medium and hard</p>
          <h1 className="login-brand-title mt-5">Turn hard questions into <em>familiar</em> ones.</h1>
          <p className="login-brand-copy">Medium and hard questions. Misses come back until solved first try.</p>
        </div>
        <div className="login-brand-foot"><span>Reading &amp; Writing</span><span>Math</span><span>Rates show their n</span></div>
      </section>
      <section className="login-panel">
        <div className="login-form-card">
          <h2 className="display-2">Sign in</h2>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
