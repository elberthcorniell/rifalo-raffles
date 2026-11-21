-- Per-tenant legal copy shown on the public storefront.
-- Public (anon and authenticated) can read. Only the org owner can write.
-- The Next.js admin API uses the service role after checking membership.

CREATE OR REPLACE FUNCTION public.is_org_owner(p_org_id uuid)
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
      AND m.role = 'owner'
  );
$$;

REVOKE ALL ON FUNCTION public.is_org_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_org_owner(uuid) TO authenticated;

CREATE TABLE public.org_legal_documents (
  org_id uuid PRIMARY KEY REFERENCES public.organizations (id) ON DELETE CASCADE,
  terms_md text,
  privacy_md text,
  rules_md text,
  support_md text,
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_legal_documents_terms_len CHECK (terms_md IS NULL OR char_length(terms_md) <= 20000),
  CONSTRAINT org_legal_documents_privacy_len CHECK (privacy_md IS NULL OR char_length(privacy_md) <= 20000),
  CONSTRAINT org_legal_documents_rules_len CHECK (rules_md IS NULL OR char_length(rules_md) <= 20000),
  CONSTRAINT org_legal_documents_support_len CHECK (support_md IS NULL OR char_length(support_md) <= 20000)
);

CREATE TRIGGER org_legal_documents_updated_at
  BEFORE UPDATE ON public.org_legal_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.org_legal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_legal_documents_public_select
  ON public.org_legal_documents
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY org_legal_documents_owner_insert
  ON public.org_legal_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_org_owner(org_id));

CREATE POLICY org_legal_documents_owner_update
  ON public.org_legal_documents
  FOR UPDATE
  TO authenticated
  USING (public.is_org_owner(org_id))
  WITH CHECK (public.is_org_owner(org_id));

CREATE POLICY org_legal_documents_owner_delete
  ON public.org_legal_documents
  FOR DELETE
  TO authenticated
  USING (public.is_org_owner(org_id));

REVOKE ALL ON public.org_legal_documents FROM PUBLIC;
GRANT SELECT ON public.org_legal_documents TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.org_legal_documents TO authenticated;
GRANT ALL ON public.org_legal_documents TO service_role;
