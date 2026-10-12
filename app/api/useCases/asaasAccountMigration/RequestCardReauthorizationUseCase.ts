import type { IAsaasAccountMigrationRepository } from "@/app/api/infra/data/repositories/asaasAccountMigration/IAsaasAccountMigrationRepository"
import type { AsaasCardReauthorizationRepository } from "@/app/api/infra/data/repositories/asaasCardReauthorization/AsaasCardReauthorizationRepository"
import { Output } from "@/lib/output"

export interface ICardReauthorizationNotifier {
  send(input: { to: string; name: string; url: string; expiresAt: Date }): Promise<void>
}

export class RequestCardReauthorizationUseCase {
  constructor(
    private readonly dependencies: {
      ledgerRepository: IAsaasAccountMigrationRepository
      tokenRepository: Pick<AsaasCardReauthorizationRepository, "createToken">
      notifier: ICardReauthorizationNotifier
      publicAppUrl: string
    }
  ) {}

  async execute(legacyCustomerId: string, now = new Date()): Promise<Output> {
    const migration = await this.dependencies.ledgerRepository.findByLegacyCustomerId(legacyCustomerId)
    if (!migration) return new Output(false, [], ["Registro de migração não encontrado"], null)
    if (!migration.primaryCustomerId) return new Output(false, [], ["Customer primary ausente"], null)
    if (!["legacy_removed", "requires_card_reauth", "paused_awaiting_card"].includes(migration.status)) {
      return new Output(false, [], ["Migração ainda não está aguardando reautorização"], null)
    }

    const masterContact = await this.dependencies.ledgerRepository.findActiveMasterContact?.(migration.profileId)
    if (!masterContact) {
      return new Output(false, [], ["Master ativo não encontrado para a notificação"], null)
    }
    const civilDay = (date: Date) => new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date)
    if (
      migration.reauthorizationRequestedAt &&
      civilDay(migration.reauthorizationRequestedAt) === civilDay(now)
    ) {
      return new Output(true, ["Lembrete do dia já enviado"], [], { skipped: true })
    }

    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const token = await this.dependencies.tokenRepository.createToken(migration.id, expiresAt)
    const requestedAt = now
    if (["requires_card_reauth", "paused_awaiting_card"].includes(migration.status)) {
      await this.dependencies.ledgerRepository.markReauthorizationRequested?.(
        legacyCustomerId,
        requestedAt,
      )
    } else {
      await this.dependencies.ledgerRepository.transition({
        legacyCustomerId,
        toStatus: "requires_card_reauth",
        reauthorizationRequestedAt: requestedAt,
      })
    }
    const url = this.dependencies.publicAppUrl.replace(/\/$/, "")
    await this.dependencies.notifier.send({ to: masterContact.email, name: masterContact.name, url, expiresAt })
    return new Output(true, ["Link de reautorização enviado"], [], { expiresAt })
  }
}
