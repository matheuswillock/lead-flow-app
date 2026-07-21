import type {
  IPublicLeadFormService,
  PublicLeadFormBootstrapData,
  SubmitPublicLeadPayload,
  SubmitPublicLeadResult,
  AvailabilityResult,
  PreScheduleSlotsResult,
} from "./IPublicLeadFormService";
import { DEFAULT_TZ } from "@/lib/dates";

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

  async getBootstrapData(teamId: string, supabaseId?: string): Promise<PublicLeadFormBootstrapData> {
    const params = new URLSearchParams({ teamId });
    if (supabaseId) {
      params.set("supabaseId", supabaseId);
    }

    const response = await fetch(`/api/v1/integrations/bootstrap?${params}`);
    const result = await response.json();

    if (!response.ok || !result?.isValid) {
      const message =
        Array.isArray(result?.errorMessages) && result.errorMessages.length > 0
          ? result.errorMessages.join(", ")
          : "Erro ao carregar dados iniciais do formulário.";
      throw new Error(message);
    }

    return {
      teamName: result.result?.teamName ?? "",
      healthPlans: result.result?.healthPlans ?? [],
      closers: result.result?.closers ?? [],
      sdrs: result.result?.sdrs ?? [],
      guestCandidates: result.result?.guestCandidates ?? [],
      timezone: result.result?.timezone ?? DEFAULT_TZ,
      hasTransferTargets: result.result?.hasTransferTargets ?? false,
      customFieldDefinitions: Array.isArray(result.result?.customFieldDefinitions)
        ? result.result.customFieldDefinitions
        : [],
    };
  }

  async getAvailability(
    teamId: string,
    closerId: string,
    date: string,
    supabaseId?: string
  ): Promise<AvailabilityResult> {
    const payload = supabaseId ? { supabaseId, teamId, closerId, date } : { teamId, closerId, date };
    const response = await fetch("/api/v1/integrations/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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

  async getPreScheduleSlots(teamId: string, date: string, supabaseId?: string): Promise<PreScheduleSlotsResult> {
    const params = new URLSearchParams({ teamId, date });
    if (supabaseId) {
      params.set("supabaseId", supabaseId);
    }

    const response = await fetch(`/api/v1/integrations/pre-schedule-slots?${params}`);
    const result = await response.json();

    if (!response.ok || !result?.isValid) {
      console.error("[PublicLeadFormService] Erro ao buscar slots de pré-agendamento:", result?.errorMessages);
      return { occupiedSlots: [] };
    }

    return { occupiedSlots: result.result?.occupiedSlots ?? [] };
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
      lead: result?.result ?? null,
    };
  }
}

export const publicLeadFormService = new PublicLeadFormService();
