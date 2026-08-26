"use client";

import { getSupabase } from "@/lib/supabase";

export type AnswerOption = { letter: string; content: string };
export type DashboardData = {
  total: number;
  mastered: number;
  remaining: number;
  review: number;
  sections: { section: "math" | "reading-writing"; label: string; total: number; mastered: number }[];
  topics: { section: string; domain: string; skill: string; total: number; mastered: number; review: number }[];
  activeSession: { id: string; mode: "random"; requestedCount: number } | null;
};
export type PracticeSubject = "mixed" | "math" | "english";
export type PracticePool = { total: number; math: number; readingWriting: number };
export type PracticeQuestion = {
  id: string;
  displayId: string;
  section: "math" | "reading-writing";
  domainName: string;
  skillName: string;
  difficulty: "medium" | "hard";
  type: "mcq" | "spr";
  stimulusHtml: string | null;
  stemHtml: string;
  answerOptions: AnswerOption[];
  retryCount: number;
  position: number;
};
export type PracticeData = {
  session: {
    id: string;
    mode: "random";
    requestedCount: number;
    status: "active" | "completed" | "abandoned";
    createdAt: string;
    completedAt: string | null;
    abandonedAt: string | null;
  };
  total: number;
  resolved: number;
  firstAttemptCorrect: number;
  current: PracticeQuestion | null;
};
export type AnswerFeedback = {
  correct: boolean;
  message: string;
  firstAttempt?: boolean;
  completed?: boolean;
  retries?: number;
  rationaleHtml?: string;
  correctAnswers?: string[];
};

function rpcError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

const assetPattern = /\/question-assets\/([a-f0-9]{64}\.(?:png|jpg|gif|webp|svg))/gi;

export async function materializeAssetUrls(html?: string | null) {
  if (!html) return html ?? null;
  const paths = [...html.matchAll(assetPattern)].map((match) => match[1]);
  const unique = [...new Set(paths)];
  if (!unique.length) return html;
  const { data, error } = await getSupabase().storage.from("question-assets").createSignedUrls(unique, 60 * 60);
  if (error || !data) return html;
  let rewritten = html;
  for (const item of data) {
    if (item.signedUrl) rewritten = rewritten.split(`/question-assets/${item.path}`).join(item.signedUrl);
  }
  return rewritten;
}

export async function getDashboard() {
  const { data, error } = await getSupabase().rpc("get_dashboard");
  rpcError(error);
  return data as DashboardData;
}

export async function getPracticePool() {
  const { data, error } = await getSupabase().rpc("get_practice_pool");
  rpcError(error);
  return data as PracticePool;
}

export async function startPractice(count: number, subject: PracticeSubject = "mixed") {
  const filters = subject === "math"
    ? ["section:math"]
    : subject === "english" ? ["section:reading-writing"] : [];
  const { data, error } = await getSupabase().rpc("start_practice", {
    p_mode: "random",
    p_count: count,
    p_filters: filters,
  });
  rpcError(error);
  return data as string;
}

export async function getPracticeSession(sessionId: string) {
  const { data, error } = await getSupabase().rpc("get_practice_session", { p_session_id: sessionId });
  rpcError(error);
  const practice = data as PracticeData;
  if (practice.current) {
    practice.current.stimulusHtml = await materializeAssetUrls(practice.current.stimulusHtml);
    practice.current.stemHtml = (await materializeAssetUrls(practice.current.stemHtml)) ?? "";
    practice.current.answerOptions = await Promise.all(practice.current.answerOptions.map(async (option) => ({
      ...option,
      content: (await materializeAssetUrls(option.content)) ?? "",
    })));
  }
  return practice;
}

export async function submitPracticeAnswer(sessionId: string, questionId: string, response: string) {
  const { data, error } = await getSupabase().rpc("submit_practice_answer", {
    p_session_id: sessionId,
    p_question_id: questionId,
    p_response: response,
  });
  rpcError(error);
  const feedback = data as AnswerFeedback;
  if (feedback.rationaleHtml) feedback.rationaleHtml = (await materializeAssetUrls(feedback.rationaleHtml)) ?? "";
  return feedback;
}

export async function abandonPracticeSession(sessionId: string) {
  const { error } = await getSupabase().rpc("abandon_practice_session", { p_session_id: sessionId });
  rpcError(error);
}
