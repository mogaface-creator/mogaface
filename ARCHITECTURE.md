# Architecture

## Layers today (single-photo, `/analyze`)

```
Browser
  FaceUploader → PhotoPreview           (components/facial-analysis)
        ↓
  faceLandmarker.ts (MediaPipe, WASM)   → raw 478-point landmarks
        ↓
  quality.ts                            → PhotoQualityResult (blocks bad photos)
        ↓
  measurements.ts / symmetry.ts / proportions.ts
        ↓
  analysis.ts                           → versioned FacialAnalysisResult
        ↓
  resultStore.ts (sessionStorage)       → hands the result from /analyze to /results
        ↓
  AnalysisResults + cards               → /results UI
```

Everything under `lib/facial-analysis/` except `faceLandmarker.ts` is plain
TypeScript with no React or browser dependency — it takes typed data in and
returns typed data out, which is what makes it unit-testable with
`node --test` and safe to reuse if the pipeline ever moves server-side.

## Frontend

Next.js App Router, four routes (`/`, `/analyze`, `/results`, `/assessment`),
Tailwind for styling. No global state library — `/analyze` owns a single
state machine (`select → processing → blocked | error`) and hands its
result to `/results` via `sessionStorage`. `/assessment` (a client-only
wizard, loaded via `next/dynamic` + `ssr:false` since it reads
`localStorage`/blob URLs from its first render) owns its own state and
persists the questionnaire to `localStorage` — see `lib/assessment/` and
its own section below.

## Assessment + multi-photo analysis (`/assessment`, `lib/assessment/`, `lib/facial-analysis/multiPhoto/`)

```
Assessment wizard (profile/goals/hair/facial hair/lifestyle/style)
        ↓
5 standardized photo slots (front, left/right 45°, left/right profile)
        ↓
lib/facial-analysis/multiPhoto/coordinator.ts   — one photo at a time (Step 16)
        ↓
faceLandmarker.ts (same singleton MediaPipe instance as /analyze)
        ↓
quality.ts / measurements.ts / symmetry.ts / proportions.ts — UNCHANGED, reused as-is
        ↓
viewValidation.ts + viewCapabilities.ts   — per-view plausibility + what's combinable
        ↓
consistency.ts + combine.ts   — pure, cheap, re-run after any single photo changes
        ↓
MultiPhotoFacialAnalysis   — shown by the temporary MultiPhotoDevResults dev view
```

`lib/assessment/` (questionnaire data model, `localStorage` persistence) and
`lib/facial-analysis/` (the measurement engine) are kept independent — the
questionnaire never needs to know how a photo is measured, and the engine
never needs to know about assessment questions. `PhotoSlot` is defined once,
in `lib/assessment/types.ts`, and `lib/facial-analysis/multiPhoto/types.ts`
mirrors its literal values rather than importing them, so the facial-analysis
engine stays a standalone dependency (only `coordinator.ts`, the explicit
integration layer, imports from `lib/assessment/`).

**Single-photo vs. multi-photo versioning:** `analysisVersion`
(`lib/facial-analysis/analysis.ts`) tracks the per-photo formulas; a change
there affects both `/analyze` and every photo in a multi-photo run.
`multiPhotoAnalysisVersion` (`lib/facial-analysis/multiPhoto/types.ts`)
tracks only the combination/consistency rules layered on top — the two
version independently. `/analyze` and its single-photo `FacialAnalysisResult`
type are untouched by any of this.

## Facial-analysis engine

`landmarkMapping.ts` is the single source of truth for which of MediaPipe's
478 landmark indices mean what; every other engine module imports names from
it instead of hard-coding indices. `geometry.ts` is the only place distance/
angle/ratio math happens. This separation means a future measurement (say,
a new jaw metric) is: add a landmark name if needed, add a formula in
`measurements.ts` using existing geometry primitives, done — no component
changes required.

## Landmark system

MediaPipe's FaceLandmarker returns normalized (0-1) x/y/z per point, already
scale-independent of pixel resolution but not of image crop or camera
distance. `normalization.ts` documents why every reported ratio divides by a
facial reference dimension (face width or height) rather than reporting raw
distances as standalone numbers.

## Future AI layer (not implemented)

```
FacialAnalysisResult (already versioned, already structured)
        ↓
AI interpretation (Phase 22 — lib/facial-analysis/future.ts has the types)
        ↓
User-facing report / recommendations / visualization
```

The contract: an LLM only ever *reads* a `FacialAnalysisResult` and produces
prose or a preview image from it. It never calculates a measurement, never
overrides a ratio, and any future `OPENAI_API_KEY` stays server-side (see
`.env.example`). This keeps the deterministic engine trustworthy regardless
of what's layered on top of it.

## Future database layer (not implemented)

Supabase would own: auth, user accounts, stored assessments (a
`FacialAnalysisResult` per upload, already JSON-serializable), and private
image storage. Because the engine already outputs one versioned, structured
object, adding persistence is additive — save what `resultStore.ts` already
produces, keyed by user and timestamp, instead of sessionStorage. No engine
code should need to change.

## Explicitly not built

Microservices, a separate backend, Docker/Kubernetes, queues, or Redis. The
whole pipeline runs in the user's browser on a static Next.js app — there is
nothing here that needs a server to compute.
