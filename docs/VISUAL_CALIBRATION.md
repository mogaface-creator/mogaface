# Visual Calibration

**Status: engineering calibration has NOT been performed.** The infrastructure to do it — including a real-sample session workflow (below) — is built and tested; no real face photos or videos were available in the project, so no real-data sample has been run. `VISUAL_OBSERVATIONS_CALIBRATED = false` and stays false until the workflow below is completed and recorded.

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

## Real-sample calibration workflow

> **This is an engineering calibration workflow, not clinical validation.** Your labels are a person's visual opinion, not ground truth; the samples are few; nothing here says anything about any person's skin, face, health or suitability for any treatment.

Open `http://localhost:3000/dev/calibration` (development builds only; production returns 404) → **Real sample sessions**. Code: `lib/facial-analysis/calibration/{expectations,session,comparison,report,proposals,export}.ts`, `components/dev/{CalibrationWorkbench,RealSampleSessions,SessionView,AggregatePanel}.tsx`. It reuses the existing pipeline (`analyzeSinglePhoto`, `analyzeVideoFile`), threshold decisions (`decisions.ts`) and registry (`thresholds.ts`); it adds no computer-vision feature and changes no threshold.

### How to create a real calibration sample

1. **Consent first.** Only use people who have agreed to be used for engineering testing. Do not record their name, email, phone, address or date of birth anywhere — including free-text notes.
2. **Create a session** with an anonymous **Sample ID** such as `REAL-001`. Ids that look like an email, a phone number or a date are refused. Optionally record engineering metadata: approximate age band (prefer *not recorded*), lighting, camera, glasses, makeup. Nothing is inferred from the image.
3. **Choose inputs** and press **Run analysis**. The chosen files exist only in the page's memory and are **discarded automatically as soon as the analysis finishes**; only numbers and your labels remain.
4. **Read the input quality** for each photo and the video. Failed samples are never hidden — the reason is stated ("Face not detected.", "Image too dark.", "Head rotation outside the expected range.", "Face too small in frame.").
5. **Record your engineering expectations**, ideally before you read the MogaFace column.
6. Read **Expected vs MogaFace**, the **margins table**, **multi-view consistency**, and (expandable) the **raw output**.
7. Add notes (engineering observations only), repeat for more people, then read the **calibration summary**, record any **threshold proposals**, and **export**.

### Required photo views and video

| Input | Status | Notes |
|---|---|---|
| Front | **Required for a baseline** | Camera at eye level, neutral expression, even light, whole face in frame. |
| Left 45° | **Required for a baseline** | Head turned about 45° to the subject's left. |
| Right 45° | **Required for a baseline** | Head turned about 45° to the subject's right. |
| Left / right profile | Optional | The layer only checks detection/quality on profiles; it computes no profile geometry. |
| Video | Optional | About 10–20 s, front-facing, steady, well lit. **Start with a still, relaxed face for a second or two** (this becomes the neutral baseline), then raise the eyebrows, frown, smile and squint, returning to neutral between them. |

Not every view is required. Missing views simply produce "not evaluated" rows.

### Engineering expectation labels

Recorded per domain; **not recorded** rows are skipped. One scale, worded per domain:

| Domain | clearly | subtle | absent | unclear |
|---|---|---|---|---|
| Facial lines (forehead / glabellar / lateral eye) | clearly visible | somewhat visible | not visibly apparent | unclear |
| Facial contour | contour difference clearly visible | subtle | not visibly apparent | unclear |
| Under-eye | dark-looking appearance clearly visible | subtle | not visibly apparent | unclear |
| Expression movement (brow raise / frown / smile / squint) | clearly present | subtle | absent | unclear |
| Input quality (each supplied view and the video) | usable / borderline / unusable | | | |

Describe **only what you can see**. Do not label a cause or condition (no tear trough, pigmentation disorder, cause of puffiness, or medical condition) — the form has no place for it and rejects unknown fields.

### Reading MATCH / MISS / FALSE POSITIVE / UNCLEAR

"Actual" comes from the layer's own threshold decisions: **detected**, **not detected**, **withheld (borderline)**, or **not evaluated** (the inputs did not exist — no video, no neutral baseline, the expression was not performed or not identified).

| You expected | detected | not detected / withheld | not evaluated |
|---|---|---|---|
| **clearly** | MATCH | **MISS** ("Potential miss") | UNCLEAR |
| **subtle** | MATCH | UNCLEAR (a subtle feature may legitimately sit under a conservative threshold) | UNCLEAR |
| **absent** | **FALSE POSITIVE** ("Potential false positive") | MATCH | UNCLEAR |
| **unclear** | UNCLEAR | UNCLEAR | UNCLEAR |

Input quality: same label → MATCH; you expected *unusable* but the layer accepted it → potential false positive; you expected *usable* but it rejected it → potential miss; borderline mismatches → UNCLEAR.

"MISS" and "FALSE POSITIVE" always mean **potential** ones *against your expectation* — a prompt to look closer at the raw output, never a measured error. A **withheld (borderline)** result counts as "not detected" for comparison and is flagged BORDERLINE so it stands out.

**Known gap — contour.** Contour observations are relative geometry (angles and ratios). The layer has **no detection threshold** for "a visible contour difference", so an expectation cannot be compared against anything: contour rows are always UNCLEAR, with that explanation. What *can* be calibrated for contour is (a) whether it is measurable at all (front + a usable 45° photo) and (b) **multi-view consistency**: the left/right 45° angle spread against the `contour.viewDisagreementDeg` guard, plus lighting and face-size differences across photos. If you want contour expectations to be testable, a detection rule must be designed first (not done here).

