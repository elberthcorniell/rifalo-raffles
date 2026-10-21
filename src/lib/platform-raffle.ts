import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantUrl } from "@/lib/constants";
import { getTicketCounts, listRaffleBundles, mapRaffle } from "@/lib/raffles";
import { normalizeCheckoutFields, type CheckoutFields } from "@/types/org";
import type { DbRaffle, Raffle } from "@/types/raffle";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PlatformRafflePayload = {
  raffle: Raffle;
  currency: string;
  org: {
    id: string;
    name: string;
    slug: string;
    checkoutFields: CheckoutFields;
    siteUrl: string;
    raffleUrl: string;
  };
};

export type PlatformRaffleResult =
  | { kind: "ready"; data: PlatformRafflePayload }
  | { kind: "error"; error: string; status: number };

export const getVerifiedPlatformRaffle = cache(
  async (id: string): Promise<PlatformRaffleResult> => {
    if (!UUID_RE.test(id)) {
      return { kind: "error", error: "ID inválido", status: 400 };
    }

    try {
      const supabase = createAdminClient();
      const { data: raffle, error } = await supabase
        .from("raffles")
        .select("*")
        .eq("id", id)
        .eq("status", "active")
        .eq("verification_status", "verified")
        .maybeSingle();

      if (error) throw error;
      if (!raffle) {
        return {
          kind: "error",
          error: "Rifa no encontrada o no disponible",
          status: 404,
        };
      }

      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("id, name, slug, checkout_fields")
        .eq("id", raffle.org_id)
        .maybeSingle();

      if (orgError) throw orgError;
      if (!org?.slug) {
        return {
          kind: "error",
          error: "Organización no encontrada",
          status: 404,
        };
      }

      const [counts, bundles] = await Promise.all([
        getTicketCounts([id]),
        listRaffleBundles(supabase, [id]),
      ]);

      const row = raffle as DbRaffle;
      return {
        kind: "ready",
        data: {
          currency: row.currency || "DOP",
          raffle: {
            ...mapRaffle(row, counts[id]),
            bundles: bundles[id] || [],
          },
          org: {
            id: org.id,
            name: org.name,
            slug: org.slug,
            checkoutFields: normalizeCheckoutFields(org.checkout_fields),
            siteUrl: getTenantUrl(org.slug),
            raffleUrl: getTenantUrl(org.slug, `/raffles/${id}`),
          },
        },
      };
    } catch (error) {
      console.error("Error fetching platform raffle:", error);
      return {
        kind: "error",
        error: "Error al cargar la rifa",
        status: 500,
      };
    }
  },
);
