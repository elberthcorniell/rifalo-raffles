-- Cura tu Suerte: replace Gestiono with Supabase
-- Schema, RLS, storage, and ticket RPCs

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SCHEMA IF NOT EXISTS private;

-- ---------------------------------------------------------------------------
-- Helper: admin check via app_metadata.role (never user_metadata)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.raffles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  image_path text,
  ticket_price numeric(12, 2) NOT NULL CHECK (ticket_price >= 0),
  min_tickets integer NOT NULL DEFAULT 1 CHECK (min_tickets >= 1),
  currency text NOT NULL DEFAULT 'DOP',
  end_date timestamptz,
  featured boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'ended', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ticket_ranges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id uuid NOT NULL REFERENCES public.raffles (id) ON DELETE CASCADE,
  start_number integer NOT NULL CHECK (start_number >= 0),
  end_number integer NOT NULL CHECK (end_number >= start_number),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ticket_ranges_unique_bounds UNIQUE (raffle_id, start_number, end_number)
);

CREATE TABLE public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  bank text NOT NULL DEFAULT '',
  account_number text NOT NULL,
  account_type text NOT NULL DEFAULT '',
  currency text NOT NULL DEFAULT 'DOP',
  holder_name text,
  cedula text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  whatsapp text NOT NULL,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customers_whatsapp_unique UNIQUE (whatsapp)
);

CREATE TABLE public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers (id),
  raffle_id uuid NOT NULL REFERENCES public.raffles (id),
  bank_account_id uuid NOT NULL REFERENCES public.bank_accounts (id),
  quantity integer NOT NULL CHECK (quantity > 0),
  total_amount numeric(12, 2) NOT NULL CHECK (total_amount >= 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'rejected')),
  voucher_path text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users (id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id uuid NOT NULL REFERENCES public.raffles (id) ON DELETE CASCADE,
  number integer NOT NULL CHECK (number >= 0),
  display_number text NOT NULL,
  status text NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'reserved', 'sold')),
  purchase_id uuid REFERENCES public.purchases (id) ON DELETE SET NULL,
  range_id uuid REFERENCES public.ticket_ranges (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tickets_raffle_number_unique UNIQUE (raffle_id, number)
);

