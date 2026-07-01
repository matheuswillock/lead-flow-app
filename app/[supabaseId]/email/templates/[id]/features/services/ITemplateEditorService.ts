import type { Template, TemplateEditorDraft, TemplateTestRequest, TemplateVersionItem } from "../context/TemplateEditorTypes";

export interface ITemplateEditorService {
  getApprovalSettings(supabaseId: string, teamId?: string | null): Promise<{ templateApprovalRequired: boolean }>;
  getEmailSettingsForTips(
    supabaseId: string,
    teamId?: string | null
  ): Promise<{ fromEmail: string | null }>;
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
  publishTemplate(
    supabaseId: string,
    templateId: string,
    teamId?: string | null
  ): Promise<Template>;
  unpublishTemplate(
    supabaseId: string,
    templateId: string,
    teamId?: string | null
  ): Promise<Template>;
  submitForApproval(
    supabaseId: string,
    templateId: string,
    teamId?: string | null
  ): Promise<Template>;
  approveTemplate(
    supabaseId: string,
    templateId: string,
    teamId?: string | null
  ): Promise<Template>;
  rejectTemplate(
    supabaseId: string,
    templateId: string,
    reviewNote: string,
    teamId?: string | null
  ): Promise<Template>;
  sendTest(
    supabaseId: string,
    templateId: string,
    teamId: string | null | undefined,
    input: TemplateTestRequest
  ): Promise<void>;
  listVersions(
    supabaseId: string,
    templateId: string,
    teamId?: string | null
  ): Promise<{ versions: TemplateVersionItem[] }>;
  restoreVersion(
    supabaseId: string,
    templateId: string,
    versionId: string,
    teamId?: string | null
  ): Promise<Template>;
}
