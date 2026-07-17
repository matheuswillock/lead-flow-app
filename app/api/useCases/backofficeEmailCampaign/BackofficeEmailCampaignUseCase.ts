import {
  BackofficeEmailEventType,
  BackofficeEmailLogStatus,
  type BackofficeEmailCampaign,
  type Prisma,
} from "@prisma/client"
import { Output } from "@/lib/output"
import {
  backofficeEmailCampaignRepository,
  STUCK_SENDING_THRESHOLD_MS,
  type BackofficeEmailCampaignRepository,
} from "@/app/api/infra/data/repositories/backoffice/backofficeEmailCampaign/BackofficeEmailCampaignRepository"
import {
  backofficeEmailCampaignDispatchRepository,
  type BackofficeEmailCampaignDispatchRepository,
} from "@/app/api/infra/data/repositories/backoffice/backofficeEmailCampaignDispatch/BackofficeEmailCampaignDispatchRepository"
import {
  backofficeEmailLogRepository,
  type BackofficeEmailLogRepository,
} from "@/app/api/infra/data/repositories/backoffice/backofficeEmailLog/BackofficeEmailLogRepository"
import {
  backofficeEmailEventRepository,
  type BackofficeEmailEventRepository,
} from "@/app/api/infra/data/repositories/backoffice/backofficeEmailEvent/BackofficeEmailEventRepository"
import {
  backofficeEmailContactRepository,
  type BackofficeEmailContactRepository,
} from "@/app/api/infra/data/repositories/backoffice/backofficeEmailContact/BackofficeEmailContactRepository"
import {
  backofficeEmailContactListRepository,
  type BackofficeEmailContactListRepository,
} from "@/app/api/infra/data/repositories/backoffice/backofficeEmailContactList/BackofficeEmailContactListRepository"
import {
  backofficeEmailCampaignDispatchService,
  type BackofficeEmailCampaignDispatchService,
} from "@/app/api/services/backofficeEmailCampaign/BackofficeEmailCampaignDispatchService"
import { backofficeEmailTemplatesService } from "@/app/api/services/backofficeEmailTemplates/BackofficeEmailTemplatesService"
import type {
  ApplyBackofficeResendWebhookEventInput,
  BackofficeLeadForCampaignSubscription,
  IBackofficeEmailCampaignUseCase,
  UpsertBackofficeEmailCampaignData,
} from "./IBackofficeEmailCampaignUseCase"

const DEFAULT_LIVE_CAMPAIGN_HOUR_UTC = 16 // 13:00 America/Sao_Paulo
const DEFAULT_FROM_EMAIL = process.env.BACKOFFICE_EMAIL_CAMPAIGN_FROM_EMAIL ?? "contato@corretorstudio.com"
const DEFAULT_FROM_NAME = process.env.BACKOFFICE_EMAIL_CAMPAIGN_FROM_NAME ?? "Corretor Studio"

// `eventType` chega já normalizado pelo ResendWebhookUseCase (ex.: "sent", "opened"),
// não no formato bruto do Resend (ex.: "email.opened").
const KNOWN_EVENT_TYPES = new Set<string>(Object.values(BackofficeEmailEventType))

function toBackofficeEmailEventType(eventType: string): BackofficeEmailEventType | null {
  return KNOWN_EVENT_TYPES.has(eventType) ? (eventType as BackofficeEmailEventType) : null
}

const LOG_STATUS_BY_EVENT: Partial<Record<BackofficeEmailEventType, BackofficeEmailLogStatus>> = {
  sent: BackofficeEmailLogStatus.sent,
  delivered: BackofficeEmailLogStatus.delivered,
  opened: BackofficeEmailLogStatus.opened,
  clicked: BackofficeEmailLogStatus.clicked,
  bounced: BackofficeEmailLogStatus.bounced,
  complained: BackofficeEmailLogStatus.complained,
  failed: BackofficeEmailLogStatus.failed,
}

const TIMESTAMP_FIELD_BY_EVENT: Partial<
  Record<BackofficeEmailEventType, "sentAt" | "deliveredAt" | "openedAt" | "clickedAt" | "bouncedAt" | "complainedAt">
> = {
  sent: "sentAt",
  delivered: "deliveredAt",
  opened: "openedAt",
  clicked: "clickedAt",
  bounced: "bouncedAt",
  complained: "complainedAt",
}

function formatBrazilianDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}

