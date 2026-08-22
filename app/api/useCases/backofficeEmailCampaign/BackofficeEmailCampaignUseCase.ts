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
import {
  publishBackofficeEmailCampaignDispatchWake,
  type BackofficeEmailCampaignDispatchWakePayload,
} from "@/lib/queues/backoffice-email-campaign-dispatch"
import type {
  ApplyBackofficeResendWebhookEventInput,
  BackofficeLeadForCampaignSubscription,
  IBackofficeEmailCampaignUseCase,
  UpsertBackofficeEmailCampaignData,
} from "./IBackofficeEmailCampaignUseCase"
import type { BackofficeEmailCampaignDispatch } from "@prisma/client"

const DEFAULT_LIVE_CAMPAIGN_HOUR_UTC = 16 // 13:00 America/Sao_Paulo
const DEFAULT_FROM_EMAIL = process.env.BACKOFFICE_EMAIL_CAMPAIGN_FROM_EMAIL ?? "contato@corretorstudio.com"
const DEFAULT_FROM_NAME = process.env.BACKOFFICE_EMAIL_CAMPAIGN_FROM_NAME ?? "Corretor Studio"

/**
 * Lote por invocação do consumer (fila `backoffice-email-campaign-dispatch`).
 * Mesmo racional do PR1 do produto (`DISPATCH_QUEUE_BATCH_SIZE`): publish é
 * uma chamada de rede, então o gargalo real é o Resend (chunk de 50 no
 * `BackofficeEmailCampaignDispatchService`), não o Postgres — 500 por lote
 * cabe folgado no `maxDuration=300` do consumer.
 */
