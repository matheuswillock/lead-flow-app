import type { EmailEventType } from "@prisma/client"
import { randomUUID } from "crypto"
import { emailLogRepository } from "@/app/api/infra/data/repositories/emailLog/EmailLogRepository"
import type { IEmailLogRepository, EmailLogWebhookRecord } from "@/app/api/infra/data/repositories/emailLog/IEmailLogRepository"
import type { EmailEventOrigin } from "@/lib/email/email-event-origin-classifier"
import type { ResendWebhookPayload } from "@/app/api/useCases/resendWebhook/resendWebhookTypes"

const EVENT_TYPE_MAP: Record<string, EmailEventType> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.suppressed": "suppressed",
  "email.delivery_delayed": "delivery_delayed",
  "email.unsubscribed": "unsubscribed",
  "email.failed": "failed",
}

export class ResendWebhookService {
  constructor(private readonly emailLogs: IEmailLogRepository = emailLogRepository) {}

  mapEventType(resendEventType: string): EmailEventType | null {
    return EVENT_TYPE_MAP[resendEventType] ?? null
  }

  /**
   * Momento REAL do evento, não a criação do e-mail.
   *
   * O pipeline usava `data.created_at` como `occurredAt` — mas esse campo é a
   * hora de CRIAÇÃO do e-mail, constante para todos os eventos da mesma
   * mensagem (medido em produção, 17/09). Consequência: toda abertura repetida
   * do mesmo destinatário chegava com o MESMO `occurredAt`, e o dedupe por
   * `(logId, type, occurredAt)` a engolia — era ESTE o corte que deixava só 1
   * open por destinatário no banco, não o provedor. `open.timestamp` /
   * `click.timestamp` carregam a hora verdadeira de cada fetch/clique; o
   * `created_at` do topo do payload é o fallback (hora de emissão do evento).
   */
  resolveOccurredAt(event: ResendWebhookPayload): Date {
    const eventSpecificTimestamp =
      event.type === "email.opened"
        ? event.data.open?.timestamp
        : event.type === "email.clicked"
          ? event.data.click?.timestamp
          : null

    const raw = eventSpecificTimestamp ?? (this.isEventTimeAnchored(event.type) ? event.created_at : null) ?? event.data.created_at
    const parsed = raw ? new Date(raw) : new Date()
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed
  }

  /**
   * Só abertura/clique mudam de âncora nesta fase: são os tipos cuja repetição
   * precisa persistir e cuja classificação depende do delta real. Os demais
   * tipos mantêm `data.created_at` (comportamento legado) até decisão
   * explícita — mudar a âncora de `delivered`/`bounced` mexeria nas janelas do
   * analytics (SPEC 30 — D5) sem necessidade para esta entrega.
   */
  private isEventTimeAnchored(resendEventType: string): boolean {
    return resendEventType === "email.opened" || resendEventType === "email.clicked"
  }

  async processEmailLogWebhook(input: {
    log: EmailLogWebhookRecord
    eventType: EmailEventType
    occurredAt: Date
    metadata: Record<string, unknown>
    resendEventType: string
    svixId?: string | null
    /** Classificação de origem (opened/clicked) — já computada no use case. */
    origin?: EmailEventOrigin
  }): Promise<boolean> {
    const { log, eventType, occurredAt, metadata } = input
    const eventMetadata = {
      ...metadata,
      ...(input.svixId ? { svixId: input.svixId } : {}),
    }

    const duplicate = await this.emailLogs.hasDuplicateEvent(log.id, eventType, occurredAt)
    if (duplicate) {
      console.info(
        `[ResendWebhookService] Evento duplicado ignorado para log ${log.id}: ${input.resendEventType}`
      )
      return true
    }

    await this.emailLogs.applyWebhookEvent({
      log,
      eventType,
      occurredAt,
      metadata: eventMetadata,
      eventId: randomUUID(),
      origin: input.origin,
    })

    console.info(`[ResendWebhookService] Evento ${input.resendEventType} processado para log ${log.id}`)
    return true
  }
}

export const resendWebhookService = new ResendWebhookService()
