import { test } from "node:test";
import assert from "node:assert/strict";
import { CAMERA_MESSAGES, assessCameraSupport, cameraError, describeStream, listVideoDevices, mapCameraError, openCamera, stopStream, type CameraEnv } from "../../lib/camera-capture/camera.ts";
import { FALLBACK_CONSTRAINTS, IDEAL_HEIGHT, IDEAL_WIDTH, buildCameraConstraints } from "../../lib/camera-capture/constraints.ts";

const err = (name: string, message = "raw DOMException text that must never be shown") => Object.assign(new Error(message), { name });

function fakeStream(settings: Partial<MediaTrackSettings> = { width: 1280, height: 720, deviceId: "cam1" }) {
  const stopped: string[] = [];
  const track = (id: string) => ({ kind: "video", stop: () => stopped.push(id), getSettings: () => settings });
  const stream = { getVideoTracks: () => [track("v")], getTracks: () => [track("v"), track("v2")] } as unknown as MediaStream;
  return { stream, stopped };
}
const env = (getUserMedia: () => Promise<MediaStream>, over: Partial<CameraEnv> = {}): CameraEnv => ({
  isSecureContext: true,
  mediaDevices: { getUserMedia, enumerateDevices: async () => [] } as unknown as MediaDevices,
  ...over,
});

// ---- constraints: preferences, video only ----

test("constraints are preferences (ideal), video-only, and never request the microphone", () => {
  const c = buildCameraConstraints();
  assert.equal(c.audio, false);
  const v = c.video as MediaTrackConstraints;
  assert.deepEqual(v.width, { ideal: IDEAL_WIDTH });
  assert.deepEqual(v.height, { ideal: IDEAL_HEIGHT });
  assert.deepEqual(v.facingMode, { ideal: "user" });
  assert.ok(!JSON.stringify(c).includes("exact"), "nothing is an exact requirement");
  assert.equal(FALLBACK_CONSTRAINTS.audio, false);
  assert.deepEqual(buildCameraConstraints({ deviceId: "abc" }).video && (buildCameraConstraints({ deviceId: "abc" }).video as MediaTrackConstraints).deviceId, { ideal: "abc" });
});

// ---- error mapping ----

test("every browser camera error maps to a friendly message; raw DOMException text is never exposed", () => {
  const cases: [string, string][] = [
    ["NotAllowedError", "permission_denied"], ["PermissionDeniedError", "permission_denied"], ["SecurityError", "permission_denied"],
    ["NotFoundError", "no_camera"], ["DevicesNotFoundError", "no_camera"],
    ["NotReadableError", "camera_busy"], ["TrackStartError", "camera_busy"], ["AbortError", "camera_busy"],
    ["OverconstrainedError", "overconstrained"], ["TypeError", "unsupported"], ["WeirdError", "unknown"],
  ];
  for (const [name, kind] of cases) {
    const e = mapCameraError(err(name));
    assert.equal(e.kind, kind, name);
    assert.ok(!e.message.includes("raw DOMException"), name);
    assert.equal(e.message, CAMERA_MESSAGES[e.kind as keyof typeof CAMERA_MESSAGES]);
  }
  for (const weird of [null, undefined, "boom", 42, {}]) assert.doesNotThrow(() => mapCameraError(weird));
});

test("the messages are the specified friendly wording", () => {
  assert.equal(CAMERA_MESSAGES.permission_denied, "Camera access is blocked. You can allow camera access in your browser settings or upload photos instead.");
  assert.equal(CAMERA_MESSAGES.no_camera, "We couldn't find a camera on this device.");
  assert.equal(CAMERA_MESSAGES.camera_busy, "Your camera is being used by another application.");
  assert.equal(CAMERA_MESSAGES.unsupported, "This browser can't use the camera here. You can upload your photos instead.");
  for (const m of Object.values(CAMERA_MESSAGES)) assert.doesNotMatch(m, /DOMException|NotAllowedError|getUserMedia|undefined/);
  assert.equal(cameraError("camera_busy").retryable, true);
  assert.equal(cameraError("permission_denied").retryable, false);
});

// ---- support + opening ----