function computeNextThursday(now: Date): Date {
  const next = new Date(now)
  next.setUTCDate(next.getUTCDate() + 7)
  next.setUTCHours(DEFAULT_LIVE_CAMPAIGN_HOUR_UTC, 0, 0, 0)
  return next
}

export class BackofficeEmailCampaignUseCase implements IBackofficeEmailCampaignUseCase {
  constructor(
    private readonly campaignRepository: BackofficeEmailCampaignRepository = backofficeEmailCampaignRepository,
    private readonly dispatchRepository: BackofficeEmailCampaignDispatchRepository = backofficeEmailCampaignDispatchRepository,
    private readonly logRepository: BackofficeEmailLogRepository = backofficeEmailLogRepository,
    private readonly eventRepository: BackofficeEmailEventRepository = backofficeEmailEventRepository,
    private readonly contactRepository: BackofficeEmailContactRepository = backofficeEmailContactRepository,
    private readonly contactListRepository: BackofficeEmailContactListRepository = backofficeEmailContactListRepository,
    private readonly dispatchService: BackofficeEmailCampaignDispatchService = backofficeEmailCampaignDispatchService
  ) {}

  async list(): Promise<Output> {
    const campaigns = await this.campaignRepository.findMany()
    return new Output(true, [], [], campaigns)
  }

  async getById(id: string): Promise<Output> {
    const campaign = await this.campaignRepository.findById(id)
    if (!campaign) return new Output(false, [], ["Campanha não encontrada"], null)
    return new Output(true, [], [], campaign)
  }

  async create(
    data: UpsertBackofficeEmailCampaignData,
    backofficeUserId: string
  ): Promise<Output> {
    if (!data.name?.trim()) {
      return new Output(false, [], ["Nome da campanha é obrigatório"], null)
    }
    if (!data.contactListId) {
      return new Output(false, [], ["Lista de contatos é obrigatória"], null)
    }
    if (!data.scheduledAt) {
      return new Output(false, [], ["Data de disparo é obrigatória"], null)
    }
    const list = await this.contactListRepository.findById(data.contactListId)
    if (!list) {
      return new Output(false, [], ["Lista de contatos não encontrada"], null)
    }

    const created = await this.campaignRepository.create({
      name: data.name.trim(),
      contactListId: data.contactListId,
      scheduledAt: new Date(data.scheduledAt),
      resendTemplateId: data.resendTemplateId,
      resendTemplateName: data.resendTemplateName,
      fromName: data.fromName,
      fromEmail: data.fromEmail,
      replyTo: data.replyTo,
      createdByBackofficeUserId: backofficeUserId,
    })
    return new Output(true, ["Campanha criada com sucesso"], [], created)
  }

  async update(id: string, data: UpsertBackofficeEmailCampaignData): Promise<Output> {
    const campaign = await this.campaignRepository.findById(id)
    if (!campaign) return new Output(false, [], ["Campanha não encontrada"], null)
    if (campaign.status !== "draft" && campaign.status !== "scheduled") {
      return new Output(false, [], ["Só é possível editar campanhas em rascunho ou agendadas"], null)
    }

    const updated = await this.campaignRepository.update(id, {
      name: data.name?.trim(),
      contactListId: data.contactListId,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      resendTemplateId: data.resendTemplateId,
      resendTemplateName: data.resendTemplateName,
      fromName: data.fromName,
      fromEmail: data.fromEmail,
      replyTo: data.replyTo,
    })

    const shouldBeScheduled = Boolean(updated.resendTemplateId) && updated.status === "draft"
    if (shouldBeScheduled) {
      await this.campaignRepository.updateStatus(id, "scheduled")
    }

    const final = await this.campaignRepository.findById(id)
    return new Output(true, ["Campanha atualizada com sucesso"], [], final)
  }

  async cancel(id: string): Promise<Output> {
    const canceled = await this.campaignRepository.cancel(id)
    if (!canceled) {
      return new Output(
        false,
        [],
        ["Só é possível cancelar campanhas em rascunho ou agendadas"],
        null
      )
    }
    return new Output(true, ["Campanha cancelada com sucesso"], [], canceled)
  }

