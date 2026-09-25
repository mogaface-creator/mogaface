/**
 * The authorization and rate-limit BOUNDARY for the interpretation endpoint.
 *
 * MogaFace has no authentication system yet, so nothing here invents one:
 *  - An Authenticator is a function a future auth module will supply. In
 *    production, with none supplied, every request is refused — the endpoint is
 *    never an open proxy to a paid API.
 *  - A RateLimiter is an interface a future shared store (Redis, KV, …) will
 *    implement. The in-memory one below is per-process: on a serverless
 *    platform every instance has its own counter, so it is NOT a production
 *    control. In production, with none supplied, requests are refused.
 */

export interface AuthenticatedSubject {
  /** A stable, non-personal identifier for rate limiting and logs (never an email or name). */
  subject: string;
}

export type Authenticator = (request: Request) => Promise<AuthenticatedSubject | null>;

/** Development only: whoever is on localhost may call the endpoint (and only if a provider is configured). */
export const devAuthenticator: Authenticator = async () => ({ subject: "dev-local" });

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  check(key: string): Promise<RateLimitDecision>;
}

// ponytail: fixed window, one process — replace with a shared-store limiter before serverless production.
export function createMemoryRateLimiter(config: { limit?: number; windowMs?: number; now?: () => number } = {}): RateLimiter {
  const limit = config.limit ?? 10;
  const windowMs = config.windowMs ?? 60_000;
  const now = config.now ?? Date.now;
  const windows = new Map<string, { start: number; count: number }>();
  return {
    async check(key) {
      const t = now();
      const w = windows.get(key);
      if (!w || t - w.start >= windowMs) {
        windows.set(key, { start: t, count: 1 });
        return { allowed: true, retryAfterSeconds: 0 };
      }
      w.count += 1;
      return w.count <= limit ? { allowed: true, retryAfterSeconds: 0 } : { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((w.start + windowMs - t) / 1000)) };
    },
  };
}
