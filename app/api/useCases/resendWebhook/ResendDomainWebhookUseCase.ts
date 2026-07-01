import { Output } from "@/lib/output"
import {
  emailTeamDomainEventRepository,
  type EmailTeamDomainEventType,
  type IEmailTeamDomainEventRepository,
} from "@/app/api/infra/data/repositories/emailTeamDomainEvent/EmailTeamDomainEventRepository"
import type { ResendWebhookPayload } from "@/app/api/useCases/resendWebhook/resendWebhookTypes"

export class ResendDomainWebhookUseCase {
  constructor(
    private readonly domainEvents: IEmailTeamDomainEventRepository = emailTeamDomainEventRepository
  ) {}

  async handle(event: ResendWebhookPayload): Promise<Output> {
    if (!event.type.startsWith("domain.")) {
      return new Output(true, [], [], { handled: false, reason: "not_domain_event" })
    }

    const domainId = event.data.id
    if (!domainId) {
      console.info("[ResendDomainWebhookUseCase] Evento de domínio sem id:", event.type)
      return new Output(true, [], [], { handled: false, reason: "missing_domain_id" })
    }

    const settings = await this.domainEvents.findTeamByResendDomainId(domainId)
    if (!settings) {
      console.info("[ResendDomainWebhookUseCase] Domínio não vinculado:", domainId)
      return new Output(true, [], [], { handled: false, reason: "team_not_found" })
    }

    const occurredAt = event.data.created_at ? new Date(event.data.created_at) : new Date()

    if (event.type === "domain.deleted") {
      await this.domainEvents.clearDomainSettings(settings.teamId)
      await this.domainEvents.recordEventIfMissing(settings.teamId, "domain_deleted", occurredAt, {
        domainId,
        domainName: settings.resendDomainName,
      })
      return new Output(true, ["Evento de domínio processado"], [], { handled: true, target: "team_domain" })
    }

    await this.domainEvents.syncFromResendDomain(
      settings.teamId,
      {
        id: domainId,
        name: event.data.name ?? settings.resendDomainName ?? undefined,
        status: event.data.status,
        region: event.data.region,
        records: event.data.records,
        open_tracking: event.data.open_tracking,
        click_tracking: event.data.click_tracking,
      },
      occurredAt
    )

    if (event.type === "domain.created") {
      await this.domainEvents.recordEventIfMissing(
        settings.teamId,
        "domain_added" as EmailTeamDomainEventType,
        occurredAt,
        { domainId, domainName: event.data.name }
      )
    }

    console.info(
      `[ResendDomainWebhookUseCase] Evento ${event.type} processado para time ${settings.teamId}`
    )
    return new Output(true, ["Evento de domínio processado"], [], { handled: true, target: "team_domain" })
  }
}

export const resendDomainWebhookUseCase = new ResendDomainWebhookUseCase()
