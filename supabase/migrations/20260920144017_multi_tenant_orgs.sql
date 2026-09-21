-- Multi-tenant: organizations, membership, org-scoped data and RLS

-- ---------------------------------------------------------------------------
-- Organizations
-- ---------------------------------------------------------------------------
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  logo_path text,
  tagline text NOT NULL DEFAULT '',
  email text,
  phone text,
  admin_email text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizations_slug_format CHECK (
    slug ~ '^[a-z0-9]([a-z0-9-]{1,30}[a-z0-9])?$'
  ),
  CONSTRAINT organizations_slug_unique UNIQUE (slug)
);

CREATE TABLE public.org_members (
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'admin'
    CHECK (role IN ('owner', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);

CREATE INDEX org_members_user_idx ON public.org_members (user_id);
CREATE INDEX organizations_slug_idx ON public.organizations (slug);

CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Seed default org and backfill before NOT NULL
-- ---------------------------------------------------------------------------
INSERT INTO public.organizations (id, slug, name, tagline, email, admin_email)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'cura',
  'Cura tu Suerte',
  'La plataforma de rifas más emocionante de República Dominicana. ¡Cura tu suerte con nosotros!',
  'info@curatusuerte.do',
  'info@curatusuerte.do'
);

-- Existing global admins become owners of the cura org
INSERT INTO public.org_members (org_id, user_id, role)
SELECT
  '00000000-0000-0000-0000-000000000001'::uuid,
  u.id,
  'owner'
FROM auth.users u
WHERE coalesce(u.raw_app_meta_data ->> 'role', '') = 'admin'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Add org_id columns (nullable first, then backfill, then NOT NULL)
-- ---------------------------------------------------------------------------
ALTER TABLE public.raffles
  ADD COLUMN org_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;

ALTER TABLE public.bank_accounts
  ADD COLUMN org_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;

ALTER TABLE public.customers
  ADD COLUMN org_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;

ALTER TABLE public.purchases
  ADD COLUMN org_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;

UPDATE public.raffles
SET org_id = '00000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

UPDATE public.bank_accounts
SET org_id = '00000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

UPDATE public.customers
SET org_id = '00000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

UPDATE public.purchases
SET org_id = '00000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

ALTER TABLE public.raffles ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.bank_accounts ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.customers ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.purchases ALTER COLUMN org_id SET NOT NULL;

CREATE INDEX raffles_org_idx ON public.raffles (org_id);
CREATE INDEX bank_accounts_org_idx ON public.bank_accounts (org_id);
CREATE INDEX customers_org_idx ON public.customers (org_id);
CREATE INDEX purchases_org_idx ON public.purchases (org_id);

-- WhatsApp unique per org
ALTER TABLE public.customers DROP CONSTRAINT customers_whatsapp_unique;
ALTER TABLE public.customers
  ADD CONSTRAINT customers_org_whatsapp_unique UNIQUE (org_id, whatsapp);

-- ---------------------------------------------------------------------------
-- Membership helpers (org_members table — not user_metadata)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_members m
    WHERE m.org_id = p_org_id
      AND m.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_any_org_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_members m
    WHERE m.user_id = auth.uid()
  );
$$;

-- Keep is_admin() for backward compat but redefine as any org member
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_any_org_admin();
$$;

REVOKE ALL ON FUNCTION public.is_org_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_any_org_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_any_org_admin() TO authenticated, anon;

-- ---------------------------------------------------------------------------
-- RPC wrappers: require membership of the raffle/purchase org
-- ---------------------------------------------------------------------------
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
DECLARE
  v_org_id uuid;
