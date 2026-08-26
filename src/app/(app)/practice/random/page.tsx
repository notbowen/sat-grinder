"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { PracticeSetup } from "@/components/practice-setup";
import { getTopicCatalog } from "@/lib/supabase-api";

export default function RandomPracticePage() {
  const [eligible, setEligible] = useState<number | null>(null); const [error, setError] = useState("");
  useEffect(() => { void getTopicCatalog().then((catalog) => setEligible(catalog.reduce((sum, domain) => sum + domain.count, 0))).catch((cause) => setError(cause instanceof Error ? cause.message : "Practice unavailable.")); }, []);
  return <main className="page-container"><p className="eyebrow">Random practice</p><h1 className="page-title">Let the bank surprise you.</h1><p className="page-subtitle">Choose a quiz size. Every non-mastered question has an equal shot at appearing.</p><div className="mt-9">{error ? <p className="form-error">{error}</p> : eligible === null ? <LoaderCircle className="size-7 animate-spin text-[var(--blue)]" /> : <PracticeSetup mode="random" eligible={eligible} />}</div></main>;
}
