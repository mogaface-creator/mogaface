/**
 * Wraps an async function so a call made while a previous one is still
 * running is dropped (resolves to null) instead of starting a second one.
 * Used by the developer illustration test control so a double-click, or a
 * duplicate call caused by a React re-render, can never turn one explicit
 * click into two requests — see DevIllustrationTest.tsx.
 */
export function createSingleFlight<Args extends unknown[], T>(fn: (...args: Args) => Promise<T>): (...args: Args) => Promise<T | null> {
  let inFlight = false;
  return async (...args: Args) => {
    if (inFlight) return null;
    inFlight = true;
    try {
      return await fn(...args);
    } finally {
      inFlight = false;
    }
  };
}
