# Treatment Opportunity Engine

Engine version: `TREATMENT_OPPORTUNITY_ENGINE_VERSION = "0.1.0"` (`lib/treatment-opportunities/versions.ts`).

## Purpose

Turns what MogaFace can actually evidence into a short list of **appearance-related concerns that may be worth discussing with a qualified clinician**, each mapped to a possible treatment *category*.

It is not a diagnosis, not a recommendation, and not a suitability check. The chain is:

```
OBSERVATION + USER-REPORTED GOAL/CONCERN
        ↓
     CONCERN
        ↓
POSSIBLE TREATMENT CATEGORY
        ↓
CLINICIAN ASSESSMENT REQUIRED
```

Language is always "may be worth discussing with your clinician" — never "you need Botox/fillers/threads".

## Architecture

```
Assessment ─────────────┐
                        ├─→ buildEvaluationContext ─→ rules A–D ─→ validate ─→ dedupe ─→ TreatmentOpportunity[]
MogaFaceAnalysis ───────┤                                            (evaluate.ts)
(observation layer)     │
VideoObservation[] ─────┘  (input contract only; no video pipeline exists yet)
```

| File | Role |
|---|---|
| `types.ts` | `TreatmentOpportunity`, unions (`TreatmentCategory`, status, confidence, concern, signal kind), `createOpportunity()` |
| `categories.ts` | Configurable category definitions (label, consultation label, description) |
| `evidence.ts` | Questionnaire → concern signals, observation/video lookup, `deriveConfidence`, `explainOpportunity`, `CONFIDENCE_MEANING` |
| `rules.ts` | The four rules (`TREATMENT_RULES`) |
| `evaluate.ts` | `evaluateTreatmentOpportunities(input)` — runs rules, drops invalid output, dedupes |
| `validate.ts` | `validateOpportunity(unknown): string[]` — never throws |
| `versions.ts` | Engine version |

The layer is **pure** (only `createdAt` timestamps vary), reads `lib/assessment/` and `lib/observation/` without modifying them, and adds no dependencies. It sits *above* the observation layer, so `MogaFaceAnalysis` itself is unchanged.

Integration point: `components/assessment/AssessmentReview.tsx` calls `evaluateTreatmentOpportunities` right after `buildMogaFaceAnalysis`, and the existing development view (`MultiPhotoDevResults`) lists the result. `/results` is not changed.

## The opportunity model

```ts
{
  id: "facial_contour_volume:FACIAL_CONTOURING",   // concern:category — deterministic, so duplicates are droppable
  concern, category, title, rationale,
  evidence: EvidenceItem[],            // source of truth
  evidenceObservationIds: string[],    // derived: observation + video evidence
  evidenceQuestionIds: string[],       // derived: questionnaire evidence
  status, confidence, limitations,
  clinicianReviewRequired: true,       // literal type; validator rejects anything else
  methodologyVersion, createdAt,
}
```

**Status**
- `potential_opportunity` — a rule fired with supporting evidence. `category` and `confidence` are set.
- `insufficient_evidence` — the user stated a related goal and analysis ran, but no observation supports it. `category` and `confidence` are `null`; nothing is recommended.
- `not_available` — the user stated a related goal but no photo analysis exists yet. `category` and `confidence` are `null`.

## Evidence model

Every opportunity carries `EvidenceItem`s: `{ kind: "observation" | "questionnaire" | "video", id, label, source }`. `source` is the photo view (`front`), `"video"`, or `"user"`. An opportunity with no evidence is invalid. A `potential_opportunity` must additionally include at least one questionnaire item — observations alone never create one.

**What evidence exists today** (see `docs/VISUAL_OBSERVATION_LAYER.md` for how each is produced)

| Evidence | Produced by | Status |
|---|---|---|
| Measured facial-structure observations (front view) | `lib/observation/photoDomains.ts` | Yes |
| Contour geometry — cheek/jaw outline angles per photo view, jaw/face width and lower-face ratios (front) | `lib/facial-analysis/contour.ts` | Yes — front, plus a 45° view's near side |
| Video expression movement (brow raise, frown, smile, squint) | `lib/facial-analysis/video/` | Yes, **only when a video is provided** and a steady neutral baseline exists |
| Video "visible line pattern" observations (forehead, glabellar, lateral eye) | same, within-video line-contrast comparison | Yes, **only when a video is provided**; uncalibrated thresholds |
| Under-eye "visible dark-looking appearance" | `lib/facial-analysis/underEye.ts` | Yes, front photo — recorded only; no rule consumes it |
| Questionnaire goals and structured appearance concerns | `docs/ASSESSMENT_APPEARANCE_CONCERNS.md` | Yes |
| Lifting / laxity observation | — | **No** — deliberately not implemented; `LIFTING_OBSERVATION_IDS` stays reserved |
| Skin visual observations (texture, tone, pigmentation, blemish, redness) | — | **No** — skin concerns stay user-reported; `SKIN_VISUAL_OBSERVATION_IDS` stays reserved |

