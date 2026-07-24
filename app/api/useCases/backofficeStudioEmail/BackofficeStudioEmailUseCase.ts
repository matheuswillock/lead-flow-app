import { Output } from "@/lib/output"
import type { BackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { buildStudioEmailTeamContext } from "@/app/api/v1/backoffice/utils/buildStudioEmailTeamContext"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import {
  EmailCampaignUseCase,
  type CreateCampaignInput,
} from "@/app/api/useCases/email/EmailCampaignUseCase"
import { EmailContactListUseCase } from "@/app/api/useCases/email/EmailContactListUseCase"
import { EmailContactImportUseCase } from "@/app/api/useCases/email/EmailContactImportUseCase"
import { EmailTemplateUseCase } from "@/app/api/useCases/email/EmailTemplateUseCase"
import { emailAnalyticsUseCase } from "@/app/api/useCases/email/EmailAnalyticsUseCase"
import { EmailTeamSettingsUseCase } from "@/app/api/useCases/email/EmailTeamSettingsUseCase"
import { EmailTeamVariablesUseCase } from "@/app/api/useCases/email/EmailTeamVariablesUseCase"
import { backofficeStudioEmailRepository } from "@/app/api/infra/data/repositories/backoffice/studioEmail/BackofficeStudioEmailRepository"

export type StudioEmailActor = {
  access: BackofficeAccess
  masterId: string
  teamId: string
}

type ManagedRow = Record<string, unknown> & { managedByBackofficeUserId?: string | null }

function withManagedFlag<T extends ManagedRow>(row: T): Omit<T, "managedByBackofficeUserId"> & {
  managedByCorretorStudio: boolean
} {
  const { managedByBackofficeUserId, managedByCorretorStudio, ...rest } = row as ManagedRow & {
    managedByCorretorStudio?: boolean
  }
  return {
    ...(rest as Omit<T, "managedByBackofficeUserId">),
    managedByCorretorStudio:
      typeof managedByCorretorStudio === "boolean"
        ? managedByCorretorStudio
        : Boolean(managedByBackofficeUserId),
  }
}

function mapResultManaged(result: unknown): unknown {
  if (result == null) return result
  if (Array.isArray(result)) {
    return result.map((item) =>
      item && typeof item === "object" ? withManagedFlag(item as ManagedRow) : item
    )
  }
  if (typeof result === "object") {
    const obj = result as Record<string, unknown>
    const listKeys = ["items", "campaigns", "lists", "templates"] as const
    for (const key of listKeys) {
      if (Array.isArray(obj[key])) {
        return {
          ...obj,
          [key]: (obj[key] as unknown[]).map((item) =>
            item && typeof item === "object" ? withManagedFlag(item as ManagedRow) : item
          ),
        }
      }
    }
    return withManagedFlag(obj as ManagedRow)
  }
  return result
}

function decorateOutput(output: Output): Output {
  return new Output(
    output.isValid,
    output.successMessages,
    output.errorMessages,
    mapResultManaged(output.result)
  )
}

async function resolveCtx(actor: StudioEmailActor): Promise<
  | { ctx: TeamAccess; error?: never; status?: never }
  | { ctx?: never; error: Output; status: number }
> {
  const built = await buildStudioEmailTeamContext(actor.masterId, actor.teamId)
  if (built.error) return { error: built.error, status: built.status }
  return { ctx: built.ctx }
}

function extractId(result: unknown): string | null {
  if (result && typeof result === "object" && "id" in result && typeof (result as { id: unknown }).id === "string") {
    return (result as { id: string }).id
  }
  return null
}

async function stampCampaignTree(campaignId: string, backofficeUserId: string | null, teamId: string) {
  if (!backofficeUserId) return
  await backofficeStudioEmailRepository.stampCampaignTree(campaignId, backofficeUserId, teamId)
}

async function stampContactList(id: string, backofficeUserId: string | null) {
  if (!backofficeUserId) return
  await backofficeStudioEmailRepository.stampContactList(id, backofficeUserId)
}

async function stampTemplate(id: string, backofficeUserId: string | null) {
  if (!backofficeUserId) return
  await backofficeStudioEmailRepository.stampTemplate(id, backofficeUserId)
}

async function stampImportJob(importId: string, backofficeUserId: string | null) {
  if (!backofficeUserId) return
  await backofficeStudioEmailRepository.stampImportJob(importId, backofficeUserId)
}

export class BackofficeStudioEmailUseCase {
  private campaigns = new EmailCampaignUseCase()
  private contactLists = new EmailContactListUseCase()
  private contactImport = new EmailContactImportUseCase()
  private templates = new EmailTemplateUseCase()
  private settings = new EmailTeamSettingsUseCase()
  private variables = new EmailTeamVariablesUseCase()

  async listCampaigns(
    actor: StudioEmailActor,
    options: {
      status?: string | string[]
      page: number
      pageSize: number
      name?: string
      createdAtFrom?: string
      createdAtTo?: string
    }
  ): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    return decorateOutput(await this.campaigns.list(resolved.ctx, options))
  }

  async getCampaign(actor: StudioEmailActor, campaignId: string): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    return decorateOutput(await this.campaigns.getById(campaignId, resolved.ctx))
  }

  async createCampaign(actor: StudioEmailActor, data: CreateCampaignInput): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    const output = await this.campaigns.create(data, resolved.ctx)
    const id = extractId(output.result)
    if (output.isValid && id) {
      await stampCampaignTree(id, actor.access.backofficeUserId, resolved.ctx.teamId)
      return decorateOutput(await this.campaigns.getById(id, resolved.ctx))
    }
    return decorateOutput(output)
  }

  async updateCampaign(
    actor: StudioEmailActor,
    campaignId: string,
    data: Partial<CreateCampaignInput>
  ): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    const output = await this.campaigns.update(campaignId, data, resolved.ctx)
    if (output.isValid) {
      await stampCampaignTree(campaignId, actor.access.backofficeUserId, resolved.ctx.teamId)
    }
    return decorateOutput(output)
  }

  async sendCampaign(actor: StudioEmailActor, campaignId: string): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    const output = await this.campaigns.send(campaignId, resolved.ctx)
    if (output.isValid) {
      await stampCampaignTree(campaignId, actor.access.backofficeUserId, resolved.ctx.teamId)
    }
    return decorateOutput(output)
  }

  async cancelCampaign(actor: StudioEmailActor, campaignId: string): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    return decorateOutput(await this.campaigns.cancel(campaignId, resolved.ctx))
  }

  async archiveCampaign(actor: StudioEmailActor, campaignId: string): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    return decorateOutput(await this.campaigns.archive(campaignId, resolved.ctx))
  }

  async previewDispatch(
    actor: StudioEmailActor,
    campaignId: string,
    dispatchId: string
  ): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    return decorateOutput(
      await emailAnalyticsUseCase.getDispatchPreview({
        teamId: resolved.ctx.teamId,
        campaignId,
        dispatchId,
      })
    )
  }

  async listContactLists(actor: StudioEmailActor): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    return decorateOutput(await this.contactLists.list(resolved.ctx))
  }

  async getContactList(actor: StudioEmailActor, listId: string): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    return decorateOutput(await this.contactLists.getById(listId, resolved.ctx))
  }

  async createContactList(
    actor: StudioEmailActor,
    data: { name: string; description?: string }
  ): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    const output = await this.contactLists.create(data, resolved.ctx)
    const id = extractId(output.result)
    if (output.isValid && id) {
      await stampContactList(id, actor.access.backofficeUserId)
      return decorateOutput(await this.contactLists.getById(id, resolved.ctx))
    }
    return decorateOutput(output)
  }

  async updateContactList(
    actor: StudioEmailActor,
    listId: string,
    data: Partial<{ name: string; description?: string }>
  ): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    const output = await this.contactLists.update(listId, data, resolved.ctx)
    if (output.isValid) {
      await stampContactList(listId, actor.access.backofficeUserId)
    }
    return decorateOutput(output)
  }

  async deleteContactList(actor: StudioEmailActor, listId: string): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    return decorateOutput(await this.contactLists.deleteList(listId, resolved.ctx))
  }

  async listContacts(
    actor: StudioEmailActor,
    listId: string,
    options: { page: number; pageSize: number; search?: string }
  ): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    return decorateOutput(await this.contactLists.listContacts(listId, resolved.ctx, options))
  }

  async addContact(
    actor: StudioEmailActor,
    listId: string,
    email: string,
    name: string | null
  ): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    const output = await this.contactLists.addContact(listId, email, name, resolved.ctx)
    if (output.isValid) {
      await stampContactList(listId, actor.access.backofficeUserId)
    }
    return decorateOutput(output)
  }

  async deleteContact(
    actor: StudioEmailActor,
    listId: string,
    contactId: string
  ): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    return decorateOutput(await this.contactLists.deleteContact(listId, contactId, resolved.ctx))
  }

  async uploadContactsCsv(
    actor: StudioEmailActor,
    listId: string,
    csvContent: string
  ): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    const output = await this.contactImport.enqueueCsvImport(listId, csvContent, resolved.ctx)
    if (output.isValid) {
      const importId =
        output.result && typeof output.result === "object"
          ? (output.result as { importId?: string }).importId
          : undefined
      if (importId) await stampImportJob(importId, actor.access.backofficeUserId)
      await stampContactList(listId, actor.access.backofficeUserId)
    }
    return decorateOutput(output)
  }

  async importMappedContacts(
    actor: StudioEmailActor,
    listId: string,
    rows: Array<{
      line?: number
      email: string
      name?: string
      customFields?: Record<string, string>
    }>
  ): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    const output = await this.contactImport.enqueueMappedImport(listId, rows, resolved.ctx)
    if (output.isValid) {
      const importId =
        output.result && typeof output.result === "object"
          ? (output.result as { importId?: string }).importId
          : undefined
      if (importId) await stampImportJob(importId, actor.access.backofficeUserId)
      await stampContactList(listId, actor.access.backofficeUserId)
    }
    return decorateOutput(output)
  }

  async listTemplates(
    actor: StudioEmailActor,
    options?: {
      scope?: "campaign" | "workbench"
      approvalFilter?: "all" | "pending_approval" | "approved" | "rejected"
    }
  ): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    return decorateOutput(
      await this.templates.list(
        resolved.ctx,
        options?.approvalFilter ?? "all",
        options?.scope ?? "workbench"
      )
    )
  }

  async getTemplate(actor: StudioEmailActor, templateId: string): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    return decorateOutput(await this.templates.getById(templateId, resolved.ctx))
  }

  async createTemplate(
    actor: StudioEmailActor,
    data: Parameters<EmailTemplateUseCase["create"]>[0]
  ): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    const output = await this.templates.create(data, resolved.ctx)
    const id = extractId(output.result)
    if (output.isValid && id) {
      await stampTemplate(id, actor.access.backofficeUserId)
      return decorateOutput(await this.templates.getById(id, resolved.ctx))
    }
    return decorateOutput(output)
  }

  async updateTemplate(
    actor: StudioEmailActor,
    templateId: string,
    data: Parameters<EmailTemplateUseCase["update"]>[1]
  ): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    const output = await this.templates.update(templateId, data, resolved.ctx)
    if (output.isValid) {
      await stampTemplate(templateId, actor.access.backofficeUserId)
    }
    return decorateOutput(output)
  }

  async publishTemplate(actor: StudioEmailActor, templateId: string): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    const output = await this.templates.publish(templateId, resolved.ctx)
    if (output.isValid) {
      await stampTemplate(templateId, actor.access.backofficeUserId)
    }
    return decorateOutput(output)
  }

  async testTemplate(
    actor: StudioEmailActor,
    templateId: string,
    data: Parameters<EmailTemplateUseCase["sendTest"]>[1]
  ): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    return decorateOutput(await this.templates.sendTest(templateId, data, resolved.ctx))
  }

  async listTemplateVersions(actor: StudioEmailActor, templateId: string): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    return decorateOutput(await this.templates.listVersions(templateId, resolved.ctx))
  }

  async restoreTemplateVersion(
    actor: StudioEmailActor,
    templateId: string,
    versionId: string
  ): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    return decorateOutput(await this.templates.restoreVersion(templateId, versionId, resolved.ctx))
  }

  async submitTemplate(actor: StudioEmailActor, templateId: string): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    return decorateOutput(await this.templates.submitForApproval(templateId, resolved.ctx))
  }

  async approveTemplate(actor: StudioEmailActor, templateId: string): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    return decorateOutput(await this.templates.approve(templateId, resolved.ctx))
  }

  async rejectTemplate(
    actor: StudioEmailActor,
    templateId: string,
    reviewNote: string
  ): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    return decorateOutput(await this.templates.reject(templateId, reviewNote, resolved.ctx))
  }

  async archiveTemplate(actor: StudioEmailActor, templateId: string): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    return decorateOutput(await this.templates.archive(templateId, resolved.ctx))
  }

  async getAnalytics(
    actor: StudioEmailActor,
    options: { from: Date; to: Date; campaignId?: string }
  ): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    return decorateOutput(
      await emailAnalyticsUseCase.getAnalytics({
        teamId: resolved.ctx.teamId,
        from: options.from,
        to: options.to,
        campaignId: options.campaignId,
      })
    )
  }

  async listLogs(
    actor: StudioEmailActor,
    options: {
      page: number
      pageSize: number
      search?: string
      campaignId?: string
      category?: string
      statuses?: string[]
      from?: string
      to?: string
    }
  ): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error

    const { logs, total } = await backofficeStudioEmailRepository.listLogs({
      teamId: resolved.ctx.teamId,
      ...options,
    })

    return new Output(true, [], [], {
      items: logs,
      page: options.page,
      pageSize: options.pageSize,
      total,
      totalPages: Math.ceil(total / options.pageSize),
    })
  }

  async getLog(actor: StudioEmailActor, logId: string): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error

    const log = await backofficeStudioEmailRepository.getLog(resolved.ctx.teamId, logId)
    if (!log) {
      return new Output(false, [], ["Log não encontrado"], null)
    }

    return new Output(true, [], [], log)
  }

  async getSettings(actor: StudioEmailActor): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    return decorateOutput(await this.settings.get(resolved.ctx))
  }

  async updateSettings(
    actor: StudioEmailActor,
    data: Parameters<EmailTeamSettingsUseCase["update"]>[0]
  ): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    return decorateOutput(await this.settings.update(data, resolved.ctx))
  }

  async listSenders(actor: StudioEmailActor): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    return decorateOutput(await this.settings.listSenders(resolved.ctx))
  }

  async createSender(
    actor: StudioEmailActor,
    data: Parameters<EmailTeamSettingsUseCase["createSender"]>[0]
  ): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    return decorateOutput(await this.settings.createSender(data, resolved.ctx))
  }

  async updateSender(
    actor: StudioEmailActor,
    senderId: string,
    data: Parameters<EmailTeamSettingsUseCase["updateSender"]>[1]
  ): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    return decorateOutput(await this.settings.updateSender(senderId, data, resolved.ctx))
  }

  async deleteSender(actor: StudioEmailActor, senderId: string): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    return decorateOutput(await this.settings.deleteSender(senderId, resolved.ctx))
  }

  async setDefaultSender(actor: StudioEmailActor, senderId: string): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    return decorateOutput(await this.settings.setDefaultSender(senderId, resolved.ctx))
  }

  async connectDomain(actor: StudioEmailActor, domainName: string): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    return decorateOutput(await this.settings.connectDomain(domainName, resolved.ctx))
  }

  async disconnectDomain(actor: StudioEmailActor): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    return decorateOutput(await this.settings.disconnectDomain(resolved.ctx))
  }

  async verifyDomain(actor: StudioEmailActor): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    return decorateOutput(await this.settings.verifyDomain(resolved.ctx))
  }

  async getDomainRecords(actor: StudioEmailActor): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    return decorateOutput(await this.settings.getDomainRecords(resolved.ctx))
  }

  async listVariables(actor: StudioEmailActor): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    return decorateOutput(await this.variables.list(resolved.ctx))
  }

  async createVariable(
    actor: StudioEmailActor,
    data: Parameters<EmailTeamVariablesUseCase["create"]>[0]
  ): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    return decorateOutput(await this.variables.create(data, resolved.ctx))
  }

  async updateVariable(
    actor: StudioEmailActor,
    variableId: string,
    data: Parameters<EmailTeamVariablesUseCase["update"]>[1]
  ): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    return decorateOutput(await this.variables.update(variableId, data, resolved.ctx))
  }

  async deleteVariable(actor: StudioEmailActor, variableId: string): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    return decorateOutput(await this.variables.delete(variableId, resolved.ctx))
  }
}

export const backofficeStudioEmailUseCase = new BackofficeStudioEmailUseCase()
