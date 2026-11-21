-- Blog emails sent from the platform superadmin.
-- Service role only. The Next.js route checks the superadmin email first.

CREATE TABLE public.blog_email_unsubscribes (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blog_email_unsubscribes_email_check
    CHECK (email = lower(email) AND position('@' in email) > 1)
);

CREATE TABLE public.blog_email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_slug text NOT NULL,
  subject text NOT NULL,
  audience text NOT NULL,
  kind text NOT NULL,
  recipient_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blog_email_campaigns_audience_check
    CHECK (audience IN ('all', 'published', 'paying', 'free', 'test')),
  CONSTRAINT blog_email_campaigns_kind_check
    CHECK (kind IN ('test', 'bulk')),
  CONSTRAINT blog_email_campaigns_counts_check
    CHECK (recipient_count >= 0 AND sent_count >= 0 AND failed_count >= 0)
);

CREATE INDEX blog_email_campaigns_created_idx
  ON public.blog_email_campaigns (created_at DESC);

CREATE TABLE public.blog_email_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.blog_email_campaigns (id) ON DELETE CASCADE,
  post_slug text NOT NULL,
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  email text NOT NULL,
  kind text NOT NULL,
  status text NOT NULL,
  error text,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blog_email_deliveries_kind_check
    CHECK (kind IN ('test', 'bulk')),
  CONSTRAINT blog_email_deliveries_status_check
    CHECK (status IN ('pending', 'sent', 'failed')),
  CONSTRAINT blog_email_deliveries_email_check
    CHECK (email = lower(email) AND position('@' in email) > 1)
);

CREATE INDEX blog_email_deliveries_campaign_idx
  ON public.blog_email_deliveries (campaign_id);

CREATE INDEX blog_email_deliveries_post_idx
  ON public.blog_email_deliveries (post_slug, kind);

-- One bulk row per post and address. A later send updates that row
-- instead of inserting another, so the same post is not mailed twice.
CREATE UNIQUE INDEX blog_email_deliveries_bulk_email_uidx
  ON public.blog_email_deliveries (post_slug, email)
  WHERE kind = 'bulk';

ALTER TABLE public.blog_email_unsubscribes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_email_deliveries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.blog_email_unsubscribes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.blog_email_campaigns FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.blog_email_deliveries FROM PUBLIC, anon, authenticated;

GRANT ALL ON public.blog_email_unsubscribes TO service_role;
GRANT ALL ON public.blog_email_campaigns TO service_role;
GRANT ALL ON public.blog_email_deliveries TO service_role;