The engine never manufactures a missing row. Observations are found by id list (`evidence.ts`): type `measured` or `inferred` (never `user_reported`), value `true` for presence-type observations. Video evidence is derived from the expression-movement observations already present in the analysis (`videoObservationsFrom`); the optional `videoObservations` input remains for supplying extra evidence directly.

Two evidence-strength rules follow from provenance: (1) every frame of one video counts as ONE source, so a video's line pattern and its movement cannot corroborate each other into "high"; (2) the volume branch's confidence is capped at "moderate" because contour geometry is relative outline geometry, not a volume measurement.

### Questionnaire mapping (`evidence.ts`)

Specific concerns from `assessment.appearanceConcerns` are read via `normalizeAppearanceConcerns` and mapped (all `explicit`) — see `docs/ASSESSMENT_APPEARANCE_CONCERNS.md` for the full table: `FACIAL_LINES`→`expression_lines`, `FACIAL_DEFINITION`→`facial_definition` (jaw/cheek/lower-face/overall-contour details→`facial_contour`), `FACIAL_VOLUME`→`facial_volume`, `FACIAL_LIFTING`→`facial_lifting`, `UNDER_EYE`→`under_eye`, the four skin concerns→`skin_concern`. `NOT_SURE`, `FACIAL_BALANCE`, `OVERALL_APPEARANCE` and "not sure which" details create no signal. The original broad goals below are unchanged.

| Answer | Signal | Strength |
|---|---|---|
| priority `lookMoreDefined` | `facial_definition` | general |
| priority `improveSkin` | `skin_concern` | explicit |
| area `skin` | `skin_concern` | general |
| area `jawDefinition` | `facial_contour` | explicit |

Multiple answers for one signal merge (strongest strength wins). Age, gender presentation and every other answer are never read. To support a new concern (e.g. a "reduce facial lines" goal), add a typed entry to the mapping tables when the question exists.

## Treatment categories

`NEUROMODULATOR`, `DERMAL_FILLER`, `FACIAL_CONTOURING`, `FACIAL_LIFTING`, `SKIN_TREATMENT`, `HAIR_SCALP_ASSESSMENT`, `CLINIC_CONSULTATION` — generic families, defined in `categories.ts`. They are **not** clinic services: nothing assumes any clinic offers any category (clinic configuration is a later layer). `HAIR_SCALP_ASSESSMENT` and `CLINIC_CONSULTATION` are defined but no rule produces them yet.

## Rules

Each rule needs a user goal signal; none triggers from observations alone.

| Rule | Needs | Output |
|---|---|---|
| **A** dynamic facial lines | `expression_lines` goal **and** a video line-pattern observation (video movement is listed as supporting evidence) | `NEUROMODULATOR` |
| **B** contour / volume | `facial_definition` / `facial_contour` goal **and** measured facial-structure observations (→ `FACIAL_CONTOURING`); or `facial_volume` goal **and** cheek-contour geometry from **at least two photo views** (→ `DERMAL_FILLER`, confidence capped at moderate) | one opportunity per category; a goal lacking its evidence adds one `insufficient_evidence` entry |
| **C** facial lifting (concern id `facial_lifting`) | `facial_lifting` goal **and** a lifting-relevant observation — none exists, so this never fires today | `FACIAL_LIFTING` |
| **D** skin | `skin_concern` goal; visual skin observations (uneven texture/tone, blemish/pigmentation/redness appearance, fine lines) add evidence | `SKIN_TREATMENT` |

Generic front-view structure measurements support only the contour branch of B. The volume branch needs two-view cheek-contour geometry; Rule C needs a lifting observation that no layer can produce. If A, B or C has the goal but not the observation → `insufficient_evidence` (or `not_available` if no analysis ran). D never downgrades: a user-reported skin concern is itself evidence, so it yields a `low`-confidence opportunity, and its wording drops "images" when no image evidence exists.

