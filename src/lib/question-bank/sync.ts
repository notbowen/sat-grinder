import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sanitizeHtml from "sanitize-html";
import { and, eq, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { questionAssets, questions, syncRuns, type AnswerOption } from "@/db/schema";
import { db } from "@/lib/db";

const API_BASE = "https://qbank-api.collegeboard.org/msreportingquestionbank-prod/questionbank";
const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), ".data");
const ASSET_DIR = path.join(DATA_DIR, "question-assets");

const metadataSchema = z.object({
  questionId: z.string().min(1), external_id: z.string().min(1).nullable(), uId: z.string().optional(), updateDate: z.number().optional(),
  skill_cd: z.string().min(1), skill_desc: z.string().min(1), primary_class_cd: z.string().min(1), primary_class_cd_desc: z.string().min(1), difficulty: z.enum(["E", "M", "H"]),
}).passthrough();
const detailSchema = z.object({
  type: z.enum(["mcq", "spr"]), stem: z.string(), stimulus: z.string().nullish(), rationale: z.string(), externalid: z.string().min(1),
  answerOptions: z.array(z.object({ content: z.string() }).passthrough()).optional(), correct_answer: z.array(z.union([z.string(), z.number().transform(String)])).optional(), keys: z.array(z.union([z.string(), z.number().transform(String)])).optional(),
}).passthrough();
const lookupSchema = z.object({ mathLiveItems: z.array(z.string()).default([]), readingLiveItems: z.array(z.string()).default([]) }).passthrough();

type Metadata = z.infer<typeof metadataSchema> & { external_id: string; section: "math" | "reading-writing"; isActiveTest: boolean };
type AssetRecord = typeof questionAssets.$inferInsert;

async function fetchJson(url: string, body?: unknown) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { method: body ? "POST" : "GET", headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
  throw lastError;
}

