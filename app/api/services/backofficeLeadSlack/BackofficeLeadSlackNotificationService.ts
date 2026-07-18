import { BackofficeLeadOrigin, BackofficeLeadStatus, type BackofficeLead } from "@prisma/client"
import { getEnvService } from "@/lib/env"

type BackofficeLeadSlackEventInput = {
  lead: Pick<
    BackofficeLead,
    | "id"
    | "name"
    | "email"
    | "phone"
    | "notes"
    | "status"
    | "origin"
    | "createdAt"
    | "qualificationLeadOrganization"
    | "qualificationAvgUsers"
    | "qualificationProfileFit"
  >
  title?: string
  force?: boolean
}

type SlackNotificationResult = {
  success: boolean
  skipped?: boolean
  error?: string
}

const statusLabels: Record<BackofficeLeadStatus, string> = {
  new_opportunity: "Nova oportunidade",
  scheduled: "Agendado",
  no_show: "No-show",
  new_adhesion: "Nova adesão",
  lost: "Perdido",
  implementation: "Implementação",
  finalized: "Finalizado",
}

const originLabels: Record<BackofficeLeadOrigin | "public_form", string> = {
  manual: "Manual",
  webhook_meta: "Webhook Meta",
  landing_page: "Landing page",
  public_form: "Formulário público",
}

function escapeSlackMrkdwn(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function formatOptional(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? escapeSlackMrkdwn(trimmed) : "Não informado"
}

function formatDatePtBr(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date)
}

function getBackofficeLeadsSlackWebhookUrl() {
  const envService = getEnvService()

  if (!envService.isValid()) {
    const validation = envService.validate()
    if (!validation.isValid) {
      return {
        success: false as const,
        error: validation.errorMessages.join("; ") || "Falha ao validar variáveis de ambiente",
      }
    }
  }

  return {
    success: true as const,
    webhookUrl: envService.getEnv().SLACK_BACKOFFICE_LEADS_WEBHOOK_URL.trim(),
  }
}

export class BackofficeLeadSlackNotificationService {
  async sendLeadCreatedEvent(input: BackofficeLeadSlackEventInput): Promise<SlackNotificationResult> {
    if (!input.force && input.lead.status !== BackofficeLeadStatus.new_opportunity) {
      return { success: true, skipped: true }
    }

    const envResult = getBackofficeLeadsSlackWebhookUrl()
    if (!envResult.success) {
      return {
        success: false,
        error: envResult.error,
      }
    }

    const webhookUrl = envResult.webhookUrl
    if (!webhookUrl) {
      return {
        success: false,
        error: "SLACK_BACKOFFICE_LEADS_WEBHOOK_URL não configurada nas variáveis de ambiente",
      }
    }

    const payload = this.buildLeadCreatedPayload(input)
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const responseBody = await response.text().catch(() => "")
      console.error("[BackofficeLeadSlackNotificationService][sendLeadCreatedEvent] Slack webhook retornou erro", {
        status: response.status,
        responseBody,
        leadId: input.lead.id,
      })
      return { success: false, error: "Falha ao enviar evento para o Slack" }
    }

    console.info("[BackofficeLeadSlackNotificationService][sendLeadCreatedEvent] Evento enviado", {
      leadId: input.lead.id,
      title: input.title,
    })

    return { success: true }
  }

  async sendLeadCreatedEventBestEffort(input: BackofficeLeadSlackEventInput): Promise<void> {
    try {
      const result = await this.sendLeadCreatedEvent(input)
      if (!result.success) {
        console.error("[BackofficeLeadSlackNotificationService][sendLeadCreatedEventBestEffort] Evento não enviado", {
          leadId: input.lead.id,
          error: result.error,
        })
      }
    } catch (error) {
      console.error("[BackofficeLeadSlackNotificationService][sendLeadCreatedEventBestEffort] Exceção ao enviar evento", {
        leadId: input.lead.id,
        error,
      })
    }
  }

  private buildLeadCreatedPayload(input: BackofficeLeadSlackEventInput) {
    const { lead } = input
    const title = input.title ?? "Novo lead no backoffice"
    const fields = [
      { type: "mrkdwn", text: `*Nome:*\n${formatOptional(lead.name)}` },
      { type: "mrkdwn", text: `*Origem:*\n${originLabels[lead.origin] ?? lead.origin}` },
      { type: "mrkdwn", text: `*Status:*\n${statusLabels[lead.status] ?? lead.status}` },
      { type: "mrkdwn", text: `*E-mail:*\n${formatOptional(lead.email)}` },
      { type: "mrkdwn", text: `*WhatsApp:*\n${formatOptional(lead.phone)}` },
      { type: "mrkdwn", text: `*Criado em:*\n${formatDatePtBr(lead.createdAt)}` },
    ]

    const blocks: Record<string, unknown>[] = [
      {
        type: "header",
        text: { type: "plain_text", text: title, emoji: true },
      },
      {
        type: "section",
        fields,
      },
    ]

    const qualificationFields = [
      lead.qualificationLeadOrganization ? `*Organização:*\n${formatOptional(lead.qualificationLeadOrganization)}` : null,
      lead.qualificationAvgUsers ? `*Volume/time:*\n${formatOptional(lead.qualificationAvgUsers)}` : null,
      lead.qualificationProfileFit ? `*Perfil:*\n${formatOptional(lead.qualificationProfileFit)}` : null,
    ].filter((item): item is string => Boolean(item))

    if (qualificationFields.length > 0) {
      blocks.push({
        type: "section",
        fields: qualificationFields.map((text) => ({ type: "mrkdwn", text })),
      })
    }

    if (lead.notes?.trim()) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Observações:*\n${escapeSlackMrkdwn(lead.notes.trim()).slice(0, 2900)}`,
        },
      })
    }

    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Lead ID: ${escapeSlackMrkdwn(lead.id)}`,
        },
      ],
    })

    return {
      text: `${title}: ${lead.name}`,
      blocks,
    }
  }
}

export const backofficeLeadSlackNotificationService = new BackofficeLeadSlackNotificationService()
