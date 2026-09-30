-- Trusted analysis-session persistence (see lib/analysis-session/).
--
-- HOW TO APPLY: in the Supabase dashboard, open your project's SQL Editor
-- and run this file's contents once. (Or, with the Supabase CLI installed
-- and linked to your project: `supabase link` then `supabase db push`.)
-- Then set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see
-- .env.example) from Project Settings -> API. Nothing else in the app
-- needs this table to exist — without it, or without those two env vars
-- set, lib/analysis-session/store.ts transparently uses an in-memory
-- fallback (fine for local dev; see that file's own module comment for why
-- it is not safe in a real multi-instance deployment).
--
-- One row per AnalysisRecord: created once by POST /api/analysis-session,
-- read once (or a few times, within its TTL) by POST /api/generate-illustration
-- — possibly in a completely separate serverless invocation, which is the
-- whole reason this table exists instead of the in-memory Map it replaces.
--
-- The full AnalysisRecord (assessment, analysis observations, and — this is
-- the security-critical part — the SERVER-COMPUTED treatment opportunities)
-- is stored as one JSONB blob. Nothing here is ever written from a
-- client-submitted opportunities/consumerReady/plan value; see
-- lib/analysis-session/store.ts for where that guarantee actually lives —
-- this table only persists what the server already decided.
--
-- session_token_hash is a SHA-256 hex digest, never the raw bearer token:
-- even a full table read (a backup, a misconfigured export) does not hand
-- out usable session tokens.

create table if not exists public.analysis_sessions (
  analysis_id uuid primary key,
  session_token_hash text not null,
  record jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'active'
);

create index if not exists analysis_sessions_expires_at_idx on public.analysis_sessions (expires_at);

-- RLS is enabled with ZERO policies attached — this is a deliberate default-deny:
-- PostgREST requests using the public/anon key can never select, insert, update
-- or delete a single row of this table, no matter what. Only a request signed
-- with the service-role key (which bypasses RLS entirely, by Supabase's own
-- design) can touch it — and that key is only ever used server-side, from
-- lib/analysis-session/supabaseClient.ts. Do not add a policy here without
-- re-reading that file's own doc comment first: a permissive policy on this
-- table would let the browser read or forge trusted analysis records directly,
-- which is exactly the vulnerability this whole architecture exists to close.
alter table public.analysis_sessions enable row level security;

-- service_role bypasses RLS, but Postgres still checks table grants first.
-- A table created in the SQL editor does not always receive this grant.
grant select, insert, update, delete on table public.analysis_sessions to service_role;

-- Best-effort housekeeping only — getAnalysisRecord() already checks expiry
-- in application code on every read and never trusts a stale row, so this is
-- not a security control, just table hygiene. Run manually or on a schedule;
-- nothing in the application depends on it running.
-- delete from public.analysis_sessions where expires_at < now();
