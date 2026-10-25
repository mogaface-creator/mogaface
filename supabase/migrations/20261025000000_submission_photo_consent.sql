alter table public.submissions
  add column if not exists photo_visualization_consent text not null default 'declined'
  check (photo_visualization_consent in ('granted', 'declined'));
