"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { RandomPracticeSetup } from "@/components/random-practice-setup";
import { getPracticePool, type PracticePool } from "@/lib/supabase-api";

export default function RandomPracticePage() {
  const [pool, setPool] = useState<PracticePool | null>(null); const [error, setError] = useState("");
  useEffect(() => { void getPracticePool().then(setPool).catch((cause) => setError(cause instanceof Error ? cause.message : "Practice unavailable.")); }, []);
  return <main className="page-container"><p className="eyebrow">Random practice</p><h1 className="page-title">Let the bank surprise you.</h1><p className="page-subtitle">Choose a mix and quiz size. Every non-mastered question in your selection has an equal shot at appearing.</p><div className="mt-9">{error ? <p className="form-error">{error}</p> : pool === null ? <LoaderCircle className="size-7 animate-spin text-[var(--blue)]" /> : <RandomPracticeSetup pool={pool} />}</div></main>;
}
