import type { StudioEmailTemplateDetail } from "../context/BackofficeClientEmailTemplateEditorTypes"

export interface IBackofficeClientEmailTemplateEditorService {
  getTemplate(masterId: string, teamId: string, templateId: string): Promise<StudioEmailTemplateDetail>
  updateTemplate(
    masterId: string,
    teamId: string,
    templateId: string,
    data: { name: string; subject: string; html: string }
  ): Promise<StudioEmailTemplateDetail>
}
