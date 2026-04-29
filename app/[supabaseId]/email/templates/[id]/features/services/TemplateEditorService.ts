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

  private toPayload(draft: TemplateEditorDraft) {
    return {
      name: draft.name,
      subject: draft.subject,
      previewText: draft.previewText,
      html: draft.html,
      mailyJson: draft.mailyJson,
    };
  }
}

export function createTemplateEditorService(): ITemplateEditorService {
  return new TemplateEditorService();
}
