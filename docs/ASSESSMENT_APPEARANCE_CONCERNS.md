# Assessment: Appearance Concerns

Source of truth: `lib/assessment/appearanceConcerns.ts` (catalog, validation, edit helpers, normalization) and `components/assessment/AppearanceConcernsStep.tsx` (UI). Version: `APPEARANCE_CONCERNS_VERSION = "0.1.0"`.

## Purpose

Collect **what the user would like to improve**, as structured IDs, so downstream layers have real user-reported evidence to work with. The questionnaire asks about appearance goals — never about treatments. It does not mention any treatment, and a selection never implies that any treatment is medically appropriate.

## Data model

`Assessment.appearanceConcerns`:

```ts
{
  version: "0.1.0",
  selected:   AppearanceConcernId[],        // top-level concerns
  details:    AppearanceConcernDetailId[],  // optional refinements; parent must be selected
  priorities: AppearanceConcernId[],        // "what is most important?" — ≤ 3, each in `selected`
}
```

This is a separate field from the older broad `goals` (areas/priorities), which is unchanged. `goals.priorities` uses a different vocabulary (hair, style, "glow-up"…), so it cannot serve as the priority list for face/skin concerns; the two coexist and both feed the engine (see below).

## Concerns and detail hierarchy

The step groups concerns under section headings and reveals details only after a concern is selected (concern → optional detail). Multiple selections are allowed everywhere.

| Section | Concern (ID) | Details |
|---|---|---|
| Facial lines | `FACIAL_LINES` — "Lines that become more visible with facial expressions" | `FOREHEAD_LINES`, `FROWN_LINES`, `EYE_AREA_LINES`, `MOUTH_AREA_LINES`, `GENERAL_EXPRESSION_LINES`, `FACIAL_LINES_NOT_SURE` |
| Face shape & contour | `FACIAL_DEFINITION` | `JAW_DEFINITION`, `CHEEK_DEFINITION`, `LOWER_FACE_DEFINITION`, `OVERALL_CONTOUR`, `CONTOUR_BALANCE`, `FACIAL_DEFINITION_NOT_SURE` |
| | `FACIAL_BALANCE` | — |
| Volume & fullness | `FACIAL_VOLUME` | `CHEEK_FULLNESS`, `MIDFACE_FULLNESS`, `LIP_FULLNESS`, `FACIAL_VOLUME_BALANCE`, `FACIAL_VOLUME_NOT_SURE` |
| Lifting & firmness | `FACIAL_LIFTING` | `FACIAL_FIRMNESS`, `LOWER_FACE_LIFTING`, `JAWLINE_LIFTING`, `OVERALL_LIFTED_APPEARANCE`, `FACIAL_LIFTING_NOT_SURE` |
| Under-eye | `UNDER_EYE` | `DARK_LOOKING_UNDER_EYES`, `UNDER_EYE_PUFFINESS`, `UNDER_EYE_HOLLOW_APPEARANCE`, `UNDER_EYE_FINE_LINES`, `UNDER_EYE_APPEARANCE_GENERAL`, `UNDER_EYE_NOT_SURE` |
| Skin | `SKIN_TEXTURE` | `UNEVEN_TEXTURE`, `ROUGH_LOOKING_SKIN`, `VISIBLE_PORES`, `FINE_LINES`, `GENERAL_TEXTURE` |
| | `SKIN_TONE` | `UNEVEN_TONE`, `DULL_LOOKING_SKIN`, `REDNESS`, `GENERAL_TONE` |
| | `PIGMENTATION` | `DARK_SPOTS`, `UNEVEN_PIGMENTATION`, `GENERAL_PIGMENTATION` |
| | `BLEMISHES` | `ACTIVE_BLEMISHES`, `BLEMISH_MARKS`, `GENERAL_BLEMISH_CONCERN` |
| Overall | `OVERALL_APPEARANCE` — "An overall improvement in my appearance" | — |
| | `NOT_SURE` — "I'm not sure yet" | — |

Detail IDs are globally unique. Where the brief repeated a name across parents (`NOT_SURE` under several concerns; `FACIAL_BALANCE` as both a concern and a contour detail) the detail IDs are `<CONCERN>_NOT_SURE` and `CONTOUR_BALANCE`, so a flat `details` list is never ambiguous.

Labels are user-voiced appearance wording ("Dark-looking under-eyes", "More fullness in my cheeks"). A test enforces that no label names a treatment or a clinical/diagnostic term (acne, melasma, rosacea, dermatitis, scarring, hyperpigmentation, laxity, …).

### `NOT_SURE`

Records uncertainty and nothing else. The UI treats it as exclusive (selecting it clears other concerns; selecting a real concern clears it). It cannot have details or be a priority. It never creates a treatment opportunity.

### Priorities

Shown once at least two real concerns are selected; optional; maximum 3; drawn only from selected concerns. Deselecting a concern removes its details and priority. A priority does not change evidence strength — it is metadata for the results layer.

## Validation

`validateAppearanceConcerns(unknown): string[]` (never throws) checks: valid concern IDs; valid detail IDs; no duplicates in any list; each detail's parent is selected; ≤ 3 priorities; each priority is selected and is not `NOT_SURE`; version. `sanitizeAppearanceConcerns` returns a copy or `null`. The pure edit helpers `toggleConcern` / `toggleDetail` / `togglePriority` maintain all invariants, so the UI cannot produce invalid state.

## Storage and backward compatibility

