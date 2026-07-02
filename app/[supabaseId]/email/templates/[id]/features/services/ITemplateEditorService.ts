import type { Template, TemplateEditorDraft, TemplateTestRequest, TemplateVersionItem } from "../context/TemplateEditorTypes";
import type { EmailTemplateAssetItem } from "@/lib/email/email-template-assets";

export interface EmailTemplateAssetUploadResult {
  fileId: string;
  fileName: string;
  publicUrl: string;
}

export interface XPostEmbedResult {
  authorName: string;
  authorUrl: string | null;
  text: string;
  postUrl: string;
  htmlSnippet: string;
}

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
  listAssets(
    supabaseId: string,
    teamId?: string | null
  ): Promise<{ assets: EmailTemplateAssetItem[] }>;
  uploadAsset(
    supabaseId: string,
    teamId: string | null | undefined,
    file: File
  ): Promise<EmailTemplateAssetUploadResult>;
  deleteAsset(
    supabaseId: string,
    teamId: string | null | undefined,
    fileId: string
  ): Promise<void>;
  resolveXPostEmbed(
    supabaseId: string,
    teamId: string | null | undefined,
    url: string
  ): Promise<XPostEmbedResult>;
}
