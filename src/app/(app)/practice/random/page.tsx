import type { Metadata } from "next";
import { PracticeSetup } from "@/components/practice-setup";
import { getEligibleQuestions } from "@/lib/practice";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Random practice" };

export default async function RandomPracticePage() {
  const current = await requireSession(); const eligible = (await getEligibleQuestions(current.user.id)).length;
  return <main className="page-container"><p className="eyebrow">Random practice</p><h1 className="page-title">Let the bank surprise you.</h1><p className="page-subtitle">Choose a quiz size. Every non-mastered question has an equal shot at appearing.</p><div className="mt-9"><PracticeSetup mode="random" eligible={eligible} /></div></main>;
}
