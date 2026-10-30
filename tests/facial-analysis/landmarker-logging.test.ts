import test from "node:test";
import assert from "node:assert/strict";
import { withLandmarkerLogging } from "../../lib/facial-analysis/landmarkerLogging.ts";

test("CPU initialization goes to info while real errors and return values are preserved", () => {
  const error = console.error, info = console.info;
  const errors: unknown[][] = [], notices: unknown[][] = [];
  console.error = (...args) => { errors.push(args); };
  console.info = (...args) => { notices.push(args); };
  const scopedError = console.error;
  try {
    const value = withLandmarkerLogging(() => {
      console.error("INFO: Created TensorFlow Lite XNNPACK delegate for CPU.");
      console.error("Actual WASM failure", {code: 7});
      return 42;
    });
    assert.equal(value,42);
    assert.equal(notices.length,1);
    assert.deepEqual(errors,[["Actual WASM failure",{code:7}]]);
    assert.equal(console.error, scopedError);
    assert.throws(() => withLandmarkerLogging(() => { throw new Error("detection failed"); }), /detection failed/);
    assert.equal(console.error, scopedError);
  } finally { console.error=error; console.info=info; }
});

test("WASM logger captured during initialization still filters notices after initialization", async () => {
  const { withLandmarkerInitializationLogging } = await import("../../lib/facial-analysis/landmarkerLogging.ts");
  const originalError=console.error, originalInfo=console.info;
  const errors: unknown[][]=[], infos: unknown[][]=[];
  console.error=(...args)=>{errors.push(args);};
  console.info=(...args)=>{infos.push(args);};
  const baseline=console.error;
  try {
    const captured = await withLandmarkerInitializationLogging(async () => {
      await Promise.resolve();
      return console.error.bind(console);
    });
    assert.equal(console.error,baseline);
    captured("INFO: Created TensorFlow Lite XNNPACK delegate for CPU.");
    captured("Real runtime failure");
    assert.equal(infos.length,1);
    assert.deepEqual(errors,[["Real runtime failure"]]);
    await assert.rejects(withLandmarkerInitializationLogging(async()=>{throw new Error("init failure");}),/init failure/);
    assert.equal(console.error,baseline);
  } finally {console.error=originalError;console.info=originalInfo;}
});
