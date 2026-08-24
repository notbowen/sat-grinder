import katex from "katex";
import { mathResponseToLatex } from "@/lib/math-response";

export function MathExpression({ value, className = "" }: { value: string; className?: string }) {
  const html = katex.renderToString(mathResponseToLatex(value), {
    errorColor: "#a53b29",
    maxExpand: 100,
    maxSize: 10,
    strict: "error",
    throwOnError: false,
    trust: false,
  });

  return <span className={`math-expression ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
