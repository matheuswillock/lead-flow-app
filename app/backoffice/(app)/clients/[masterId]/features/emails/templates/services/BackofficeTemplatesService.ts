import type { Template } from "@/app/[supabaseId]/email/templates/features/context/TemplatesTypes"
import type {
  StudioEmailCreateTemplateData,
  StudioEmailTemplatesService,
} from "@/lib/email/studio-email-service-contracts"
import { parseStudioEmailOutput, studioEmailBasePath } from "@/lib/email/backoffice-studio-email-api"

export class BackofficeTemplatesService implements StudioEmailTemplatesService {
  private templatesPath(supabaseId: string, teamId: string | null | undefined): string {
    if (!teamId) throw new Error("teamId é obrigatório")
    return `${studioEmailBasePath(supabaseId, teamId)}/templates`
  }

  private settingsPath(supabaseId: string, teamId: string | null | undefined): string {
    if (!teamId) throw new Error("teamId é obrigatório")
    return `${studioEmailBasePath(supabaseId, teamId)}/settings`
  }

  async getApprovalSettings(
    supabaseId: string,
    teamId?: string | null
  ): Promise<{ templateApprovalRequired: boolean }> {
    const response = await fetch(this.settingsPath(supabaseId, teamId))
    const settings = await parseStudioEmailOutput<{ templateApprovalRequired?: boolean }>(response)
    return { templateApprovalRequired: settings.templateApprovalRequired ?? false }
  }

  async list(supabaseId: string, teamId?: string | null): Promise<Template[]> {
    const response = await fetch(this.templatesPath(supabaseId, teamId))
    return parseStudioEmailOutput<Template[]>(response)
  }

  async create(
    supabaseId: string,
    data: StudioEmailCreateTemplateData,
    teamId?: string | null
  ): Promise<Template> {
    const response = await fetch(this.templatesPath(supabaseId, teamId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    return parseStudioEmailOutput<Template>(response)
  }

  async delete(supabaseId: string, id: string, teamId?: string | null): Promise<void> {
    const response = await fetch(`${this.templatesPath(supabaseId, teamId)}/${id}`, {
      method: "DELETE",
    })
    if (!response.ok) await parseStudioEmailOutput<unknown>(response)
  }

  async submitForApproval(
    supabaseId: string,
    id: string,
    teamId?: string | null
  ): Promise<Template> {
    const response = await fetch(`${this.templatesPath(supabaseId, teamId)}/${id}/submit`, {
      method: "POST",
    })
    return parseStudioEmailOutput<Template>(response)
  }

  async approve(supabaseId: string, id: string, teamId?: string | null): Promise<Template> {
    const response = await fetch(`${this.templatesPath(supabaseId, teamId)}/${id}/approve`, {
      method: "POST",
    })
    return parseStudioEmailOutput<Template>(response)
  }

  async reject(
    supabaseId: string,
    id: string,
    reviewNote: string,
    teamId?: string | null
  ): Promise<Template> {
    const response = await fetch(`${this.templatesPath(supabaseId, teamId)}/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewNote }),
    })
    return parseStudioEmailOutput<Template>(response)
  }
}
