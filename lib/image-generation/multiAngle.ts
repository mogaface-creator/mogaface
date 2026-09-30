/**
 * Multi-angle illustration orchestration: front, left 45° and right 45°,
 * generated from their OWN actual source photo, sharing the SAME trusted
 * analysis record (see lib/analysis-session/) — so the same server-computed
 * opportunities, and therefore the same resulting visualization plan and
 * approved change(s), drive every angle. No angle is ever invented: only a
 * photo actually present in the request is ever attempted.
 *
 * Each angle is a fully independent call into the real, unmodified
 * handleIllustrationRequest pipeline (via
 * generateTrustedIllustrationForPhoto — see trustedHandler.ts): same
 * consent gate, same per-photo validation, same real eligibility decision,
 * same safety-checked prompt, same output validation, run SEQUENTIALLY
 * (never in parallel — three real image-edit calls per "Analyze My Face" is
 * already real cost and real provider load; nothing here should multiply
 * that further with concurrency). A transient failure ("failed" — a
 * provider error, timeout, or an output that didn't pass validation) is
 * retried ONCE. Retrying is not a different or "stricter" prompt: the
 * existing prompt (buildIllustrationPrompt) is already built from the fixed,
 * safety-checked, maximally-constrained approved instruction — there is no
 * looser version to fall back from. A second failure marks that angle
 * unavailable; nothing here ever fabricates a result. "not_eligible" and
 * "unavailable" are never retried — retrying cannot change whether the
 * server's analysis found real evidence or whether a provider is configured.
 */

import { isUploadedPhoto } from "./output.ts";
import { generateTrustedIllustrationForPhoto } from "./trustedHandler.ts";
import type { IllustrationHandlerDeps } from "./handler.ts";
import { getAnalysisRecord, AnalysisPersistenceUnavailableError } from "../analysis-session/store.ts";
import type { AnalysisRecord } from "../analysis-session/types.ts";
import { allowsPhotoProcessing } from "../visualization/consent.ts";
import type { VisualizedArea } from "../visualization/present.ts";
import { ANGLE_SLOTS } from "./angles.ts";
import type { AngleSlot } from "./angles.ts";

export { ANGLE_SLOTS };
export type { AngleSlot };

const ANGLE_FORM_FIELDS: Record<AngleSlot, string> = { front: "photo_front", leftFortyFive: "photo_leftFortyFive", rightFortyFive: "photo_rightFortyFive" };

export type AngleStatus = "ready" | "not_eligible" | "unavailable" | "failed" | "not_requested";

export interface AngleResult {
  status: AngleStatus;
  image?: { mimeType: string; base64: string };
  attempts: number;
  /** Which areas THIS angle's generation actually illustrated — from the real server-authoritative plan, identical across every ready angle since they all share one record. See handler.ts's ready response. */
  changes?: VisualizedArea[];
  /** Safe machine code for a non-ready angle. Never a message, key, or image. */
  code?: string;
}

export type MultiAngleResult = Record<AngleSlot, AngleResult>;

const MAX_ATTEMPTS = 2; // one retry

function safeCode(value: unknown): string | undefined {
  return typeof value === "string" && /^[a-z0-9_]{1,80}$/i.test(value) ? value : undefined;
}

async function parseAngleResponse(res: Response): Promise<{ status: AngleStatus; image?: { mimeType: string; base64: string }; changes?: VisualizedArea[]; code?: string }> {
  if (res.status === 403) return { status: "unavailable", code: "forbidden" }; // consent — already checked once, up front, before any angle; defensive only
  if (res.status === 404) return { status: "not_eligible", code: "not_found" }; // analysis record missing/expired
  let body: Record<string, unknown>;
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    return { status: "failed", code: "unreadable" };
  }
  if (body.available === false) return { status: "unavailable", code: "provider_disabled" };
  if (body.status === "not_eligible") return { status: "not_eligible", code: safeCode(body.reason) ?? "not_eligible" };
  const image = body.image as { mimeType?: string; base64?: string } | undefined;
  if (body.status === "ready" && typeof image?.base64 === "string" && /^image\/(png|jpeg|webp)$/.test(image.mimeType ?? "")) {
    const changes = Array.isArray(body.changes) ? (body.changes as VisualizedArea[]) : undefined;
    return { status: "ready", image: { mimeType: image.mimeType!, base64: image.base64 }, changes };
  }
  return { status: "failed", code: safeCode(body.error) ?? safeCode(body.providerCode) ?? safeCode(body.errorCode) ?? `http_${res.status}` };
}

