# Visual Calibration

**Status: engineering calibration has NOT been performed.** The infrastructure to do it is built and tested; no real face photos or videos were available in the project, so no real-data sample has been run. `VISUAL_OBSERVATIONS_CALIBRATED = false` and stays false until the workflow below is completed and recorded.

> **Thresholds are engineering heuristics and have not been clinically validated.**

Three different things must not be confused:

| | What it is | Where things stand |
|---|---|---|
| **Synthetic test validation** | Unit tests on fabricated landmarks and pixel arrays. Proves the code does what it says (e.g. "a brow raise of +27% is classified as a brow raise"). Says **nothing** about whether real faces behave that way. | Done: the `tests/` suite. |
| **Engineering calibration** | Running the pipeline on real photos/videos, recording what it measured and decided next to a developer's own visual judgement, and adjusting thresholds only where the evidence supports it. This document. | **Not done.** Harness ready. |
| **Clinical validation** | Establishing, with qualified clinicians and an appropriate study, that an observation is medically meaningful or that an opportunity is appropriate. | **Out of scope. Not done. Never implied.** |

Calibration here is **engineering** calibration only. Completing it would justify showing observations to consumers as "what the software measured"; it would never make any output a diagnosis, a suitability decision, or a prediction.

## 1. What is being calibrated

The numeric decision points of the visual observation layer (`docs/VISUAL_OBSERVATION_LAYER.md`): how far a landmark must move before a frame counts as an expression, how much more line contrast counts as a "visible line pattern", how much darker an under-eye strip must be to be called "dark-looking", how turned a "45°" photo must be to report contour, how steady a neutral baseline must be, and the quality gates that decide whether a photo or frame is usable at all.

## 2. Why calibration is required

Every number below was chosen by reasoning about the geometry, then tested only on synthetic faces built to satisfy it. Real faces differ in ways a synthetic face cannot show: hair and eyebrows crossing region boxes, glasses, shadows, skin tone, beards, lens distortion, compression, head motion during an expression, expressions that are only partly performed. A threshold that is perfect on synthetic data can be wildly wrong on people. Until it has been looked at on real data, the layer's outputs are not fit to influence consumer-facing content.

## 3. Thresholds currently in use

Generated from the live constants (`lib/facial-analysis/calibration/thresholds.ts` — a test fails if this table and the registry disagree). **None has been changed by this work** (see §8).

