# Facial Analysis Methodology

This document describes exactly what MogaFace measures and how, so nothing
here is a black box. It does not establish scientific or clinical validity
for any ratio — these are the same kinds of measurable geometric quantities
used in classical facial-proportion references, reported as plain numbers.

**MogaFace draws a hard line between measurement and interpretation.** A
measurement like "face width / face height = 0.71" is a geometric
observation. Nothing in this codebase translates a measurement into
"beautiful," "ugly," "ideal," or a medical diagnosis. See the "What this is
not" section at the end.

## 1. Source data

All measurements derive from MediaPipe Face Landmarker's 478-point canonical
face mesh, run entirely client-side. Landmarks are normalized to [0, 1]
against image width/height.

## 2. Landmark map

`lib/facial-analysis/landmarkMapping.ts` names every index this app uses.
Eye, mouth-corner, and face-boundary indices (33/133/263/362, 61/291,
234/454) are confirmed directly against MediaPipe's own
`FACEMESH_RIGHT_EYE` / `FACEMESH_LEFT_EYE` / `FACEMESH_LIPS` /
`FACEMESH_FACE_OVAL` connection sets. Ala, jaw, and eyebrow indices were
assigned using the consistent index offset (~+230) between those confirmed
right/left pairs. Two points carry known approximation:

- **`foreheadTop` (index 10)** approximates the upper forehead boundary the
  mesh reaches — it is not a tracked hairline/trichion, since hair is not
  part of the face mesh.
- **`rightJaw`/`leftJaw` (172/397)** approximate the jaw angle (gonion) from
  the face-oval contour, not a palpated bony landmark.

Every formula below states which points it uses so any of this can be
audited against the map directly.

## 3. Geometry primitives (`geometry.ts`)

- `distance(a,b)` — Euclidean distance.
- `horizontalDistance` / `verticalDistance` — single-axis distance.
- `angle(a,b,c)` — angle at vertex `b`, in degrees.
- `ratio(a,b)` — `a/b`, or `null` if `b` is 0 (never `Infinity`/`NaN`).
- `percentageDifference(a,b)` — `|a-b| / max(a,b) × 100`, or `null` if both
  are 0.
- `normalizedDifference(a,b,ref)` — `|a-b| / ref × 100`, or `null` if `ref`
  is 0.

## 4. Normalization

Raw landmark distances are fractions of image dimensions, which change with
crop and camera distance. Every ratio MogaFace reports is normalized against
a facial reference dimension instead of shown as a raw standalone number:

| Ratio | Formula |
|---|---|
| Face proportion | `faceWidth / faceHeight` |
| Interocular ratio | `interocularDistance / faceWidth` |
| Nose ratio | `noseWidth / faceWidth` |
| Mouth ratio | `mouthWidth / faceWidth` |
| Lower-face ratio | `lowerFaceHeight / faceHeight` |
| Facial thirds | each third's height / sum of all three thirds |

No "ideal" or "golden" value is encoded for any of these.

## 5. Measurements (`measurements.ts`)

| Measurement | Landmarks used | Formula |
|---|---|---|
| Face width | `faceRightEdge` (234), `faceLeftEdge` (454) | `horizontalDistance` |
| Face height | `foreheadTop` (10), `chin` (152) | `verticalDistance` |
| Left/right eye width | eye inner + outer corners (362/263, 133/33) | `distance` |
| Interocular distance | `rightEyeInner` (133), `leftEyeInner` (362) | `distance` |
| Nose width | `noseRightAla` (129), `noseLeftAla` (358) | `distance` |
| Nose height | `glabella` (9), `noseBase` (2) | `verticalDistance` |
| Mouth width | `mouthRight` (61), `mouthLeft` (291) | `distance` |
| Jaw width | `rightJaw` (172), `leftJaw` (397) | `distance` |
| Chin height | `lowerLip` (17), `chin` (152) | `verticalDistance` |
| Lower face height | `noseBase` (2), `chin` (152) | `verticalDistance` |
| Facial thirds | `foreheadTop`, `glabella`, `noseBase`, `chin` | consecutive `verticalDistance` |

## 6. Symmetry (`symmetry.ts`)

Every symmetry metric compares a left-side value against its right-side
counterpart relative to an estimated midline (the mean x of `foreheadTop`,
`noseTip`, and `chin` — all midline landmarks):

- **Eye width symmetry** — left vs. right eye width.
- **Eye vertical position symmetry** — left vs. right outer-eye-corner y.
- **Eyebrow symmetry** — left vs. right brow-to-eye vertical gap.
- **Nose alignment** — distance from midline to each ala.
- **Mouth alignment** — distance from midline to each mouth corner.
- **Lower-face symmetry** — distance from midline to each jaw point.

