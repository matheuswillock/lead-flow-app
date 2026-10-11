import type { IAsaasAccountMigrationRepository } from "@/app/api/infra/data/repositories/asaasAccountMigration/IAsaasAccountMigrationRepository"
import type { BillingQuote } from "@/app/api/shared/billing/billingQuoteTypes"
import { Output } from "@/lib/output"
import type { MigrateAsaasAccountUseCase } from "./MigrateAsaasAccountUseCase"
import type { RequestCardReauthorizationUseCase } from "./RequestCardReauthorizationUseCase"

export class AsaasCardReauthorizationReminderUseCase {
  constructor(private readonly dependencies: {
    ledgerRepository: IAsaasAccountMigrationRepository
    migrationUseCase: MigrateAsaasAccountUseCase
    requestUseCase: RequestCardReauthorizationUseCase
    now?: () => Date
  }) {}

  async execute(): Promise<Output> {
    const now = this.dependencies.now?.() ?? new Date()
    const rows = await this.dependencies.ledgerRepository.listForReauthorizationReminder?.(now) ?? []
    const results: Array<{ legacyCustomerId: string; ok: boolean; skipped: boolean }> = []
    for (const row of rows) {
      try {
        let status: string = row.status
        if (["pending", "customer_created", "awaiting_due_date"].includes(status)) {
          const quote = row.quoteSnapshot as BillingQuote | null
          if (!quote) {
            results.push({ legacyCustomerId: row.legacyCustomerId, ok: false, skipped: false })
            continue
          }
          const preparation = await this.dependencies.migrationUseCase.execute({
            legacyCustomerId: row.legacyCustomerId,
            quote,
            now,
          })
          const preparationResult = preparation.result as { status?: string; reason?: string } | null
          if (!preparation.isValid) {
            const skipped = ["already_processing", "not_ready"].includes(
              preparationResult?.reason ?? "",
            )
            results.push({ legacyCustomerId: row.legacyCustomerId, ok: skipped, skipped })
            continue
          }
          status = preparationResult?.status ?? status
        }
        if (!["requires_card_reauth", "paused_awaiting_card"].includes(status)) {
          results.push({ legacyCustomerId: row.legacyCustomerId, ok: true, skipped: true })
          continue
        }
        const notification = await this.dependencies.requestUseCase.execute(row.legacyCustomerId, now)
        results.push({
          legacyCustomerId: row.legacyCustomerId,
          ok: notification.isValid,
          skipped: Boolean((notification.result as { skipped?: boolean } | null)?.skipped),
        })
      } catch (error) {
        console.error("[AsaasCardReauthorizationReminderUseCase] Falha em uma linha", {
          legacyCustomerId: row.legacyCustomerId,
          error,
        })
        results.push({ legacyCustomerId: row.legacyCustomerId, ok: false, skipped: false })
      }
    }
    const failed = results.filter((result) => !result.ok).length
    const skipped = results.filter((result) => result.skipped).length
    const succeeded = results.length - failed - skipped
    return new Output(
      failed === 0,
      failed === 0 ? ["Lembretes de reautorização processados"] : [],
      failed === 0 ? [] : ["Falha ao processar parte dos lembretes de reautorização"],
      { processed: results.length, succeeded, failed, skipped, results },
    )
  }
}