const mathTags = ["math", "mrow", "mi", "mn", "mo", "mfrac", "msup", "msub", "msubsup", "msqrt", "mroot", "mtext", "mfenced", "mtable", "mtr", "mtd", "mover", "munder", "munderover", "menclose", "mspace", "semantics", "annotation"];
const svgTags = ["svg", "g", "defs", "path", "use", "clipPath", "rect", "marker", "line", "text", "tspan", "circle", "ellipse", "polyline", "polygon", "linearGradient", "radialGradient", "stop", "title", "desc"];
const allowedTags = [...sanitizeHtml.defaults.allowedTags, "img", "figure", "figcaption", ...mathTags, ...svgTags];
const svgStyleAttributes = ["style"];
const svgColor = /^(?:none|transparent|currentColor|#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}(?:\.\d+)?%?(?:\s*,\s*\d{1,3}(?:\.\d+)?%?){2}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)|[a-z]+)$/i;
const svgNumber = /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?(?:px|pt|pc|mm|cm|in|em|rem|%)?$/i;
const localSvgReference = /^url\(\s*#[A-Za-z_][\w:.-]*\s*\)$/;
const localSvgHref = /^#[A-Za-z_][\w:.-]*$/;

function filterSvgReferences(tagName: string, attribs: sanitizeHtml.Attributes) {
  if (!svgTags.includes(tagName)) return { tagName, attribs };
  const filtered = { ...attribs };
  for (const attribute of ["clip-path", "marker-start", "marker-mid", "marker-end", "mask", "filter"]) {
    if (filtered[attribute] && !localSvgReference.test(filtered[attribute])) delete filtered[attribute];
  }
  for (const attribute of ["fill", "stroke"]) {
    if (filtered[attribute]?.includes("url(") && !localSvgReference.test(filtered[attribute])) delete filtered[attribute];
  }
  for (const attribute of ["href", "xlink:href"]) {
    if (filtered[attribute] && !localSvgHref.test(filtered[attribute])) delete filtered[attribute];
  }
  if (filtered.transform && !/^[A-Za-z0-9+.,()\s-]+$/.test(filtered.transform)) delete filtered.transform;
  return { tagName, attribs: filtered };
}

export function sanitizeQuestionHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags,
    allowedAttributes: {
      "*": ["class", "id", "aria-hidden", "aria-label", "role"],
      p: ["style"],
      math: ["xmlns", "alttext", "display"],
      mfenced: ["open", "close", "separators"],
      img: ["src", "alt", "width", "height"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
      annotation: ["encoding"],
      svg: ["width", "height", "viewBox", "version", "xmlns", "xmlns:xlink", "preserveAspectRatio", ...svgStyleAttributes],
      g: ["clip-path", "fill", "font-family", "font-size", "opacity", "text-anchor", "transform", ...svgStyleAttributes],
      path: ["clip-path", "d", "fill", "marker-start", "marker-mid", "marker-end", "stroke", "stroke-dasharray", "stroke-dashoffset", "stroke-linecap", "stroke-linejoin", "stroke-width", "transform", ...svgStyleAttributes],
      use: ["x", "y", "width", "height", "href", "xlink:href", "fill", "stroke", "transform", ...svgStyleAttributes],
      clipPath: ["clipPathUnits", "transform"],
      rect: ["x", "y", "width", "height", "rx", "ry", "clip-path", "fill", "stroke", "stroke-width", "transform", ...svgStyleAttributes],
      marker: ["markerHeight", "markerUnits", "markerWidth", "orient", "preserveAspectRatio", "refX", "refY", "viewBox"],
      line: ["x1", "x2", "y1", "y2", "marker-start", "marker-mid", "marker-end", "fill", "stroke", "stroke-width", "transform", ...svgStyleAttributes],
      text: ["x", "y", "dx", "dy", "fill", "font-family", "font-size", "font-style", "font-weight", "text-anchor", "transform", ...svgStyleAttributes],
      tspan: ["x", "y", "dx", "dy", "fill", "font-family", "font-size", "font-style", "font-weight", "text-anchor", ...svgStyleAttributes],
      circle: ["cx", "cy", "r", "fill", "stroke", "stroke-width", "transform", ...svgStyleAttributes],
      ellipse: ["cx", "cy", "rx", "ry", "fill", "stroke", "stroke-width", "transform", ...svgStyleAttributes],
      polyline: ["points", "fill", "stroke", "stroke-width", "transform", ...svgStyleAttributes],
      polygon: ["points", "fill", "stroke", "stroke-width", "transform", ...svgStyleAttributes],
      linearGradient: ["x1", "x2", "y1", "y2", "gradientUnits", "gradientTransform", "href", "xlink:href"],
      radialGradient: ["cx", "cy", "r", "fx", "fy", "gradientUnits", "gradientTransform", "href", "xlink:href"],
      stop: ["offset", "stop-color", "stop-opacity", ...svgStyleAttributes],
    },
    allowedSchemes: ["https"], allowedSchemesByTag: { img: ["https"] },
    allowedStyles: {
      "*": {
        "text-align": [/^(?:left|right|center)$/],
        fill: [svgColor],
        stroke: [svgColor],
        "stroke-width": [svgNumber],
        "stroke-linecap": [/^(?:butt|round|square)$/],
        "stroke-linejoin": [/^(?:arcs|bevel|miter|miter-clip|round)$/],
        "stroke-dasharray": [/^(?:none|[\d.eE+,\s-]+)$/],
        "stroke-dashoffset": [svgNumber],
        opacity: [/^(?:0|1|0?\.\d+)$/],
        "fill-opacity": [/^(?:0|1|0?\.\d+)$/],
        "stroke-opacity": [/^(?:0|1|0?\.\d+)$/],
        "font-family": [/^[\w ,"'-]+$/],
        "font-size": [svgNumber],
        "font-style": [/^(?:normal|italic|oblique)$/],
        "font-weight": [/^(?:normal|bold|bolder|lighter|[1-9]00)$/],
        "text-anchor": [/^(?:start|middle|end)$/],
        "dominant-baseline": [/^[a-z-]+$/],
        "clip-path": [localSvgReference],
      },
    },
    transformTags: { "*": filterSvgReferences },
    parser: { lowerCaseTags: false, lowerCaseAttributeNames: false },
  });
}

function extension(mime: string) {
  return ({ "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp", "image/svg+xml": "svg" } as Record<string, string>)[mime];
}

async function storeImage(source: string): Promise<AssetRecord | null> {
  let bytes: Buffer; let mime: string;
  if (source.startsWith("data:image/")) {
    const match = source.match(/^data:([^;,]+);base64,(.+)$/s); if (!match) return null;
    mime = match[1]; bytes = Buffer.from(match[2], "base64");
  } else {
    const url = new URL(source); if (url.protocol !== "https:") return null;
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) }); if (!response.ok) return null;
    mime = response.headers.get("content-type")?.split(";")[0] ?? ""; bytes = Buffer.from(await response.arrayBuffer());
  }
  const suffix = extension(mime); if (!suffix || bytes.byteLength > 10_000_000) return null;
  const id = createHash("sha256").update(bytes).digest("hex"); await fs.mkdir(ASSET_DIR, { recursive: true });
  const filePath = path.join(ASSET_DIR, `${id}.${suffix}`);
  try { await fs.access(filePath); } catch { await fs.writeFile(filePath, bytes, { flag: "wx" }); }
  return { id, mimeType: mime, filePath, byteSize: bytes.byteLength, createdAt: new Date() };
}