async function runOneAngle(photo: Blob, record: Parameters<typeof generateTrustedIllustrationForPhoto>[1], consent: unknown, qualityValid: unknown, requestUrl: string, headers: Headers, deps: IllustrationHandlerDeps): Promise<AngleResult> {
  let attempts = 0;
  let last: { status: AngleStatus; image?: { mimeType: string; base64: string }; changes?: VisualizedArea[]; code?: string } = { status: "failed" };
  while (attempts < MAX_ATTEMPTS) {
    attempts++;
    const res = await generateTrustedIllustrationForPhoto(photo, record, consent, qualityValid, requestUrl, headers, deps);
    last = await parseAngleResponse(res);
    if (last.status !== "failed") break; // only a genuine failure is worth a second attempt
  }
  return { ...last, attempts };
}

function forwardedHeaders(request: Request): Headers {
  const headers = new Headers();
  for (const name of ["origin", "host", "x-request-id", "x-vercel-id"]) {
    const v = request.headers.get(name);
    if (v) headers.set(name, v);
  }
  return headers;
}

export async function handleMultiAngleIllustrationRequest(request: Request, deps: IllustrationHandlerDeps): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  const payloadText = form.get("payload");
  if (typeof payloadText !== "string") return Response.json({ error: "invalid_request" }, { status: 400 });
  let payload: { photoVisualizationConsent?: unknown; photoQualityValid?: unknown; analysisId?: unknown; sessionToken?: unknown };
  try {
    const parsed: unknown = JSON.parse(payloadText);
    if (!parsed || typeof parsed !== "object") throw new Error("shape");
    payload = parsed as typeof payload;
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  if (typeof payload.analysisId !== "string" || typeof payload.sessionToken !== "string") {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const photosByAngle: Partial<Record<AngleSlot, Blob>> = {};
  for (const angle of ANGLE_SLOTS) {
    const f = form.get(ANGLE_FORM_FIELDS[angle]);
    if (isUploadedPhoto(f)) photosByAngle[angle] = f;
  }
  if (!photosByAngle.front) return Response.json({ error: "invalid_request", detail: "front photo is required" }, { status: 400 });

  let record: AnalysisRecord | null;
  try {
    record = await getAnalysisRecord(payload.analysisId, payload.sessionToken, deps.analysisSessionDeps ?? { env: deps.env, fetchImpl: deps.fetchImpl });
  } catch (err) {
    // Production persistence is unavailable: fail closed with a generic error, BEFORE any
    // angle is attempted — the OpenAI provider is never called.
    if (err instanceof AnalysisPersistenceUnavailableError) return Response.json({ error: "storage_unavailable" }, { status: 503 });
    throw err;
  }
  if (!record) return Response.json({ error: "analysis_not_found" }, { status: 404 });

  // Consent is for the person's photos being sent to the provider at all — checked ONCE,
  // before any angle is attempted, not re-litigated per angle.
  if (!allowsPhotoProcessing(payload.photoVisualizationConsent)) {
    return Response.json({ error: "consent_required" }, { status: 403 });
  }

  const headers = forwardedHeaders(request);
  const results = {} as MultiAngleResult;
  for (const angle of ANGLE_SLOTS) {
    const photo = photosByAngle[angle];
    if (!photo) {
      results[angle] = { status: "not_requested", attempts: 0 };
      continue;
    }
    results[angle] = await runOneAngle(photo, record, payload.photoVisualizationConsent, payload.photoQualityValid, request.url, headers, deps);
  }

  return Response.json({ status: "done", angles: results });
}