| Id | Value | Kind | Meaning | Observations affected |
|---|---|---|---|---|
| `movement.BROW_RAISE` | 12 % vs neutral | decision | Brow-to-eye distance increase at which a frame counts as a brow raise. | `expression.browRaise.foreheadRegionMovementPct`, `expression.visibleForeheadLinePattern` |
| `movement.FROWN` | 8 % vs neutral | decision | Mean inner-brow closeness/drop at which a frame counts as a frown. | `expression.frown.glabellarRegionMovementPct`, `expression.visibleGlabellarLinePattern` |
| `movement.SMILE` | 10 % vs neutral | decision | Mouth-width increase at which a frame counts as a smile. | `expression.smile.mouthAreaMovementPct`, `expression.visibleLateralEyeLinePattern` |
| `movement.SQUINT` | 25 % vs neutral | decision | Eye-opening decrease at which a frame counts as a squint. | `expression.squint.eyeAreaMovementPct`, `expression.visibleLateralEyeLinePattern` |
| `movement.borderlineFraction` | 0.1 fraction of threshold | margin | A frame must exceed a state's threshold by this margin to count; below it (down to neutralFraction) the frame is ambiguous. | `expression.*` |
| `movement.neutralFraction` | 0.5 fraction of threshold | parameter | A frame is NEUTRAL only if every state's movement is below this fraction of its threshold. | `expression.*` |
| `movement.dominanceFactor` | 1.5 × | parameter | When two expressions both pass, the stronger must exceed the other by this factor or the frame is ambiguous. | `expression.*` |
| `baseline.windowFrames` | 3 frames | parameter | How many of the first usable frames form the neutral baseline. | `expression.*` |
| `baseline.stability` | 0.08 relative spread | quality_gate | Maximum (max−min)/median of any feature across baseline frames for the face to count as at rest; otherwise no baseline. | `expression.*` |
| `lineContrast.ratio` | 1.3 × neutral | decision | Expression-frame line contrast ÷ neutral-frame line contrast needed to call a line pattern visible. | `expression.visibleForeheadLinePattern`, `expression.visibleGlabellarLinePattern`, `expression.visibleLateralEyeLinePattern` |
| `lineContrast.borderlineFraction` | 0.1 fraction of threshold | margin | A contrast ratio within this margin of lineContrast.ratio is insufficient evidence. | `expression.visible*LinePattern` |
| `lineContrast.floor` | 0.01 fraction of mean brightness | quality_gate | Minimum expression-frame contrast, so a near-flat region cannot pass on a ratio of tiny numbers; also floors the neutral denominator. | `expression.visible*LinePattern` |
| `strength.consistentCv` | 0.35 coefficient of variation | parameter | Movement is 'consistent' (needed for high evidence strength) at or below this variation across expression frames. | `expression evidence strength` |
| `strength.highMinFrames` | 3 frames | parameter | Expression frames needed for high evidence strength. | `expression evidence strength` |
| `underEye.darkerRatio` | 0.85 under-eye ÷ cheek brightness | decision | Both eyes at or below this ratio (and clear of the borderline band) → 'visible dark-looking under-eye appearance'. | `eyeArea.visibleUnderEyeDarkness` |
| `underEye.borderlineFraction` | 0.05 fraction of threshold | margin | A ratio within this margin of underEye.darkerRatio is insufficient evidence. | `eyeArea.visibleUnderEyeDarkness` |
| `contour.turnedSpanRatio` | 1.25 span ratio | decision | Nose-to-edge span ratio at which a '45°' photo counts as turned enough to report its near-side contour; a frontal-looking 45° photo contributes nothing. | `facialStructure.contour.*.leftFortyFive.*`, `facialStructure.contour.*.rightFortyFive.*` |
| `contour.viewDisagreementDeg` | 20 degrees | guard | Left vs right 45° outline angles further apart than this are contradictory; contour evidence is set aside (insufficient). | `facialStructure.contour.* (as engine evidence)` |
| `quality.maxRoll` | 15 degrees | quality_gate | Eye-line tilt above which a front photo warns and a video frame is unusable. | `all photo/video observations` |
| `quality.maxYaw` | 1.8 span ratio | quality_gate | Nose-to-eye span ratio above which a front photo warns and a video frame is unusable. | `all photo/video observations` |
| `quality.minFaceWidthError` | 0.15 fraction of frame width | quality_gate | Face narrower than this is a hard error. | `all photo/video observations` |
| `quality.minFaceWidthWarning` | 0.25 fraction of frame width | quality_gate | Face narrower than this warns. | `all photo/video observations` |
| `quality.minBrightness` | 40 0-255 mean luminance | quality_gate | Darker frames are flagged; video frames this dark are unusable. | `all photo/video observations` |
| `quality.maxBrightness` | 215 0-255 mean luminance | quality_gate | Brighter frames are flagged; video frames this bright are unusable. | `all photo/video observations` |
| `quality.minResolutionError` | 240 px (short side) | quality_gate | Hard resolution floor for photos and frames. | `all photo/video observations` |
| `quality.minResolutionWarning` | 480 px (short side) | quality_gate | Resolution warning level. | `all photo/video observations` |
| `video.minDurationSec` | 2 s | quality_gate | Shortest accepted video. | `expression.*` |
| `video.maxDurationSec` | 60 s | quality_gate | Longest accepted video. | `expression.*` |
| `video.minDimensionError` | 240 px (short side) | quality_gate | Video below this resolution is rejected. | `expression.*` |
| `video.minDimensionWarning` | 480 px (short side) | quality_gate | Video below this resolution warns. | `expression.*` |
| `video.maxFrames` | 24 frames | parameter | Frames sampled per video. | `expression.*` |
| `video.edgeMarginFraction` | 0.05 fraction of duration | parameter | Start and end of the video skipped when sampling. | `expression.*` |
| `video.maxFrameSide` | 960 px | parameter | Frames are downscaled to this long side before detection and pixel measures. | `expression.*` |