async function materialize(html: string | null | undefined) {
  if (!html) return { html: "", assets: [] as AssetRecord[] };
  let rewritten = html; const assets: AssetRecord[] = [];
  const sources = [...html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)].map((match) => match[1]);
  for (const source of new Set(sources)) {
    try { const asset = await storeImage(source); if (asset) { assets.push(asset); rewritten = rewritten.split(source).join(`/api/question-assets/${asset.id}`); } } catch { /* keep the importer moving; sanitizer removes unsupported sources */ }
  }
  return { html: sanitizeQuestionHtml(rewritten), assets };
}

async function concurrentMap<T, R>(items: T[], concurrency: number, mapper: (item: T, index: number) => Promise<R>) {
  const results = new Array<R>(items.length); let next = 0;
  async function worker() { while (true) { const index = next++; if (index >= items.length) return; results[index] = await mapper(items[index], index); } }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker)); return results;
}

export async function runQuestionBankSync(runId: string) {
  try {
    if (process.env.COLLEGE_BOARD_EQB_AUTHORIZED !== "true") throw new Error("Set COLLEGE_BOARD_EQB_AUTHORIZED=true only after confirming written content authorization.");
    const lookup = lookupSchema.parse(await fetchJson(`${API_BASE}/lookup`));
    const [readingRaw, mathRaw] = await Promise.all([
      fetchJson(`${API_BASE}/digital/get-questions`, { asmtEventId: 99, test: 1, domain: "INI,CAS,EOI,SEC" }),
      fetchJson(`${API_BASE}/digital/get-questions`, { asmtEventId: 99, test: 2, domain: "H,P,Q,S" }),
    ]);
    const activeReading = new Set(lookup.readingLiveItems); const activeMath = new Set(lookup.mathLiveItems);
    const parseList = (raw: unknown, section: Metadata["section"], active: Set<string>): Metadata[] => z.array(metadataSchema).parse(raw).flatMap((item) => {
      if (!item.external_id || (item.difficulty !== "M" && item.difficulty !== "H")) return [];
      return [{ ...item, external_id: item.external_id, section, isActiveTest: active.has(item.external_id) }];
    });
    const parsedMetadata = [...parseList(readingRaw, "reading-writing", activeReading), ...parseList(mathRaw, "math", activeMath)];
    const metadata: Metadata[] = [...new Map(parsedMetadata.map((item) => [item.external_id, item])).values()];
    await db.update(syncRuns).set({ totalMetadata: metadata.length }).where(eq(syncRuns.id, runId));
    let fetchedDetails = 0;
    const imported = await concurrentMap(metadata, 8, async (meta) => {
      const detail = detailSchema.parse(await fetchJson(`${API_BASE}/digital/get-question`, { external_id: meta.external_id }));
      const [stimulus, stem, rationale, options] = await Promise.all([
        materialize(detail.stimulus), materialize(detail.stem), materialize(detail.rationale),
        Promise.all((detail.answerOptions ?? []).map(async (option, optionIndex) => ({ letter: String.fromCharCode(65 + optionIndex), ...(await materialize(option.content)) }))),
      ]);
      const completed = ++fetchedDetails;
      if (completed % 20 === 0 || completed === metadata.length) await db.update(syncRuns).set({ fetchedDetails: completed }).where(eq(syncRuns.id, runId));
      const answerOptions: AnswerOption[] = options.map((option) => ({ letter: option.letter, content: option.html }));
      const assets = [...stimulus.assets, ...stem.assets, ...rationale.assets, ...options.flatMap((option) => option.assets)];
      const correctAnswers = (detail.correct_answer?.length ? detail.correct_answer : detail.keys) ?? [];
      if (!correctAnswers.length || (detail.type === "mcq" && answerOptions.length !== 4)) throw new Error(`Question ${meta.questionId} has an unsupported answer shape.`);
      const normalized = { id: meta.external_id, displayId: meta.questionId, section: meta.section, domainCode: meta.primary_class_cd, domainName: meta.primary_class_cd_desc, skillCode: meta.skill_cd, skillName: meta.skill_desc, difficulty: meta.difficulty === "H" ? "hard" as const : "medium" as const, type: detail.type, stimulusHtml: stimulus.html || null, stemHtml: stem.html, rationaleHtml: rationale.html, answerOptions, correctAnswers: correctAnswers.map(String), isActiveTest: meta.isActiveTest, isRetired: false, sourceUpdatedAt: meta.updateDate ? new Date(meta.updateDate) : null, syncRunId: runId };
      return { question: { ...normalized, contentHash: createHash("sha256").update(JSON.stringify(normalized)).digest("hex") }, assets };
    });
    const now = new Date(); const assets = new Map(imported.flatMap((item) => item.assets).map((asset) => [asset.id, asset]));
    db.transaction((tx) => {
      tx.update(questions).set({ isRetired: true, updatedAt: now }).run();
      for (const asset of assets.values()) tx.insert(questionAssets).values(asset).onConflictDoNothing().run();
      for (const item of imported) tx.insert(questions).values({ ...item.question, createdAt: now, updatedAt: now }).onConflictDoUpdate({ target: questions.id, set: { ...item.question, updatedAt: now } }).run();
      tx.update(syncRuns).set({ status: "completed", completedAt: now, fetchedDetails: imported.length, imported: imported.length, activeExcluded: imported.filter((item) => item.question.isActiveTest).length }).where(eq(syncRuns.id, runId)).run();
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown synchronization error";
    await db.update(syncRuns).set({ status: "failed", completedAt: new Date(), error: message.slice(0, 2000) }).where(eq(syncRuns.id, runId));
    throw error;
  }
}

export async function createSyncRun(triggeredBy: string | null) {
  const staleBefore = new Date(Date.now() - 60 * 60 * 1000);
  await db.update(syncRuns).set({ status: "failed", completedAt: new Date(), error: "The previous sync stopped before it could finish." })
    .where(and(eq(syncRuns.status, "running"), lt(syncRuns.startedAt, staleBefore)));
  const running = await db.select({ id: syncRuns.id }).from(syncRuns).where(eq(syncRuns.status, "running")).limit(1);
  if (running.length) throw new Error("A question-bank sync is already running.");
  const id = randomUUID();
  try { await db.insert(syncRuns).values({ id, status: "running", triggeredBy, startedAt: new Date() }); }
  catch (error) { if (error instanceof Error && /UNIQUE constraint failed: sync_runs\.status/.test(error.message)) throw new Error("A question-bank sync is already running."); throw error; }
  return id;
}

export async function questionBankStats() {
  const [latest, count] = await Promise.all([
    db.select().from(syncRuns).orderBy(sql`${syncRuns.startedAt} desc`).limit(1),
    db.select({ total: sql<number>`count(*)`, eligible: sql<number>`sum(case when ${questions.isRetired} = 0 and ${questions.isActiveTest} = 0 then 1 else 0 end)`, active: sql<number>`sum(case when ${questions.isRetired} = 0 and ${questions.isActiveTest} = 1 then 1 else 0 end)` }).from(questions),
  ]);
  return { latest: latest[0] ?? null, total: count[0]?.total ?? 0, eligible: count[0]?.eligible ?? 0, active: count[0]?.active ?? 0 };
}
