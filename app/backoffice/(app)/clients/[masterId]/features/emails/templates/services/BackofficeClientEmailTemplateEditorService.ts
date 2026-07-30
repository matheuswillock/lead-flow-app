import type {
  Template,
  TemplateEditorDraft,
  TemplateTestRequest,
  TemplateVersionItem,
} from "@/app/[supabaseId]/email/templates/[id]/features/context/TemplateEditorTypes"
import type {
  StudioEmailTemplateAssetUploadResult,
  StudioEmailTemplateEditorService,
  StudioEmailXPostEmbedResult,
} from "@/lib/email/studio-email-service-contracts"
import type { EmailTemplateAssetItem } from "@/lib/email/email-template-assets"
import { parseStudioEmailOutput, studioEmailBasePath } from "@/lib/email/backoffice-studio-email-api"

export class BackofficeClientEmailTemplateEditorService implements StudioEmailTemplateEditorService {
  private templatesPath(supabaseId: string, teamId: string | null | undefined): string {
    if (!teamId) throw new Error("teamId é obrigatório")
    return `${studioEmailBasePath(supabaseId, teamId)}/templates`
  }

  private settingsPath(supabaseId: string, teamId: string | null | undefined): string {
    if (!teamId) throw new Error("teamId é obrigatório")
    return `${studioEmailBasePath(supabaseId, teamId)}/settings`
  }

  private toPayload(draft: TemplateEditorDraft) {
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

  async getApprovalSettings(
    supabaseId: string,
    teamId?: string | null
  ): Promise<{ templateApprovalRequired: boolean }> {
    const response = await fetch(this.settingsPath(supabaseId, teamId))
    const settings = await parseStudioEmailOutput<{ templateApprovalRequired?: boolean }>(response)
    return { templateApprovalRequired: settings.templateApprovalRequired ?? false }
  }

  async getEmailSettingsForTips(
    supabaseId: string,
    teamId?: string | null
  ): Promise<{ fromEmail: string | null }> {
    const response = await fetch(this.settingsPath(supabaseId, teamId))
    const settings = await parseStudioEmailOutput<{ fromEmail?: string | null }>(response)
    return { fromEmail: settings.fromEmail ?? null }
  }

  async getTemplate(
    supabaseId: string,
    templateId: string,
    teamId?: string | null
  ): Promise<Template> {
    const response = await fetch(`${this.templatesPath(supabaseId, teamId)}/${templateId}`)
    return parseStudioEmailOutput<Template>(response)
  }

  async createTemplate(
    supabaseId: string,
    draft: TemplateEditorDraft,
    teamId?: string | null
  ): Promise<Template> {
    const response = await fetch(this.templatesPath(supabaseId, teamId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(this.toPayload(draft)),
    })
    return parseStudioEmailOutput<Template>(response)
  }

  async updateTemplate(
    supabaseId: string,
    templateId: string,
    draft: TemplateEditorDraft,
    teamId?: string | null
  ): Promise<Template> {
    const response = await fetch(`${this.templatesPath(supabaseId, teamId)}/${templateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(this.toPayload(draft)),
    })
    return parseStudioEmailOutput<Template>(response)
  }

  async publishTemplate(
    supabaseId: string,
    templateId: string,
    teamId?: string | null
  ): Promise<Template> {
    const response = await fetch(`${this.templatesPath(supabaseId, teamId)}/${templateId}/publish`, {
      method: "POST",
    })
    return parseStudioEmailOutput<Template>(response)
  }

  async unpublishTemplate(
    supabaseId: string,
    templateId: string,
    teamId?: string | null
  ): Promise<Template> {
    const response = await fetch(`${this.templatesPath(supabaseId, teamId)}/${templateId}/publish`, {
      method: "DELETE",
    })
    return parseStudioEmailOutput<Template>(response)
  }

  async submitForApproval(
    supabaseId: string,
    templateId: string,
    teamId?: string | null
  ): Promise<Template> {
    const response = await fetch(`${this.templatesPath(supabaseId, teamId)}/${templateId}/submit`, {
      method: "POST",
    })
    return parseStudioEmailOutput<Template>(response)
  }

  async approveTemplate(
    supabaseId: string,
    templateId: string,
    teamId?: string | null
  ): Promise<Template> {
    const response = await fetch(`${this.templatesPath(supabaseId, teamId)}/${templateId}/approve`, {
      method: "POST",
    })
    return parseStudioEmailOutput<Template>(response)
  }

  async rejectTemplate(
    supabaseId: string,
    templateId: string,
    reviewNote: string,
    teamId?: string | null
  ): Promise<Template> {
    const response = await fetch(`${this.templatesPath(supabaseId, teamId)}/${templateId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewNote }),
    })
    return parseStudioEmailOutput<Template>(response)
  }

  async sendTest(
    supabaseId: string,
    templateId: string,
    teamId: string | null | undefined,
    input: TemplateTestRequest
  ): Promise<void> {
    const response = await fetch(`${this.templatesPath(supabaseId, teamId)}/${templateId}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    await parseStudioEmailOutput<null>(response)
  }

  async listVersions(
    supabaseId: string,
    templateId: string,
    teamId?: string | null
  ): Promise<{ versions: TemplateVersionItem[] }> {
    const response = await fetch(
      `${this.templatesPath(supabaseId, teamId)}/${templateId}/versions`
    )
    return parseStudioEmailOutput<{ versions: TemplateVersionItem[] }>(response)
  }

  async restoreVersion(
    supabaseId: string,
    templateId: string,
    versionId: string,
    teamId?: string | null
  ): Promise<Template> {
    const response = await fetch(
      `${this.templatesPath(supabaseId, teamId)}/${templateId}/restore-version`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
      }
    )
    return parseStudioEmailOutput<Template>(response)
  }

  async listAssets(): Promise<{ assets: EmailTemplateAssetItem[] }> {
    return { assets: [] }
  }

  async uploadAsset(): Promise<StudioEmailTemplateAssetUploadResult> {
    throw new Error("Upload de imagens não disponível no backoffice")
  }

  async deleteAsset(): Promise<void> {
    throw new Error("Exclusão de imagens não disponível no backoffice")
  }

  async resolveXPostEmbed(): Promise<StudioEmailXPostEmbedResult> {
    throw new Error("Embed de post do X não disponível no backoffice")
  }
}
