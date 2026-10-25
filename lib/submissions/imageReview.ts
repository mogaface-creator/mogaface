/** Conservative automated triage, not a guarantee of identity or clinical accuracy. */
export const REVIEW_CHECKS = ["samePerson", "naturalTexture", "preservedLighting", "preservedUnselectedAreas", "subtleChanges"] as const;
export type ReviewChecks = Record<(typeof REVIEW_CHECKS)[number], boolean>;
export type ImageReview =
  | { status: "approved" | "rejected"; checks: ReviewChecks; reason: string }
  | { status: "unavailable"; code: "review_timeout" | "review_network_error" | "review_provider_error" | "review_invalid_response"; httpStatus?: number };
export function reviewPassed(value: unknown): boolean {
  return parseReview(value)?.status === "approved";
}
export function parseReview(value: unknown): Extract<ImageReview, { checks: ReviewChecks }> | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (!REVIEW_CHECKS.every((key) => typeof v[key] === "boolean")) return null;
  const checks = Object.fromEntries(REVIEW_CHECKS.map((key) => [key, v[key]])) as ReviewChecks;
  return { status: REVIEW_CHECKS.every((key) => checks[key]) ? "approved" : "rejected", checks,
    reason: typeof v.reason === "string" ? v.reason.slice(0, 500) : "" };
}
export async function reviewAfterImage(input: {
  apiKey: string; model: string; before: string; after: string; prompt: string;
}): Promise<ImageReview> {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${input.apiKey}` },
      body: JSON.stringify({ model: input.model, response_format: { type: "json_object" }, temperature: 0, max_tokens: 500,
        messages: [
          { role: "system", content: 'Compare the original portrait (first image) and the clinically enhanced simulation (second image). Verify that: (1) samePerson: the subject remains recognizably the exact same individual with identical bone structure, eye shape, and nose; (2) naturalTexture: skin maintains authentic photographic pore texture rather than a waxy doll or cartoon filter; (3) preservedLighting: head pose, background, camera angle, and natural skin undertone are preserved; (4) preservedUnselectedAreas: unselected areas remain consistent; (5) subtleChanges: non-surgical enhancements (e.g., cleared acne, defined jawline, refreshed under-eyes) are proportionate and realistic rather than a drastic fantasy caricature. Visible, attractive improvements in skin clarity, jawline definition, and under-eyes are explicitly intended and should PASS. Only reject if the subject was swapped for a different person, bleached, or rendered as waxy plastic. Return ONLY JSON: {"samePerson":boolean,"naturalTexture":boolean,"preservedLighting":boolean,"preservedUnselectedAreas":boolean,"subtleChanges":boolean,"reason":"short explanation"}.' },
          { role: "user", content: [{ type: "text", text: input.prompt }, { type: "image_url", image_url: { url: input.before, detail: "high" } }, { type: "image_url", image_url: { url: input.after, detail: "high" } }] },
        ] }), signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) return { status: "unavailable", code: "review_provider_error", httpStatus: response.status };
    try {
      const data = await response.json();
      return parseReview(JSON.parse(data.choices?.[0]?.message?.content ?? "null")) ?? { status: "unavailable", code: "review_invalid_response" };
    } catch { return { status: "unavailable", code: "review_invalid_response" }; }
  } catch (error) {
    return { status: "unavailable", code: error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name) ? "review_timeout" : "review_network_error" };
  }
}