  async sendNow(id: string, backofficeUserId: string): Promise<Output> {
    const campaign = await this.campaignRepository.findById(id)
    if (!campaign) return new Output(false, [], ["Campanha não encontrada"], null)
    if (!campaign.resendTemplateId) {
      return new Output(false, [], ["Configure um template antes de enviar"], null)
    }

    const claimed = await this.campaignRepository.claimForDispatch(id)
    if (!claimed) {
      return new Output(false, [], ["Campanha já está sendo enviada ou não pode ser enviada"], null)
    }

    const result = await this.dispatchCampaign(campaign, backofficeUserId)
    return result
  }

  async listDispatches(id: string): Promise<Output> {
    const dispatches = await this.dispatchRepository.findByCampaignId(id)
    return new Output(true, [], [], dispatches)
  }

  async getUpcomingLiveCampaignInfo(): Promise<Output> {
    const campaign = await this.campaignRepository.findUpcomingLiveCampaign()
    if (!campaign) {
      return new Output(true, [], [], null)
    }
    return new Output(true, [], [], { id: campaign.id, name: campaign.name })
  }

  async ensureUpcomingLiveCampaignExists(): Promise<Output> {
    const now = new Date()
    const existing = await this.campaignRepository.findUpcomingLiveCampaign()
    if (existing) {
      return new Output(true, ["Já existe uma campanha Live em aberto"], [], existing)
    }

    const scheduledAt = computeNextThursday(now)
    const name = `Live — ${formatBrazilianDate(scheduledAt)}`
    const systemList = await this.contactListRepository.getOrCreateSystemDefault()

    try {
      const created = await this.campaignRepository.create({
        name,
        contactListId: systemList.id,
        scheduledAt,
        createdByBackofficeUserId: null,
      })
      return new Output(true, ["Campanha Live provisionada com sucesso"], [], created)
    } catch (error) {
      // Unique constraint on [type, scheduledAt] — another run already created it.
      console.info(
        "[BackofficeEmailCampaignUseCase][ensureUpcomingLiveCampaignExists] campanha já provisionada",
        error
      )
      const raceWinner = await this.campaignRepository.findUpcomingLiveCampaign()
      return new Output(true, [], [], raceWinner)
    }
  }

  async dispatchDueCampaigns(now: Date = new Date()): Promise<Output> {
    const due = await this.campaignRepository.findDueForDispatch(now)
    let dispatched = 0

    for (const campaign of due) {
      const claimed = await this.campaignRepository.claimForDispatch(campaign.id)
      if (!claimed) continue
      await this.dispatchCampaign(campaign, null)
      dispatched += 1
    }

    return new Output(true, [], [], { dispatched, total: due.length })
  }

  async recoverStuckDispatches(): Promise<Output> {
    const olderThan = new Date(Date.now() - STUCK_SENDING_THRESHOLD_MS)
    const count = await this.campaignRepository.recoverStuck(olderThan)
    return new Output(true, [], [], { recovered: count })
  }

  async subscribeFromLead(lead: BackofficeLeadForCampaignSubscription): Promise<Output> {
    if (!lead.email?.trim()) {
      return new Output(false, [], ["Lead sem e-mail — não é possível inscrever na campanha"], null)
    }

    try {
      const list = await this.contactListRepository.getOrCreateSystemDefault()
      const contact = await this.contactRepository.upsertActive({
        listId: list.id,
        email: lead.email,
        name: lead.name,
        backofficeLeadId: lead.id,
      })
      return new Output(true, ["Lead inscrito na campanha Live"], [], contact)
    } catch (error) {
      console.error("[BackofficeEmailCampaignUseCase][subscribeFromLead]", error)
      return new Output(false, [], ["Erro ao inscrever lead na campanha"], null)
    }
  }

