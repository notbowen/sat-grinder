import { z } from "zod";
import { MAX_MATH_RESPONSE_LENGTH } from "@/lib/math-response";
import { PracticeError, submitPracticeAnswer } from "@/lib/practice";
import { getCurrentSession } from "@/lib/session";

const inputSchema = z.object({ questionId: z.string().min(1), response: z.string().max(MAX_MATH_RESPONSE_LENGTH) });

export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const current = await getCurrentSession(); if (!current) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const input = inputSchema.parse(await request.json()); const { sessionId } = await params;
    return Response.json(await submitPracticeAnswer(current.user.id, sessionId, input.questionId, input.response));
  } catch (error) {
    if (error instanceof PracticeError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return Response.json({ error: "Enter a valid answer." }, { status: 400 });
    console.error(error); return Response.json({ error: "Your answer could not be checked." }, { status: 500 });
  }
}
