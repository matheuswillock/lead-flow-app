import type { MetaLeadIntegration, WhatsAppIntegration, IntegrationTeamMember } from "../context/IntegrationTypes";

interface OutputResponse<T> {
  isValid: boolean;
  successMessages: string[];
  errorMessages: string[];
  result: T;
}

export class IntegrationService {
  private buildHeaders(supabaseId?: string, includeJson?: boolean) {
    return {
      ...(includeJson ? { "Content-Type": "application/json" } : {}),
      ...(supabaseId ? { "x-supabase-user-id": supabaseId } : {})
    };
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    const data = (await response.json()) as OutputResponse<T>;
    if (!response.ok || !data.isValid) {
      const message = data?.errorMessages?.join(", ") || "Erro ao processar";
      throw new Error(message);
    }
    return data.result;
  }

  async getMetaIntegrations(supabaseId: string, teamId?: string | null): Promise<MetaLeadIntegration[]> {
    const params = new URLSearchParams();
    if (teamId) params.set("teamId", teamId);

    const response = await fetch(`/api/v1/integrations/meta-leads?${params.toString()}`, {
      headers: this.buildHeaders(supabaseId)
    });
    return this.handleResponse<MetaLeadIntegration[]>(response);
  }

  async createMetaIntegration(supabaseId: string, payload: any): Promise<MetaLeadIntegration> {
    const response = await fetch("/api/v1/integrations/meta-leads", {
      method: "POST",
      headers: this.buildHeaders(supabaseId, true),
      body: JSON.stringify(payload)
    });
    return this.handleResponse<MetaLeadIntegration>(response);
  }

  async updateMetaIntegration(supabaseId: string, id: string, payload: any): Promise<MetaLeadIntegration> {
    const response = await fetch(`/api/v1/integrations/meta-leads/${id}`, {
      method: "PUT",
      headers: this.buildHeaders(supabaseId, true),
      body: JSON.stringify(payload)
    });
    return this.handleResponse<MetaLeadIntegration>(response);
  }

  async testMetaIntegration(supabaseId: string, pageId?: string | null): Promise<{ pageId: string; totalForms: number }> {
    const response = await fetch("/api/v1/integrations/meta-leads/test", {
      method: "POST",
      headers: this.buildHeaders(supabaseId, true),
      body: JSON.stringify({ pageId })
    });
    return this.handleResponse<{ pageId: string; totalForms: number }>(response);
  }

  async getWhatsAppIntegrations(supabaseId: string, teamId?: string | null): Promise<WhatsAppIntegration[]> {
    const params = new URLSearchParams();
    if (teamId) params.set("teamId", teamId);

    const response = await fetch(`/api/v1/integrations/whatsapp?${params.toString()}`, {
      headers: this.buildHeaders(supabaseId)
    });
    return this.handleResponse<WhatsAppIntegration[]>(response);
  }

  async createWhatsAppIntegration(supabaseId: string, payload: any): Promise<WhatsAppIntegration> {
    const response = await fetch("/api/v1/integrations/whatsapp", {
      method: "POST",
      headers: this.buildHeaders(supabaseId, true),
      body: JSON.stringify(payload)
    });
    return this.handleResponse<WhatsAppIntegration>(response);
  }

  async updateWhatsAppIntegration(supabaseId: string, id: string, payload: any): Promise<WhatsAppIntegration> {
    const response = await fetch(`/api/v1/integrations/whatsapp/${id}`, {
      method: "PUT",
      headers: this.buildHeaders(supabaseId, true),
      body: JSON.stringify(payload)
    });
    return this.handleResponse<WhatsAppIntegration>(response);
  }

  async testWhatsAppIntegration(supabaseId: string, phoneNumberId?: string | null): Promise<{ phoneNumberId: string; displayPhoneNumber?: string; verifiedName?: string }> {
    const response = await fetch("/api/v1/integrations/whatsapp/test", {
      method: "POST",
      headers: this.buildHeaders(supabaseId, true),
      body: JSON.stringify({ phoneNumberId })
    });
    return this.handleResponse<{ phoneNumberId: string; displayPhoneNumber?: string; verifiedName?: string }>(response);
  }

  async getTeamMembers(supabaseId: string, teamId?: string | null): Promise<IntegrationTeamMember[]> {
    const params = new URLSearchParams();
    if (teamId) params.set("teamId", teamId);

    const response = await fetch(`/api/v1/manager/${supabaseId}/users?${params.toString()}`, {
      headers: this.buildHeaders(supabaseId)
    });
    const data = (await response.json()) as any;
    if (!response.ok || !data.isValid) {
      return [];
    }

    return (data.result || data).map((member: any) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role
    }));
  }
}

export const integrationService = new IntegrationService();
