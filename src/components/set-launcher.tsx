"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { startPractice, type PracticePool, type PracticeSubject } from "@/lib/supabase-api";
import { readLastSetSettings, saveLastSetSettings } from "@/lib/set-settings";

const subjectOptions: { value: PracticeSubject; label: string }[] = [
  { value: "mixed", label: "Mix" },
  { value: "english", label: "Reading & Writing" },
  { value: "math", label: "Math" },
];
const presets = [5, 10, 20, 30, 50];
export const MAX_SET_SIZE = 50;

export function subjectCount(pool: PracticePool, subject: PracticeSubject) {
  if (subject === "math") return pool.math;
  if (subject === "english") return pool.readingWriting;
  return pool.total;
}

function clamp(count: number, available: number) {
  return Math.max(1, Math.min(count, available || 1));
}

export function setPath(sessionId: string) {
  return `/practice/set/?set=${encodeURIComponent(sessionId)}`;
}

/** Mix and size for a new set. `blocked` names why starting is off, such as a set already in progress. */
export function SetLauncher({ pool, blocked }: { pool: PracticePool; blocked?: string }) {
  const router = useRouter();
  const [settings] = useState(readLastSetSettings);
  const [subject, setSubject] = useState<PracticeSubject>(settings.subject);
  const [count, setCount] = useState(() => clamp(settings.count, Math.min(MAX_SET_SIZE, subjectCount(pool, settings.subject))));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const selectionCount = subjectCount(pool, subject);
  const available = Math.min(MAX_SET_SIZE, selectionCount);

  function chooseSubject(nextSubject: PracticeSubject) {
    setSubject(nextSubject);
    setCount((current) => clamp(current, Math.min(MAX_SET_SIZE, subjectCount(pool, nextSubject))));
  }

  async function start() {
    setError("");
    setLoading(true);
    try {
      const sessionId = await startPractice(count, subject);
      saveLastSetSettings({ subject, count });
      router.push(setPath(sessionId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start.");
      setLoading(false);
    }
  }

  return <section className="panel launcher" aria-labelledby="new-set-title">
    <div className="launcher-head">
      <h2 id="new-set-title" className="eyebrow eyebrow-ink">New set</h2>
      <p className="small muted">Timed only while a question is on screen.</p>
    </div>
    <fieldset>
      <legend className="sr-only">Mix</legend>
      <div className="subject-options">
        {subjectOptions.map(({ value, label }) => <label key={value} className="subject-option">
          <input type="radio" name="set-subject" value={value} checked={subject === value} onChange={() => chooseSubject(value)} />
          <strong>{label}</strong>
          <small>{subjectCount(pool, value).toLocaleString()} left</small>
        </label>)}
      </div>
    </fieldset>
    <div>
      <p className="stat-label">Questions</p>
      <div className="count-presets mt-3" role="group" aria-label="Questions">
        {presets.map((preset) => <button key={preset} type="button" className={count === preset ? "active" : ""} aria-pressed={count === preset} disabled={preset > available} onClick={() => setCount(preset)}>{preset}</button>)}
        <input className="count-input" type="number" min={1} max={Math.max(1, available)} aria-label="Number of questions" placeholder={`1–${Math.max(1, available)}`} value={count} onChange={(event) => setCount(Number(event.target.value))} />
      </div>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div>
      <button className="btn btn-primary btn-lg w-full" onClick={start} disabled={loading || Boolean(blocked) || selectionCount === 0 || count < 1 || count > available}>
        {loading ? <LoaderCircle className="size-5 animate-spin" /> : <>Start {count} question{count === 1 ? "" : "s"} <ArrowRight className="size-4" aria-hidden="true" /></>}
      </button>
      <p className="small muted mt-3">{blocked ?? "Unseen and review questions, equal odds."}</p>
    </div>
  </section>;
}
