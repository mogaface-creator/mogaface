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

function cleanEnv(value: string | undefined): string {
  return (value ?? "").trim().replace(/^['"]|['"]$/g, "");
}

/**
 * Project URL → origin used for PostgREST. Accepts the dashboard Project URL
 * (`https://<ref>.supabase.co`) and the Data API URL some people paste instead
 * (`https://<ref>.supabase.co/rest/v1`). Callers always append `/rest/v1` themselves.
 */
export function supabaseRestOrigin(raw: string): string | null {
  try {
    const url = new URL(cleanEnv(raw));
    if (url.protocol !== "https:") return null;
    url.search = "";
    url.hash = "";
    let path = url.pathname.replace(/\/+$/, "");
    if (path.endsWith("/rest/v1")) path = path.slice(0, -"/rest/v1".length);
    return `${url.origin}${path}`;
  } catch {
    return null;
  }
}

function isValidSupabaseUrl(value: string): boolean {
  return supabaseRestOrigin(value) !== null;
}

let warnedWrongRole = false;

/** `anon` / `authenticated` JWTs cannot write this table (RLS default-deny). Non-JWT secrets (sb_secret_…) are left alone. */
function jwtRole(key: string): string | null {
  const parts = key.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { role?: unknown };
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
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
  const url = cleanEnv(env.NEXT_PUBLIC_SUPABASE_URL);
  const key = cleanEnv(env.SUPABASE_SERVICE_ROLE_KEY);
  return !!url && !!key && isValidSupabaseUrl(url);
}

/**
 * One PostgREST call against `${url}/rest/v1${path}`. Never throws on a
 * non-2xx response (callers inspect `.ok`/`.status`); throws only on a
 * genuine network failure, matching fetch's own contract.
 */
export async function supabaseRequest(env: SupabaseEnv, path: string, init: RequestInit = {}, fetchImpl: typeof fetch = fetch): Promise<Response> {
  if (!isSupabaseConfigured(env)) throw new Error("Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing).");
  const base = supabaseRestOrigin(env.NEXT_PUBLIC_SUPABASE_URL!)!;
  const key = cleanEnv(env.SUPABASE_SERVICE_ROLE_KEY);
  const role = jwtRole(key);
  if (role && role !== "service_role" && !warnedWrongRole) {
    warnedWrongRole = true;
    console.error("[analysis-session] SUPABASE_SERVICE_ROLE_KEY is a " + role + " key. Writes need the service_role secret; the anon key cannot insert into analysis_sessions.");
  }
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  // sb_secret_ / sb_publishable_ keys are opaque, not JWTs. The Supabase gateway
  // rejects them with Invalid JWT when they are also sent as Authorization: Bearer.
  // Legacy service_role keys are JWTs and still go on both headers.
  if (key.startsWith("sb_")) headers.delete("authorization");
  else headers.set("authorization", `Bearer ${key}`);
  if (!headers.has("content-type")) headers.set("content-type", "application/json");
  return fetchImpl(`${base}/rest/v1${path}`, { ...init, headers });
}