```
symmetryIndex = clamp(100 − normalizedDifference, 0, 100)
```

100 means the two sides matched exactly on that metric, in this photo, at
this head pose — not a claim about the person's face in general, and never
a claim that a higher score is "better."

## 7. Facial thirds

The classic upper/middle/lower third split (forehead-to-brow,
brow-to-nose-base, nose-base-to-chin) is reported as each segment's share of
their total. This is a descriptive geometric convention, not a validated
aesthetic standard.

## 8. Photo quality score (`quality.ts`)

`qualityScore = clamp(100 − 25×errors − 8×warnings, 0, 100)`. Every
error/warning comes from a measurable check (face count, frame coverage,
edge cropping, resolution, brightness, estimated roll/yaw) — never an
invented "attractiveness" or "ideal face" score.

## 9. Versioning

`analysisVersion` in every `FacialAnalysisResult` (currently `0.1.0`) bumps
whenever a formula above changes, so a stored result from one version is
never silently reinterpreted under a newer methodology.

## 10. Multi-photo analysis (`lib/facial-analysis/multiPhoto/`)

Everything above describes the single-photo engine (`analysisVersion`,
independent of the below). The multi-photo layer runs that *same* engine
once per standardized photo (front, left 45°, right 45°, left profile,
right profile) and combines the results — it does not add new formulas to
sections 1-9, and it does not redefine what any existing metric means.

**This is multi-view facial analysis using standardized photographs. It is
not 3D facial reconstruction** — five 2D photos are not claimed to
reconstruct a medically or scientifically accurate 3D face, and nothing in
this codebase performs 3D reconstruction.

### View capabilities (`viewCapabilities.ts`)

| View | Computable (same engine as front) | Combinable into the final result |
|---|---|---|
| Front | Full measurement/symmetry/proportion set | All of it — front is the primary and only source for frontal proportions |
| 45° (left/right) | Same formulas still run, computed per-photo | None — the face is turned, so the numbers are foreshortened and not comparable to front's |
| Profile (left/right) | None — the engine is not invoked | None |

Profile photos never run `calculateMeasurements`/`calculateSymmetry`/
`calculateProportions`: the landmarks those formulas need (the opposite eye,
the opposite nostril) aren't reliably visible from the side, so running them
would produce numbers that look precise but aren't meaningful.

### Why no pose angle is calculated

MediaPipe's FaceLandmarker can optionally output a facial transformation
matrix (`outputFacialTransformationMatrixes`), which in principle encodes
head rotation. This app does not decompose it into a yaw/pitch/roll angle:
doing so correctly (rotation order, sign conventions) cannot be verified
without testing against real photos in a browser, which wasn't available
while building this. Getting that decomposition subtly wrong would mean
presenting a fabricated angle as if it were measured — worse than not
having one. `viewValidation.ts` instead only checks a much weaker, honestly
weaker signal: whether both eyes' landmarks have non-trivial spacing, as a
coarse plausibility check per claimed view.

### Cross-photo consistency (`consistency.ts`)

Deliberately does **not** compare frontal-style geometry across views (that
would mean treating a foreshortened 45° measurement as equivalent to a
front one, which section 10 explicitly rules out). Instead it compares two
things that should be stable regardless of pose: face size in frame
(camera-distance/crop proxy) and estimated brightness (lighting proxy).
Both are named directly in the product brief as causes of "inconsistent
measurements." No confidence score is computed — only a boolean per metric
plus a plain-language warning.

### Combination rules (`combine.ts`)

Front is the sole source for frontal proportions and the overall symmetry
index — there is exactly one front photo, so "primary source" means "the
only source," never an average. Profile-specific geometry (nose/chin
projection, facial convexity) is listed with `value: null` and a documented
reason rather than omitted, so the intended architecture is visible without
fabricating a number.

### Versioning

`multiPhotoAnalysisVersion` (`MULTI_PHOTO_ANALYSIS_VERSION`, currently
`0.1.0`) is tracked separately from the single-photo `analysisVersion`. They
happen to match today only because both are new — a future change to
combination/consistency rules bumps `multiPhotoAnalysisVersion` without
requiring a change to the underlying per-photo formulas, and vice versa.

## What this is not

- Not a medical, dermatological, or diagnostic tool.
- Not a measure of attractiveness — no ratio here is presented as "ideal."
- Not a source of real-world physical units (cm/mm) without a calibration
  reference, which a single 2D photo does not provide.
- Not backed by a published, peer-reviewed reference population (see
  `lib/facial-analysis/future.ts` — `ReferenceDataset` is a placeholder
  type only; no dataset is populated anywhere in this codebase).
- Not 3D facial reconstruction (see section 10).
