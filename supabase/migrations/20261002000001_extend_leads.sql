-- Extends the leads table with fields needed for the PDF report and
-- email delivery. Run AFTER 20261001000000_create_leads.sql.
--
-- HOW TO APPLY: Supabase SQL Editor → run once, or `supabase db push`.

-- What the client said they want to address (from questionnaire)
alter table public.leads
  add column if not exists places         jsonb,    -- array of place IDs selected
  add column if not exists dislikes       jsonb,    -- array of { words } objects
  add column if not exists want_after     text,     -- 'yes' | 'no' | null
  add column if not exists has_front      boolean not null default false,
  add column if not exists has_left       boolean not null default false,
  add column if not exists has_right      boolean not null default false;
