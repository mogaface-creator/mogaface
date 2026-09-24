# Visual Observation Layer

Observation-layer version `0.2.0` (`lib/observation/versions.ts`); video analysis version `0.1.0` (`lib/facial-analysis/video/types.ts`).

## Purpose

Turn the submitted photos and the optional video into **structured, traceable observations** that the Treatment Opportunity Engine may consume. The flow is:

```
OBSERVABLE FEATURE → STRUCTURED OBSERVATION → (Treatment Opportunity Engine MAY consume it)
```

This layer **describes what is observable**. It does not diagnose, score, recommend, or predict, and it never names a treatment. It uses no age, gender, race or ethnicity, compares nothing to an ideal face, and produces no attractiveness/beauty/aging/suitability score. All processing is local (existing MediaPipe landmarks + browser canvas); no external AI is used and nothing is uploaded.

> **Calibration status — read this first.** **Thresholds are engineering heuristics and have not been clinically validated.** They have not even been engineering-calibrated: the pipeline is unit-tested on synthetic landmarks and synthetic pixel data only, no real-face photo or video was available, and the pixel-based measures (line contrast, under-eye brightness) have not been checked against real footage. `VISUAL_OBSERVATIONS_CALIBRATED = false` (`lib/facial-analysis/calibration/status.ts`): observations are produced and shown in development, but any treatment opportunity that cites them is marked `consumerReady: false`. The calibration workflow, threshold registry, real-data test matrix and sign-off criteria are in [`VISUAL_CALIBRATION.md`](VISUAL_CALIBRATION.md); the development harness is at `/dev/calibration`.
>
> Three levels, never to be conflated: **synthetic test validation** (done — the unit tests), **engineering calibration** (not done — harness ready), **clinical validation** (out of scope, never implied).

## Observation model

Every new observation is a normal `Observation<T>` (`lib/observation/types.ts`) built with `measuredObservation` — so it carries `id, domain, label, type, value, source, confidence, methodologyVersion, createdAt`, with `type: "measured"` and `confidence: "not_calibrated"` like every other measurement. Only one thing was added: the domain `"expression"`, for video-derived observations.

## Observation catalog

| id | domain | value | source (provenance) | From |
|---|---|---|---|---|
| `facialStructure.contour.cheekContourAngle.<slot>.<side>` | facial-structure | degrees | photo slot (`front`, `leftFortyFive`, …) | outline angle at the cheek point |
| `facialStructure.contour.jawContourAngle.<slot>.<side>` | facial-structure | degrees | photo slot | outline angle at the jaw-angle point |
| `facialStructure.contour.jawToFaceWidthRatio` | facial-structure | ratio | `front` | jaw width / face width |
| `facialStructure.contour.lowerFaceContourRatio` | facial-structure | ratio | `front` | nose-base-to-chin height / jaw width |
| `eyeArea.underEyeBrightnessRatio.<right\|left>` | eye-area | ratio | `front` | under-eye strip brightness ÷ adjacent cheek |
| `eyeArea.visibleUnderEyeDarkness` | eye-area | `true` | `front` | both ratios ≤ 0.85 |
| `expression.browRaise.foreheadRegionMovementPct` | expression | % | `video_frame_…` | brow-to-eye distance vs neutral |
| `expression.frown.glabellarRegionMovementPct` | expression | % | `video_frame_…` | inner-brow closeness vs neutral |
| `expression.smile.mouthAreaMovementPct` | expression | % | `video_frame_…` | mouth width vs neutral |
| `expression.squint.eyeAreaMovementPct` | expression | % | `video_frame_…` | eye-opening decrease vs neutral |
| `expression.visibleForeheadLinePattern` | expression | `true` | `video_frame_…` | brow-raise vs neutral line contrast |
| `expression.visibleGlabellarLinePattern` | expression | `true` | `video_frame_…` | frown vs neutral line contrast |
| `expression.visibleLateralEyeLinePattern` | expression | `true` | `video_frame_…` | smile/squint vs neutral texture contrast |
| `expression.lineContrastRatio.<region>.<expression>` | expression | ratio | `video_frame_…` | the numbers behind the pattern observations |

Naming: "visible … line pattern", never "wrinkle", "aging" or a treatment word. A `true` pattern/darkness observation means "this looks so in this media"; **absence means "not evidenced", never "not present"**.

## Provenance

