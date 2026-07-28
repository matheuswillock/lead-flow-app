import type {
  CreateInboundWebhookPayload,
  CreateOutboundWebhookPayload,
  ITeamWebhooksService,
  TeamWebhookDirection,
  TeamWebhookLogResult,
  TeamWebhookStatus,
  TeamWebhookSummary,
  UpdateTeamWebhookPayload,
} from "./ITeamWebhooksService";

class TeamWebhooksService implements ITeamWebhooksService {
  private extractErrorMessage(output: unknown, fallback: string): string {
    if (!output || typeof output !== "object") return fallback;
    const errors = (output as { errorMessages?: unknown }).errorMessages;
    if (Array.isArray(errors) && errors.length > 0) {
      return errors.join(", ");
    }
    return fallback;
  }

  private headers(supabaseId: string, teamId: string): HeadersInit {
    return {
      "Content-Type": "application/json",
      "x-supabase-user-id": supabaseId,
      "x-team-id": teamId,
    };
  }

  async list(
    supabaseId: string,
    teamId: string,
    params: {
      direction: TeamWebhookDirection;
      page?: number;
      pageSize?: number;
      status?: TeamWebhookStatus;
      search?: string;
    }
  ) {
    const search = new URLSearchParams({
      direction: params.direction,
      page: String(params.page ?? 1),
      pageSize: String(params.pageSize ?? 20),
    });
    if (params.status) search.set("status", params.status);
    if (params.search?.trim()) search.set("search", params.search.trim());

    const response = await fetch(`/api/v1/integrations/webhooks?${search.toString()}`, {
      method: "GET",
      headers: this.headers(supabaseId, teamId),
    });
    const output = await response.json();
    if (!response.ok || !output?.isValid) {
      throw new Error(this.extractErrorMessage(output, "Não foi possível listar webhooks"));
    }
    return output.result;
  }

  async getById(supabaseId: string, teamId: string, id: string) {
    const response = await fetch(`/api/v1/integrations/webhooks/${id}`, {
      method: "GET",
      headers: this.headers(supabaseId, teamId),
    });
    const output = await response.json();
    if (!response.ok || !output?.isValid) {
      throw new Error(this.extractErrorMessage(output, "Não foi possível carregar o webhook"));
    }
    return output.result as TeamWebhookSummary;
  }

  async create(
    supabaseId: string,
    teamId: string,
    payload: CreateInboundWebhookPayload | CreateOutboundWebhookPayload
  ) {
    const response = await fetch(`/api/v1/integrations/webhooks`, {
      method: "POST",
      headers: this.headers(supabaseId, teamId),
      body: JSON.stringify(payload),
    });
    const output = await response.json();
    if (!response.ok || !output?.isValid) {
      throw new Error(this.extractErrorMessage(output, "Não foi possível criar o webhook"));
    }
    return output.result as TeamWebhookSummary;
  }

  async update(
    supabaseId: string,
    teamId: string,
    id: string,
    payload: UpdateTeamWebhookPayload
  ) {
    const response = await fetch(`/api/v1/integrations/webhooks/${id}`, {
      method: "PATCH",
      headers: this.headers(supabaseId, teamId),
      body: JSON.stringify(payload),
    });
    const output = await response.json();
    if (!response.ok || !output?.isValid) {
      throw new Error(this.extractErrorMessage(output, "Não foi possível atualizar o webhook"));
    }
    return output.result as TeamWebhookSummary;
  }

  async changeStatus(
    supabaseId: string,
    teamId: string,
    id: string,
    body: { status: "active" | "disabled" } | { action: "reactivate" }
  ) {
    const response = await fetch(`/api/v1/integrations/webhooks/${id}/status`, {
      method: "POST",
      headers: this.headers(supabaseId, teamId),
      body: JSON.stringify(body),
    });
    const output = await response.json();
    if (!response.ok || !output?.isValid) {
      throw new Error(this.extractErrorMessage(output, "Não foi possível alterar o status"));
    }
    return output.result as TeamWebhookSummary;
  }

  async listLogs(
    supabaseId: string,
    teamId: string,
    id: string,
    params: { page?: number; pageSize?: number; result?: TeamWebhookLogResult }
  ) {
    const search = new URLSearchParams({
      page: String(params.page ?? 1),
      pageSize: String(params.pageSize ?? 20),
    });
    if (params.result) search.set("result", params.result);

    const response = await fetch(`/api/v1/integrations/webhooks/${id}/logs?${search.toString()}`, {
      method: "GET",
      headers: this.headers(supabaseId, teamId),
    });
    const output = await response.json();
    if (!response.ok || !output?.isValid) {
      throw new Error(this.extractErrorMessage(output, "Não foi possível carregar os logs"));
    }
    return output.result;
  }

  async testDelivery(supabaseId: string, teamId: string, id: string) {
    const response = await fetch(`/api/v1/integrations/webhooks/${id}/test`, {
      method: "POST",
      headers: this.headers(supabaseId, teamId),
    });
    const output = await response.json();
    if (!response.ok || !output?.isValid) {
      throw new Error(this.extractErrorMessage(output, "Falha no envio de teste"));
    }
    return output.result;
  }
}

export const teamWebhooksService = new TeamWebhooksService();
