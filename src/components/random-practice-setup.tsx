"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, Calculator, LoaderCircle, Shuffle } from "lucide-react";
import { startPractice, type PracticePool, type PracticeSubject } from "@/lib/supabase-api";

const subjectOptions: { value: PracticeSubject; label: string; description: string; icon: typeof BookOpen }[] = [
  { value: "mixed", label: "Mix", description: "English and Math", icon: Shuffle },
  { value: "math", label: "Math only", description: "Math questions", icon: Calculator },
  { value: "english", label: "English only", description: "Reading & Writing", icon: BookOpen },
];
const presets = [5, 10, 20, 30, 50];

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
      setError(cause instanceof Error ? cause.message : "Could not create the quiz.");
      setLoading(false);
    }
  }

  return <div className="setup-grid">
    <section className="panel">
      <fieldset>
        <legend className="eyebrow">Question mix</legend>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {subjectOptions.map(({ value, label, description, icon: Icon }) => <label key={value} className="subject-option">
            <input type="radio" name="practice-subject" value={value} checked={subject === value} onChange={() => chooseSubject(value)} />
            <span className="subject-option-icon"><Icon className="size-4" aria-hidden="true" /></span>
            <span><strong>{label}</strong><small>{description}</small></span>
            <span className="subject-option-count">{subjectCount(pool, value).toLocaleString()}</span>
          </label>)}
        </div>
      </fieldset>
      <div className="pool-callout">
        <p className="stat-label">Your remaining pool</p>
        <div className="hero-number-row"><p className="hero-number">{selectionCount.toLocaleString()}</p><span>questions available</span></div>
        <p className="panel-copy" style={{ maxWidth: "34rem" }}>Every unmastered question in this mix has the same odds, review included. Mastered questions never come back.</p>
      </div>
    </section>
    <aside className="panel lg:sticky lg:top-20">
      <p className="eyebrow">Quiz size</p>
      <label className="mt-4 block"><span className="sr-only">Number of questions</span><input className="input count-input" type="number" min={1} max={Math.max(1, available)} value={count} onChange={(event) => setCount(Number(event.target.value))} /></label>
      <div className="count-presets" role="group" aria-label="Quick sizes">
        {presets.map((preset) => <button key={preset} type="button" className={count === preset ? "active" : ""} disabled={preset > available} onClick={() => setCount(preset)}>{preset}</button>)}
      </div>
      <p className="small muted mt-3">{selectionCount.toLocaleString()} eligible · max 50 per quiz</p>
      {error && <p className="form-error mt-4" role="alert">{error}</p>}
      <button className="btn btn-primary mt-6 w-full" onClick={start} disabled={loading || selectionCount === 0 || count < 1 || count > available}>{loading ? <LoaderCircle className="size-5 animate-spin" /> : <>Start quiz <ArrowRight className="size-4" aria-hidden="true" /></>}</button>
    </aside>
  </div>;
}
