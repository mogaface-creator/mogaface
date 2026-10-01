-- Clinic leads collected before an analysis. Contact details live here, not
-- inside the assessment that the image and interpretation paths read.
--
-- HOW TO APPLY: in the Supabase dashboard, open SQL Editor and run this file
-- once. Until then, the same details are still saved on the analysis session
-- record (record.contact), so a lead is not lost if this table is missing.

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid,
  name text not null,
  phone text not null,
  email text not null,
  location text not null,
  created_at timestamptz not null default now()
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_email_idx on public.leads (email);

alter table public.leads enable row level security;

grant select, insert on table public.leads to service_role;
