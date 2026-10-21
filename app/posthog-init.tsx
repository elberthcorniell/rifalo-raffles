"use client";

import { useEffect, useRef } from "react";
import posthog from "posthog-js";
import { createClient } from "@/lib/supabase/client";

export function PostHogInit() {
  const identifiedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!posthog.__loaded) return;

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
