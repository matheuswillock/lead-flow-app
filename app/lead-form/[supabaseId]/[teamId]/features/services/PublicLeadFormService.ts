import type {
  IPublicLeadFormService,
  PublicLeadFormBootstrapData,
  SubmitPublicLeadPayload,
  SubmitPublicLeadResult,
  AvailabilityResult,
} from "./IPublicLeadFormService";

class PublicLeadFormService implements IPublicLeadFormService {
  private resolveTrackingPayload(): Pick<
    SubmitPublicLeadPayload,
    | "source"
    | "utmSource"
    | "utmMedium"
    | "utmCampaign"
    | "utmContent"
    | "utmTerm"
    | "landingUrl"
    | "referrer"
  > {
    if (typeof window === "undefined") {
      return {};
    }

    const currentUrl = new URL(window.location.href);
    const normalize = (value: string | null): string | undefined => {
      if (!value) return undefined;
      const normalized = value.trim();
      return normalized.length > 0 ? normalized : undefined;
    };

    return {
      source: normalize(currentUrl.searchParams.get("source")),
      utmSource: normalize(currentUrl.searchParams.get("utm_source")),
      utmMedium: normalize(currentUrl.searchParams.get("utm_medium")),
      utmCampaign: normalize(currentUrl.searchParams.get("utm_campaign")),
      utmContent: normalize(currentUrl.searchParams.get("utm_content")),
      utmTerm: normalize(currentUrl.searchParams.get("utm_term")),
      landingUrl: normalize(window.location.href),
      referrer: normalize(document.referrer),
    };
  }

  async getBootstrapData(supabaseId: string, teamId: string): Promise<PublicLeadFormBootstrapData> {
    const params = new URLSearchParams({ supabaseId, teamId });
    const response = await fetch(`/api/v1/integrations/bootstrap?${params}`);
    const result = await response.json();

    if (!response.ok || !result?.isValid) {
      console.error("[PublicLeadFormService] Erro ao buscar bootstrap inicial:", result?.errorMessages);
      return { healthPlans: [], closers: [] };
    }

    return {
      healthPlans: result.result?.healthPlans ?? [],
      closers: result.result?.closers ?? [],
    };
  }

  async getAvailability(
    supabaseId: string,
    teamId: string,
    closerId: string,
    date: string
  ): Promise<AvailabilityResult> {
    const response = await fetch("/api/v1/integrations/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supabaseId, teamId, closerId, date }),
    });
    const result = await response.json();

    if (!response.ok || !result?.isValid) {
      console.error("[PublicLeadFormService] Erro ao buscar disponibilidade:", result?.errorMessages);
      return { availableTimes: [], source: "internal" };
    }

    return {
      availableTimes: result.result?.availableTimes ?? [],
      source: result.result?.source ?? "internal",
    };
  }

  async submitLead(payload: SubmitPublicLeadPayload): Promise<SubmitPublicLeadResult> {
    const trackingPayload = this.resolveTrackingPayload();

    const response = await fetch("/api/v1/integrations/lead-form", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        ...trackingPayload,
      }),
    });
    const result = await response.json();

    return {
      isValid: result?.isValid ?? false,
      successMessages: result?.successMessages ?? [],
      errorMessages: result?.errorMessages ?? [],
    };
  }
}

export const publicLeadFormService = new PublicLeadFormService();