const DISPATCH_QUEUE_BATCH_SIZE = 500

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

    const final = await this.syncScheduledStatus(created)
    return new Output(true, ["Campanha criada com sucesso"], [], final)
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

    const final = await this.syncScheduledStatus(updated)
    return new Output(true, ["Campanha atualizada com sucesso"], [], final)
  }

  /** Promove draft -> scheduled assim que a campanha tem template configurado, para o cron de disparo poder encontrá-la. */
  private async syncScheduledStatus(
    campaign: BackofficeEmailCampaign
  ): Promise<BackofficeEmailCampaign> {
    const shouldBeScheduled = Boolean(campaign.resendTemplateId) && campaign.status === "draft"
    if (!shouldBeScheduled) return campaign

    await this.campaignRepository.updateStatus(campaign.id, "scheduled")
    return (await this.campaignRepository.findById(campaign.id)) ?? campaign
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

    const prepared = await this.prepareDispatch(campaign, backofficeUserId)
    if (!prepared.ok) return prepared.output

    await this.publishDispatchWake(prepared.dispatchId, "start")

    const sending = (await this.campaignRepository.findById(id)) ?? campaign
    return new Output(true, ["Envio iniciado — acompanhe o progresso na lista"], [], sending)
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

      const prepared = await this.prepareDispatch(campaign, null)
      if (prepared.ok) {
        await this.publishDispatchWake(prepared.dispatchId, "cron-start")
        dispatched += 1
      }
    }

    return new Output(true, [], [], { dispatched, total: due.length })
  }

  /**
   * Campanhas em `sending` há mais de `STUCK_SENDING_THRESHOLD_MS`: com o
   * disparo agora sendo processado em lotes pela fila, "sending" há muito
   * tempo não significa mais travado por padrão — pode só ser uma lista
   * grande ainda em processamento. Só marca `failed` quando não existe
   * nenhum dispatch de fato (órfã real); se existir um dispatch `sending`,
   * republica o wake (`cron-reclaim`) se ainda houver logs `queued`, ou
   * finaliza se o dispatch já esgotou os `queued` mas nunca chegou a
   * fechar (crash entre o último lote e o finalize). Se o dispatch mais
   * recente já estiver `completed`/`failed` mas a campanha continuar
   * `sending`, é o mesmo crash só que **depois** do `updateStatus` do
   * dispatch e **antes** do `markSent`/`markFailed` da campanha em
   * `finalizeDispatchQueueBatch` — reconcilia rodando `finalizeDispatchQueueBatch`
   * de novo (idempotente) em vez de sobrescrever um envio bem-sucedido com
   * `markFailed`.
   */
  async recoverStuckDispatches(): Promise<Output> {
    const olderThan = new Date(Date.now() - STUCK_SENDING_THRESHOLD_MS)
    const stuckCampaigns = await this.campaignRepository.findStuckSending(olderThan)

    let reclaimed = 0
    let failed = 0

    for (const campaign of stuckCampaigns) {
      const dispatches = await this.dispatchRepository.findByCampaignId(campaign.id)
      const sendingDispatch = dispatches.find((dispatch) => dispatch.status === "sending")

      if (!sendingDispatch) {
        const terminalDispatch = dispatches.find(
          (dispatch) => dispatch.status === "completed" || dispatch.status === "failed"
        )

        if (terminalDispatch) {
          console.info(
            "[BackofficeEmailCampaignUseCase][recoverStuckDispatches] dispatch já finalizado mas campanha ainda em sending — reconciliando",
            { campaignId: campaign.id, dispatchId: terminalDispatch.id, dispatchStatus: terminalDispatch.status }
          )
          await this.finalizeDispatchQueueBatch(terminalDispatch, campaign)
          reclaimed += 1
          continue
        }

        await this.campaignRepository.markFailed(
          campaign.id,
          "Disparo travado sem dispatch ativo — marcado como falho automaticamente"
        )
        failed += 1
        continue
      }

      const remaining = await this.logRepository.countQueuedByDispatchId(sendingDispatch.id)
      if (remaining > 0) {
        console.info("[BackofficeEmailCampaignUseCase][recoverStuckDispatches] republicando wake", {
          campaignId: campaign.id,
          dispatchId: sendingDispatch.id,
          remaining,
        })
        await this.publishDispatchWake(sendingDispatch.id, "cron-reclaim", { remainingCount: remaining })
        reclaimed += 1
        continue
      }

      await this.finalizeDispatchQueueBatch(sendingDispatch, campaign)
      reclaimed += 1
    }

    return new Output(true, [], [], { reclaimed, failed, total: stuckCampaigns.length })
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
        resubscribe: true,
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

  /**
   * Prepara o disparo (template, destinatários, dispatch + logs `queued`) sem
   * chamar Resend — quem envia de fato é só o consumer da fila
   * (`processDispatchQueueBatch`). Mesma separação prepare/send do PR1 do
   * produto (`startManualDispatch` vs `processDispatchQueueBatch`).
   */
  private async prepareDispatch(
    campaign: BackofficeEmailCampaign,
    triggeredByBackofficeUserId: string | null
  ): Promise<{ ok: true; dispatchId: string } | { ok: false; output: Output }> {
    if (!campaign.resendTemplateId) {
      await this.campaignRepository.markFailed(campaign.id, "Nenhum template configurado")
      return { ok: false, output: new Output(false, [], ["Nenhum template configurado"], null) }
    }

    let template: { subject: string | null; html: string }
    try {
      template = await backofficeEmailTemplatesService.get(campaign.resendTemplateId)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao buscar template no Resend"
      await this.campaignRepository.markFailed(campaign.id, message)
      return { ok: false, output: new Output(false, [], [message], null) }
    }

    const contacts = await this.contactRepository.listActiveByListId(campaign.contactListId)
    if (contacts.length === 0) {
      await this.campaignRepository.markFailed(campaign.id, "Nenhum destinatário ativo na lista")
      return { ok: false, output: new Output(false, [], ["Nenhum destinatário ativo na lista"], null) }
    }

    const dispatch = await this.dispatchRepository.create({
      campaignId: campaign.id,
      templateSubjectSnapshot: template.subject ?? campaign.name,
      templateHtmlSnapshot: template.html,
      resendTemplateIdSnapshot: campaign.resendTemplateId,
      triggeredByBackofficeUserId,
    })

    await this.logRepository.createQueuedBatch(
      contacts.map((contact) => ({
        campaignId: campaign.id,
        dispatchId: dispatch.id,
        contactId: contact.id,
        recipientEmail: contact.email,
      }))
    )

    await this.dispatchRepository.updateCounters(dispatch.id, { totalRecipients: contacts.length })

    return { ok: true, dispatchId: dispatch.id }
  }

  private async publishDispatchWake(
    dispatchId: string,
    reason: BackofficeEmailCampaignDispatchWakePayload["reason"],
    options?: { remainingCount?: number; batchOffset?: number }
  ): Promise<void> {
    try {
      await publishBackofficeEmailCampaignDispatchWake({
        dispatchId,
        reason,
        remainingCount: options?.remainingCount,
        batchOffset: options?.batchOffset,
      })
    } catch (error) {
      console.error("[BackofficeEmailCampaignUseCase][publishDispatchWake] falha ao publicar wake", {
        dispatchId,
        reason,
        error,
      })
    }
  }

  /**
   * Consumer da fila `backoffice-email-campaign-dispatch`: processa **um
   * lote** (até `DISPATCH_QUEUE_BATCH_SIZE`) de logs `queued` do dispatch e,
   * se sobrar mais, republica o wake em vez de tentar a lista inteira numa
   * única invocação (causa dos timeouts do cron/`send-now` síncronos).
   */
  async processDispatchQueueBatch(
    dispatchId: string,
    options?: { batchSize?: number }
  ): Promise<Output> {
    const batchSize = options?.batchSize ?? DISPATCH_QUEUE_BATCH_SIZE

    const dispatch = await this.dispatchRepository.findById(dispatchId)
    if (!dispatch || dispatch.status !== "sending") {
      console.info(
        "[BackofficeEmailCampaignUseCase][processDispatchQueueBatch] dispatch já finalizado ou inexistente",
        { dispatchId }
      )
      return new Output(true, ["Disparo já finalizado"], [], { dispatchId, hasMore: false })
    }

    const campaign = await this.campaignRepository.findById(dispatch.campaignId)
    if (!campaign) {
      console.error(
        "[BackofficeEmailCampaignUseCase][processDispatchQueueBatch] campanha não encontrada para o dispatch",
        { dispatchId, campaignId: dispatch.campaignId }
      )
      return new Output(false, [], ["Campanha não encontrada para o disparo"], { dispatchId, hasMore: false })
    }

    const queuedLogs = await this.logRepository.findQueuedByDispatchId(dispatchId, batchSize)

    if (queuedLogs.length === 0) {
      return this.finalizeDispatchQueueBatch(dispatch, campaign)
    }

    const recipients = queuedLogs.map((log) => ({
      logId: log.id,
      contactId: log.contactId,
      email: log.recipientEmail,
    }))

    const result = await this.dispatchService.dispatchBatch({
      campaignId: campaign.id,
      dispatchId: dispatch.id,
      dispatchNumber: dispatch.dispatchNumber,
      from: campaign.fromEmail
        ? `${campaign.fromName ?? DEFAULT_FROM_NAME} <${campaign.fromEmail}>`
        : `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_EMAIL}>`,
      replyTo: campaign.replyTo,
      subject: dispatch.templateSubjectSnapshot,
      html: dispatch.templateHtmlSnapshot,
      recipients,
    })

    await this.dispatchRepository.incrementCounters(dispatch.id, { totalSent: result.sent })

    const remaining = await this.logRepository.countQueuedByDispatchId(dispatchId)

    if (remaining > 0) {
      console.info(
        "[BackofficeEmailCampaignUseCase][processDispatchQueueBatch] lote processado, republicando wake",
        { dispatchId, batchSent: result.sent, remaining }
      )
      await this.publishDispatchWake(dispatchId, "continue", {
        remainingCount: remaining,
        batchOffset: dispatch.totalRecipients - remaining,
      })
      return new Output(
        true,
        [`Lote processado: ${result.sent} enviado(s), ${remaining} restante(s)`],
        [],
        { dispatchId, batchSent: result.sent, remaining, hasMore: true }
      )
    }

    return this.finalizeDispatchQueueBatch(dispatch, campaign)
  }

  /**
   * Fecha o dispatch quando não sobra nenhum log `queued` (última chamada do
   * consumer, ou reclaim do cron que descobriu um dispatch já esgotado).
   * Falha total (nenhum envio confirmado) marca a campanha `failed`; qualquer
   * envio confirmado marca `sent`, com o total de falhas registrado no
   * `errorMessage` do dispatch (mesmo comportamento do fluxo síncrono antigo).
   */
  private async finalizeDispatchQueueBatch(
    dispatch: BackofficeEmailCampaignDispatch,
    campaign: BackofficeEmailCampaign
  ): Promise<Output> {
    const sentCount = await this.logRepository.countSentByDispatchId(dispatch.id)
    const failedCount = Math.max(0, dispatch.totalRecipients - sentCount)
    const totalFailure = sentCount === 0 && dispatch.totalRecipients > 0

    await this.dispatchRepository.updateStatus(
      dispatch.id,
      totalFailure ? "failed" : "completed",
      failedCount > 0 ? `${failedCount} envio(s) falharam` : null
    )

    if (totalFailure) {
      const updated = await this.campaignRepository.markFailed(
        campaign.id,
        `${failedCount} envio(s) falharam`
      )
      console.info(
        "[BackofficeEmailCampaignUseCase][finalizeDispatchQueueBatch] dispatch finalizado com falha total",
        { dispatchId: dispatch.id }
      )
      return new Output(false, [], ["Falha ao enviar a campanha"], updated)
    }

    const updated = await this.campaignRepository.markSent(campaign.id, campaign.dispatchCount + 1, {
      totalRecipients: dispatch.totalRecipients,
      totalSent: sentCount,
    })

    console.info("[BackofficeEmailCampaignUseCase][finalizeDispatchQueueBatch] dispatch finalizado", {
      dispatchId: dispatch.id,
      sentCount,
      failedCount,
      campaignStatus: updated.status,
    })

    return new Output(true, ["Campanha enviada com sucesso"], [], updated)
  }
}

export const backofficeEmailCampaignUseCase = new BackofficeEmailCampaignUseCase()
