import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../../", import.meta.url).pathname;
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : []; });
const CAMERA_UI = ["GuidedCameraCapture", "CameraPreview", "FaceGuideOverlay", "CaptureGuidance", "CaptureReview", "ExpressionVideoCapture", "PhotoCaptureStep", "useCameraStream"].map((n) => join(ROOT, "components/assessment", n + (n === "useCameraStream" ? ".ts" : ".tsx")));
const code = (p: string) => strip(readFileSync(p, "utf8"));

test("privacy: camera code never uses browser storage, IndexedDB, cookies, or any network/upload API", () => {
  const banned = /\b(localStorage|sessionStorage|indexedDB|IndexedDB)\s*(\.|\[|\))|window\.(localStorage|sessionStorage|indexedDB)|document\.cookie|caches\.(open|match)|navigator\.storage|\bfetch\s*\(|XMLHttpRequest|sendBeacon|new WebSocket|FormData|readAsDataURL|toDataURL/;
  const targets = [...files(join(ROOT, "lib/camera-capture")), ...CAMERA_UI];
  assert.ok(targets.length >= 15);
  assert.deepEqual(targets.filter((f) => banned.test(code(f))).map((f) => f.replace(ROOT, "")), []);
});

test("privacy: the microphone is never requested — audio is false everywhere and no audio constraint or track is used", () => {
  const all = [...files(join(ROOT, "lib/camera-capture")), ...CAMERA_UI].map(code).join("\n");
  assert.doesNotMatch(all, /audio\s*:\s*true/);
  assert.doesNotMatch(all, /getAudioTracks|audio\s*:\s*\{/);
  assert.match(code(join(ROOT, "lib/camera-capture/constraints.ts")), /audio:\s*false/);
  // The recorder wraps only the VIDEO tracks of the stream.
  assert.match(code(join(ROOT, "lib/camera-capture/recording.ts")), /new MediaStream\(stream\.getVideoTracks\(\)\)/);
});

test("privacy: captures are drawn from the video frame (not a page screenshot) and are not mirrored", () => {
  const src = code(join(ROOT, "lib/camera-capture/capture.ts"));
  assert.match(src, /drawImage\(video/);
  assert.doesNotMatch(src, /scale\(-1|html2canvas|getDisplayMedia/);
  assert.doesNotMatch(code(join(ROOT, "lib/camera-capture/live.ts")), /getDisplayMedia/);
});

test("cleanup (static): the camera hook releases tracks on stop, on unmount and on pagehide; previews and the recorder are released too", () => {
  const hook = code(join(ROOT, "components/assessment/useCameraStream.ts"));
  assert.match(hook, /stopStream\(streamRef\.current\)/);
  assert.match(hook, /pagehide/);
  assert.match(hook, /return \(\) => \{[\s\S]*release\(\)/);
  const cap = code(join(ROOT, "components/assessment/GuidedCameraCapture.tsx"));
  assert.match(cap, /URL\.revokeObjectURL/);
  assert.match(cap, /cam\.stop\(\)/);
  assert.match(code(join(ROOT, "components/assessment/ExpressionVideoCapture.tsx")), /recorderRef\.current\?\.cancel\(\)/);
  assert.match(code(join(ROOT, "components/assessment/CameraPreview.tsx")), /srcObject = null/);
});

test("the live loop uses the EXISTING MediaPipe detector and the existing quality rules — no second detector, no new formulas", () => {
  const live = code(join(ROOT, "lib/camera-capture/live.ts"));
  assert.match(live, /detectFace/);
  assert.match(live, /faceLandmarker\.ts/);
  const guidance = code(join(ROOT, "lib/camera-capture/guidance.ts"));
  for (const reused of ["checkPhotoQuality", "estimateRollDegrees", "estimateYawRatio", "nearSideOf", "validateThreeQuarter", "MAX_ROLL_DEGREES", "MIN_BRIGHTNESS"]) assert.match(guidance, new RegExp(reused));
  assert.doesNotMatch(guidance + live, /FaceDetector|BlazeFace|tracking\.js|face-api/);
});

test("fallback upload: uploading is still available as 'Upload instead' / 'Use camera', through the unchanged PhotoCollection", () => {
  const step = code(join(ROOT, "components/assessment/PhotoCaptureStep.tsx"));
  assert.match(step, /PhotoCollection/);
  assert.match(step, /Use camera/);
  const capture = code(join(ROOT, "components/assessment/GuidedCameraCapture.tsx"));
  assert.ok((capture.match(/Upload instead/g) ?? []).length >= 3, "offered at the intro, on errors, and while capturing");
  assert.match(capture, /Allow camera/);
  const collection = code(join(ROOT, "components/assessment/PhotoCollection.tsx"));
  assert.match(collection, /type="file"/);
});

test("camera permission is only requested after a user action (the 'Allow camera' button), never on mount", () => {
  const cap = code(join(ROOT, "components/assessment/GuidedCameraCapture.tsx"));
  const hook = code(join(ROOT, "components/assessment/useCameraStream.ts"));
  assert.match(cap, /onClick=\{requestCamera\}/);
  assert.doesNotMatch(hook.replace(/const start = useCallback[\s\S]*?\n {2}\}, \[\]\);/, ""), /openCamera\(/);
  assert.doesNotMatch(cap, /useEffect\(\(\) => \{\s*void?\s*(requestCamera|cam\.start)/);
});
