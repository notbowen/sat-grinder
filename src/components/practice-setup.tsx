"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";

type Domain = { code: string; name: string; section: "math" | "reading-writing"; count: number; skills: { code: string; name: string; count: number }[] };

export function PracticeSetup({ mode, eligible, catalog = [] }: { mode: "random" | "topics"; eligible: number; catalog?: Domain[] }) {
  const router = useRouter(); const [count, setCount] = useState(Math.min(10, eligible || 10)); const [selected, setSelected] = useState<string[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const selectionCount = useMemo(() => {
    if (mode === "random") return eligible;
    const domainCounts = new Map<string, number>(catalog.map((domain) => [`domain:${domain.code}`, domain.count]));
    const skillCounts = new Map<string, number>(catalog.flatMap((domain) => domain.skills.map((skill) => [`skill:${skill.code}`, skill.count] as [string, number])));
    return selected.reduce((total, key) => total + (domainCounts.get(key) ?? skillCounts.get(key) ?? 0), 0);
  }, [catalog, eligible, mode, selected]);
  const available = Math.min(50, selectionCount);

  function toggle(key: string, domain?: Domain) {
    setSelected((current) => {
      const has = current.includes(key);
      if (key.startsWith("domain:") && domain) {
        const skillKeys = domain.skills.map((skill) => `skill:${skill.code}`);
        return has ? current.filter((item) => item !== key) : [...current.filter((item) => !skillKeys.includes(item)), key];
      }
      if (domain) return has ? current.filter((item) => item !== key) : [...current.filter((item) => item !== `domain:${domain.code}`), key];
      return has ? current.filter((item) => item !== key) : [...current, key];
    });
  }

  async function start() {
    setError(""); setLoading(true);
    const response = await fetch("/api/practice/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode, count, topics: selected }) });
    const data = await response.json(); setLoading(false);
    if (!response.ok) { setError(data.error || "The quiz could not be created."); return; }
    router.push(`/practice/${data.sessionId}`);
  }

  return <div className="setup-grid">
    <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-7">
      {mode === "topics" && <div className="space-y-7">
        {(["reading-writing", "math"] as const).map((section) => <div key={section}><p className="eyebrow">{section === "math" ? "Math" : "Reading & Writing"}</p><div className="mt-3 space-y-3">
          {catalog.filter((domain) => domain.section === section).map((domain) => <div key={domain.code} className="topic-selector">
            <label className="flex cursor-pointer items-start gap-3 font-bold"><input type="checkbox" className="check-input" checked={selected.includes(`domain:${domain.code}`)} onChange={() => toggle(`domain:${domain.code}`, domain)} /><span>{domain.name}<span className="ml-2 text-xs font-semibold text-[var(--muted)]">{domain.count}</span></span></label>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">{domain.skills.map((skill) => <label key={skill.code} className="skill-check"><input type="checkbox" className="check-input" disabled={selected.includes(`domain:${domain.code}`)} checked={selected.includes(`skill:${skill.code}`)} onChange={() => toggle(`skill:${skill.code}`, domain)} /><span>{skill.name}<small>{skill.count}</small></span></label>)}</div>
          </div>)}
        </div></div>)}
      </div>}
      {mode === "random" && <div className="rounded-xl bg-[var(--blue-soft,#e3f1f4)] p-6"><p className="text-lg font-bold">Your full remaining pool</p><p className="mt-2 leading-7 text-[var(--muted)]">All eligible Reading & Writing and Math questions are equally likely, including questions already in your review pile.</p><p className="mt-6 font-[family-name:var(--font-display)] text-5xl font-bold tracking-[-.05em] text-[var(--blue-dark)]">{eligible.toLocaleString()}</p><p className="mt-1 text-sm font-semibold text-[var(--muted)]">questions available</p></div>}
    </section>
    <aside className="h-fit rounded-2xl border border-[var(--line)] bg-white p-6 lg:sticky lg:top-24"><p className="eyebrow">Quiz size</p><label className="mt-4 block"><span className="sr-only">Number of questions</span><input className="form-input text-2xl font-bold" type="number" min={1} max={Math.max(1, available)} value={count} onChange={(event) => setCount(Number(event.target.value))} /></label><p className="mt-2 text-sm text-[var(--muted)]">{selectionCount.toLocaleString()} eligible in this pool · maximum 50 per quiz</p>
      {error && <p className="form-error mt-4" role="alert">{error}</p>}
      <button className="primary-button mt-6 w-full" onClick={start} disabled={loading || selectionCount === 0 || count < 1 || count > available}>{loading ? <LoaderCircle className="size-5 animate-spin" /> : <>Start quiz <ArrowRight className="size-5" /></>}</button>
    </aside>
  </div>;
}
