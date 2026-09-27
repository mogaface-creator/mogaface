# Interpretation, Visualization and Consumer Results

```
Assessment → facial analysis → observation layer → treatment opportunity engine
   → INTERPRETATION → VISUALIZATION PLAN → IMAGE PROVIDER → CONSUMER RESULTS PAGE
```

Everything on the right of the opportunity engine **builds on** the existing evidence; none of it recomputes a measurement, changes a threshold, or adds a treatment rule. The clinician is the final decision-maker, and every result says so.

> **Status.** The pipeline runs end to end with a deterministic local interpretation; the image step is built but **disabled by default and not eligible for any real assessment** (see "Illustrative image generation"). A server-side AI *wording* provider exists (`INTERPRETATION_PROVIDER=openai`) but has only been tested against a stubbed API — it has not been run against the live service. No live OpenAI call (text or image) has been made from this repository. Real assessments currently produce very little consumer-facing visual content, because the visual observation layer is uncalibrated and its opportunities are gated (see "Why real results are sparse today").

## Interpretation (`lib/interpretation/`)

`buildInterpretationInput(assessment, analysis, opportunities)` assembles the **only** thing a provider may see: normalized goals, validated observations, treatment opportunities, technical limitations. Age, gender, height, weight, photos and landmark arrays are not included (tested).

`InterpretationResult` = `summary`, `priorities`, sections (`facialStructure`, `eyeArea`, `skin`, `hair`, `facialHair`, `lifestyle`, `style`), `opportunities` (one per goal area), consumer `limitations`, an audit `evidence` list, and `clinicianReviewRequired: true`.

**Every statement carries evidence references** — `{ sourceType: "questionnaire" | "visual_observation" | "treatment_opportunity" | "assessment", sourceId }`, e.g. `{ questionnaire, "user_reports_facial_definition_goal" }` or `{ visual_observation, "facialStructure.contour…" }`. `sourceId`s are internal and never shown to consumers.

### Rules (local provider, `build.ts`)

| Goal area | "Discuss" only if… | Otherwise |
|---|---|---|
| Facial lines | a consumer-ready neuromodulator opportunity **and** a usable visual observation backs it | "We couldn't establish enough visual evidence to interpret facial lines from these images." |
| Facial definition | consumer-ready contouring opportunity **and** usable geometry | "…interpret facial definition…" |
| Facial volume | consumer-ready opportunity **and** usable contour evidence — never from the questionnaire alone | "We couldn't establish enough visual evidence to interpret facial volume from these images." |
| Facial lifting | (no observation method exists — never) | "Your goal was recorded, but the current assessment does not have enough visual evidence to evaluate lifting-related changes." |
| Under-eye | a usable "dark-looking" observation → *observation only*: "…a visible difference in under-eye appearance relative to nearby facial skin." No treatment, no cause. | "…couldn't establish enough visual evidence…" |
| Skin | questionnaire only (no skin CV exists): "Your responses indicate skin-related concerns that may be worth assessing with your clinician." | "This assessment does not analyze skin from photographs." |

Visual observations resting on uncalibrated thresholds are never *stated* to a consumer (same prefixes as the gate in `lib/facial-analysis/calibration/status.ts`).

### Providers (`provider.ts`)

The app depends on `InterpretationProvider`, not a vendor. `localRulesProvider` is deterministic and needs no key. `createAiInterpretationProvider` is an **adapter structure only**: with no `complete` function it throws `ProviderNotConfigured`. `prompts.ts` fixes the contract for a future model (evidence-only input, narrow serialization, rules in the system prompt).

### Safety is enforced in code, not in a prompt

`validateInterpretation` runs on the local output **and on anything a provider returns** (`interpretWithFallback` discards invalid output and falls back to the local rules). It rejects: a statement without evidence; a reference that does not exist in the input; visual evidence that is not consumer-usable; a treatment named without a backing opportunity; a "discuss" item without a real, consumer-ready opportunity of the same category; a category on a non-"discuss" item; and forbidden language anywhere (`lib/safety/language.ts`): need/should-get/suitable/candidate claims, diagnosis and named conditions, anatomical causes, aging, scores and percentages, attractiveness, ideal/perfect face, outcome promises, transformation claims, brand names.

## The MogaFace report (`lib/interpretation/report.ts`, `components/results/Report.tsx`)

