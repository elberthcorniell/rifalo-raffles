-- Minimum tickets required per purchase (e.g. price 15, min 10)
ALTER TABLE public.raffles
  ADD COLUMN IF NOT EXISTS min_tickets integer NOT NULL DEFAULT 1
  CHECK (min_tickets >= 1);
