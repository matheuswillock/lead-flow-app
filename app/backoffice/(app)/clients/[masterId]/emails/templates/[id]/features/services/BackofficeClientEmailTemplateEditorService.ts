import type {
  Template,
  TemplateApprovalStatus,
  TemplateEditorDraft,
  TemplateStatus,
  TemplateTestRequest,
  TemplateVariable,
} from "@/app/[supabaseId]/email/templates/[id]/features/context/TemplateEditorTypes"
import { backofficeStudioEmailService } from "@/app/backoffice/(app)/clients/[masterId]/features/emails/services/BackofficeStudioEmailService"
import type { StudioEmailTemplate } from "@/app/backoffice/(app)/clients/[masterId]/features/emails/services/IBackofficeStudioEmailService"
import type { IBackofficeClientEmailTemplateEditorService } from "./IBackofficeClientEmailTemplateEditorService"

function toPayload(draft: TemplateEditorDraft) {
  return {
    name: draft.name,
    subject: draft.subject,
    previewText: draft.previewText,
    html: draft.html,
    mailyJson: draft.mailyJson,
    editorMode: draft.editorMode,
    variables: draft.variables,
  }
}

function mapStudioTemplateToTemplate(raw: StudioEmailTemplate): Template {
  return {
    id: raw.id,
    versionGroupId: raw.id,
    versionNumber: 1,
    isCurrentPublished: raw.isCurrentPublished ?? raw.status === "published",
    name: raw.name,
    subject: raw.subject,
    previewText: raw.previewText ?? null,
    mailyJson: raw.mailyJson ?? null,
    html: raw.html ?? null,
    editorMode: "html",
    variables: (raw.variables as TemplateVariable[]) ?? [],
    status: raw.status as TemplateStatus,
    approvalStatus: (raw.approvalStatus ?? "approved") as TemplateApprovalStatus,
    reviewNote: null,
    approvedAt: null,
    rejectedAt: null,
    publishedAt: null,
    createdAt: raw.updatedAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
    history: [],
  }
}

export class BackofficeClientEmailTemplateEditorService
  implements IBackofficeClientEmailTemplateEditorService
{
  async getTemplate(masterId: string, teamId: string, templateId: string) {
    const result = await backofficeStudioEmailService.getTemplate(masterId, teamId, templateId)
    return mapStudioTemplateToTemplate(result)
  }

  async getApprovalSettings(masterId: string, teamId: string) {
    const settings = await backofficeStudioEmailService.getSettings(masterId, teamId)
    return { templateApprovalRequired: settings.templateApprovalRequired ?? false }
  }

  async updateTemplate(
    masterId: string,
    teamId: string,
    templateId: string,
    draft: TemplateEditorDraft
  ) {
    const result = await backofficeStudioEmailService.updateTemplate(
      masterId,
      teamId,
      templateId,
      toPayload(draft)
    )
    return mapStudioTemplateToTemplate(result)
  }

  async publishTemplate(masterId: string, teamId: string, templateId: string) {
    const result = await backofficeStudioEmailService.publishTemplate(masterId, teamId, templateId)
    return mapStudioTemplateToTemplate(result)
  }

  async unpublishTemplate(masterId: string, teamId: string, templateId: string) {
    const result = await backofficeStudioEmailService.unpublishTemplate(masterId, teamId, templateId)
    return mapStudioTemplateToTemplate(result)
  }

  async submitForApproval(masterId: string, teamId: string, templateId: string) {
    const result = await backofficeStudioEmailService.submitTemplate(masterId, teamId, templateId)
    return mapStudioTemplateToTemplate(result)
  }

  async approveTemplate(masterId: string, teamId: string, templateId: string) {
    const result = await backofficeStudioEmailService.approveTemplate(masterId, teamId, templateId)
    return mapStudioTemplateToTemplate(result)
  }

  async rejectTemplate(
    masterId: string,
    teamId: string,
    templateId: string,
    reviewNote: string
  ) {
    const result = await backofficeStudioEmailService.rejectTemplate(
      masterId,
      teamId,
      templateId,
      reviewNote
    )
    return mapStudioTemplateToTemplate(result)
  }

  async sendTest(
    masterId: string,
    teamId: string,
    templateId: string,
    input: TemplateTestRequest
  ) {
    const variables: Record<string, string> = {}
    for (const variable of input.variables) {
      variables[variable.key] = variable.value
    }
    await backofficeStudioEmailService.testTemplate(masterId, teamId, templateId, {
      to: input.to,
      variables,
    })
  }

  async listVersions(masterId: string, teamId: string, templateId: string) {
    const result = await backofficeStudioEmailService.listTemplateVersions(
      masterId,
      teamId,
      templateId
    )
    return {
      versions: result.versions.map((version) => ({
        id: version.id,
        versionNumber: version.versionNumber,
        name: "",
        subject: "",
        publishedAt: null,
        approvedAt: null,
        createdAt: version.createdAt,
        creator: {
          id: "",
          fullName: version.createdBy?.fullName ?? null,
          email: version.createdBy?.email ?? null,
        },
        approver: null,
      })),
    }
  }

  async restoreVersion(
    masterId: string,
    teamId: string,
    templateId: string,
    versionId: string
  ) {
    const result = await backofficeStudioEmailService.restoreTemplateVersion(
      masterId,
      teamId,
      templateId,
      versionId
    )
    return mapStudioTemplateToTemplate(result)
  }
}

export const backofficeClientEmailTemplateEditorService =
  new BackofficeClientEmailTemplateEditorService()