**Line patterns need a video.** A single photo cannot establish dynamic lines, so no photo produces a line observation; lines are compared only through the video's within-clip contrast, and only when the matching expression (brow raise → forehead, frown → glabellar, smile/squint → lateral eye) was identified. Otherwise the row is "not evaluated" → UNCLEAR, and the reason says why.

### Borderline cases

The **Threshold decisions and margins** table lists every observation-type decision with its metric, source view/video, value, threshold, signed margin (value − threshold, and as % of the threshold), the borderline band, the decision and the reason. Borderline ones are highlighted and listed first, e.g.:

```
Threshold 1.30 · Observed 1.27 · margin −0.03 (−2.3%) · band 1.43 / 1.17 · BORDERLINE / WITHHELD
reason: Close to the threshold; not used as evidence.
```

Nothing here modifies a threshold.

### The summary and what the statistics mean

Each session shows: photos submitted/processed, quality counts, and one cautious line per recorded expectation ("Frown: expected clearly present · not detected — Potential miss"). The **calibration summary** aggregates every session in the current page (per observation type: expected-positive, detected-positive, potential misses, expected-absent, potential false positives, unclear).

- It is labelled **ENGINEERING CALIBRATION STATISTIC** and is **not** accuracy, **not** sensitivity or specificity, and **not** clinical validation: the "expected" side is a developer's opinion, and the samples are few.
- **Rates are withheld** until there are at least **10** clearly labelled, *evaluable* samples in a category (10 is an engineering choice, not a statistical guarantee). Samples the layer could not evaluate never count toward a rate.
- *Subtle* and *unclear* expectations are excluded from rates; they only appear in the *unclear* count.
- Even a rate over 10 samples from one lab, one camera and a few faces says little. Follow §9 (overfitting) before acting on it.

### Threshold proposal workflow

Under **Threshold change proposals** a developer records: the threshold (from the registry; the current value is read from it, never typed), a proposed value, a reason (≥ 10 characters) and the evidence sessions. Status starts **PROPOSED**; a later reviewer may mark it **APPROVED** or **REJECTED** — a decision note is required, and a decided proposal is final. Proposals based on fewer than 3 samples carry an overfitting warning.

**A proposal never changes a threshold** — there is no code path from the proposal to any constant, and no automatic tuning exists. After an approval, a developer must still edit the constant, bump `CALIBRATION_VERSION`, and add a dated row to the change log in §8. `VISUAL_OBSERVATIONS_CALIBRATED` stays `false` until the sign-off criteria below are met and someone on the team decides.

### Export

**Export calibration JSON** downloads structured metadata only: sample ids, engineering metadata, expectations, actual observations (with their sources), comparison results, threshold decisions, notes, proposals, the aggregate, and version ids (calibration, analysis, observation engine, video analysis, multi-photo). Optionally, raw numeric metrics (measurements — still no media). It **never** contains photos, video, base64, blob/object URLs, file names or media-like fields; the exporter scans its own output and **refuses** to produce a file if anything like that is found (including in free-text notes, so don't mention file names). Nothing is uploaded — the browser hands you the file.

### Privacy behaviour

- The session id is anonymous; there is no field for a name, contact detail or date of birth, and a session cannot hold any field beyond the listed ones.
- Photos/video live only in a component's memory while the analysis runs, then are **discarded automatically**; the file inputs are reset. Only metrics and labels are kept, in memory.
- No `localStorage`, `sessionStorage`, IndexedDB, cookie, network request or `FileReader`/data-URL use exists in the calibration code (a test scans the source; a runtime test spies on storage). In a real browser run: zero storage keys and zero upload requests, and after a refresh no sessions, no results and no selected files remain.
- *Note:* in `next dev`, Next.js itself creates an IndexedDB database called `__next_debug_channel` on every page. That is the framework's dev tooling, not this feature (verified against a control page); it holds no media.
- Prefer not to keep exports of identifiable people's data lying around: a JSON of face-derived measurements is still personal data. Keep exports out of the repository unless anonymised, and delete them when done.

### First manual test (one real person)

See the exact steps in the project report / below; in short: consent → `npm run dev` → `/dev/calibration` → create `REAL-001` → front + left/right 45° (+ video) → **Run analysis** → check quality → record expectations → read the comparison and margins → export → refresh and confirm nothing remains.

1. Get the person's agreement to be used for engineering testing. Take: a neutral front photo, a left-45° and a right-45° photo (same light, same distance), and a 10–20 s front video that starts with a relaxed face and then raises the eyebrows, frowns, smiles and squints.
2. `npm run dev`, open `http://localhost:3000/dev/calibration`.
3. **Sample ID** `REAL-001` → **Create session**. Set lighting/camera/glasses/makeup if you like; leave age band *not recorded*.
4. Choose Front, Left 45°, Right 45° and the video → **Run analysis** (a 15 s video takes roughly 20–60 s). The files are discarded when it finishes.
5. **Input quality**: every photo should show *face detected: yes*, landmarks *complete*. If a photo failed, read the reason, retake it, create `REAL-001b` and repeat — don't tune anything to rescue a bad photo.
6. **Before** reading the MogaFace column, look at the media and fill in **Engineering expectation** (forehead/glabellar/lateral-eye lines, under-eye, each expression, and input quality per view).
7. Read **Expected vs MogaFace**. For every MISS, FALSE POSITIVE or BORDERLINE row open **Raw output** and the **margins** table and write down *why* in Notes (e.g. "glabellar pattern not evaluated: frown was not identified — see frame table").
8. Read **Video calibration** (per-expression strength/movement, line-contrast values) and **Multi-view consistency**.
9. **Export calibration JSON**; open the file and confirm it contains no image or video data.
10. Refresh the page and confirm the session, the results and the chosen files are gone.
11. Repeat with more people, in different light, with and without glasses. Only after many samples read the calibration summary — and treat it as described above.

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
