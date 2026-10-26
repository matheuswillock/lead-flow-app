import {
  type GetStudioWebhookLogsResponse,
  type GetRadarPixelHitLogsResponse,
  type IntegrationsBootstrapResponse,
  type IIntegrationsService,
  type RadarPixelConfigData,
  type SaveRadarPixelConfigPayload,
  type SaveStudioWebhookConfigPayload,
  type SaveStudioWebhookConfigResponse,
  StudioWebhookRotationRequiresConfirmationError,
} from "./IIntegrationsService";
import { API_CLIENT_BASE } from "@/lib/route-map";

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

  async getStudioWebhookConfig(supabaseId: string, teamId: string): Promise<IntegrationsBootstrapResponse> {
    const response = await fetch(`${API_CLIENT_BASE}/integrations/studio-webhook?teamId=${encodeURIComponent(teamId)}`, {
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

    return output.result as IntegrationsBootstrapResponse;
  }

  async getStudioWebhookLogs(supabaseId: string, teamId: string): Promise<GetStudioWebhookLogsResponse> {
    const response = await fetch(`${API_CLIENT_BASE}/integrations/studio-webhook/logs?teamId=${encodeURIComponent(teamId)}`, {
      method: "GET",
      headers: {
        "x-supabase-user-id": supabaseId,
        "x-team-id": teamId,
      },
    });

    const output = await response.json();
    if (!response.ok || !output?.isValid) {
      throw new Error(this.extractErrorMessage(output, "Não foi possível carregar os logs do webhook"));
    }

    return output.result as GetStudioWebhookLogsResponse;
  }

  async saveStudioWebhookConfig(
    supabaseId: string,
    payload: SaveStudioWebhookConfigPayload
  ): Promise<SaveStudioWebhookConfigResponse> {
    const response = await fetch(`${API_CLIENT_BASE}/integrations/studio-webhook`, {
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
      if (response.status === 409) {
        throw new StudioWebhookRotationRequiresConfirmationError();
      }
      throw new Error(this.extractErrorMessage(output, "Não foi possível salvar configuração do webhook"));
    }

    return output.result as SaveStudioWebhookConfigResponse;
  }

  async getRadarPixelConfig(supabaseId: string, teamId: string): Promise<RadarPixelConfigData> {
    const response = await fetch(`/api/v1/radar/pixel?teamId=${encodeURIComponent(teamId)}`, {
      method: "GET",
      headers: {
        "x-supabase-user-id": supabaseId,
        "x-team-id": teamId,
      },
    });

    const output = await response.json();
    if (!response.ok || !output?.isValid) {
      throw new Error(this.extractErrorMessage(output, "Não foi possível carregar configuração do pixel"));
    }

    return output.result as RadarPixelConfigData;
  }

  async saveRadarPixelConfig(
    supabaseId: string,
    teamId: string,
    payload: SaveRadarPixelConfigPayload
  ): Promise<RadarPixelConfigData> {
    const response = await fetch("/api/v1/radar/pixel", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-supabase-user-id": supabaseId,
        "x-team-id": teamId,
      },
      body: JSON.stringify(payload),
    });

    const output = await response.json();
    if (!response.ok || !output?.isValid) {
      throw new Error(this.extractErrorMessage(output, "Não foi possível salvar configuração do pixel"));
    }

    return output.result as RadarPixelConfigData;
  }

  async deleteRadarPixelConfig(supabaseId: string, teamId: string): Promise<void> {
    const response = await fetch("/api/v1/radar/pixel", {
      method: "DELETE",
      headers: {
        "x-supabase-user-id": supabaseId,
        "x-team-id": teamId,
      },
    });

    const output = await response.json();
    if (!response.ok || !output?.isValid) {
      throw new Error(this.extractErrorMessage(output, "Não foi possível remover configuração do pixel"));
    }
  }

  async getRadarPixelHitLogs(supabaseId: string, teamId: string): Promise<GetRadarPixelHitLogsResponse> {
    const response = await fetch(`/api/v1/radar/pixel/logs?teamId=${encodeURIComponent(teamId)}`, {
      method: "GET",
      headers: {
        "x-supabase-user-id": supabaseId,
        "x-team-id": teamId,
      },
    });

    const output = await response.json();
    if (!response.ok || !output?.isValid) {
      throw new Error(this.extractErrorMessage(output, "Não foi possível carregar os logs do pixel"));
    }

    return output.result as GetRadarPixelHitLogsResponse;
  }
}

export const integrationsService = new IntegrationsService();
