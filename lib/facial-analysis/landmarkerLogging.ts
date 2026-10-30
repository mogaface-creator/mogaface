/** MediaPipe emits this successful initialization notice on stderr. */
const CPU_DELEGATE_NOTICE = "INFO: Created TensorFlow Lite XNNPACK delegate for CPU.";

/** Scope interception to synchronous WASM execution; forward every other error. */
export function withLandmarkerLogging<T>(run: () => T): T {
  const original = console.error;
  console.error = (...args: unknown[]) => {
    if (args.length === 1 && typeof args[0] === "string" && args[0].trim() === CPU_DELEGATE_NOTICE) {
      console.info(args[0]);
      return;
    }
    original.apply(console, args);
  };
  try { return run(); }
  finally { console.error = original; }
}

/** WASM binds console.error at initialization, so capture the filtered logger then. */
export async function withLandmarkerInitializationLogging<T>(run: () => Promise<T>): Promise<T> {
  const original = console.error;
  const filtered = (...args: unknown[]) => {
    if (args.length === 1 && typeof args[0] === "string" && args[0].trim() === CPU_DELEGATE_NOTICE) {
      console.info(args[0]);
      return;
    }
    original.apply(console, args);
  };
  console.error = filtered;
  try { return await run(); }
  finally { if (console.error === filtered) console.error = original; }
}