CREATE INDEX tickets_raffle_status_idx ON public.tickets (raffle_id, status);
CREATE INDEX tickets_purchase_idx ON public.tickets (purchase_id);
CREATE INDEX purchases_status_idx ON public.purchases (status);
CREATE INDEX purchases_raffle_idx ON public.purchases (raffle_id);
CREATE INDEX customers_whatsapp_idx ON public.customers (whatsapp);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER raffles_updated_at BEFORE UPDATE ON public.raffles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER bank_accounts_updated_at BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER customers_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER purchases_updated_at BEFORE UPDATE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tickets_updated_at BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, coalesce(NEW.raw_user_meta_data ->> 'display_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Private RPCs (security definer)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.pad_ticket_number(n integer, pad_width integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lpad(n::text, greatest(pad_width, length(n::text)), '0');
$$;

CREATE OR REPLACE FUNCTION private.generate_ticket_range(
  p_raffle_id uuid,
  p_start integer,
  p_end integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_range_id uuid;
  v_pad integer;
  v_overlap boolean;
BEGIN
  IF p_start IS NULL OR p_end IS NULL OR p_end < p_start THEN
    RAISE EXCEPTION 'Invalid range: start=% end=%', p_start, p_end;
  END IF;

  IF p_end - p_start + 1 > 100000 THEN
    RAISE EXCEPTION 'Range too large (max 100000 tickets)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.raffles WHERE id = p_raffle_id) THEN
    RAISE EXCEPTION 'Raffle not found';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.raffle_id = p_raffle_id
      AND t.number BETWEEN p_start AND p_end
  ) INTO v_overlap;

  IF v_overlap THEN
    RAISE EXCEPTION 'Ticket numbers overlap an existing range for this raffle';
  END IF;

  v_pad := length(p_end::text);
  IF v_pad < 4 THEN
    v_pad := 4;
  END IF;

  INSERT INTO public.ticket_ranges (raffle_id, start_number, end_number)
  VALUES (p_raffle_id, p_start, p_end)
  RETURNING id INTO v_range_id;

  INSERT INTO public.tickets (raffle_id, number, display_number, status, range_id)
  SELECT
    p_raffle_id,
    g.n,
    private.pad_ticket_number(g.n, v_pad),
    'available',
    v_range_id
  FROM generate_series(p_start, p_end) AS g(n);

  RETURN v_range_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.assign_random_tickets(
  p_raffle_id uuid,
  p_quantity integer,
  p_purchase_id uuid
)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_numbers text[];
  v_count integer;
BEGIN
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'Quantity must be at least 1';
  END IF;

  WITH picked AS (
    SELECT t.id
    FROM public.tickets t
    WHERE t.raffle_id = p_raffle_id
      AND t.status = 'available'
    ORDER BY random()
    LIMIT p_quantity
    FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE public.tickets t
    SET status = 'reserved', purchase_id = p_purchase_id
    FROM picked
    WHERE t.id = picked.id
    RETURNING t.display_number, t.number
  )
  SELECT array_agg(u.display_number ORDER BY u.number), count(*)::integer
  INTO v_numbers, v_count
  FROM updated u;

  IF v_count IS NULL OR v_count < p_quantity THEN
    RAISE EXCEPTION 'Not enough available tickets. Requested: %, available: %',
      p_quantity,
      coalesce(v_count, 0);
  END IF;

  RETURN v_numbers;
END;
$$;

CREATE OR REPLACE FUNCTION private.confirm_purchase(p_purchase_id uuid, p_reviewed_by uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status FROM public.purchases WHERE id = p_purchase_id FOR UPDATE;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Purchase not found';
  END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'Purchase is not pending (status=%)', v_status;
  END IF;

  UPDATE public.purchases
  SET status = 'confirmed',
      reviewed_at = now(),
      reviewed_by = p_reviewed_by
  WHERE id = p_purchase_id;

  UPDATE public.tickets
  SET status = 'sold'
  WHERE purchase_id = p_purchase_id
    AND status = 'reserved';
END;
$$;

CREATE OR REPLACE FUNCTION private.reject_purchase(
  p_purchase_id uuid,
  p_reviewed_by uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status FROM public.purchases WHERE id = p_purchase_id FOR UPDATE;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Purchase not found';
  END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'Purchase is not pending (status=%)', v_status;
  END IF;

  UPDATE public.purchases
  SET status = 'rejected',
      reviewed_at = now(),
      reviewed_by = p_reviewed_by,
      notes = coalesce(p_notes, notes)
  WHERE id = p_purchase_id;

  UPDATE public.tickets
  SET status = 'available', purchase_id = NULL
  WHERE purchase_id = p_purchase_id
    AND status = 'reserved';
END;
$$;

-- Public wrappers (callable via PostgREST / service role)
CREATE OR REPLACE FUNCTION public.generate_ticket_range(
  p_raffle_id uuid,
  p_start integer,
  p_end integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN private.generate_ticket_range(p_raffle_id, p_start, p_end);
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_random_tickets(
  p_raffle_id uuid,
  p_quantity integer,
  p_purchase_id uuid
)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  RETURN private.assign_random_tickets(p_raffle_id, p_quantity, p_purchase_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_purchase(p_purchase_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  PERFORM private.confirm_purchase(p_purchase_id, auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_purchase(p_purchase_id uuid, p_notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  PERFORM private.reject_purchase(p_purchase_id, auth.uid(), p_notes);
END;
$$;

-- Service-role friendly confirm/reject used from Next.js API with service key
CREATE OR REPLACE FUNCTION public.admin_confirm_purchase(
  p_purchase_id uuid,
  p_reviewed_by uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  PERFORM private.confirm_purchase(p_purchase_id, p_reviewed_by);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reject_purchase(
  p_purchase_id uuid,
  p_reviewed_by uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  PERFORM private.reject_purchase(p_purchase_id, p_reviewed_by, p_notes);
END;
$$;

REVOKE ALL ON FUNCTION public.assign_random_tickets(uuid, integer, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_ticket_range(uuid, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_purchase(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_purchase(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_confirm_purchase(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_reject_purchase(uuid, uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.generate_ticket_range(uuid, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assign_random_tickets(uuid, integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_purchase(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_purchase(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_confirm_purchase(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_reject_purchase(uuid, uuid, text) TO service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raffles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_ranges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin());
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_admin());
CREATE POLICY profiles_admin_all ON public.profiles
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- raffles: anon/authenticated read active; admin full
CREATE POLICY raffles_public_read ON public.raffles
  FOR SELECT TO anon, authenticated
  USING (status = 'active' OR public.is_admin());
CREATE POLICY raffles_admin_insert ON public.raffles
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY raffles_admin_update ON public.raffles
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY raffles_admin_delete ON public.raffles
  FOR DELETE TO authenticated USING (public.is_admin());

-- ticket_ranges
CREATE POLICY ticket_ranges_admin_all ON public.ticket_ranges
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY ticket_ranges_public_read ON public.ticket_ranges
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.raffles r
      WHERE r.id = ticket_ranges.raffle_id AND (r.status = 'active' OR public.is_admin())
    )
  );

-- tickets: public can see counts via API (service role); admin full; no anon write
CREATE POLICY tickets_admin_all ON public.tickets
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY tickets_public_read_sold ON public.tickets
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.raffles r
      WHERE r.id = tickets.raffle_id AND r.status = 'active'
    )
  );

-- bank_accounts: public read active; admin full
CREATE POLICY bank_accounts_public_read ON public.bank_accounts
  FOR SELECT TO anon, authenticated
  USING (is_active = true OR public.is_admin());
CREATE POLICY bank_accounts_admin_insert ON public.bank_accounts
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY bank_accounts_admin_update ON public.bank_accounts
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY bank_accounts_admin_delete ON public.bank_accounts
  FOR DELETE TO authenticated USING (public.is_admin());

-- customers / purchases: admin only via RLS (writes go through service role)
CREATE POLICY customers_admin_all ON public.customers
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY purchases_admin_all ON public.purchases
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage buckets
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'raffle-images',
    'raffle-images',
    true,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  ),
  (
    'vouchers',
    'vouchers',
    false,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
  )
ON CONFLICT (id) DO NOTHING;

-- Public read raffle images
CREATE POLICY raffle_images_public_read ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'raffle-images');

CREATE POLICY raffle_images_admin_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'raffle-images' AND public.is_admin());

CREATE POLICY raffle_images_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'raffle-images' AND public.is_admin())
  WITH CHECK (bucket_id = 'raffle-images' AND public.is_admin());

CREATE POLICY raffle_images_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'raffle-images' AND public.is_admin());

-- Vouchers: admin read; uploads via service role (no anon policy)
CREATE POLICY vouchers_admin_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'vouchers' AND public.is_admin());

CREATE POLICY vouchers_admin_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vouchers' AND public.is_admin());