Region boxes (`lib/facial-analysis/regions.ts`) are also fixed fractions of face/eye size (forehead, glabellar, lateral-eye, under-eye and cheek-reference strips). They are not listed individually but are the most likely source of error in the pixel-based measures — see "Candidate calibration issues".

## 4. Which observations depend on them

| Observation | Depends on |
|---|---|
| `expression.browRaise.foreheadRegionMovementPct` / `frown.glabellarRegionMovementPct` / `smile.mouthAreaMovementPct` / `squint.eyeAreaMovementPct` | `movement.*`, `movement.borderlineFraction`, `movement.neutralFraction`, `movement.dominanceFactor`, `baseline.*`, all `quality.*` and `video.*` gates |
| `expression.visibleForeheadLinePattern` / `visibleGlabellarLinePattern` / `visibleLateralEyeLinePattern` | everything above **plus** `lineContrast.*` and the region boxes |
| `eyeArea.visibleUnderEyeDarkness` (and `underEyeBrightnessRatio.*`) | `underEye.darkerRatio`, `underEye.borderlineFraction`, region boxes, `quality.*` |
| `facialStructure.contour.*` | `contour.turnedSpanRatio` (which views contribute), `quality.*`; the angles themselves are threshold-free geometry |
| Engine: volume / contouring branches | `contour.viewDisagreementDeg` |
| Engine: neuromodulator opportunity | the line-pattern observations, therefore everything they depend on |

## 5. False positives

An **engineering** false positive is a case where the layer **produced an observation the developer, looking at the same media, judges is not visibly there**:

- a `visible…LinePattern` on a smooth forehead — typically hair fringe, brow shadow, a lighting gradient that changed during the clip, or the region box catching the eyebrow;
- `visibleUnderEyeDarkness` where the strip is not visibly darker than the cheek — typically a shadow from brow/glasses or a light-direction change;
- an expression state accepted for a frame that plainly is not that expression (e.g. a head tilt or talking mistaken for a brow raise);
- a contour observation from a "45°" photo that is actually frontal or a profile.

A false positive is the costly error here: it is what could push an inappropriate consultation suggestion in front of a consumer.

## 6. False negatives

A **false negative** is a case where the layer **produced no observation although the developer judges the feature is clearly visible** — for example clearly visible forehead lines that produced no pattern, clearly dark under-eyes that stayed borderline, or a clearly performed frown classified as ambiguous. False negatives are acceptable and expected (they cost only an unmade suggestion); the design deliberately trades them for fewer false positives. Do not "fix" false negatives by loosening a threshold without the false-positive evidence in §9.

## 7. What must remain `insufficient_evidence`

The default answer. Specifically, the layer must produce **no observation** (and the engine `insufficient_evidence`) when:

- the value is **close to the threshold** (inside the borderline band) — never a coin-flip observation;
- a needed input is missing: no face, several faces, no neutral baseline, no pixel data, an unmeasurable region;
- the media is poor: dark, overexposed, tilted, turned, cut off, occluded, wrong angle;
- evidence **contradicts itself** across views (left vs right 45° outline angles beyond `contour.viewDisagreementDeg`);
- a concern has no defensible visual method at all: **lifting/laxity, skin classification, under-eye puffiness/hollowing/fine lines, profile geometry.**

A correct calibration outcome is often "this must stay insufficient". Never make the system more aggressive to produce more opportunities.

## 8. How threshold changes must be documented