Every observation names its source. Photo-derived: the slot it was measured on. Video-derived: the sampled frames it was computed from, e.g. `video_frame_0+video_frame_1+video_frame_2+video_frame_3`. `validateObservation` rejects any `expression` observation whose source is not of that form, so an untraceable video observation cannot be built. A missing photo view contributes nothing — values are never borrowed from another view.

## Photo evidence

### Contour geometry (`lib/facial-analysis/contour.ts`)

Relative geometry of the face-oval outline between ear level and chin, from the landmarks of each complete **front** and **45°** photo. Landmark indices were checked against MediaPipe's own face-oval ordering (ear → chin: 234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152, mirrored 454 … 379).

- **Cheek contour angle** — the outline's angle at the cheek point (132 / 361) between the ear-level point and the jaw-angle point.
- **Jaw contour angle** — the outline's angle at the jaw-angle point (172 / 397) between the cheek point and the chin-side point (150 / 379).
- Angles are computed in **pixel space** (landmarks × image size), so a non-square photo does not distort them.
- **Front** reports both sides plus the two ratios. A **45°** view reports only its **near side** (chosen from where the nose tip sits between the face edges; span ratio ≥ 1.25) and no ratios, because the far side is foreshortened. A "45°" photo that is actually frontal contributes nothing.
- **Profile** photos contribute nothing: chin projection and other profile geometry are not implemented (MediaPipe's mesh is not reliable in profile). No placeholder observation is emitted; the existing "Chin projection (profile)" combined-measurement entry stays `null`.

These are angles and ratios, not volumes. No absolute size, no ideal, and no claim that any value means too little or too much of anything.

### Under-eye (`lib/facial-analysis/underEye.ts`)

One conservative quantity: the mean luminance of a strip just below each lower lid ÷ that of a same-width reference strip on the cheek below it, **in the same photo**. Below 1 = the strip looks darker in this image. `visibleUnderEyeDarkness` is emitted only when **both** eyes are clearly below the 0.85 threshold — at or below 0.8075 (a ±5% borderline band around 0.85 counts as insufficient evidence and produces no observation). Worded "visible dark-looking under-eye appearance, relative to adjacent cheek". **This is the only thing measured: relative brightness.** It is not pigmentation, not volume, not a vascular or medical finding, and no cause is inferred.

It does **not** say why the area looks dark — shadow, light direction, skin tone variation, camera processing and anatomy all give the same number — and says nothing about pigmentation, volume or any condition.

**Deliberately not measured**, and reported as such in `eyeArea.notMeasured` with a reason (never silently dropped): visible under-eye puffiness (needs 3D shape), **apparent** under-eye hollowing (shadow and shape are indistinguishable in one photo), visible under-eye fine-line pattern (not reliably resolvable in a selfie).

## Video evidence

An optional video is chosen in the assessment review step, held in memory only, and analyzed locally when the user starts the analysis. It never blocks the photo analysis.

### Protocol

The user is asked to start with a **still, relaxed face**, then raise the eyebrows, frown, smile and squint. The neutral opening is what everything is compared against. The video is not required to contain every expression.

### Pipeline (`lib/facial-analysis/video/`)

| Step | File | Behaviour |
|---|---|---|
| 1. Metadata validation | `validate.ts` | Must be `video/*`, 2–60 s, ≥ 240 px on its short side (warning below 480), ≤ 200 MB. |
| 2. Frame sampling | `sampling.ts` | Up to 24 evenly spaced timestamps across the middle 90% of the video. |
| 3. Frame capture, detection, landmarks | `capture.ts` (browser only) | Native `<video>` seek → canvas (long side ≤ 960 px) → the existing MediaPipe FaceLandmarker. No new dependency. |
| 4. Frame quality | `quality.ts` | Reuses the photo checks (exactly one face, size, not cut off, resolution) and additionally rejects frames that are too dark/bright, tilted (> 15°) or turned (yaw ratio > 1.8). Rejection reasons are recorded. |
| 5. Neutral baseline | `expressions.ts` | The first 3 **usable** frames. Stable if no feature spreads more than 8%; otherwise **no baseline** and every state is `insufficient_evidence`. |
| 6. Classification | `expressions.ts` | Each usable frame → `NEUTRAL`, one expression, or `AMBIGUOUS` (never used as evidence). |
| 7. Comparison | `observe.ts` | Per state: mean movement vs neutral, frames, strength. Plus within-video line contrast. |

Unusable frames (no face, several faces, too dark, cut off, turned, tilted) never enter the baseline or any comparison.

### Expression features

All in pixel space, divided by the frame's own interocular distance, so they are comparable within one video without any absolute unit: brow-to-eye distance (mid-brow to upper lid), inner-brow separation, inner-brow-to-eye-corner distance, eye opening (lid gap ÷ eye width), mouth width. Landmarks used are named in `landmarkMapping.ts` (eyelid centers 159/145/386/374, mid-brow 105/334, inner lips 13/14 — verified against MediaPipe's connection sets).

