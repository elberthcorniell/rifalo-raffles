ALTER TABLE public.ticket_bundles
  ADD COLUMN label text NOT NULL DEFAULT '',
  ADD COLUMN badge text NOT NULL DEFAULT ''
    CHECK (badge IN ('', 'best', 'vip'));
