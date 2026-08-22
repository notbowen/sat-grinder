import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Calculator, CheckCircle2, RotateCcw } from "lucide-react";
import { getDashboard } from "@/lib/dashboard";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const current = await requireSession();
  const data = await getDashboard(current.user.id);
  const percentage = data.total ? Math.round((data.mastered / data.total) * 100) : 0;
  const featuredTopics = [...data.topics].sort((a, b) => b.review - a.review || a.mastered / Math.max(a.total, 1) - b.mastered / Math.max(b.total, 1)).slice(0, 6);

  return <main className="page-container">
    <div className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div><p className="eyebrow">Your dashboard</p><h1 className="page-title">Keep the streak alive.</h1><p className="page-subtitle">Every correct first attempt moves you closer to mastery. Missed questions stay in rotation until they stick.</p></div>
      {data.activeSession && <Link href={`/practice/${data.activeSession.id}`} className="secondary-button">Resume {data.activeSession.mode === "random" ? "random" : "topic"} quiz <ArrowRight className="size-4" /></Link>}
    </div>

    {data.total === 0 && <div className="empty-banner"><BookOpen className="size-6" /><div><p className="font-bold">The question bank is not ready yet.</p><p className="text-sm text-[var(--muted)]">Ask an administrator to run the first authorized sync.</p></div>{current.user.role === "admin" && <Link href="/admin/question-bank" className="secondary-button ml-auto">Open sync controls</Link>}</div>}

    <div className="grid gap-4 sm:grid-cols-3">
      <article className="metric-card bg-[var(--ink)] text-white"><p className="metric-label text-white/60">Mastered</p><p className="metric-value">{data.mastered.toLocaleString()}</p><p className="mt-2 text-sm text-white/60">{percentage}% of your eligible bank</p></article>
      <article className="metric-card"><p className="metric-label">Still to go</p><p className="metric-value">{data.remaining.toLocaleString()}</p><p className="mt-2 text-sm text-[var(--muted)]">Across Reading & Writing and Math</p></article>
      <article className="metric-card border-[var(--coral)] bg-[var(--coral-soft)]"><p className="metric-label text-[var(--coral-dark)]">Review pile</p><p className="metric-value text-[var(--coral-dark)]">{data.review.toLocaleString()}</p><p className="mt-2 text-sm text-[var(--coral-dark)]/70">Missed questions awaiting a clean solve</p></article>
    </div>

    <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_350px]">
      <section>
        <div><p className="eyebrow">Progress by topic</p><h2 className="section-title">Where you stand</h2></div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
          {featuredTopics.length ? featuredTopics.map((topic, index) => { const percent = topic.total ? Math.round(topic.mastered / topic.total * 100) : 0; return <div key={`${topic.section}:${topic.domain}:${topic.skill}`} className={`topic-row ${index ? "border-t border-[var(--line)]" : ""}`}>
            <div><p className="font-bold">{topic.skill}</p><p className="mt-1 text-sm text-[var(--muted)]">{topic.domain} · {topic.section === "math" ? "Math" : "Reading & Writing"}</p></div>
            <div><div className="h-2 overflow-hidden rounded-full bg-[var(--paper-deep)]"><div className="h-full rounded-full bg-[var(--blue)]" style={{ width: `${percent}%` }} /></div>{topic.review > 0 && <p className="mt-1.5 text-xs font-semibold text-[var(--coral-dark)]">{topic.review} in review</p>}</div>
            <p className="text-right text-sm font-bold tabular-nums">{topic.mastered}/{topic.total}</p>
          </div>; }) : <div className="p-8 text-center text-[var(--muted)]">Topic progress will appear after the question bank syncs.</div>}
        </div>
      </section>

      <aside className="space-y-4"><div><p className="eyebrow">Start practicing</p><h2 className="section-title">Pick your grind</h2></div>
        <Link href="/practice/random" className="practice-card group bg-[var(--blue)] text-white"><span className="practice-icon bg-white/15"><BookOpen className="size-5" /></span><span><strong className="block text-lg">Random practice</strong><span className="mt-1 block text-sm leading-6 text-white/70">Mix questions from your full remaining pool.</span></span><ArrowRight className="ml-auto size-5 transition-transform group-hover:translate-x-1" /></Link>
        <Link href="/practice/topics" className="practice-card group bg-[var(--coral)] text-white"><span className="practice-icon bg-white/15"><Calculator className="size-5" /></span><span><strong className="block text-lg">Topic practice</strong><span className="mt-1 block text-sm leading-6 text-white/75">Choose exactly what you want to sharpen.</span></span><ArrowRight className="ml-auto size-5 transition-transform group-hover:translate-x-1" /></Link>
        <div className="rounded-2xl border border-[var(--line)] bg-white p-5"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-[var(--green-soft)] text-[var(--green)]">{data.review ? <RotateCcw className="size-5" /> : <CheckCircle2 className="size-5" />}</span><div><p className="font-bold">{data.review ? "Ready to review" : "Review pile clear"}</p><p className="text-sm text-[var(--muted)]">{data.review ? `${data.review} missed questions are mixed into practice.` : "No missed questions are waiting."}</p></div></div></div>
      </aside>
    </div>
  </main>;
}
