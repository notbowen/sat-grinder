import type { Metadata } from "next";
import { PracticeSetup } from "@/components/practice-setup";
import { getTopicCatalog } from "@/lib/practice";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Topic practice" };

export default async function TopicPracticePage() {
  const current = await requireSession(); const catalog = await getTopicCatalog(current.user.id); const eligible = catalog.reduce((sum, domain) => sum + domain.count, 0);
  return <main className="page-container"><p className="eyebrow">Topic practice</p><h1 className="page-title">Aim at the weak spot.</h1><p className="page-subtitle">Choose whole domains or drill down to one or more specific skills.</p><div className="mt-9"><PracticeSetup mode="topics" eligible={eligible} catalog={catalog} /></div></main>;
}
