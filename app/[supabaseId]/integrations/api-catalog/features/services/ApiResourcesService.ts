import { API_CLIENT_BASE } from "@/lib/route-map";
import type { ApiResourceActivation, ApiResourceState, IApiResourcesService } from "./IApiResourcesService";

class ApiResourcesService implements IApiResourcesService {
  private headers(supabaseId: string, teamId: string): HeadersInit {
    return { "Content-Type": "application/json", "x-supabase-user-id": supabaseId, "x-team-id": teamId };
  }

  private async unwrap<T>(response: Response, fallback: string): Promise<T> {
    const output = await response.json().catch(() => null);
    if (!response.ok || !output?.isValid) {
      const messages = Array.isArray(output?.errorMessages) ? output.errorMessages : [];
      throw new Error(messages.length > 0 ? messages.join(", ") : fallback);
    }
    return output.result as T;
  }

  async get(supabaseId: string, teamId: string, slug: string): Promise<ApiResourceState> {
    const response = await fetch(`${API_CLIENT_BASE}/integrations/api-resources/${encodeURIComponent(slug)}`, {
      method: "GET",
      headers: this.headers(supabaseId, teamId),
    });
    const result = await this.unwrap<{ activation: ApiResourceActivation | null }>(
      response,
      "Não foi possível carregar o recurso",
    );
    return { activation: result.activation };
  }

  async activate(supabaseId: string, teamId: string, slug: string) {
    const response = await fetch(`${API_CLIENT_BASE}/integrations/api-resources/${encodeURIComponent(slug)}`, {
      method: "POST",
      headers: this.headers(supabaseId, teamId),
    });
    return this.unwrap<{ activation: ApiResourceActivation; token: string }>(
      response,
      "Não foi possível gerar o token",
    );
  }

  async setStatus(supabaseId: string, teamId: string, slug: string, status: "active" | "inactive") {
    const response = await fetch(`${API_CLIENT_BASE}/integrations/api-resources/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      headers: this.headers(supabaseId, teamId),
      body: JSON.stringify({ status }),
    });
    const result = await this.unwrap<{ activation: ApiResourceActivation }>(
      response,
      "Não foi possível atualizar o recurso",
    );
    return result.activation;
  }
}

export const apiResourcesService: IApiResourcesService = new ApiResourcesService();
