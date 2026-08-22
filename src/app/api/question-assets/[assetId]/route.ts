import fs from "node:fs/promises";
import { eq } from "drizzle-orm";
import { questionAssets } from "@/db/schema";
import { db } from "@/lib/db";
import { getCurrentSession } from "@/lib/session";

export async function GET(_: Request, { params }: { params: Promise<{ assetId: string }> }) {
  if (!await getCurrentSession()) return new Response("Unauthorized", { status: 401 });
  const { assetId } = await params; if (!/^[a-f0-9]{64}$/.test(assetId)) return new Response("Not found", { status: 404 });
  const asset = await db.select().from(questionAssets).where(eq(questionAssets.id, assetId)).limit(1); if (!asset[0]) return new Response("Not found", { status: 404 });
  try { const bytes = await fs.readFile(asset[0].filePath); return new Response(bytes, { headers: { "content-type": asset[0].mimeType, "cache-control": "private, max-age=31536000, immutable", "x-content-type-options": "nosniff" } }); } catch { return new Response("Not found", { status: 404 }); }
}