BEGIN
  SELECT org_id INTO v_org_id FROM public.raffles WHERE id = p_raffle_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Raffle not found';
  END IF;
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT public.is_org_member(v_org_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN private.generate_ticket_range(p_raffle_id, p_start, p_end);
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_purchase(p_purchase_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT org_id INTO v_org_id FROM public.purchases WHERE id = p_purchase_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Purchase not found';
  END IF;
  IF NOT public.is_org_member(v_org_id) THEN
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
DECLARE
  v_org_id uuid;
BEGIN
  SELECT org_id INTO v_org_id FROM public.purchases WHERE id = p_purchase_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Purchase not found';
  END IF;
  IF NOT public.is_org_member(v_org_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  PERFORM private.reject_purchase(p_purchase_id, auth.uid(), p_notes);
END;
$$;

-- ---------------------------------------------------------------------------
-- Drop old policies and recreate org-scoped ones
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
DROP POLICY IF EXISTS profiles_admin_all ON public.profiles;
DROP POLICY IF EXISTS raffles_public_read ON public.raffles;
DROP POLICY IF EXISTS raffles_admin_insert ON public.raffles;
DROP POLICY IF EXISTS raffles_admin_update ON public.raffles;
DROP POLICY IF EXISTS raffles_admin_delete ON public.raffles;
DROP POLICY IF EXISTS ticket_ranges_admin_all ON public.ticket_ranges;
DROP POLICY IF EXISTS ticket_ranges_public_read ON public.ticket_ranges;
DROP POLICY IF EXISTS tickets_admin_all ON public.tickets;
DROP POLICY IF EXISTS tickets_public_read_sold ON public.tickets;
DROP POLICY IF EXISTS bank_accounts_public_read ON public.bank_accounts;
DROP POLICY IF EXISTS bank_accounts_admin_insert ON public.bank_accounts;
DROP POLICY IF EXISTS bank_accounts_admin_update ON public.bank_accounts;
DROP POLICY IF EXISTS bank_accounts_admin_delete ON public.bank_accounts;
DROP POLICY IF EXISTS customers_admin_all ON public.customers;
DROP POLICY IF EXISTS purchases_admin_all ON public.purchases;
DROP POLICY IF EXISTS raffle_images_admin_write ON storage.objects;
DROP POLICY IF EXISTS raffle_images_admin_update ON storage.objects;
DROP POLICY IF EXISTS raffle_images_admin_delete ON storage.objects;
DROP POLICY IF EXISTS vouchers_admin_read ON storage.objects;
DROP POLICY IF EXISTS vouchers_admin_write ON storage.objects;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

-- organizations: members can read/update their org; anyone authenticated can insert (signup)
CREATE POLICY organizations_select_member ON public.organizations
  FOR SELECT TO authenticated
  USING (public.is_org_member(id));

-- Public can look up by slug via service role; allow authenticated read of own orgs only.
-- Anon has no direct SELECT (prevents listing all tenants). Middleware uses service role.

CREATE POLICY organizations_insert_authenticated ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY organizations_update_member ON public.organizations
  FOR UPDATE TO authenticated
  USING (public.is_org_member(id))
  WITH CHECK (public.is_org_member(id));

-- org_members
CREATE POLICY org_members_select_own ON public.org_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_org_member(org_id));

CREATE POLICY org_members_insert_owner ON public.org_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_org_member(org_id)
  );

CREATE POLICY org_members_delete_member ON public.org_members
  FOR DELETE TO authenticated
  USING (public.is_org_member(org_id));

-- profiles
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_any_org_admin());
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- raffles: NO anon public SELECT of all active (would leak tenants).
-- Members manage their org; public reads go through Next.js + service role.
CREATE POLICY raffles_member_select ON public.raffles
  FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));
CREATE POLICY raffles_member_insert ON public.raffles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(org_id));
CREATE POLICY raffles_member_update ON public.raffles
  FOR UPDATE TO authenticated
  USING (public.is_org_member(org_id))
  WITH CHECK (public.is_org_member(org_id));
CREATE POLICY raffles_member_delete ON public.raffles
  FOR DELETE TO authenticated
  USING (public.is_org_member(org_id));

-- ticket_ranges / tickets via raffle org
CREATE POLICY ticket_ranges_member_all ON public.ticket_ranges
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.raffles r
      WHERE r.id = ticket_ranges.raffle_id AND public.is_org_member(r.org_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.raffles r
      WHERE r.id = ticket_ranges.raffle_id AND public.is_org_member(r.org_id)
    )
  );

CREATE POLICY tickets_member_all ON public.tickets
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.raffles r
      WHERE r.id = tickets.raffle_id AND public.is_org_member(r.org_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.raffles r
      WHERE r.id = tickets.raffle_id AND public.is_org_member(r.org_id)
    )
  );

-- bank_accounts
CREATE POLICY bank_accounts_member_select ON public.bank_accounts
  FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));
CREATE POLICY bank_accounts_member_insert ON public.bank_accounts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(org_id));
CREATE POLICY bank_accounts_member_update ON public.bank_accounts
  FOR UPDATE TO authenticated
  USING (public.is_org_member(org_id))
  WITH CHECK (public.is_org_member(org_id));
CREATE POLICY bank_accounts_member_delete ON public.bank_accounts
  FOR DELETE TO authenticated
  USING (public.is_org_member(org_id));

-- customers / purchases
CREATE POLICY customers_member_all ON public.customers
  FOR ALL TO authenticated
  USING (public.is_org_member(org_id))
  WITH CHECK (public.is_org_member(org_id));

CREATE POLICY purchases_member_all ON public.purchases
  FOR ALL TO authenticated
  USING (public.is_org_member(org_id))
  WITH CHECK (public.is_org_member(org_id));

-- Storage: org members can write (path prefix not enforced in RLS; app prefixes with org_id)
CREATE POLICY raffle_images_member_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'raffle-images' AND public.is_any_org_admin());

CREATE POLICY raffle_images_member_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'raffle-images' AND public.is_any_org_admin())
  WITH CHECK (bucket_id = 'raffle-images' AND public.is_any_org_admin());

CREATE POLICY raffle_images_member_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'raffle-images' AND public.is_any_org_admin());

CREATE POLICY vouchers_member_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'vouchers' AND public.is_any_org_admin());

CREATE POLICY vouchers_member_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vouchers' AND public.is_any_org_admin());