- Persists through the existing `localStorage` assessment storage (`lib/assessment/storage.ts`, unchanged). No image/video bytes are involved; photo storage is untouched.
- `ASSESSMENT_VERSION` stays `"0.1.0"` — bumping it would discard every previously stored assessment. Instead the new field is versioned on its own (`appearanceConcerns.version`).
- `sanitizeAssessment`: a stored assessment **without** the field loads with an empty `appearanceConcerns`. A field that is **present but malformed** discards the whole assessment, matching how every other section is handled.
- The step is optional; `validateAssessment` (the gate for "Start Analysis") is unchanged.

## Normalization

`normalizeAppearanceConcerns(value)` turns answers into `AppearanceConcernSignal[]`: one signal per selected concern, then one per selected detail. Malformed input yields `[]`.

| Answer | Signal |
|---|---|
| `FACIAL_LINES` | `user_reports_facial_lines_concern` |
| `FOREHEAD_LINES` | `user_reports_forehead_line_concern` |
| `FACIAL_DEFINITION` | `user_reports_facial_definition_goal` |
| `JAW_DEFINITION` | `user_reports_jaw_definition_goal` |
| `FACIAL_VOLUME` | `user_reports_facial_volume_goal` |
| `FACIAL_LIFTING` | `user_reports_facial_lifting_goal` |
| `UNDER_EYE` | `user_reports_under_eye_concern` |
| `DARK_LOOKING_UNDER_EYES` | `user_reports_dark_looking_under_eye_concern` |
| `SKIN_TEXTURE` / `SKIN_TONE` / `PIGMENTATION` / `BLEMISHES` | `user_reports_skin_texture_concern` / `_skin_tone_concern` / `_pigmentation_concern` / `_blemish_concern` |
| `NOT_SURE` | `user_reports_uncertainty_about_areas` |

Every signal starts with `user_reports_` and is unique (tested); the full list lives in the catalog. Each signal also carries its label, a stable `questionId` (`appearanceConcerns.selected.<ID>` / `appearanceConcerns.details.<ID>`) and an `isPriority` flag.

## What these signals are — and are not

They are **user-reported evidence**: the user said this is something they want to improve. They are not a diagnosis, not a finding about the person's face, not visual evidence, and not a treatment recommendation or decision. Selecting a concern does not mean a treatment is appropriate.

## Relationship to the Treatment Opportunity Engine

`buildConcernSignals` (`lib/treatment-opportunities/evidence.ts`) now also reads `assessment.appearanceConcerns` through `normalizeAppearanceConcerns`:

| Concern | Engine signal | Consumed by |
|---|---|---|
| `FACIAL_LINES` (+ details) | `expression_lines` | Rule A (neuromodulator) |
| `FACIAL_DEFINITION` | `facial_definition` | Rule B (contouring) |
| `JAW_/CHEEK_/LOWER_FACE_DEFINITION`, `OVERALL_CONTOUR` | `facial_contour` | Rule B (contouring) |
| `FACIAL_VOLUME` | `facial_volume` | Rule B (filler branch) |
| `FACIAL_LIFTING` | `facial_lifting` | Rule C (lifting) |
| `UNDER_EYE` | `under_eye` | no rule yet — recorded only |
| `SKIN_TEXTURE`, `SKIN_TONE`, `PIGMENTATION`, `BLEMISHES` | `skin_concern` | Rule D (skin) |
| `FACIAL_BALANCE`, `OVERALL_APPEARANCE`, `NOT_SURE`, `*_NOT_SURE` details | none | — |

A mapped signal is always `explicit` strength (the user named the concern). The questionnaire is evidence, not the decision, so **a concern alone does not create a treatment opportunity** unless the engine already allows that from user evidence (only skin, at low confidence):

- `FACIAL_LINES` alone → `insufficient_evidence`, no category. With a provided video whose brow-raise frames show both measurable movement and higher line contrast than neutral frames, → `NEUROMODULATOR` (moderate at most).
- `FACIAL_VOLUME` alone → `insufficient_evidence`. With cheek-contour geometry from at least two photo views (front + a 45° photo) → `DERMAL_FILLER` (capped at moderate); a single view is not enough.
- `FACIAL_LIFTING` → `insufficient_evidence` always, for now — no clinically defensible lifting observation exists, and jaw geometry is not treated as one. The engine's concern id and the user's signal are both `facial_lifting`; nothing in the questionnaire or the engine implies laxity.
- Definition/contour + measured facial-structure geometry → `FACIAL_CONTOURING` (moderate for a named contour concern).
- Skin concern → low-confidence `SKIN_TREATMENT`; a visual skin observation would raise it.
- `UNDER_EYE` → recorded, no opportunity. `NOT_SURE` → nothing.

The engine never creates visual evidence itself; it only reads what `docs/VISUAL_OBSERVATION_LAYER.md` describes. Lifting and skin stay on reserved ids no layer emits.

## Development visibility

The existing development view (`MultiPhotoDevResults`, shown after "Start Analysis") lists each normalized signal next to its label, e.g. "Forehead lines — `user_reports_forehead_line_concern`", above the opportunity list. `/results` is unchanged and no treatment recommendation is shown to consumers.

## Examples

- User selects `FACIAL_LINES` + `FOREHEAD_LINES`, no visual layer: signals `user_reports_facial_lines_concern`, `user_reports_forehead_line_concern`; engine → one `insufficient_evidence` opportunity for facial-line appearance (no category), citing both answers.
- User selects `SKIN_TONE` + `REDNESS`: engine → low-confidence `SKIN_TREATMENT`, "Your submitted responses indicate skin-related concerns that may be worth assessing with your clinician."
- User selects `NOT_SURE`: one uncertainty signal; no opportunity.
- Assessment saved before this feature: loads with empty concerns; nothing changes.