**Instrument first; do not tune yet.** This work changed no threshold value. It added *conservative borderline margins* (`*.borderlineFraction`) and a contour-disagreement guard, in line with "close to the threshold → insufficient". These are new withholding rules, not tuning — and they are themselves uncalibrated.

When real samples suggest a threshold is wrong, record it as a **candidate calibration issue** first (id, evidence, which samples). Change a value only when the evidence meets §9, and for every change record, in a dated entry appended to the change log below:

1. threshold id, old value, new value;
2. the sample ids (exported JSON) that motivated it, with counts of each evaluator label before and after;
3. the false-positive and false-negative effect on the **held-out** samples;
4. the observations affected, and whether any test expectation changed and why;
5. bump `CALIBRATION_VERSION` (`lib/facial-analysis/calibration/status.ts`).

Never change a threshold silently, and never change one only to make a test or a demo produce an opportunity.

### Change log

| Date | Threshold | Old → new | Evidence | Notes |
|---|---|---|---|---|
| — | — | — | — | No thresholds have been changed. Calibration not yet performed. |

## 9. Avoiding overfitting to a tiny sample

- **Do not tune on fewer than ~30 distinct people** covering the matrix below, and never from one person's face — a threshold tuned to your own forehead and lighting will fail on everyone else. The number is a working minimum for engineering confidence, not a statistical guarantee.
- **Split the samples** before looking: tune on one part, judge on a held-out part that you did not look at while tuning.
- **Vary what should not matter**: lighting, camera, time of day, glasses, hair, skin tone, age range, facial hair — deliberately. If a threshold only works on one combination, it is not calibrated.
- **Prefer widening a borderline band or tightening a threshold** (toward `insufficient_evidence`) to loosening one. Justify any loosening with false-positive counts on held-out negatives, not with missed positives.
- **Report per-condition results**, not one overall accuracy: a good average can hide a category that fails.
- **Record labels before seeing the threshold decision** where you can, to avoid confirming what the system said.
- Labels are your visual judgement, and your judgement is noisy: use `unclear` freely; have a second person label a subset if possible.
- Treat `NOT_EVALUATED` and `BORDERLINE_INSUFFICIENT` rows as data too — a metric that is often borderline is a metric worth redesigning, not just re-thresholding.

## The harness

`/dev/calibration` (development builds only — a production build returns 404). Source: `components/dev/VisualCalibrationPanel.tsx`, `lib/facial-analysis/calibration/`.

- Runs the **real** pipeline (`analyzeSinglePhoto`, `analyzeVideoFile`) on files you choose; nothing is uploaded, nothing is written to storage (verified in the browser: zero upload requests, empty `localStorage`/`sessionStorage`); samples live in the tab until you download them or close it.
- For every sample it shows the **raw numbers** — photo: detection status, quality score, roll, yaw ratio, near-side span ratio, face bounding box, landmark availability, facial measurements, contour, under-eye brightness, static line-contrast values; video: frame count, usable frames, per-frame timestamp / quality / state / movement % for every expression / features, neutral candidates, best candidate per state (even near-misses), baseline spread, line-contrast values.
- For every threshold-based call it shows the **decision**: metric, value, threshold, borderline band, result (`OBSERVED`, `NOT_OBSERVED`, `BORDERLINE_INSUFFICIENT`, `NOT_EVALUATED`, `PASSED`, `FAILED`) and why.
- It lists the **observations generated** and lets you attach an engineering label (`true_positive`, `false_positive`, `true_negative`, `false_negative`, `unclear`) and a note to each decision or observation.
- **Download samples (JSON)** exports `CalibrationSample` records (`sampleId, sourceType, sourceDescription, photoRole, videoState, rawMetrics, thresholdDecisions, generatedObservations, evaluatorNotes, calibrationVersion, createdAt`). They contain numbers and short text only — no image or video bytes. Keep them out of the repository unless anonymised; do not put a person's name in `sourceDescription`.

