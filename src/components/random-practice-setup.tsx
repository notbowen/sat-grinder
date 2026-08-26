"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, Calculator, LoaderCircle } from "lucide-react";
import { startPractice, type PracticePool, type PracticeSubject } from "@/lib/supabase-api";

const subjectOptions: { value: PracticeSubject; label: string; description: string; icon: typeof BookOpen }[] = [
  { value: "mixed", label: "Mix", description: "English and Math", icon: BookOpen },
  { value: "math", label: "Math only", description: "Math questions", icon: Calculator },
  { value: "english", label: "English only", description: "Reading & Writing", icon: BookOpen },
];

function subjectCount(pool: PracticePool, subject: PracticeSubject) {
  if (subject === "math") return pool.math;
  if (subject === "english") return pool.readingWriting;
  return pool.total;
}

export function RandomPracticeSetup({ pool }: { pool: PracticePool }) {
  const router = useRouter();
  const [subject, setSubject] = useState<PracticeSubject>("mixed");
  const [count, setCount] = useState(Math.min(10, Math.max(1, pool.total)));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const selectionCount = subjectCount(pool, subject);
  const available = Math.min(50, selectionCount);

  function chooseSubject(nextSubject: PracticeSubject) {
    const nextAvailable = Math.min(50, subjectCount(pool, nextSubject));
    setSubject(nextSubject);
    setCount((current) => Math.max(1, Math.min(current, nextAvailable || 1)));
  }

  async function start() {
    setError("");
    setLoading(true);
    try {
      const sessionId = await startPractice(count, subject);
      router.push(`/practice/session/?session=${encodeURIComponent(sessionId)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The quiz could not be created.");
      setLoading(false);
    }
  }

  return <div className="setup-grid">
    <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-7">
      <fieldset>
        <legend className="eyebrow">Question mix</legend>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {subjectOptions.map(({ value, label, description, icon: Icon }) => <label key={value} className="subject-option">
            <input type="radio" name="practice-subject" value={value} checked={subject === value} onChange={() => chooseSubject(value)} />
            <span className="subject-option-icon"><Icon className="size-5" /></span>
            <span><strong>{label}</strong><small>{description}</small></span>
            <span className="subject-option-count">{subjectCount(pool, value).toLocaleString()}</span>
          </label>)}
        </div>
      </fieldset>
      <div className="mt-6 rounded-xl bg-[var(--blue-soft,#e3f1f4)] p-6">
        <p className="text-lg font-bold">Your remaining pool</p>
        <p className="mt-2 leading-7 text-[var(--muted)]">Every eligible question in the selected mix is equally likely, including questions already in your review pile.</p>
        <p className="mt-6 font-[family-name:var(--font-display)] text-5xl font-bold tracking-[-.05em] text-[var(--blue-dark)]">{selectionCount.toLocaleString()}</p>
        <p className="mt-1 text-sm font-semibold text-[var(--muted)]">questions available</p>
      </div>
    </section>
    <aside className="h-fit rounded-2xl border border-[var(--line)] bg-white p-6 lg:sticky lg:top-24">
      <p className="eyebrow">Quiz size</p>
      <label className="mt-4 block"><span className="sr-only">Number of questions</span><input className="form-input text-2xl font-bold" type="number" min={1} max={Math.max(1, available)} value={count} onChange={(event) => setCount(Number(event.target.value))} /></label>
      <p className="mt-2 text-sm text-[var(--muted)]">{selectionCount.toLocaleString()} eligible in this pool · maximum 50 per quiz</p>
      {error && <p className="form-error mt-4" role="alert">{error}</p>}
      <button className="primary-button mt-6 w-full" onClick={start} disabled={loading || selectionCount === 0 || count < 1 || count > available}>{loading ? <LoaderCircle className="size-5 animate-spin" /> : <>Start quiz <ArrowRight className="size-5" /></>}</button>
    </aside>
  </div>;
}
