import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

const handlers = toNextJsHandler(auth);
export const GET = handlers.GET;

export async function POST(request: Request) {
  if (new URL(request.url).pathname.includes("/sign-up/")) {
    return Response.json({ error: "Public registration is disabled." }, { status: 404 });
  }
  return handlers.POST(request);
}
