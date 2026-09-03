import { randomUUID } from "crypto"
import { Prisma } from "@prisma/client"
import type { Lead } from "@prisma/client"
import { emailLogRepository } from "@/app/api/infra/data/repositories/emailLog/EmailLogRepository"
import { publicFormsRepository } from "@/app/api/infra/data/repositories/publicForms/PublicFormsRepository"
import { findMatchingLead } from "@/app/api/useCases/publicForms/publicFormLeadSync"
import { syncLeadToRadarUseCase } from "@/app/api/useCases/radar/SyncLeadToRadarUseCase"
import { Output } from "@/lib/output"
import {
  extractPhoneFromCustomFields,
  FORM_START_ACTIVITY_BODY,
  parseEmailLogIdFromOrigin,
  resolveAttributionDisplayName,
} from "@/lib/public-forms/email-campaign-attribution"
import { normalizeLeadPhoneDigits } from "@/lib/masks"

export type ResolveEmailCampaignFormAttributionInput = {
  teamId: string
  formId: string
  formName: string
  formPublicId: string
  publicationId: string
  emailCampaignTrackingEnabled: boolean
  eventType: "form_viewed" | "form_started" | "form_completed"
  origin: Record<string, unknown>
  visitorSessionId: string
  occurredAt?: string | null
}

/**
 * Marca em `EmailEvent.metadata` que o clique veio do carimbo `cs_el` na URL do
 * formulário, e não do redirecionador do Resend. Serve para auditar a origem da
 * métrica durante e depois da transição.
 */
export const FIRST_PARTY_CLICK_SOURCE = "public_form_attribution"

