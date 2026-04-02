import type { BuildLeadFormUrlParams, IIntegrationsService } from "./IIntegrationsService";

class IntegrationsService implements IIntegrationsService {
  resolveAppUrl(): string {
    const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (configuredUrl) {
      return configuredUrl;
    }

    if (typeof window !== "undefined") {
      return window.location.origin;
    }

    return "";
  }

  buildLeadFormUrl({ appUrl, supabaseId, teamId }: BuildLeadFormUrlParams): string {
    if (!appUrl || !supabaseId || !teamId) {
      return "";
    }

    const normalizedAppUrl = appUrl.endsWith("/") ? appUrl.slice(0, -1) : appUrl;
    return `${normalizedAppUrl}/lead-form/${supabaseId}/${teamId}`;
  }

  async copyToClipboard(value: string): Promise<boolean> {
    if (!value || typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      return false;
    }

    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch (error) {
      console.error("[IntegrationsService] Erro ao copiar URL para clipboard:", error);
      return false;
    }
  }
}

export const integrationsService = new IntegrationsService();
