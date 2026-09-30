/**
 * Minimal, server-only REST client for Supabase's PostgREST API. Raw fetch,
 * no @supabase/supabase-js dependency — matching this codebase's own
 * established pattern for external services (see
 * lib/image-generation/openaiImages.ts, which calls OpenAI the same way):
 * one small, testable HTTP call, not a vendor SDK.
 *
 * SUPABASE_SERVICE_ROLE_KEY is read only here, only server-side, and is
 * NEVER sent to the browser: every caller of this module is itself
 * server-only (an API route, or a module an API route imports). Next.js
 * only inlines NEXT_PUBLIC_-prefixed env vars into the client bundle;
 * SUPABASE_SERVICE_ROLE_KEY deliberately is not one, matching every other
 * server-only secret in this codebase. NEXT_PUBLIC_SUPABASE_URL is not a
 * secret (it's the project's public REST endpoint) — reading it server-side
 * here is fine, the same way NEXT_PUBLIC_ILLUSTRATION_GENERATION already is
 * elsewhere.
 *
 * The service-role key BYPASSES Row Level Security by Supabase's own design
 * — see the migration SQL's comment for why the table has RLS enabled with
 * zero policies: the anon/public key can never read or write this table at
 * all; only this server-only client, with the service-role key, can.
 */

export interface SupabaseEnv {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  [key: string]: string | undefined;
}

function isValidSupabaseUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * True only when both variables are present AND the URL is actually a
 * well-formed https URL — a malformed NEXT_PUBLIC_SUPABASE_URL (typo,
 * http://, empty string) must be treated exactly like a missing one, never
 * as "configured" (see store.ts's production fail-closed behavior, which
 * depends on this being strict).
 */
export function isSupabaseConfigured(env: SupabaseEnv): boolean {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return !!url && !!key && isValidSupabaseUrl(url);
}

/**
 * One PostgREST call against `${url}/rest/v1${path}`. Never throws on a
 * non-2xx response (callers inspect `.ok`/`.status`); throws only on a
 * genuine network failure, matching fetch's own contract.
 */
export async function supabaseRequest(env: SupabaseEnv, path: string, init: RequestInit = {}, fetchImpl: typeof fetch = fetch): Promise<Response> {
  if (!isSupabaseConfigured(env)) throw new Error("Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing).");
  const base = env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/+$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY!;
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("authorization", `Bearer ${key}`);
  if (!headers.has("content-type")) headers.set("content-type", "application/json");
  return fetchImpl(`${base}/rest/v1${path}`, { ...init, headers });
}
