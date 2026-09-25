# Interpretation, Visualization and Consumer Results

```
Assessment → facial analysis → observation layer → treatment opportunity engine
   → INTERPRETATION → VISUALIZATION PLAN → IMAGE PROVIDER → CONSUMER RESULTS PAGE
```

Everything on the right of the opportunity engine **builds on** the existing evidence; none of it recomputes a measurement, changes a threshold, or adds a treatment rule. The clinician is the final decision-maker, and every result says so.

> **Status.** The pipeline runs end to end with a **mock** image provider. No real AI interpretation provider and no real image-generation provider is connected or tested. Real assessments currently produce very little consumer-facing visual content, because the visual observation layer is uncalibrated and its opportunities are gated (see "Why real results are sparse today").

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

## Visualization plan (`lib/visualization/`)

Decides **what an image generator may show**; the image model never decides what someone "needs". A plan is `planned` only when all hold: a **front** photo exists, it **passed quality validation**, at least one **consumer-ready** opportunity maps to an approved change, and that change rests on visual evidence. Otherwise `not_eligible` with a reason and **no image is generated**.

Approved changes (first version): `facial_contour` (from contouring) and `expression_lines` (from the neuromodulator opportunity). Filler, lifting, skin, hair and consultation are **excluded**, each with a recorded reason. Intensity must be `subtle` (or `light`); anything stronger fails validation. Every plan — planned or not — carries the fixed disclaimer **"Illustrative visualization" / "Not a prediction of treatment outcome."**, and the validator rejects a plan whose disclaimer is missing or altered.

## Image generation (`lib/image-generation/`)

`ImageGenerationProvider.generateIllustration({ sourceImage, visualizationPlan })`. `generateVisualization` **never throws and never retries**: it validates the plan, makes at most one attempt with a timeout, refuses empty or image-sized results (no binaries in storage), and returns `ready`, `unavailable` (no eligible plan / no provider) or `failed`. `buildIllustrationPrompt` names only the approved changes and instructs the model to preserve identity, proportions, skin tone, hair, facial hair and background, with no dramatic or celebrity-like change.

- **Mock provider** (`mockProvider.ts`): no key, no network, generates nothing — it returns the source image (or a supplied placeholder) and is badged "Mock image — development only".
- **Provider selection** (`selectImageGenerationProvider`): env unset → mock in development, **no provider in production**; `mock`; `none`; any other name → a provider that reports `provider_not_configured` unless a registered adapter and key exist. **No vendor adapter is registered** (`REMOTE_IMAGE_APIS` is empty), so no real provider can be silently active.
- A real provider must run **server-side** (the key must never reach the browser) and must not receive a user's photo without a **consent flow**. Neither exists, which is why no adapter was written.

### Environment variables for a real provider

| Variable | Purpose | Notes |
|---|---|---|
| `IMAGE_GENERATION_PROVIDER` | provider name (`mock`, `none`, or a registered adapter) | unset → mock in dev, none in production |
| `IMAGE_GENERATION_API_KEY` | the provider's credential | **server-side only**; never commit; use `.env.local` |
| `NEXT_PUBLIC_CONSULTATION_URL` | consultation button destination (public) | `https://`, `mailto:`, `tel:` or a site path; default `/` |
| `NEXT_PUBLIC_CONSULTATION_CTA_LABEL` | button text (public) | default "Discuss My Results" |

`.env.example` lists these commented and blank; a test asserts no variable there has a value.

## Results (`lib/results/`, `components/results/`, `app/results/page.tsx`)

`MogaFaceResult { id, assessmentId, createdAt, interpretation, treatmentOpportunities, visualizationPlan, visualization, status, limitations }` — shaped for later server persistence. `visualization` is `{ status: pending | ready | unavailable | failed, provider?, imageUrl?, createdAt?, errorCode? }` — a **reference**, never image bytes; the snapshot store refuses anything image-sized.

**Flow.** After analysis the review screen shows the existing developer view **and** a "View My Results" button. It saves an `AssessmentSnapshot` (assessment, analysis, opportunities, front photo as a fresh blob URL) to `sessionStorage` and opens `/results`, which runs `runResultPipeline`: interpreting → (if eligible) preparing visualization → result. If the tab holds both an assessment snapshot and a newer single-photo `/analyze` result, the newer one is shown (`chooseResultSource`); the original measurement view remains as the fallback for `/analyze`.

**Stages shown:** analyzing · interpreting · preparing visualization · visualization ready · visualization unavailable · error. Copy never exposes implementation details.

**The consumer page** is a separate presentation layer fed by `toConsumerView`, which outputs plain copy only — no evidence ids, landmark numbers, symmetry values, thresholds, calibration state, versions or debug data (tested by scanning the serialized view) — and re-scans every string for forbidden language. Sections: your priorities · key observations · areas to discuss (plus a collapsed "what we couldn't assess") · illustrative visualization (before / illustrative after, label, notice, "What changed") · clinician review · consultation button. **No image?** A card reads "Your assessment is ready" with one of three honest explanations (not enough evidence / provider unavailable / generation failed) — never an empty box. **An image failure never fails the result:** the interpretation and opportunities are preserved and a non-blocking message is shown.

## Why real results are sparse today

`VISUAL_OBSERVATIONS_CALIBRATED = false`, so every opportunity citing video, contour or under-eye evidence is not consumer-ready, and the interpretation refuses to state those observations. A real assessment therefore yields: priorities, front-view structure/eye-area observations, a skin area (from answers), "not enough visual evidence" for the rest, and **no illustrative image**. That is intentional. To see the full experience during development, use the demo (below); to make real results richer, complete the calibration in `docs/VISUAL_CALIBRATION.md`.

## Development demo (not a real assessment)

Outside production builds only:

- `/results?demo=1` — synthetic evidence through the real engine, opportunities marked consumer-ready **for the demo only**, placeholder SVG "photos", mock image, and a visible "Demo data — development only" banner.
- `&image=none` — no provider configured · `&image=noevidence` — no front photo, plan not eligible · `&image=fail` — the provider fails.

The demo does not touch the real gate (tested) and production builds ignore these switches. It tests UI and pipeline behavior only and says nothing about any real face or outcome.

## Not implemented

A real AI interpretation provider; a real image-generation provider and its server route; a photo-upload consent flow; server-side result persistence; a real consultation destination; visualization for filler, lifting or skin; using profile/45° photos as visualization sources.