### Expression states

| State | Region | Movement metric (vs neutral) | Threshold (uncalibrated) |
|---|---|---|---|
| `BROW_RAISE` | FOREHEAD | brow-to-eye distance increase | 12% |
| `FROWN` | GLABELLA | mean of inner-brow-separation decrease and inner-brow-to-eye-corner decrease | 8% |
| `SMILE` | MOUTH_AREA | mouth-width increase | 10% |
| `SQUINT` | EYE_AREA | eye-opening decrease | 25% |

A frame is `NEUTRAL` if every state's movement is under half its threshold; `AMBIGUOUS` if the strongest is between half and **1.1×** its threshold (a movement must clearly exceed the threshold, not merely touch it), or if two expressions both pass and the stronger is not ≥ 1.5× the other (e.g. a smile with a strong squint). **A state with no reliably identified frame is `insufficient_evidence` with a reason — it is never guessed.**

Each state's evidence has the shape from the brief: `{ type: "dynamic_expression_observation", expression, region, status: "observed" | "insufficient_evidence", evidence: { neutralFrames, expressionFrames, movementMetric, movementPct }, strength, reason }`.

### Evidence strength (completeness, not medical confidence)

| Level | Meaning |
|---|---|
| **low** | Only one usable frame on one side of the comparison — e.g. a single neutral frame, so the baseline's stability cannot be checked. (With the current baseline rule this only arises for a video with a single usable frame, which yields no expression evidence at all; the level exists so the semantics are complete.) |
| **moderate** | A stable neutral baseline plus at least one expression frame. |
| **high** | A stable baseline plus at least three usable expression frames whose movement is consistent (coefficient of variation ≤ 0.35). |

### Line patterns (dynamic evidence only)

A single relaxed photo cannot establish dynamic lines, so **no static-image line observation exists**; the `STATIC_IMAGE_EVIDENCE` mode is defined in the types but nothing produces it. Instead, where frames carry pixel data, the same video's expression frames are compared with its neutral frames:

| Pattern | Frames compared | Measure (`regions.ts`) |
|---|---|---|
| forehead | brow-raise vs neutral | horizontal line-band contrast in the central forehead |
| glabellar | frown vs neutral | vertical line-band contrast between the inner brows |
| lateral eye | smile / squint vs neutral | local texture contrast outside each outer eye corner |

