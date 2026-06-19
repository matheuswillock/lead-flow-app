import type { Template, TemplateEditorDraft } from "../context/TemplateEditorTypes";
import type { ITemplateEditorService } from "./ITemplateEditorService";

type ApiOutput<T> = {
  isValid: boolean;
  successMessages?: string[];
  errorMessages?: string[];
  result: T;
};

class TemplateEditorService implements ITemplateEditorService {
  private readonly baseUrl = "/api/v1/email/templates";
  private readonly settingsUrl = "/api/v1/email/settings";

  private buildHeaders(supabaseId: string, teamId?: string | null): HeadersInit {
    return {
      "Content-Type": "application/json",
      "x-supabase-user-id": supabaseId,
      ...(teamId ? { "x-team-id": teamId } : {}),
    };
  }

  private async parseResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
    const body = (await response.json().catch(() => null)) as ApiOutput<T> | null;
    if (!response.ok || !body?.isValid) {
      const message = body?.errorMessages?.join(", ") || fallbackMessage;
      throw new Error(message);
    }

    return body.result;
  }

  async getTemplate(
    supabaseId: string,
    templateId: string,
    teamId?: string | null
  ): Promise<Template> {
    console.info("[TemplateEditorService] Fetching template", templateId);
    const response = await fetch(`${this.baseUrl}/${templateId}`, {
      cache: "no-store",
      headers: this.buildHeaders(supabaseId, teamId),
    });

    return this.parseResponse<Template>(response, "Erro ao buscar template");
  }

  async getApprovalSettings(
    supabaseId: string,
    teamId?: string | null
  ): Promise<{ templateApprovalRequired: boolean }> {
    const response = await fetch(this.settingsUrl, {
      cache: "no-store",
      headers: this.buildHeaders(supabaseId, teamId),
    });
    const settings = await this.parseResponse<{ templateApprovalRequired?: boolean }>(
      response,
      "Erro ao buscar configurações de aprovação"
    );

    return { templateApprovalRequired: settings.templateApprovalRequired ?? false };
  }

  async createTemplate(
    supabaseId: string,
    draft: TemplateEditorDraft,
    teamId?: string | null
  ): Promise<Template> {
    console.info("[TemplateEditorService] Creating template", draft.name);
    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: this.buildHeaders(supabaseId, teamId),
      body: JSON.stringify(this.toPayload(draft)),
    });

    return this.parseResponse<Template>(response, "Erro ao criar template");
  }

  async updateTemplate(
    supabaseId: string,
    templateId: string,
    draft: TemplateEditorDraft,
    teamId?: string | null
  ): Promise<Template> {
    console.info("[TemplateEditorService] Updating template", templateId);
    const response = await fetch(`${this.baseUrl}/${templateId}`, {
      method: "PATCH",
      headers: this.buildHeaders(supabaseId, teamId),
      body: JSON.stringify(this.toPayload(draft)),
    });

    return this.parseResponse<Template>(response, "Erro ao atualizar template");
  }

  async publishTemplate(
    supabaseId: string,
    templateId: string,
    teamId?: string | null
  ): Promise<Template> {
    console.info("[TemplateEditorService] Publishing template", templateId);
    const response = await fetch(`${this.baseUrl}/${templateId}/publish`, {
      method: "POST",
      headers: this.buildHeaders(supabaseId, teamId),
    });

    return this.parseResponse<Template>(response, "Erro ao publicar template");
  }

  async unpublishTemplate(
    supabaseId: string,
    templateId: string,
    teamId?: string | null
  ): Promise<Template> {
    console.info("[TemplateEditorService] Unpublishing template", templateId);
    const response = await fetch(`${this.baseUrl}/${templateId}/publish`, {
      method: "DELETE",
      headers: this.buildHeaders(supabaseId, teamId),
    });

    return this.parseResponse<Template>(response, "Erro ao despublicar template");
  }

  async submitForApproval(
    supabaseId: string,
    templateId: string,
    teamId?: string | null
  ): Promise<Template> {
    console.info("[TemplateEditorService] Submitting for approval", templateId);
    const response = await fetch(`${this.baseUrl}/${templateId}/submit`, {
      method: "POST",
      headers: this.buildHeaders(supabaseId, teamId),
    });

    return this.parseResponse<Template>(response, "Erro ao enviar para aprovação");
  }

  async approveTemplate(
    supabaseId: string,
    templateId: string,
    teamId?: string | null
  ): Promise<Template> {
    console.info("[TemplateEditorService] Approving template", templateId);
    const response = await fetch(`${this.baseUrl}/${templateId}/approve`, {
      method: "POST",
      headers: this.buildHeaders(supabaseId, teamId),
    });

    return this.parseResponse<Template>(response, "Erro ao aprovar template");
  }

  async rejectTemplate(
    supabaseId: string,
    templateId: string,
    reviewNote: string,
    teamId?: string | null
  ): Promise<Template> {
    console.info("[TemplateEditorService] Rejecting template", templateId);
    const response = await fetch(`${this.baseUrl}/${templateId}/reject`, {
      method: "POST",
      headers: this.buildHeaders(supabaseId, teamId),
      body: JSON.stringify({ reviewNote }),
    });

    return this.parseResponse<Template>(response, "Erro ao recusar template");
  }

  private toPayload(draft: TemplateEditorDraft) {
    return {
      name: draft.name,
      subject: draft.subject,
      previewText: draft.previewText,
      html: draft.html,
      mailyJson: draft.mailyJson,
      variables: draft.variables,
    };
  }
}

export function createTemplateEditorService(): ITemplateEditorService {
  return new TemplateEditorService();
}