export type ResolveEmailCampaignFormAttributionResult = {
  leadId: string | null
  campaignId: string | null
  emailLogId: string | null
  enrichedOrigin: Record<string, unknown>
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

/**
 * Resolve `cs_el` → EmailLog → lead CRM existente + atividades de início + identidade Radar.
 * Premissa: EmailLog.id é o PID por destinatário no disparo da campanha.
 * Lead CRM novo nasce no Radar (gate A+C no perfil unificado), não no Progress.
 */
class ResolveEmailCampaignFormAttributionUseCase {
  async execute(input: ResolveEmailCampaignFormAttributionInput): Promise<Output> {
    const emailLogId = parseEmailLogIdFromOrigin(input.origin)
    const enrichedOrigin: Record<string, unknown> = { ...input.origin }

    if (!emailLogId || !input.emailCampaignTrackingEnabled) {
      return new Output(true, [], [], {
        leadId: null,
        campaignId: null,
        emailLogId,
        enrichedOrigin,
      } satisfies ResolveEmailCampaignFormAttributionResult)
    }

    try {
      const log = await emailLogRepository.findCampaignLogForAttribution(input.teamId, emailLogId)

      if (!log) {
        return new Output(true, [], [], {
          leadId: null,
          campaignId: null,
          emailLogId,
          enrichedOrigin,
        } satisfies ResolveEmailCampaignFormAttributionResult)
      }

      enrichedOrigin.emailLogId = log.id
      enrichedOrigin.recipientEmail = log.recipientEmail
      // Adenda E6b (02/09): sem isto, o perfil Radar nunca tinha como herdar o
      // nome do destinatário (caso KKJ, perfil `86426c89`) — só o e-mail
      // chegava ao `origin`. Nome CRU (nunca o fallback derivado do e-mail
      // local-part de `resolveAttributionDisplayName`, usado só na busca de
      // lead abaixo) — herdar um nome inventado marcaria como "identidade
      // conhecida" algo que não é.
      if (log.recipientName?.trim()) enrichedOrigin.recipientName = log.recipientName.trim()
      if (log.campaignId) enrichedOrigin.campaignId = log.campaignId
      if (log.dispatchId) enrichedOrigin.dispatchId = log.dispatchId

      // O `form_viewed` é o primeiro sinal de que o destinatário abriu o link do
      // e-mail, então é ele que repõe o clique quando o click tracking do Resend
      // está desligado. Fire-and-forget: falha ao gravar clique nunca pode
      // derrubar o registro da métrica do formulário.
      if (input.eventType === "form_viewed") {
        // AWAIT, não fire-and-forget. O consumidor da fila roda em serverless:
        // ele pode dar ack na mensagem e congelar o isolate enquanto a promise
        // ainda está pendente — a view do formulário fica persistida e o
        // `clickedAt` mais os contadores de clique da campanha se perdem, sem
        // erro em lugar nenhum. Com o click tracking do Resend desligado, esta
        // é a ÚNICA fonte de clique, então a perda é definitiva.
        //
        // O catch interno preserva a intenção original: falha ao gravar clique
        // não pode derrubar o registro da métrica do formulário.
        try {
          await this.recordFirstPartyClick({
            teamId: input.teamId,
            emailLogId: log.id,
            formPublicId: input.formPublicId,
            occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
          })
        } catch (error) {
          console.error("[ResolveEmailCampaignFormAttributionUseCase][recordFirstPartyClick]", error)
        }
      }

      const phone = await this.resolveRecipientPhone(input.teamId, log.recipientEmail, log.campaignId)
      const name = resolveAttributionDisplayName(log.recipientName, log.recipientEmail)
      const email = log.recipientEmail.trim().toLowerCase()
      const normalizedPhone = phone ? normalizeLeadPhoneDigits(phone) : ""
      enrichedOrigin.recipientEmail = email

      const match = await findMatchingLead(input.teamId, {
        native: {
          ...(name ? { name } : {}),
          ...(email ? { email } : {}),
          ...(phone ? { phone: phone ?? "" } : {}),
        },
        custom: {},
        notes: [],
        name,
        email,
        phone: phone ?? "",
        normalizedPhone,
      })
      const lead: Lead | null = match ?? null

      if (lead) {
        if (input.eventType === "form_started") {
          await this.ensureLeadActivity({
            leadId: lead.id,
            body: FORM_START_ACTIVITY_BODY,
            kind: "public_form_started",
            formId: input.formId,
            formName: input.formName,
            formPublicId: input.formPublicId,
            publicationId: input.publicationId,
            emailLogId: log.id,
            campaignId: log.campaignId,
            origin: enrichedOrigin,
          })
        }

        if (input.eventType !== "form_viewed") {
          void syncLeadToRadarUseCase
            .execute({ leadId: lead.id, teamId: input.teamId })
            .catch((error) => {
              console.error("[ResolveEmailCampaignFormAttributionUseCase][syncLeadToRadar]", error)
            })
        }
      }

      return new Output(true, [], [], {
        leadId: lead?.id ?? null,
        campaignId: log.campaignId,
        emailLogId: log.id,
        enrichedOrigin,
      } satisfies ResolveEmailCampaignFormAttributionResult)
    } catch (error) {
      console.error("[ResolveEmailCampaignFormAttributionUseCase][execute]", error)
      const message =
        error instanceof Error ? error.message : "Erro ao resolver atribuição e-mail→formulário"
      return new Output(false, [], [message], null)
    }
  }

  /**
   * Repõe `EmailLog.clickedAt` / `EmailCampaign.totalClicked` sem redirecionador,
   * reaproveitando o mesmo caminho do webhook do Resend — assim toda a leitura de
   * analytics continua idêntica.
   *
   * O guard em `clickedAt` torna a gravação exatamente-uma-vez por destinatário,
   * que é a mesma semântica de `totalClicked` (só o primeiro clique conta). É
   * também o que torna seguro rodar isto com o click tracking do Resend ainda
   * ligado: quem chegar primeiro grava, o outro vira no-op no contador.
   */
  private async recordFirstPartyClick(params: {
    teamId: string
    emailLogId: string
    formPublicId: string
    occurredAt: Date
  }): Promise<void> {
    const record = await emailLogRepository.findCampaignWebhookRecordById(
      params.teamId,
      params.emailLogId
    )
    if (!record || record.clickedAt) return

    await emailLogRepository.applyWebhookEvent({
      log: record,
      eventType: "clicked",
      occurredAt: params.occurredAt,
      metadata: { source: FIRST_PARTY_CLICK_SOURCE, formPublicId: params.formPublicId },
      eventId: randomUUID(),
    })
  }

  private async resolveRecipientPhone(
    teamId: string,
    recipientEmail: string,
    campaignId: string | null
  ): Promise<string | null> {
    const email = recipientEmail.trim().toLowerCase()
    if (campaignId) {
      const listIds = await publicFormsRepository.findCampaignContactListIds(teamId, campaignId)
      const customFields = await publicFormsRepository.findEmailContactCustomFields(email, listIds)
      const fromContact = extractPhoneFromCustomFields(
        customFields as Record<string, unknown> | null
      )
      if (fromContact) return fromContact
    }

    return publicFormsRepository.findRadarPhoneByEmail(teamId, email)
  }

  private async ensureLeadActivity(input: {
    leadId: string
    body: string
    kind: "public_form_started"
    formId: string
    formName: string
    formPublicId: string
    publicationId: string
    emailLogId: string
    campaignId: string | null
    origin: Record<string, unknown>
  }): Promise<void> {
    const existing = await publicFormsRepository.findLeadActivityByEmailLogAttribution({
      leadId: input.leadId,
      body: input.body,
      emailLogId: input.emailLogId,
    })
    if (existing) return

    await publicFormsRepository.createLeadActivityNote({
      leadId: input.leadId,
      body: input.body,
      payload: json({
        kind: input.kind,
        formId: input.formId,
        formName: input.formName,
        formPublicId: input.formPublicId,
        publicationId: input.publicationId,
        emailLogId: input.emailLogId,
        campaignId: input.campaignId,
        origin: input.origin,
      }),
    })
  }
}

export const resolveEmailCampaignFormAttributionUseCase =
  new ResolveEmailCampaignFormAttributionUseCase()
