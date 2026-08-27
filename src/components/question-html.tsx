import { normalizeQuestionHtml } from "@/lib/question-html";

export function QuestionHtml({ html, className = "" }: { html?: string | null; className?: string }) {
  if (!html) return null;
  return <div className={`question-html ${className}`} dangerouslySetInnerHTML={{ __html: normalizeQuestionHtml(html) }} />;
}
