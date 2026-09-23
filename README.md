# MogaFace

MogaFace is an AI-assisted facial analysis platform. It detects a face in a
photo, maps its geometry, and reports measurable proportions and symmetry —
entirely in your browser. No image is ever uploaded to a server.

**MogaFace does not make beauty, attractiveness, or medical claims.** See
[FACIAL_ANALYSIS_METHODOLOGY.md](./FACIAL_ANALYSIS_METHODOLOGY.md) for the
distinction between *measurement* and *interpretation* this project holds to.

## Install

```bash
npm install
```

## Run

```bash
npm run dev
```

Open http://localhost:3000. Visit `/analyze` to upload a photo and run the
pipeline; results are shown at `/results`.

## How MediaPipe is used in this project

Face detection and the 478-point landmark mesh come from Google's
[MediaPipe Face Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker)
(`@mediapipe/tasks-vision`), running entirely client-side via WebAssembly:

- The model file is self-hosted at `public/models/face_landmarker.task`.
- The WASM runtime is fetched from MediaPipe's CDN at load time (a static
  asset for the library itself — no image data is sent anywhere).
- `lib/facial-analysis/faceLandmarker.ts` lazily loads the model once,
  retries on CPU if the GPU delegate fails, and normalizes errors.
- `lib/facial-analysis/landmarkMapping.ts` gives every landmark index used
  by the app a semantic name, documented and cross-checked against
  MediaPipe's own connection definitions.

## How measurements are calculated

See [FACIAL_ANALYSIS_METHODOLOGY.md](./FACIAL_ANALYSIS_METHODOLOGY.md) for
every formula. In short: `lib/facial-analysis/geometry.ts` provides pure
distance/angle/ratio primitives, `measurements.ts` applies them to named
landmarks, `symmetry.ts` and `proportions.ts` derive comparative metrics, and
`analysis.ts` combines everything into a versioned `FacialAnalysisResult`.

## Project structure

```
app/                      Routes: / (landing), /analyze, /results
components/
  layout/                 Header, Footer
  ui/                     Button, StepIndicator
  facial-analysis/        Upload, preview, quality, canvas, results UI
lib/
  facial-analysis/        The analysis engine (no React, no DOM except
                           faceLandmarker.ts, which is client-only)
public/models/            Self-hosted MediaPipe model file
tests/facial-analysis/    node:test unit tests for the engine
```

## Testing

```bash
npm test    # node --test — no test framework dependency required
npm run lint
npx tsc --noEmit
npm run build
```

## Current limitations

- Measurements are **relative units** derived from the photo's own geometry
  (fractions of image width/height), not physical centimeters — there is no
  calibration reference in a single 2D photo.
- Only one photo is supported today; multi-photo tracking over time is not
  built yet (the analysis object is already versioned to support it later).
- Symmetry and proportion metrics are geometric only — they carry no
  attractiveness or medical interpretation.
- No accounts, no history, no database: results live in `sessionStorage` for
  the current tab only.

## Roadmap

Phases 22-26 of the project brief (AI interpretation, reference datasets,
Supabase accounts/history, and payments) are intentionally **not
implemented**. Only type-only interfaces exist today
(`lib/facial-analysis/future.ts`) so a real integration has a stable shape
to target. See [ARCHITECTURE.md](./ARCHITECTURE.md) for how those layers
are expected to plug in without rewriting the analysis engine.