`/results` renders a personalised report: cover · overview · top priorities (concern, why it matters, evidence available, status) · facial structure · eye area · expression and facial lines (**only** with valid, consumer-usable expression evidence) · skin · hair · facial hair · lifestyle · style · **areas to discuss with your clinician** (area, why it appeared, evidence, what the clinician can evaluate) · before / illustrative-after · what MogaFace can and cannot tell you · next step (CTA from the existing config) · footer.

`InterpretationResult.report` is a `MogaFaceReport`. Every `ReportStatement` is `{ id, text, evidenceRefs[], confidence, sourceType }`:

- `sourceType`: `user_reported` ("You reported…"), `observed`, `opportunity`, or `limitation` ("Not enough visual evidence was available…"). The validator ties it to the evidence: observed needs a visual observation, opportunity needs a treatment-opportunity reference, user-reported may cite neither, a limitation cannot cite an opportunity.
- `confidence`: `complete | partial | limited` — evidence *availability* only, never a probability.
- Sections with no evidence carry a limitation statement instead of being blank. Skin, hair, facial hair, lifestyle and style come from the questionnaire only and are labelled "From your assessment". Free-text answers are never echoed. Nothing here contains numbers, scores, causes or treatment names; area decisions come from the existing opportunity engine and calibration gate.
- **Not built:** a first name (the assessment does not collect one), a `visualizationSummary` (the before/after panel reads the visualization plan directly).

`toReportView` (`lib/results/reportView.ts`) turns it into plain copy and re-scans every string; an unsafe string is dropped and a section never goes blank.

### AI wording provider (OpenAI) — built, disabled by default

**Default: off.** With `INTERPRETATION_PROVIDER` unset (or `local`) the deterministic rules write the whole report, nothing is sent anywhere, and the browser never calls the endpoint. No live OpenAI call has been made from this repository; the model call is tested only against a stubbed `fetch`.

**Role.** MogaFace's engines are the source of truth. The model only *rewords* a deterministic draft. It cannot find, create or change anything.

**What is sent** (`lib/interpretation/prompts.ts` → `editableDraft`): one JSON object — the draft's overview, priorities, four findings sections (facial structure, eye area, expression, skin) and areas-to-discuss, i.e. goal/finding sentences plus evidence ids, statuses and categories — and the fixed system prompt. The assessment id is replaced by a fixed token and restored afterwards.

**What is not sent:** photos, image URLs, video, landmarks, observation *values*, age, gender, height, weight, email/phone/account ids, the assessment id, timestamps, methodology versions, the questionnaire-only sections (hair, facial hair, lifestyle, style — kept verbatim on the server), the standing limitations copy, the clinician-review text and the CTA. (The browser posts its narrow `InterpretationInput` — which does contain observation values — to *our own* endpoint so the server can validate; the server does not forward it.) Tests assert all of this on the real outgoing request body.

**Immutability** (`lib/interpretation/immutable.ts`, run in `interpretWithFallback` after `validateInterpretation`): compared with the draft, a returned report may differ **only** in the `text` of non-limitation statements (and their order within a section). Evidence references (as a set), source types, confidence, ids, statuses, categories, titles, concerns, evidence lines, "what the clinician can evaluate", section availability, limitations, clinician-review copy and CTA must be identical; extra or missing fields are rejected; limitation statements keep their exact text; sections not sent must be identical. Reworded text may not introduce a treatment, cause, instruction, judgement, promise, number, markup/link (words the draft itself used stay allowed) or grow much longer. On top of that, the existing validator enforces evidence existence and consumer-readiness, treatment-needs-an-opportunity, and all forbidden language (need/should-get/suitable/candidate/diagnosis/scores/percentages/attractiveness/dosage/prescribe/brands). The final result is the deterministic result with only the report's wording replaced.

**Fallback.** Missing key, provider disabled, timeout (default 15 s, `INTERPRETATION_TIMEOUT_MS`, hard server-side race), network or provider error, refusal, truncation, malformed JSON, invalid output or changed facts → the deterministic report, HTTP 200, no error shown. The client validates the server's answer again before using it.

**API.** `POST https://api.openai.com/v1/responses` (`lib/interpretation/openai.ts`, plain `fetch`, `Authorization: Bearer`), with a strict structured-output schema (`reportSchema.ts`) that fixes the *shape* only — values are checked by the validators above. Refusals, incomplete responses, HTTP/API errors and non-JSON output are content-free failure reasons that trigger the deterministic fallback. To add another vendor: write a `ModelCompletion`, add a branch in `select.ts`.