  async applyResendWebhookEvent(
    input: ApplyBackofficeResendWebhookEventInput
  ): Promise<Output & { result: { handled: boolean } }> {
    const log = await this.logRepository.findByResendEmailId(input.resendEmailId)
    if (!log) {
      return new Output(true, [], [], { handled: false }) as Output & { result: { handled: boolean } }
    }

    const eventType = toBackofficeEmailEventType(input.eventType)
    if (!eventType) {
      return new Output(true, [], [], { handled: true }) as Output & { result: { handled: boolean } }
    }

    const isNewEvent = await this.eventRepository.append({
      logId: log.id,
      type: eventType,
      occurredAt: input.occurredAt,
      metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : undefined,
    })

    const mappedStatus = LOG_STATUS_BY_EVENT[eventType]
    if (mappedStatus) {
      await this.logRepository.applyStatusIfHigherPriority(
        log.id,
        mappedStatus,
        TIMESTAMP_FIELD_BY_EVENT[eventType],
        input.occurredAt
      )
    }

    if (isNewEvent) {
      const counterKey =
        eventType === BackofficeEmailEventType.delivered
          ? "totalDelivered"
          : eventType === BackofficeEmailEventType.opened
            ? "totalOpened"
            : eventType === BackofficeEmailEventType.clicked
              ? "totalClicked"
              : eventType === BackofficeEmailEventType.bounced
                ? "totalBounced"
                : eventType === BackofficeEmailEventType.complained
                  ? "totalComplained"
                  : null

      if (counterKey) {
        await this.campaignRepository.incrementCounters(log.campaignId, { [counterKey]: 1 })
        await this.dispatchRepository.incrementCounters(log.dispatchId, { [counterKey]: 1 })
      }

      if (eventType === BackofficeEmailEventType.bounced) {
        await this.contactRepository.markBouncedByEmailInAllLists(log.recipientEmail)
      }
      if (eventType === BackofficeEmailEventType.complained) {
        await this.contactRepository.markComplainedByEmailInAllLists(log.recipientEmail)
      }
    }

    return new Output(true, [], [], { handled: true }) as Output & { result: { handled: boolean } }
  }

  private async dispatchCampaign(
    campaign: BackofficeEmailCampaign,
    triggeredByBackofficeUserId: string | null
  ): Promise<Output> {
    if (!campaign.resendTemplateId) {
      await this.campaignRepository.markFailed(campaign.id, "Nenhum template configurado")
      return new Output(false, [], ["Nenhum template configurado"], null)
    }

    let template: { subject: string | null; html: string }
    try {
      template = await backofficeEmailTemplatesService.get(campaign.resendTemplateId)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao buscar template no Resend"
      await this.campaignRepository.markFailed(campaign.id, message)
      return new Output(false, [], [message], null)
    }

    const contacts = await this.contactRepository.listActiveByListId(campaign.contactListId)
    if (contacts.length === 0) {
      await this.campaignRepository.markFailed(campaign.id, "Nenhum destinatário ativo na lista")
      return new Output(false, [], ["Nenhum destinatário ativo na lista"], null)
    }

    const dispatch = await this.dispatchRepository.create({
      campaignId: campaign.id,
      templateSubjectSnapshot: template.subject ?? campaign.name,
      templateHtmlSnapshot: template.html,
      resendTemplateIdSnapshot: campaign.resendTemplateId,
      triggeredByBackofficeUserId,
    })

    const logs = await this.logRepository.createQueuedBatch(
      contacts.map((contact) => ({
        campaignId: campaign.id,
        dispatchId: dispatch.id,
        contactId: contact.id,
        recipientEmail: contact.email,
      }))
    )

    const recipients = contacts.map((contact, index) => ({
      logId: logs[index]?.id ?? "",
      contactId: contact.id,
      email: contact.email,
      name: contact.name,
    }))

    const result = await this.dispatchService.dispatchBatch({
      campaignId: campaign.id,
      dispatchId: dispatch.id,
      dispatchNumber: dispatch.dispatchNumber,
      from: campaign.fromEmail
        ? `${campaign.fromName ?? DEFAULT_FROM_NAME} <${campaign.fromEmail}>`
        : `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_EMAIL}>`,
      replyTo: campaign.replyTo,
      subject: template.subject ?? campaign.name,
      html: template.html,
      recipients,
    })

    await this.dispatchRepository.updateCounters(dispatch.id, {
      totalRecipients: contacts.length,
      totalSent: result.sent,
    })
    await this.dispatchRepository.updateStatus(
      dispatch.id,
      result.sent === 0 && result.failed > 0 ? "failed" : "completed",
      result.failed > 0 ? `${result.failed} envio(s) falharam` : null
    )

    if (result.sent === 0 && result.failed > 0) {
      await this.campaignRepository.markFailed(campaign.id, `${result.failed} envio(s) falharam`)
      return new Output(false, [], ["Falha ao enviar a campanha"], null)
    }

    const updated = await this.campaignRepository.markSent(campaign.id, campaign.dispatchCount + 1, {
      totalRecipients: contacts.length,
      totalSent: result.sent,
    })
    return new Output(true, ["Campanha enviada com sucesso"], [], updated)
  }
}

export const backofficeEmailCampaignUseCase = new BackofficeEmailCampaignUseCase()
