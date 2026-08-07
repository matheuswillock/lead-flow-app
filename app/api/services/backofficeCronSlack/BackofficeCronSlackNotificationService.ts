import { getEnvService } from "@/lib/env"

type CronFailureAlertInput = {
  cronKey: string
  cronPath: string
  durationMs: number
  error: string
  executionId: string
}

type SlackNotificationResult = {
  success: boolean
  error?: string
}

function escapeSlackMrkdwn(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}min`
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

export class BackofficeCronSlackNotificationService {
  async sendFailureAlert(input: CronFailureAlertInput): Promise<SlackNotificationResult> {
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

    const payload = this.buildFailurePayload(input)
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const responseBody = await response.text().catch(() => "")
      console.error("[BackofficeCronSlackNotificationService][sendFailureAlert] Slack webhook retornou erro", {
        status: response.status,
        responseBody,
        cronKey: input.cronKey,
      })
      return { success: false, error: "Falha ao enviar alerta para o Slack" }
    }

    console.info("[BackofficeCronSlackNotificationService][sendFailureAlert] Alerta enviado", {
      cronKey: input.cronKey,
      executionId: input.executionId,
    })

    return { success: true }
  }

  async sendFailureAlertBestEffort(input: CronFailureAlertInput): Promise<void> {
    try {
      const result = await this.sendFailureAlert(input)
      if (!result.success) {
        console.error("[BackofficeCronSlackNotificationService][sendFailureAlertBestEffort] Alerta não enviado", {
          cronKey: input.cronKey,
          error: result.error,
        })
      }
    } catch (error) {
      console.error("[BackofficeCronSlackNotificationService][sendFailureAlertBestEffort] Exceção ao enviar alerta", {
        cronKey: input.cronKey,
        error,
      })
    }
  }

  private buildFailurePayload(input: CronFailureAlertInput) {
    const errorLines = input.error.split("\n")
    const errorSummary = errorLines[0] ?? input.error
    const errorPreview = input.error.slice(0, 500)

    const blocks: Record<string, unknown>[] = [
      {
        type: "header",
        text: { type: "plain_text", text: "🚨 Falha em Cron Job", emoji: true },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Cron:*\n${escapeSlackMrkdwn(input.cronKey)}` },
          { type: "mrkdwn", text: `*Status:*\n❌ Failed` },
          { type: "mrkdwn", text: `*Rota:*\n\`${escapeSlackMrkdwn(input.cronPath)}\`` },
          { type: "mrkdwn", text: `*Duração:*\n${formatDuration(input.durationMs)}` },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Erro:*\n\`\`\`${escapeSlackMrkdwn(errorPreview)}\`\`\``,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Execution ID: ${escapeSlackMrkdwn(input.executionId)}`,
          },
        ],
      },
    ]

    return {
      text: `Falha no cron ${input.cronKey}: ${errorSummary}`,
      blocks,
    }
  }
}

export const backofficeCronSlackNotificationService = new BackofficeCronSlackNotificationService()
