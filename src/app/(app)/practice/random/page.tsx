"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { RandomPracticeSetup } from "@/components/random-practice-setup";
import { getPracticePool, type PracticePool } from "@/lib/supabase-api";

export default function RandomPracticePage() {
  const [pool, setPool] = useState<PracticePool | null>(null); const [error, setError] = useState("");
  useEffect(() => { void getPracticePool().then(setPool).catch((cause) => setError(cause instanceof Error ? cause.message : "Practice unavailable.")); }, []);
  return <main className="page">
    <div className="page-head">
      <div>
        <p className="eyebrow">Random practice</p>
        <h1 className="page-title">Pick a mix and go.</h1>
        <p className="page-subtitle">Choose a mix and a size. Every unmastered question in the mix, unseen or in review, has the same odds.</p>
      </div>
      <div className="page-head-actions"><p className="small muted">Timed only while a question is on screen.</p></div>
    </div>
    <div className="mt-8">{error ? <p className="form-error" role="alert">{error}</p> : pool === null ? <p className="loading-inline"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Loading your pool</p> : <RandomPracticeSetup pool={pool} />}</div>
  </main>;
}