test("support: insecure context and missing mediaDevices are reported, not thrown", () => {
  assert.equal(assessCameraSupport(env(async () => fakeStream().stream)), null);
  assert.equal(assessCameraSupport(env(async () => fakeStream().stream, { isSecureContext: false }))?.kind, "insecure_context");
  assert.equal(assessCameraSupport({ isSecureContext: true, mediaDevices: undefined })?.kind, "unsupported");
  assert.equal(assessCameraSupport({ isSecureContext: true, mediaDevices: {} as never })?.kind, "unsupported");
});

test("opening the camera: success reports the ACTUAL stream settings, which may differ from the ideal", async () => {
  const { stream } = fakeStream({ width: 640, height: 480, deviceId: "d", facingMode: "user" });
  const r = await openCamera(env(async () => stream));
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.info, { width: 640, height: 480, deviceId: "d", facingMode: "user" });
  assert.deepEqual(describeStream(fakeStream({}).stream), { width: null, height: null, deviceId: null, facingMode: null });
});

test("opening the camera: permission denied, no camera and busy are friendly errors (no exception escapes)", async () => {
  for (const [name, kind] of [["NotAllowedError", "permission_denied"], ["NotFoundError", "no_camera"], ["NotReadableError", "camera_busy"]] as const) {
    const r = await openCamera(env(async () => { throw err(name); }));
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error.kind, kind);
  }
  const insecure = await openCamera(env(async () => fakeStream().stream, { isSecureContext: false }));
  assert.equal(!insecure.ok && insecure.error.kind, "insecure_context");
});

test("over-constrained: retries ONCE with the most permissive video-only request; a device that can't do 1280×720 still works", async () => {
  const seen: MediaStreamConstraints[] = [];
  const { stream } = fakeStream({ width: 320, height: 240 });
  const r = await openCamera(env(async (...args: unknown[]) => {
    seen.push(args[0] as MediaStreamConstraints);
    if (seen.length === 1) throw err("OverconstrainedError");
    return stream;
  }));
  assert.ok(r.ok);
  assert.equal(seen.length, 2);
  assert.deepEqual(seen[1], FALLBACK_CONSTRAINTS);
  assert.equal(seen[1].audio, false);

  let calls = 0;
  const failing = await openCamera(env(async () => { calls++; throw err("OverconstrainedError"); }));
  assert.equal(calls, 2, "no endless retrying");
  assert.equal(!failing.ok && failing.error.kind, "overconstrained");
});

// ---- cleanup ----

test("cleanup: every track is stopped so the camera is released; safe twice, with null, and if a track throws", () => {
  const { stream, stopped } = fakeStream();
  stopStream(stream);
  assert.deepEqual(stopped, ["v", "v2"]);
  stopStream(stream);
  assert.doesNotThrow(() => stopStream(null));
  assert.doesNotThrow(() => stopStream(undefined));
  const throwing = { getTracks: () => [{ stop: () => { throw new Error("already stopped"); } }, { stop: () => stopped.push("after") }] } as unknown as MediaStream;
  stopStream(throwing);
  assert.ok(stopped.includes("after"), "one failing track does not stop the rest");
});

test("camera list: video inputs only, with fallback labels, and enumerate failures are harmless", async () => {
  const devices = [{ kind: "videoinput", deviceId: "a", label: "FaceTime HD" }, { kind: "audioinput", deviceId: "m", label: "Mic" }, { kind: "videoinput", deviceId: "b", label: "" }];
  const e: CameraEnv = { isSecureContext: true, mediaDevices: { getUserMedia: async () => fakeStream().stream, enumerateDevices: async () => devices } as unknown as MediaDevices };
  assert.deepEqual(await listVideoDevices(e), [{ deviceId: "a", label: "FaceTime HD" }, { deviceId: "b", label: "Camera 2" }]);
  const broken: CameraEnv = { isSecureContext: true, mediaDevices: { getUserMedia: async () => fakeStream().stream, enumerateDevices: async () => { throw new Error("x"); } } as unknown as MediaDevices };
  assert.deepEqual(await listVideoDevices(broken), []);
});
