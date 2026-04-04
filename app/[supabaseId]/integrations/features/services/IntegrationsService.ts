import type {
  BuildLeadFormUrlParams,
  BuildStudioWebhookUrlParams,
  IIntegrationsService,
  SaveStudioWebhookConfigPayload,
  SaveStudioWebhookConfigResponse,
  StudioWebhookConfigResponse,
} from "./IIntegrationsService";

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

  buildLeadFormUrl({ appUrl, teamId }: BuildLeadFormUrlParams): string {
    if (!appUrl || !teamId) {
      return "";
    }

    const normalizedAppUrl = appUrl.endsWith("/") ? appUrl.slice(0, -1) : appUrl;
    return `${normalizedAppUrl}/lead-form/${teamId}`;
  }

  buildStudioWebhookUrl({ appUrl, teamId, token }: BuildStudioWebhookUrlParams): string {
    if (!appUrl || !teamId || !token) {
      return "";
    }

    const normalizedAppUrl = appUrl.endsWith("/") ? appUrl.slice(0, -1) : appUrl;
    return `${normalizedAppUrl}/api/webhooks/studio/${teamId}/${token}`;
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

  private extractErrorMessage(output: any, fallback: string): string {
    if (!output) return fallback;
    const errors = Array.isArray(output.errorMessages) ? output.errorMessages : [];
    if (errors.length > 0) {
      return errors.join(", ");
    }

    return fallback;
  }

  async getStudioWebhookConfig(supabaseId: string, teamId: string): Promise<StudioWebhookConfigResponse> {
    const response = await fetch(`/api/v1/integrations/studio-webhook?teamId=${encodeURIComponent(teamId)}`, {
      method: "GET",
      headers: {
        "x-supabase-user-id": supabaseId,
        "x-team-id": teamId,
      },
    });

    const output = await response.json();
    if (!response.ok || !output?.isValid) {
      throw new Error(this.extractErrorMessage(output, "Não foi possível carregar configuração do webhook"));
    }

    return output.result as StudioWebhookConfigResponse;
  }

  async saveStudioWebhookConfig(
    supabaseId: string,
    payload: SaveStudioWebhookConfigPayload
  ): Promise<SaveStudioWebhookConfigResponse> {
    const response = await fetch("/api/v1/integrations/studio-webhook", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-supabase-user-id": supabaseId,
        "x-team-id": payload.teamId,
      },
      body: JSON.stringify(payload),
    });

    const output = await response.json();
    if (!response.ok || !output?.isValid) {
      throw new Error(this.extractErrorMessage(output, "Não foi possível salvar configuração do webhook"));
    }

    return output.result as SaveStudioWebhookConfigResponse;
  }
}

export const integrationsService = new IntegrationsService();