Contrast is a fraction of the region's mean brightness after removing slow lighting gradients. A pattern is `observed` only if the expression state itself was observed **and** the expression-frame contrast is **clearly** above 1.3× the neutral frames' (≥ 1.43; 1.17–1.43 is borderline → insufficient evidence) **and** ≥ 1% of mean brightness (so a near-flat region can't pass on a ratio of tiny numbers). Comparing within one video makes static lighting and skin tone largely cancel; it does not remove hair, brow shadows or lighting that changes during the clip.

## Video status

What was actually checked (headless Chromium 153, this machine):

| Check | Result |
|---|---|
| `MediaRecorder` WebM (VP8) recording loaded like an uploaded file | Loaded; `duration` finite (4.55 s) at metadata time; seeks to 1/2/3 s land exactly. |
| `MediaRecorder` MP4 (H.264) recording | Loaded; finite duration (3.03 s). |
| Full app path (`analyzeVideoFile`) on a recorded MP4 through the calibration panel | Metadata validated → 24 frames sampled by seeking → face detection ran on each → correctly reported *insufficient evidence* (the recording contained no face). |
| A file labelled `video/mp4` that is not a video | Rejected cleanly ("Could not read this video") → insufficient evidence, no crash. |
| `canPlayType` | H.264 MP4 and WebM (VP8/VP9): "probably". `video/quicktime` (.mov) and HEVC: **not playable in this Chromium**. |

So an earlier note that "MediaRecorder output has no duration metadata" is **not confirmed** for this browser: the well-known Infinity-duration behaviour of recorded WebM did not occur. It may still occur in other browsers (older Chrome, some Firefox builds); if a browser reports a non-finite duration, `validateVideoMetadata` rejects the file as "length could not be read" and the video is reported as insufficient evidence. The usual workaround (seek far past the end to force the duration to resolve) is **not implemented** because it could not be reproduced here and untestable code is worse than a clear rejection. Phone-recorded files are ordinary MP4/MOV files with a container duration, so that problem is specific to browser-generated recordings.

**Not verified:** a real phone-recorded video (no such file was available), any real face in a video, `.mov`/HEVC decoding (the app relies on the browser's native decoder — Safari and recent desktop Chrome on macOS can decode HEVC; the Chromium used here cannot), Firefox, or mobile browsers. Frame seeking is sequential and takes roughly a second per frame on a large clip; nothing has been measured on real footage.

## Skin

No skin computer vision is implemented. Skin concerns stay **user-reported**. No acne, melasma, scarring, rosacea, dermatitis or pigmentation-disorder classification exists, and none is implied by any observation or label. The one skin-adjacent number is the under-eye brightness ratio above, which is appearance-only.

## Facial lifting

Intentionally **not implemented**: no laxity detection, no laxity score, and generic jaw geometry is **not** treated as evidence of laxity. A lifting goal therefore always yields `insufficient_evidence` in the engine until a clinically defensible observation method exists (`LIFTING_OBSERVATION_IDS` stays reserved and unproduced).

## How the Treatment Opportunity Engine consumes this

See `docs/TREATMENT_OPPORTUNITY_ENGINE.md`. In short: a user goal is always required; observations only support it.

| User goal | Evidence needed | Result |
|---|---|---|
| Facial lines | a video line-pattern observation (movement is shown as supporting video evidence) | neuromodulator *consultation* opportunity, moderate at most (one video = one source) |
| Facial volume | cheek-contour geometry from ≥ 2 photo views | dermal-filler *consultation* opportunity, capped at moderate; one view → `insufficient_evidence` |
| Facial definition | contour / structure geometry | facial-contouring assessment opportunity |
| Facial lifting | (none exists) | always `insufficient_evidence` |
| Under-eye | — | recorded only; no rule consumes it |

Wording stays "may be worth discussing with your clinician"; the engine, not this layer, owns it, and every opportunity requires clinician review.

## Limitations

These are also carried, verbatim, in `ANALYSIS_LIMITATIONS` on every analysis.

- Selfie lighting affects how skin, shadows and lines appear; brightness- and texture-based observations shift with light direction, exposure and the camera's own image processing.
- Camera angle and lens distance change every geometric measurement; a 45° photo is not a calibrated 45° pose.
- The user's expression may be partial or imperfect, and the video may not contain every requested expression.
- Movement and line-contrast thresholds are uncalibrated heuristics with no validation set.
- Static photographs cannot establish dynamic lines.
- Skin appearance is affected by lighting and camera processing; no skin analysis exists.
- No absolute physical measurements without a calibration reference.
- No clinical diagnosis, no treatment-suitability determination, no prediction of treatment results.

## Conservative behaviour (close to a threshold → insufficient)

A value right next to its threshold is the least trustworthy kind, so each threshold has a borderline band and a borderline value produces **no observation** (`lib/facial-analysis/bands.ts`): under-eye ratio ±5%, expression movement +10% above the threshold, line-contrast ratio ±10%. Contour measurements that contradict each other across the left and right 45° views (more than 20° apart) are set aside by the engine rather than averaged. These margins are conservative, not tuned, and are themselves uncalibrated.

## Intentionally not implemented

Skin classification; static-image line detection; puffiness, hollowing and under-eye fine-line measurement; laxity/lifting detection; profile geometry (chin/nose projection); pose-angle estimation; multi-person handling; motion-blur and sharpness checks; any external AI; any diagnosis, aging, attractiveness, suitability or before/after score.

## Fix made along the way

The shared photo-quality roll estimate returned 180° for a perfectly level face, so every level photo was warned as "tilted" (−8 `qualityScore`). It now returns the signed eye-line angle in pixel space (0° = level); tilt is still flagged above 15°. Photos and video frames both use it (`estimateRollDegrees` in `lib/facial-analysis/quality.ts`, regression-tested).
