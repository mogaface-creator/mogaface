-- Async submission queue: one row per completed assessment, tracking the
-- background job that generates the AI after-image, builds the PDF, and
-- emails it to the client.
--
-- HOW TO APPLY: in the Supabase dashboard, open your project's SQL Editor
-- and run this file's contents once (after the other two migrations).
-- Or with Supabase CLI: `supabase db push`.
--
-- Lifecycle:
--   pending    → created immediately when the user submits the assessment
--   processing → set when the background job picks it up (after ~30 min delay)
--   done       → set after the email has been successfully delivered
--   failed     → set if image generation or email delivery fails (retryable)
--
-- Storage note: after_image_base64 holds the raw base64 of the AI-generated
-- image. For large-scale use, move this to Supabase Storage (a bucket) and
-- store only the object path here. For the initial launch, inline is fine.

create table if not exists public.submissions (
  id                  uuid primary key default gen_random_uuid(),
  lead_id             uuid references public.leads(id) on delete cascade,
  analysis_id         uuid,                       -- links to analysis_sessions for the full record
  status              text not null default 'pending'
                        check (status in ('pending','processing','done','failed')),
  -- Scheduled delivery time: the job runner only processes rows where
  -- send_after <= now(). Set to 30 minutes after created_at by the API.
  send_after          timestamptz not null,
  -- AI-generated result (populated by the background job)
  after_image_base64  text,                       -- base64-encoded PNG/JPEG
  after_image_mime    text,                       -- e.g. image/png
  -- The before image we stored for PDF generation (base64, front photo only)
  before_image_base64 text,
  before_image_mime   text,
  -- Metadata from the analysis used to fill the PDF report
  report_summary      text,                       -- AI-generated plain-text summary
  detected_areas      jsonb,                      -- array of { label, description }
  -- Delivery tracking
  email_sent_at       timestamptz,
  email_error         text,
  retry_count         int not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Index for the job runner: finds rows due for processing
create index if not exists submissions_send_after_status_idx
  on public.submissions (send_after, status)
  where status in ('pending', 'failed');

create index if not exists submissions_lead_id_idx
  on public.submissions (lead_id);

create index if not exists submissions_analysis_id_idx
  on public.submissions (analysis_id);

-- RLS: same pattern as analysis_sessions — default deny, service_role only.
alter table public.submissions enable row level security;
grant select, insert, update on table public.submissions to service_role;

-- Auto-update updated_at on every write
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger submissions_updated_at
  before update on public.submissions
  for each row execute function public.set_updated_at();
