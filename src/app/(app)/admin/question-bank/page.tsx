import type { Metadata } from "next";
import Link from "next/link";
import { QuestionBankAdmin } from "@/components/question-bank-admin";
import { questionBankStats } from "@/lib/question-bank/sync";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Question bank administration" };

export default async function QuestionBankPage() {
  await requireSession({ admin: true }); const stats = await questionBankStats();
  const initial = { ...stats, latest: stats.latest ? { ...stats.latest, startedAt: stats.latest.startedAt.toISOString(), completedAt: stats.latest.completedAt?.toISOString() ?? null } : null };
  return <main className="page-container"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="eyebrow">Administration</p><h1 className="page-title">Question bank.</h1><p className="page-subtitle">Refresh the authorized College Board source without making practice depend on a live external request.</p></div><Link href="/admin/users" className="secondary-button">← User accounts</Link></div><QuestionBankAdmin initial={initial} authorized={process.env.COLLEGE_BOARD_EQB_AUTHORIZED === "true"} /></main>;
}
