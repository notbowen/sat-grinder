import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";
import { normalizeQuestionHtml } from "@/lib/question-html";

const API_BASE = "https://qbank-api.collegeboard.org/msreportingquestionbank-prod/questionbank";
const ASSET_BUCKET = "question-assets";

const metadataSchema = z.object({
  questionId: z.string().min(1),
  external_id: z.string().uuid().nullable(),
  updateDate: z.number().optional(),
  skill_cd: z.string().min(1),
  skill_desc: z.string().min(1),
  primary_class_cd: z.string().min(1),
  primary_class_cd_desc: z.string().min(1),
  difficulty: z.enum(["E", "M", "H"]),
}).passthrough();

const detailSchema = z.object({
  type: z.enum(["mcq", "spr"]),
  stem: z.string().min(1),
  stimulus: z.string().nullish(),
  rationale: z.string().min(1),
  externalid: z.string().uuid(),
  answerOptions: z.array(z.object({ content: z.string() }).passthrough()).optional(),
  correct_answer: z.array(z.union([z.string(), z.number().transform(String)])).optional(),
  keys: z.array(z.union([z.string(), z.number().transform(String)])).optional(),
}).passthrough();

const lookupSchema = z.object({
  mathLiveItems: z.array(z.string()).default([]),
  readingLiveItems: z.array(z.string()).default([]),
}).passthrough();

type Metadata = z.infer<typeof metadataSchema> & {
  external_id: string;
  section: "math" | "reading-writing";
  isActiveTest: boolean;
};

type StoredAsset = {
  id: string;
  mime_type: string;
  storage_path: string;
  byte_size: number;
  bytes: Buffer;
};

type StagedQuestion = {
  run_id: string;
  id: string;
  display_id: string;
  section: Metadata["section"];
  domain_code: string;
  domain_name: string;
  skill_code: string;
  skill_name: string;
  difficulty: "medium" | "hard";
  type: "mcq" | "spr";
  stimulus_html: string | null;
  stem_html: string;
  rationale_html: string;
  answer_options: { letter: string; content: string }[];
  correct_answers: string[];
  is_active_test: boolean;
  source_updated_at: string | null;
  content_hash: string;
};

