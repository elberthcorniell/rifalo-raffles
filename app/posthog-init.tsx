"use client";

import { useEffect, useRef } from "react";
import posthog from "posthog-js";
import { createClient } from "@/lib/supabase/client";

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;
export const isPostHogConfigured = Boolean(projectToken && apiHost);

if (!isPostHogConfigured) {
  if (process.env.NODE_ENV === "development") {
    const missingVariable = projectToken
      ? "NEXT_PUBLIC_POSTHOG_HOST"
      : "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN";

    throw new Error(
      `${missingVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingVariable} is configured`,
    );
  }
} else {
  posthog.init(projectToken, {
    api_host: apiHost,
    defaults: "2026-01-30",
    capture_exceptions: true,
    debug: process.env.NODE_ENV === "development",
    tracing_headers:
      typeof window === "undefined" ? [] : [window.location.hostname],
  });
}

export function PostHogInit() {
  const identifiedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!isPostHogConfigured) return;

    const supabase = createClient();
    const { data: authSubscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_OUT") {
          identifiedUserId.current = null;
          posthog.reset();
          return;
        }

        if (event !== "INITIAL_SESSION" && event !== "SIGNED_IN") return;

        const user = session?.user;
        if (!user) return;

        if (identifiedUserId.current && identifiedUserId.current !== user.id) {
          posthog.reset();
        }

        const personProperties: Record<string, string> = {};
        if (user.email) personProperties.email = user.email;
        if (typeof user.user_metadata.full_name === "string") {
          personProperties.name = user.user_metadata.full_name;
        }

        posthog.identify(user.id, personProperties);
        identifiedUserId.current = user.id;
      },
    );

    return () => authSubscription.subscription.unsubscribe();
  }, []);

  return null;
}
