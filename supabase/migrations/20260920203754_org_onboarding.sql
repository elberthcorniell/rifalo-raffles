-- Track whether an org finished the post-signup setup wizard.
-- Existing orgs are marked complete so they are not forced through it.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

UPDATE public.organizations
SET onboarding_completed_at = COALESCE(updated_at, created_at, now())
WHERE onboarding_completed_at IS NULL;
