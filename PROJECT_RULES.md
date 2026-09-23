# Project Rules

These are the standing constraints for MogaFace. If a future change would
violate one of these, stop and raise it rather than working around it.

## Product / scientific

- Never translate a measurement into an attractiveness, beauty, or "ideal"
  claim (see FACIAL_ANALYSIS_METHODOLOGY.md, "What this is not").
- Never make a medical or diagnostic claim, and never recommend prescription
  treatment.
- Never invent a reference/"ideal" ratio. A ratio must either be measured
  from the photo or come from a documented, sourced dataset — see
  `lib/facial-analysis/future.ts` for how a real reference dataset would be
  typed once one exists.
- Never claim a physical unit (cm/mm) for a measurement that has no
  calibration reference.
- Never silently produce `NaN`/`Infinity` in an analysis result — every
  division in the engine goes through `ratio()`/`normalizedDifference()`,
  which return `null` on a zero denominator instead.

## Engineering

- `lib/facial-analysis/` stays framework-free (except `faceLandmarker.ts`,
  which is client-only by necessity). No React imports there.
- Every landmark index used anywhere is named in `landmarkMapping.ts` — no
  raw MediaPipe index literals in other files.
- No new dependency without a concrete need; prefer stdlib/native features
  (this project's tests run on `node --test`, not a test framework, for
  exactly this reason).
- No microservices, Docker, Kubernetes, Redis, queues, or a separate
  backend. This is a single Next.js app.
- Don't implement Phases 22-26 (AI interpretation, reference datasets,
  Supabase, payments) — only their type-only interfaces exist today.
- Before editing a file: read it, understand it, make the smallest
  necessary change. Don't rewrite unrelated files or disable
  lint/TypeScript checks to make a build pass — fix the underlying issue.

## Privacy

- Photos are never uploaded to a server in the current pipeline — detection
  and analysis run entirely in the browser.
- Results persist only in `sessionStorage` for the current tab; there is no
  database yet, and none should be added without an explicit consent flow.