Rationale text (verbatim from the rules):
- A: "Your submitted images/video show features associated with facial expression lines. A neuromodulator consultation may be worth discussing with your clinician." (says "images show" when there is no video)
- B: "Your goals and facial-structure observations suggest that a facial contour/volume assessment may be worth discussing with your clinician."
- C: "Your stated goals and available facial observations may justify discussing facial lifting/contouring options with your clinician."
- D: "Your submitted images and responses indicate skin-related concerns that may be worth assessing with your clinician."

## Consumer gating (uncalibrated visual evidence)

Opportunities that depend on the visual observation layer must stay appropriately gated until its thresholds have been engineering-calibrated (`docs/VISUAL_CALIBRATION.md`) — that is **not** clinical validation, and completing it would not turn an opportunity into a recommendation.

- `VISUAL_OBSERVATIONS_CALIBRATED` (`lib/facial-analysis/calibration/status.ts`) is `false`.
- Every `TreatmentOpportunity` carries `consumerReady`. It is `false` whenever a cited observation id starts with `expression.`, `facialStructure.contour.`, `eyeArea.underEye` or `eyeArea.visibleUnderEye`; it is `true` for opportunities resting only on user-reported answers or the older front-view structure measurements (e.g. skin at low confidence). `validateOpportunity` rejects a `consumerReady` that contradicts the cited evidence.
- The engine still **produces and returns** every opportunity, so tests and the development view can inspect them and no raw observation is hidden. The development view labels gated ones. Any consumer-facing surface must use `selectConsumerOpportunities(...)`, which returns only `consumerReady` ones. No consumer surface shows opportunities today.
- Today that means the neuromodulator, filler and any contour-evidence-based contouring opportunity are gated; nothing new becomes production-ready by this change.

The engine is conservative about ambiguous evidence: a value near its threshold produces no observation (so the goal stays `insufficient_evidence`), and contour measurements that disagree across the two 45° views are set aside.

## Confidence semantics

Confidence measures **evidence completeness/strength**, never probability of suitability, and is only set on `potential_opportunity` (otherwise `null`). Computed by `deriveConfidence`:

- **high** — an explicit user goal + ≥2 relevant observations from ≥2 independent sources (two photo views, or photo + video).
- **moderate** — an explicit user goal + ≥1 relevant observation, not independently corroborated.
- **low** — weak or indirect evidence: only a general goal, or a self-reported concern with no supporting observation.

Note: with today's single front photo, "high" is unreachable for rule B from real data (Rule C cannot fire at all until a validated lifting observation exists).

## Limitations

Every potential opportunity carries: "based on submitted images and questionnaire answers only", "suitability cannot be determined from photographs alone", "a clinician must assess anatomy, medical history and treatment suitability", plus a rule-specific one (e.g. structure measurements are relative geometry and do not indicate volume loss; photographs cannot measure tissue laxity; no skin condition is identified or diagnosed). Not-evidenced opportunities carry the same list.

## Clinician review

`clinicianReviewRequired` is the literal `true` on every opportunity; the constructor sets it and `validateOpportunity` rejects anything else. The intended presentation is: observation → interpretation → potential consultation option → **clinician decision**.

## Traceability

`explainOpportunity(opp)` returns `{ opportunity, concern, reasons }`, e.g.

```json
{
  "opportunity": "FACIAL_CONTOURING",
  "concern": "facial_contour_volume",
  "reasons": [
    "Reported by user: Area of interest: jaw definition",
    "Relevant facial observation: Jaw width",
    "Evidence strength moderate: An explicit user goal plus at least one relevant observation, but not corroborated by an independent source."
  ]
}
```

## Validation

`validateOpportunity(unknown)` checks required fields, valid concern/category/status/confidence, category/confidence `null` unless potential, non-empty well-formed evidence (with derived id lists matching), a questionnaire item and ≥1 limitation for potential opportunities, `clinicianReviewRequired === true`, methodology version, `createdAt`, and rejects title/rationale wording that claims need, suitability, diagnosis, attractiveness or a percentage. It never throws. `evaluateTreatmentOpportunities` drops anything that fails.

## What the engine does NOT do

- No diagnosis, disease detection, or condition naming (acne, melasma, rosacea, scarring, dermatitis…).
- No "you need X" / suitability / percentage claims; no treatment *decision*.
- No attractiveness, beauty, or ideal-face scoring or comparison.
- No age-, gender-, or ethnicity-based assumptions.
- No invented evidence: no skin, hair, aging, laxity, filler-suitability or Botox-suitability computer vision exists, so those stay `insufficient_evidence` or absent.
- No external AI API, no after-image generation, no clinic-service configuration, no results-page UI.