**Endpoint** (`app/api/interpret/route.ts` → `lib/interpretation/handler.ts`), in this order: provider enabled and keyed → same origin → authenticated → rate limit → bounded, photo-free, exact-envelope body → consent `granted` → model. Logging is one line of metadata (`requestId`, provider, outcome, reason category, duration) — never the key, payload, answers or model output.

| Concern | Status |
|---|---|
| Authentication | **None exists in MogaFace.** The boundary is `Authenticator` (`lib/interpretation/access.ts`). In production with none supplied every request gets 401; in development anyone on localhost may call it (only if a provider is configured). **Requirement:** a real authenticator returning a stable, non-personal subject id must be wired into `route.ts` before enabling in production. |
| Rate limiting | Interface `RateLimiter` + an in-memory, per-process limiter (development only — not valid across serverless instances). In production with none supplied requests get 503. **Requirement:** a shared-store implementation (Redis/KV) wired into `route.ts`. |
| Consent | `InterpretationConsent = not_required \| pending \| granted \| declined` (`consent.ts`). Only `granted` allows third-party processing; the default is `pending`. **No consent screen exists**, so real results stay local. Development can pass `?consent=granted`. **Undecided (product owner / legal):** the consent wording, whether `not_required` may ever allow a third party, where the decision is stored and for how long, retention and data-processing terms with the provider, the region, and any regulatory obligations. Nothing here claims compliance. |
| Client opt-in | `NEXT_PUBLIC_INTERPRETATION_REMOTE=1` (a public, non-secret flag) — without it the browser makes no call. |
| Secrets | `OPENAI_API_KEY` is read in one server module (`select.ts`); no `NEXT_PUBLIC_*` key exists; a test scans the sources, the responses and the logs. |
| Model | `INTERPRETATION_MODEL`; the default (`gpt-6-luna`, the small high-volume tier on OpenAI's published model list) lives only in `openai.ts` — confirm it during the supervised live call. Only `model`, `instructions`, `input`, `text.format` (strict JSON schema), `max_output_tokens` and `store: false` are sent — no temperature, tools or reasoning settings. |

## Visualization plan (`lib/visualization/`)

Decides **what an image generator may show**; the image model never decides what someone "needs". A plan is `planned` only when all hold: a **front** photo exists, it **passed quality validation**, at least one **consumer-ready** opportunity maps to an approved change, and that change rests on visual evidence. Otherwise `not_eligible` with a reason and **no image is generated**.

Approved changes (first version): `facial_contour` (from contouring) and `expression_lines` (from the neuromodulator opportunity). Filler, lifting, skin, hair and consultation are **excluded**, each with a recorded reason. Intensity must be `subtle` (or `light`); anything stronger fails validation. Every plan — planned or not — carries the fixed disclaimer **"Illustrative visualization" / "Not a prediction of treatment outcome."**, and the validator rejects a plan whose disclaimer is missing or altered.

## Illustrative image generation (`lib/visualization/`, `lib/image-generation/`)

**The image model is a renderer.** MogaFace decides what may be visualized; the clinician decides what is appropriate; the image is illustrative only.

```
photo → analysis → treatment opportunities → visualization PLAN → GENERATION ELIGIBILITY → safety-checked prompt → image API → output validation → "Illustrative After"
```

**Plan** (`build.ts`, unchanged rules): each change now also carries `changeId`, `targetRegion`, `visualInstruction` (fixed per category in `APPROVED_VISUAL_CHANGES`), `evidenceRefs`, `sourceOpportunityId`, `consumerReady`, `intensityLimit: "subtle"` and `safetyStatus: "approved"`. `validate.ts` rejects any change whose instruction/region differs from the approved one.

**Generation eligibility** (`eligibility.ts`) — a separate, stricter decision that can only approve or block what the plan already contains:
- expression-line illustration: approved by policy, and only when its source opportunity is consumer-ready **and** re-checked against the calibration gate (uncalibrated video evidence → not eligible);
- facial-contour illustration: **blocked by policy** (`ILLUSTRATION_POLICY.facial_contour = false`). Front-geometry contouring can make an opportunity consumer-ready, but that does not by itself authorise rendering a face; the evidence policy is pending an explicit decision. Flipping this value is the only switch;
- filler/volume, lifting, skin, under-eye, hair: no approved visual change exists.
So today **no real assessment is eligible**; only the demo (open gate) is, for expression lines.

**Safety** (`safety.ts`): the whole prompt — fixed template plus fixed instructions — is scanned before any call for beauty/age edits, attractiveness, named treatments, procedures, quantities, reshaping language and promises. Unsafe → no call.

**Prompt** (`buildIllustrationPrompt`): built only from the approved changes: "Edit the supplied portrait of the same person… Preserve the person's identity… Do not retouch, stylize, smooth or otherwise alter any unrelated feature… Apply only the following approved visual change: …subtle, realistic, anatomically plausible… recognizably the same person." Never a treatment name, category, goal or evidence.

**Consent.** `PhotoVisualizationConsent = pending | granted | declined` (`consent.ts`). Only `granted` may send a photo: checked in the browser client, the server handler, and the OpenAI provider itself. The panel asks in plain product language ("your front photo will be sent to an external AI image service (OpenAI)…"). **Undecided (product owner / legal):** final consent wording, retention terms with the provider, region, and any regulatory review — nothing here claims compliance.

**Server** (`app/api/generate-illustration` → `handler.ts`), each check stopping the request: provider enabled → same origin → authenticated → entitlement hook → rate limit (the same `RateLimiter` as interpretation) → bounded multipart (`photo` + `payload`, nothing else) → consent → photo validated (real PNG/JPEG/WebP, matching type, sensible size) → **plan and eligibility rebuilt on the server from the opportunities** (client plans/prompts/descriptions/`consumerReady` are never used; readiness is re-derived against the gate) → prompt built and checked → OpenAI `POST /v1/images/edits` (multipart: model, the untouched photo, prompt, n, size, output_format, optional quality/input_fidelity) bounded by a timeout → output validated (real image, plausible size/dimensions, not the source returned unchanged) → `{ status: "ready", image, illustrativeAfter }`. Everything after the body check answers HTTP 200 with a status (`not_eligible`, `failed`), never a technical error. Authentication: none exists — production refuses (401); rate limiting: none in production (503). The server cannot verify the evidence itself (no server-side analysis exists); it re-derives what it can and requires authentication.

**What is sent to OpenAI:** the front photo (as uploaded, untouched), the fixed prompt, and the model/size/format parameters. **Not sent:** findings, observations, opportunities, categories, goals, questionnaire data, ids, scores, age, gender, height, weight, contact details, assessment/interpretation text.

**Storage / retention.** The photo is read into memory for one request and discarded; never written to disk, storage or logs. The generated image is returned to the browser and held as an in-memory blob URL (released when the panel unmounts); never in localStorage/sessionStorage. Logs are one line of metadata (request id, provider, model, outcome, reason, duration). The provider's own retention of the uploaded photo is governed by its terms (undecided; see above).

**Output.** Named `illustrativeAfter` (never a prediction/expected/guaranteed/treatment result), labelled "Illustrative After" with "AI-generated visualization" and "AI-generated visualization. This is illustrative only and is not a prediction or guarantee of treatment results.", with the clinician context beside it. It is never fed back into analysis (a test scans the analysis layers for any import).

**Cost control.** Generation happens only from the button "Generate My Illustrative View" — never on render, refresh or a timer; the results page passes **no** image provider to the pipeline. Rate limit per subject (development default 3/hour, in memory); an `EntitlementCheck` hook exists for a future plan/credits model (none built).

**UI states.** Not eligible (a calm note: "An illustrative visualization isn't available from the current analysis." + a brief reason) · eligible (button) · consent · pending · failed ("…isn't available for this analysis.") · ready.

**Providers.** `openaiImages.ts` is the real one (server-only; refuses without consent; no key or image data in any error). `mockProvider.ts` backs the demo only (a browser-side mock; nothing is sent). `RemoteImageApi` remains the generic structure for other vendors.

### Environment variables

| Variable | Purpose | Notes |
|---|---|---|
| `IMAGE_GENERATION_PROVIDER` | `openai` to enable | unset → off |
| `OPENAI_API_KEY` | credential (shared with the wording provider) | server-side only; `.env.local` |
| `IMAGE_GENERATION_MODEL` | image model id | default constant in `openaiImages.ts` — confirm at the supervised call |
| `IMAGE_GENERATION_SIZE` / `_QUALITY` / `_INPUT_FIDELITY` / `_TIMEOUT_MS` | optional tuning | size defaults from the photo's orientation; fidelity defaults to `high` for the default model |
| `NEXT_PUBLIC_ILLUSTRATION_GENERATION` | public flag: show the button | `1` to show; non-secret |
| `NEXT_PUBLIC_CONSULTATION_URL` / `_CTA_LABEL` | consultation button | public |

`.env.example` lists these commented and blank; a test asserts no variable there has a value.

## Results (`lib/results/`, `components/results/`, `app/results/page.tsx`)

`MogaFaceResult { id, assessmentId, createdAt, interpretation, treatmentOpportunities, visualizationPlan, visualization, status, limitations }` — shaped for later server persistence. `visualization` is `{ status: pending | ready | unavailable | failed, provider?, imageUrl?, createdAt?, errorCode? }` — a **reference**, never image bytes; the snapshot store refuses anything image-sized.

**Flow.** After analysis the review screen shows the existing developer view **and** a "View My Results" button. It saves an `AssessmentSnapshot` (assessment, analysis, opportunities, front photo as a fresh blob URL) to `sessionStorage` and opens `/results`, which runs `runResultPipeline`: interpreting → (if eligible) preparing visualization → result. If the tab holds both an assessment snapshot and a newer single-photo `/analyze` result, the newer one is shown (`chooseResultSource`); the original measurement view remains as the fallback for `/analyze`.

**Stages shown:** analyzing · interpreting · preparing visualization · visualization ready · visualization unavailable · error. Copy never exposes implementation details.

**The consumer page** is a separate presentation layer fed by `toConsumerView`, which outputs plain copy only — no evidence ids, landmark numbers, symmetry values, thresholds, calibration state, versions or debug data (tested by scanning the serialized view) — and re-scans every string for forbidden language. Sections: your priorities · key observations · areas to discuss (plus a collapsed "what we couldn't assess") · illustrative visualization (before / illustrative after, label, notice, "What changed") · clinician review · consultation button. **No image?** A card reads "Your assessment is ready" with one of three honest explanations (not enough evidence / provider unavailable / generation failed) — never an empty box. **An image failure never fails the result:** the interpretation and opportunities are preserved and a non-blocking message is shown.

## Why real results are sparse today

`VISUAL_OBSERVATIONS_CALIBRATED = false`, so every opportunity citing video, contour or under-eye evidence is not consumer-ready, and the interpretation refuses to state those observations. A real assessment therefore yields: priorities, front-view structure/eye-area observations, a skin area (from answers), "not enough visual evidence" for the rest, and **no illustrative image**. That is intentional. To see the full experience during development, use the demo (below); to make real results richer, complete the calibration in `docs/VISUAL_CALIBRATION.md`.

## Where a real report's data comes from

1. The assessment lives in `AssessmentShell` state (persisted to localStorage without photo bytes, `lib/assessment/storage.ts`).
2. `AssessmentReview.runAnalysis` analyses each photo in the browser (`analyzeSinglePhoto` → `buildMultiPhotoAnalysis`) and the optional video (`analyzeVideoFile`) — all in memory.
3. `buildMogaFaceAnalysis(assessment, multiPhoto, video)` creates the observations; `evaluateTreatmentOpportunities` creates the opportunities.
4. "View My Results" saves an `AssessmentSnapshot` (assessment, analysis, opportunities, front-photo blob URL) to `sessionStorage` (`lib/results/store.ts`) and opens `/results`.
5. `ResultsExperience` loads that snapshot, runs `runResultPipeline` (local interpretation → report → visualization plan) and renders `toReportView`. With no snapshot it shows "No analysis found" — never a report and never demo data.

A real result never receives an image: the results page passes no image provider outside the demo, so the before / illustrative-after panel stays a placeholder until a real provider is connected. Demo data is reachable only through `?demo=1` in a non-production build (`tests/results/real-data.test.ts` checks that no other module imports it).

## Development demo (not a real assessment)

Outside production builds only:

- `/results?demo=1` — synthetic evidence through the real engine, opportunities marked consumer-ready **for the demo only**, placeholder SVG "photos", a mock image (only after the button is pressed), and a visible "Demo data — development only" banner.
- `&image=none` — no provider configured · `&image=noevidence` — no front photo, plan not eligible · `&image=fail` — the provider fails.

The demo does not touch the real gate (tested) and production builds ignore these switches. It tests UI and pipeline behavior only and says nothing about any real face or outcome.

## Not implemented

A live-tested AI provider; a real authenticator, shared-store rate limiter and consent screens; a live-tested image provider; the contour evidence policy decision; server-side result persistence; a real consultation destination; visualization for filler, lifting or skin; using profile/45° photos as visualization sources.
