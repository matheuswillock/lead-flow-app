import type {
  Template,
  TemplateEditorDraft,
  TemplateTestRequest,
  TemplateVersionItem,
} from "@/app/[supabaseId]/email/templates/[id]/features/context/TemplateEditorTypes"

export interface IBackofficeClientEmailTemplateEditorService {
  getTemplate(masterId: string, teamId: string, templateId: string): Promise<Template>
  getApprovalSettings(masterId: string, teamId: string): Promise<{ templateApprovalRequired: boolean }>
  updateTemplate(
    masterId: string,
    teamId: string,
    templateId: string,
    draft: TemplateEditorDraft
  ): Promise<Template>
  publishTemplate(masterId: string, teamId: string, templateId: string): Promise<Template>
  unpublishTemplate(masterId: string, teamId: string, templateId: string): Promise<Template>
  submitForApproval(masterId: string, teamId: string, templateId: string): Promise<Template>
  approveTemplate(masterId: string, teamId: string, templateId: string): Promise<Template>
  rejectTemplate(
    masterId: string,
    teamId: string,
    templateId: string,
    reviewNote: string
  ): Promise<Template>
  sendTest(
    masterId: string,
    teamId: string,
    templateId: string,
    input: TemplateTestRequest
  ): Promise<void>
  listVersions(
    masterId: string,
    teamId: string,
    templateId: string
  ): Promise<{ versions: TemplateVersionItem[] }>
  restoreVersion(
    masterId: string,
    teamId: string,
    templateId: string,
    versionId: string
  ): Promise<Template>
}
