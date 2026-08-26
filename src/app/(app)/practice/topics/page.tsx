"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { PracticeSetup } from "@/components/practice-setup";
import { getTopicCatalog, type TopicDomain } from "@/lib/supabase-api";

export default function TopicPracticePage() {
  const [catalog, setCatalog] = useState<TopicDomain[] | null>(null); const [error, setError] = useState("");
  useEffect(() => { void getTopicCatalog().then(setCatalog).catch((cause) => setError(cause instanceof Error ? cause.message : "Practice unavailable.")); }, []);
  const eligible = catalog?.reduce((sum, domain) => sum + domain.count, 0) ?? 0;
  return <main className="page-container"><p className="eyebrow">Topic practice</p><h1 className="page-title">Aim at the weak spot.</h1><p className="page-subtitle">Choose whole domains or drill down to one or more specific skills.</p><div className="mt-9">{error ? <p className="form-error">{error}</p> : !catalog ? <LoaderCircle className="size-7 animate-spin text-[var(--blue)]" /> : <PracticeSetup mode="topics" eligible={eligible} catalog={catalog} />}</div></main>;
}
