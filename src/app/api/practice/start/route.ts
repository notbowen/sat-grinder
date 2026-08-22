import { z } from "zod";
import { createPracticeSession, PracticeError } from "@/lib/practice";
import { getCurrentSession } from "@/lib/session";

const inputSchema = z.object({ mode: z.enum(["random", "topics"]), count: z.number().int().min(1).max(50), topics: z.array(z.string().max(100)).max(30).default([]) });

export async function POST(request: Request) {
  const current = await getCurrentSession();
  if (!current) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const input = inputSchema.parse(await request.json());
    const sessionId = await createPracticeSession(current.user.id, input.mode, input.count, input.topics);
    return Response.json({ sessionId });
  } catch (error) {
    if (error instanceof PracticeError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return Response.json({ error: "Choose a valid quiz size and topic selection." }, { status: 400 });
    console.error(error); return Response.json({ error: "The quiz could not be created." }, { status: 500 });
  }
}