async function fetchJson(url: string, body?: unknown) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        method: body ? "POST" : "GET",
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`College Board returned HTTP ${response.status}.`);
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
  return normalizeQuestionHtml(sanitizeHtml(html, {
    allowedTags,
    allowedAttributes: {
      "*": ["class", "id", "aria-hidden", "aria-label", "role"],
      p: ["style"], span: ["style"], math: ["xmlns", "alttext", "display"],
      mfenced: ["open", "close", "separators"], mo: ["fence", "stretchy"], img: ["src", "alt", "width", "height"],
      td: ["colspan", "rowspan"], th: ["colspan", "rowspan"], annotation: ["encoding"],
      svg: ["width", "height", "viewBox", "version", "xmlns", "xmlns:xlink", "preserveAspectRatio", ...svgStyleAttributes],
      g: ["clip-path", "fill", "font-family", "font-size", "opacity", "text-anchor", "transform", ...svgStyleAttributes],
      path: ["clip-path", "d", "fill", "marker-start", "marker-mid", "marker-end", "stroke", "stroke-dasharray", "stroke-dashoffset", "stroke-linecap", "stroke-linejoin", "stroke-width", "transform", ...svgStyleAttributes],
      use: ["x", "y", "width", "height", "href", "xlink:href", "fill", "stroke", "transform", ...svgStyleAttributes],
      clipPath: ["clipPathUnits", "transform"], rect: ["x", "y", "width", "height", "rx", "ry", "clip-path", "fill", "stroke", "stroke-width", "transform", ...svgStyleAttributes],
      marker: ["markerHeight", "markerUnits", "markerWidth", "orient", "preserveAspectRatio", "refX", "refY", "viewBox"],
      line: ["x1", "x2", "y1", "y2", "marker-start", "marker-mid", "marker-end", "fill", "stroke", "stroke-width", "transform", ...svgStyleAttributes],
      text: ["x", "y", "dx", "dy", "fill", "font-family", "font-size", "font-style", "font-weight", "text-anchor", "transform", ...svgStyleAttributes],
      tspan: ["x", "y", "dx", "dy", "fill", "font-family", "font-size", "font-style", "font-weight", "text-anchor", ...svgStyleAttributes],
      circle: ["cx", "cy", "r", "fill", "stroke", "stroke-width", "transform", ...svgStyleAttributes], ellipse: ["cx", "cy", "rx", "ry", "fill", "stroke", "stroke-width", "transform", ...svgStyleAttributes],
      polyline: ["points", "fill", "stroke", "stroke-width", "transform", ...svgStyleAttributes], polygon: ["points", "fill", "stroke", "stroke-width", "transform", ...svgStyleAttributes],
      linearGradient: ["x1", "x2", "y1", "y2", "gradientUnits", "gradientTransform", "href", "xlink:href"], radialGradient: ["cx", "cy", "r", "fx", "fy", "gradientUnits", "gradientTransform", "href", "xlink:href"],
      stop: ["offset", "stop-color", "stop-opacity", ...svgStyleAttributes],
    },
    allowedSchemes: ["https"], allowedSchemesByTag: { img: ["https"] },
    allowedStyles: {
      "*": {
        "text-align": [/^(?:left|right|center)$/], fill: [svgColor], stroke: [svgColor],
        "stroke-width": [svgNumber], "stroke-linecap": [/^(?:butt|round|square)$/],
        "stroke-linejoin": [/^(?:arcs|bevel|miter|miter-clip|round)$/],
        "stroke-dasharray": [/^(?:none|[\d.eE+,\s-]+)$/], "stroke-dashoffset": [svgNumber],
        opacity: [/^(?:0|1|0?\.\d+)$/], "fill-opacity": [/^(?:0|1|0?\.\d+)$/],
        "stroke-opacity": [/^(?:0|1|0?\.\d+)$/], "font-family": [/^[\w ,"'-]+$/],
        "font-size": [svgNumber], "font-style": [/^(?:normal|italic|oblique)$/],
        "font-weight": [/^(?:normal|bold|bolder|lighter|[1-9]00)$/], "text-anchor": [/^(?:start|middle|end)$/],
        "dominant-baseline": [/^[a-z-]+$/], "clip-path": [localSvgReference],
      },
      span: { "text-decoration": [/^underline$/] },
    },
    transformTags: { "*": filterSvgReferences },
    parser: { lowerCaseTags: false, lowerCaseAttributeNames: false },
  }));
}

function extension(mime: string) {
  return ({ "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp", "image/svg+xml": "svg" } as Record<string, string>)[mime];
}

async function downloadImage(source: string): Promise<StoredAsset> {
  let bytes: Buffer;
  let mime: string;
  if (source.startsWith("data:image/")) {
    const match = source.match(/^data:([^;,]+);base64,(.+)$/s);
    if (!match) throw new Error("An embedded question image is malformed.");
    mime = match[1];
    bytes = Buffer.from(match[2], "base64");
  } else {
    const url = new URL(source);
    if (url.protocol !== "https:") throw new Error(`Question image uses an unsupported URL: ${source}`);
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Question image returned HTTP ${response.status}: ${url.hostname}`);
    mime = response.headers.get("content-type")?.split(";")[0] ?? "";
    bytes = Buffer.from(await response.arrayBuffer());
  }
  const suffix = extension(mime);
  if (!suffix) throw new Error(`Question image has unsupported MIME type ${mime || "unknown"}.`);
  if (!bytes.byteLength || bytes.byteLength > 10_000_000) throw new Error("Question image has an invalid size.");
  const id = createHash("sha256").update(bytes).digest("hex");
  return { id, mime_type: mime, storage_path: `${id}.${suffix}`, byte_size: bytes.byteLength, bytes };
}

async function materialize(html: string | null | undefined) {
  if (!html) return { html: "", assets: [] as StoredAsset[] };
  let rewritten = html;
  const assets: StoredAsset[] = [];
  const sources = [...html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)].map((match) => match[1]);
  for (const source of new Set(sources)) {
    const asset = await downloadImage(source);
    assets.push(asset);
    rewritten = rewritten.split(source).join(`/question-assets/${asset.storage_path}`);
  }
  return { html: sanitizeQuestionHtml(rewritten), assets };
}

async function concurrentMap<T, R>(items: T[], concurrency: number, mapper: (item: T, index: number) => Promise<R>) {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

function adminClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function insertBatches(client: SupabaseClient, table: string, rows: Record<string, unknown>[], size = 100) {
  for (let index = 0; index < rows.length; index += size) {
    const { error } = await client.from(table).insert(rows.slice(index, index + size));
    if (error) throw error;
  }
}

export async function runQuestionBankSync(triggerSource: "github-action" | "manual-cli" = "github-action") {
  if (process.env.COLLEGE_BOARD_EQB_AUTHORIZED !== "true") {
    throw new Error("Set COLLEGE_BOARD_EQB_AUTHORIZED=true only after confirming written content authorization.");
  }
  const client = adminClient();
  const { data: runId, error: beginError } = await client.rpc("begin_question_sync", { p_trigger_source: triggerSource });
  if (beginError || typeof runId !== "string") throw beginError ?? new Error("Supabase did not create a synchronization run.");

  try {
    const lookup = lookupSchema.parse(await fetchJson(`${API_BASE}/lookup`));
    const [readingRaw, mathRaw] = await Promise.all([
      fetchJson(`${API_BASE}/digital/get-questions`, { asmtEventId: 99, test: 1, domain: "INI,CAS,EOI,SEC" }),
      fetchJson(`${API_BASE}/digital/get-questions`, { asmtEventId: 99, test: 2, domain: "H,P,Q,S" }),
    ]);
    const activeReading = new Set(lookup.readingLiveItems);
    const activeMath = new Set(lookup.mathLiveItems);
    const parseList = (raw: unknown, section: Metadata["section"], active: Set<string>): Metadata[] =>
      z.array(metadataSchema).parse(raw).flatMap((item) => {
        if (!item.external_id || item.difficulty === "E") return [];
        return [{ ...item, external_id: item.external_id, section, isActiveTest: active.has(item.external_id) }];
      });
    const metadata = [...parseList(readingRaw, "reading-writing", activeReading), ...parseList(mathRaw, "math", activeMath)];
    const ids = new Set<string>();
    const displayIds = new Set<string>();
    for (const item of metadata) {
      if (ids.has(item.external_id) || displayIds.has(item.questionId)) throw new Error(`Duplicate question metadata: ${item.external_id}.`);
      ids.add(item.external_id);
      displayIds.add(item.questionId);
    }
    if (!metadata.length) throw new Error("The validated question bank is empty.");
    const { error: countError } = await client.from("sync_runs").update({ total_metadata: metadata.length }).eq("id", runId);
    if (countError) throw countError;

    let fetchedDetails = 0;
    const imported = await concurrentMap(metadata, 8, async (meta) => {
      const detail = detailSchema.parse(await fetchJson(`${API_BASE}/digital/get-question`, { external_id: meta.external_id }));
      if (detail.externalid !== meta.external_id) throw new Error(`Question detail identifier mismatch for ${meta.external_id}.`);
      const [stimulus, stem, rationale, options] = await Promise.all([
        materialize(detail.stimulus), materialize(detail.stem), materialize(detail.rationale),
        Promise.all((detail.answerOptions ?? []).map(async (option, index) => ({ letter: String.fromCharCode(65 + index), ...(await materialize(option.content)) }))),
      ]);
      fetchedDetails += 1;
      if (fetchedDetails % 20 === 0 || fetchedDetails === metadata.length) {
        const { error } = await client.from("sync_runs").update({ fetched_details: fetchedDetails }).eq("id", runId);
        if (error) throw error;
      }
      const answerOptions = options.map((option) => ({ letter: option.letter, content: option.html }));
      const correctAnswers = ((detail.correct_answer?.length ? detail.correct_answer : detail.keys) ?? []).map(String);
      if (!correctAnswers.length || (detail.type === "mcq" && answerOptions.length !== 4)) {
        throw new Error(`Question ${meta.questionId} has an unsupported answer shape.`);
      }
      const stageWithoutHash = {
        run_id: runId,
        id: meta.external_id,
        display_id: meta.questionId,
        section: meta.section,
        domain_code: meta.primary_class_cd,
        domain_name: meta.primary_class_cd_desc,
        skill_code: meta.skill_cd,
        skill_name: meta.skill_desc,
        difficulty: meta.difficulty === "H" ? "hard" as const : "medium" as const,
        type: detail.type,
        stimulus_html: stimulus.html || null,
        stem_html: stem.html,
        rationale_html: rationale.html,
        answer_options: answerOptions,
        correct_answers: correctAnswers,
        is_active_test: meta.isActiveTest,
        source_updated_at: meta.updateDate ? new Date(meta.updateDate).toISOString() : null,
      };
      const contentHash = createHash("sha256").update(JSON.stringify({ ...stageWithoutHash, run_id: undefined })).digest("hex");
      const assets = [...stimulus.assets, ...stem.assets, ...rationale.assets, ...options.flatMap((option) => option.assets)];
      return { question: { ...stageWithoutHash, content_hash: contentHash } satisfies StagedQuestion, assets };
    });

    const assets = new Map(imported.flatMap((item) => item.assets).map((asset) => [asset.id, asset]));
    for (const asset of assets.values()) {
      const { error } = await client.storage.from(ASSET_BUCKET).upload(asset.storage_path, asset.bytes, {
        contentType: asset.mime_type, cacheControl: "31536000", upsert: true,
      });
      if (error) throw error;
    }
    if (assets.size) {
      const { error } = await client.from("question_assets").upsert(
        [...assets.values()].map((asset) => ({
          id: asset.id,
          mime_type: asset.mime_type,
          storage_path: asset.storage_path,
          byte_size: asset.byte_size,
        })), { onConflict: "id" },
      );
      if (error) throw error;
    }
    await insertBatches(client, "question_sync_staging", imported.map((item) => item.question));
    const { data: result, error: finalizeError } = await client.rpc("finalize_question_sync", { p_run_id: runId });
    if (finalizeError) throw finalizeError;
    return result as { runId: string; imported: number; activeExcluded: number };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown synchronization error";
    await client.rpc("fail_question_sync", { p_run_id: runId, p_error: message });
    throw error;
  }
}
