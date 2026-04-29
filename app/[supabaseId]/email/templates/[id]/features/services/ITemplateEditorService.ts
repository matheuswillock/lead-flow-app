import type { Template, TemplateEditorDraft } from "../context/TemplateEditorTypes";

export interface ITemplateEditorService {
  getTemplate(
    supabaseId: string,
    templateId: string,
    teamId?: string | null
  ): Promise<Template>;
  createTemplate(
    supabaseId: string,
    draft: TemplateEditorDraft,
    teamId?: string | null
  ): Promise<Template>;
  updateTemplate(
    supabaseId: string,
    templateId: string,
    draft: TemplateEditorDraft,
    teamId?: string | null
  ): Promise<Template>;
}
