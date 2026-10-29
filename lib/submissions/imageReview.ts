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
          { role: "system", content: 'Compare the original portrait (first image) with the final masked-and-composited illustration (second image). Be strict: attractiveness is not a pass condition. Verify: samePerson: identity and facial proportions remain the same; naturalTexture: skin and curls still look photographic, with pores and individual strands; preservedLighting: expression, head pose, camera angle, background, exposure and skin undertone match; preservedUnselectedAreas: unselected and protected regions are unchanged; subtleChanges: only the selected goal areas show believable, restrained improvement. For hair, keep the same curl type, hairline, colour and plausible density while making the shape neater. For skin, reduce only visible temporary mark contrast without smoothing pores or removing permanent identifying marks. For jaw contour, keep the change slight and preserve chin, cheek width and neck. Reject alien-like facial geometry, wig-like hair, new hairlines, halos, seams, waxy texture, changed eye/nose/lip shape, or edits outside selected goals. If uncertain, reject. Return ONLY JSON: {"samePerson":boolean,"naturalTexture":boolean,"preservedLighting":boolean,"preservedUnselectedAreas":boolean,"subtleChanges":boolean,"reason":"short explanation"}.' },
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
