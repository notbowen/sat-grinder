import type { Metadata } from "next";
import { Landing } from "@/components/landing";

export const metadata: Metadata = {
  title: "SAT Grinder — medium and hard digital SAT practice",
  description: "Bluebook-style SAT questions, a review queue that brings back every miss, and stats with honest denominators.",
};

export default function HomePage() {
  return <Landing />;
}