### How a developer supplies samples

1. `npm run dev`, open `http://localhost:3000/dev/calibration`.
2. Choose photos (JPEG/PNG/WebP). For each, set the **role** (front / left 45° / right 45° / profile) and write what it is in the description, using the matrix ids, e.g. `B — front, visible forehead lines, window light`. Use only images you have the right to use, ideally of consenting volunteers.
3. Optionally choose one video and the **intended expression** (or "whole clip"). Record a clip that **starts with a still, relaxed face**, then raises the eyebrows, frowns, smiles and squints, ~10–20 s, front-facing, steady.
4. **Run selected.** Inspect: `detection` (must be `detected`), the quality/roll/yaw gates, the under-eye ratios and their band, the video frame table (are the frames you performed the expression in classified as that state? what did `best frame` reach?), and the line-contrast neutral/expression values.
5. Set an evaluator label on each observation or decision you have a view on, **before** re-reading the system's verdict where possible.
6. **Download samples**, and tally per matrix category: labels by threshold id.

## Test-case matrix

"Expected" is what a healthy, conservative layer should do — **not** every category should yield an observation. `IE` = `insufficient_evidence` / no observation.

| # | Category | Capture | Expected behaviour | Inspect |
|---|---|---|---|---|
| A | Neutral front face | front photo (+ start of video) | Detected; quality gates pass; **no** expression observation; under-eye/contour measured; no line pattern | roll/yaw, face box, landmark count |
| B | Front face with visible forehead lines | front photo; video with brow raise | Photo: **no** static line observation (by design). Video: line pattern may be observed if contrast rises clearly; borderline → IE | `lineContrast.ratio` value vs band; neutral/expression contrast |
| C | Front face without obvious forehead lines | as B | **No** forehead line pattern. A pattern here is a false positive | same |
| D | Brow raise | video | `BROW_RAISE` frames accepted; movement % clearly ≥ 12×1.1; consistent across frames | best frame, movement per frame |
| E | Frown | video | `FROWN` frames accepted; glabellar pattern only if contrast rises clearly | frown %, glabellar ratio |
| F | Smile | video | `SMILE` accepted; lateral-eye pattern only if contrast rises clearly; squint should not steal the frame (dominance) | smile vs squint % |
| G | Squint | video | `SQUINT` accepted (25% eye-opening drop); ambiguous when mixed with smile | squint % |
| H | Under-eye visibly darker than cheek | front photo | Ratio well below 0.85 (< 0.8075) on both eyes → observed | both ratios, band |
| I | Under-eye not visibly darker | front photo | Ratios near/above 1 → not observed; 0.81–0.89 → **IE (borderline)** | both ratios |
| J | Strong cheek contour | front + 45° | Angles measured on front and near side of 45°; record values | cheek/jaw angles per view |
| K | Less-defined cheek contour | front + 45° | Same measurements; the layer must **not** call it low volume (it only reports angles) | angles |
| L | Strong jaw contour | front + 45° | Jaw angle / jaw-to-face-width recorded | jaw angle, ratios |
| M | Less-defined jaw contour | front + 45° | Same; no interpretation | same |
| N | Good 45° left image | 45° photo | Turned enough (`contour.turnedSpanRatio`); near-side contour reported | span ratio, near side |
| O | Good 45° right image | 45° photo | Same, opposite side; left/right angles broadly agree | span ratio; compare with N |
| P | Profile image | profile photo | Detection may work; **no** contour and **no** frontal measurements (profile geometry unimplemented) | measurements = null |
| Q | Poor lighting | any | Brightness gate fails or frames unusable; **IE**; under-eye ratio unreliable | brightness gates |
| R | Face partially occluded | any | Low quality / no detection / unstable landmarks; **IE** | quality errors, landmark count |
| S | Multiple faces | any | `multiple_faces`; **IE** | face count |
| T | Incorrect camera angle | any (tilted, too high/low, too close) | Roll/yaw/coverage gates fail or measurements skewed; **IE** | roll, yaw, face box |

