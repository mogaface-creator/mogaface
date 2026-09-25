# Guided camera capture

Real-time guided capture for the assessment photo step: live camera → live face detection → plain-language guidance → automatic capture when the frame is good and stable → front → left 45° → right 45° → optional profiles → expression video → the existing analysis pipeline. Uploading files remains available as a fallback at every point.

Nothing here changes what is measured. Thresholds are unchanged and `VISUAL_OBSERVATIONS_CALIBRATED` stays `false`.

## What it reuses (no second detector)

| Need | Existing code |
| --- | --- |
| Face detection | `detectFace` (MediaPipe FaceLandmarker, IMAGE mode) |
| Photo quality gate | `checkPhotoQuality`, `estimateRollDegrees`, `estimateYawRatio` and their limits |
| 45° validation | `validateThreeQuarter`, `nearSideOf`, `TURNED_SPAN_RATIO` |
| Analysing a captured photo | `analyzeSinglePhoto` |
| Analysing the video | `analyzeVideoFile` |
| Slots | `PHOTO_SLOTS`, `photoMetadataFor` |

New constants are framing aids only (`CENTER_TOLERANCE_*`, `STILLNESS_TOLERANCE`, `DEFAULT_STABILITY_MS = 800`).

## Layout

`lib/camera-capture/` — `types`, `constraints`, `camera` (support check, error mapping, `openCamera`), `guidance` (`evaluateGuidance`, `stepStability`), `feedback`, `capture` (canvas capture + validation), `live` (throttled analyzer), `recording` (recorder + reducer), `flow` (photo-flow reducer).

`components/assessment/` — `PhotoCaptureStep` (camera-first with upload mode), `GuidedCameraCapture`, `CameraPreview`, `FaceGuideOverlay`, `CaptureGuidance`, `CaptureReview`, `ExpressionVideoCapture`, `useCameraStream`.

The reducers (`flow.ts`, `recording.ts`) and the guidance/stability functions are pure and unit tested. The DOM/MediaPipe parts are thin.

## Flow

`intro → requesting → photo → review → (photo …) → profiles_offer → video → video_review → complete`, plus `error` from any camera failure. The camera is requested only after the user presses **Allow camera**.

Captured files are stored in the existing photo slots (`front`, `leftFortyFive`, `rightFortyFive`, `leftProfile`, `rightProfile`); there is no parallel data model. If slots are already filled (for example uploaded), the flow resumes at the first missing view.

## Guidance states

`NO_FACE`, `MULTIPLE_FACES`, `TOO_FAR`, `TOO_CLOSE`, `MOVE_LEFT/RIGHT/UP/DOWN`, `TURN_*`, `HEAD_TOO_TILTED`, `LIGHT_TOO_DARK`, `LIGHT_TOO_BRIGHT`, `HOLD_STILL`, `GOOD_TO_CAPTURE`, `PROCESSING`, `CAPTURED`. Messages are plain language; no numbers or technical terms are shown. Priority order: face presence → light → cut-off → distance → centring → orientation → agreement with the existing quality gate.

Auto-capture fires only after a **continuous** good run of ~800 ms (a step out of tolerance or a moving face resets it). After 10 s without a capture a manual **Take photo now** appears.

### View convention

"Left 45°" means the **left side of the face is toward the camera** (the existing `nearSideOf` contract), so the person turns their head to **their right**. The preview is mirrored for display only, so movement cues ("Move a little to your left") are in what-you-see terms; **captured images are not mirrored**. The mapping lives in one constant, `VIEW_TARGET` in `guidance.ts`.

### Profiles

No live rule exists for profile views (the analysis does not support them), so they are **manual capture only**, marked optional, and can be skipped. `validateAssessment` now requires only front + both 45° photos (`REQUIRED_PHOTO_SLOTS`).

## Capture and review

The image is drawn from the `<video>` frame onto a canvas (JPEG, max side 1920) — never a page screenshot, so no overlay is in the file. The review runs the existing single-photo analysis. A rejected photo shows "Let's retake that photo" with a simple reason and **Use photo** is disabled.

## Expression video

RELAX, BROW RAISE, FROWN, SMILE, SQUINT, 3 s each with a progress indicator; video only (`audio:false`). The recording is analysed by `analyzeVideoFile`. Review offers **Use video** / **Record again**.

MediaRecorder WebM reports `duration = Infinity` until the end of the file is seen, which made the existing analysis reject camera-recorded video. `loadVideo` in `lib/facial-analysis/video/capture.ts` now resolves it (seek far past the end, then rewind). Finite durations (uploaded files) are untouched.

## Errors

Friendly text only — raw `DOMException` text is never shown. Not allowed, not found, in use (with **Try again**), over-constrained (retried once with looser constraints), unsupported browser and insecure context all offer **Upload instead**.

## Privacy

- `getUserMedia({ audio: false, video })` with `ideal` constraints only; no microphone.
- Nothing is written to localStorage/sessionStorage/IndexedDB and nothing is uploaded by this feature.
- Tracks are stopped on finish, cancel, leaving the flow, unmount and `pagehide`; preview object URLs are revoked; the recorder gets a video-only `MediaStream` and is released.

## Testing

Automated: `npm test` (`tests/camera/*`), and the browser check scripts driven with Chromium's fake camera (`--use-fake-device-for-media-stream`). The fake feed contains **no face**, so those tests cover intro, permission, constraints, guidance with no face, no auto-capture, manual capture → rejected review → retake, upload fallback, the 45°/profile/video UIs, cleanup, error states and the analysis hand-off. They cannot cover a successful auto-capture.

### Manual test — MacBook

1. `npm run dev`, open `http://localhost:3000/assessment`, go to the photo step.
2. **Allow camera**; grant permission. Watch the oval and cue text.
3. Look straight ahead in even light; hold still. The photo should capture by itself after a short hold. Try being too far, too close, off-centre, tilted, in a dark room — the cue should change.
4. Review: **Use photo**. Repeat for left 45° (turn your head to your right) and right 45°.
5. Optionally add profiles (manual **Capture**) or **Skip profile photos**.
6. Record the expression video; **Use video**. Confirm the camera light turns off.
7. Continue to review and **Start Analysis**.
8. Also try denying camera permission and **Upload instead**.

### Manual test — phone

Camera requires a secure context (HTTPS or localhost). Serve over HTTPS (for example a tunnel, or `next dev --experimental-https`) and open it on the phone. Repeat the steps above in portrait; check the safe area, that nothing scrolls sideways, and that the front camera is used.

## Needs a real device (not verified)

- Auto-capture on a real face, and the wording of live cues under real lighting.
- Left/right 45° cue direction with a real head turn.
- Mobile browsers: iOS Safari camera and MediaRecorder support, Android Chrome, orientation changes, the safe area.
- Firefox / Safari recorded-video duration handling (the fix above was verified in Chromium only).