Sampling guidance: ≥ 3 different people per category where feasible, at least two lighting conditions for B/C/H/I/Q, and include people with glasses, facial hair, fringes and different skin tones. Categories H/I and B/C are the priority — they drive the two observations most likely to reach a consumer.

## Candidate calibration issues

These come from **reading the code and from synthetic behaviour, not from real data**. They are places to look first, not findings:

1. **Region-box placement.** The forehead box starts just below landmark 10 (which sits near the hairline, not on skin), so hair or a fringe may fall inside it; the glabellar box overlaps the inner brow ends; the lateral-eye boxes are narrow strips that may include hair, glasses frames or the temple. *Inspect where the boxes land.*
2. **Box movement between frames.** The forehead box is recomputed from each frame's own landmarks, so it moves when the brows rise. On identical synthetic pixels (stripes) this alone changed the measured contrast ratio by ~7% — real noise of that size would sit inside the ±10% borderline band. *Inspect neutral-vs-neutral ratios on a still clip; they should be ≈ 1.*
3. **Lighting change within a clip.** The line-contrast ratio compares neutral vs expression frames of one video; auto-exposure or a moving shadow between them looks like "more lines". *Inspect brightness across frames.*
4. **Neutral baseline assumption.** The baseline is the first 3 usable frames; a person who starts talking or moving fails the stability gate (`baseline.stability` 8%) — check how often real clips fail it.
5. **Expression thresholds vs natural variation.** Brow position, blink and resting asymmetry vary; a 12% brow move or 25% eye-opening drop may be within resting variation for some faces (squint may fire on blinks).
6. **Under-eye strip geometry.** Strips are sized from eye width; on deep-set eyes, glasses, or with the head slightly up/down they may catch the lid, lashes or shadow rather than skin. Ratio also moves with light direction.
7. **45° near-side and contour angles.** The 45° near-side rule (`contour.turnedSpanRatio` 1.25) and the 45° outline angles depend on MediaPipe's landmark quality on turned faces, which is documented as weaker; front-vs-45° angles are foreshortened and deliberately not compared. `contour.viewDisagreementDeg` (20°) is a guess — natural left/right asymmetry may already exceed it.
8. **Quality gates** (roll 15°, yaw 1.8, brightness 40/215, face width 0.25) were set for photos, not evaluated for video frames; they may reject too many or too few real frames.
9. **Borderline margins** (5% under-eye, 10% movement, 10% line contrast) are arbitrary conservative widths.
10. **Frame budget.** 24 frames over up to 60 s is ~0.4–2.5 s apart; a brief expression can fall between samples.

## Video status

See `docs/VISUAL_OBSERVATION_LAYER.md` → "Video status". In short: a `MediaRecorder` recording (WebM/VP8, and MP4/H.264) loaded in the available Chromium 153 with a **finite duration** and seeks correctly, so the earlier note that recorded video has no duration metadata was **not confirmed** for this browser; an undecodable file is rejected cleanly. `.mov`/HEVC (typical of iPhone) is **not** playable in that Chromium build, and no real phone-recorded file or face was available to test — that path is unverified.

## Sign-off criteria for setting `VISUAL_OBSERVATIONS_CALIBRATED = true`

Only when **all** hold, recorded in the change log and a dated summary:

1. the matrix above has been run on ≥ 30 distinct consenting people with the variety in §9;
2. false-positive counts on held-out negatives (categories C, I and the "should be IE" categories) are acceptably low **as decided and written down in advance**, and per-condition results are reported;
3. every threshold change is in the change log, with `CALIBRATION_VERSION` bumped;
4. someone other than the person who tuned it has reviewed the samples;
5. the wording of every consumer surface that shows an opportunity has been reviewed as "may be worth discussing with a clinician", with clinician review still required.

This is engineering sign-off. It is not, and must not be described as, clinical validation.
