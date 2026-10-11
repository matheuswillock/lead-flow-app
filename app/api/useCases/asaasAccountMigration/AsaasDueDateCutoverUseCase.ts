import { Output } from "@/lib/output"
import type { BillingQuote } from "@/app/api/shared/billing/billingQuoteTypes"
import type { IAsaasAccountMigrationRepository } from "@/app/api/infra/data/repositories/asaasAccountMigration/IAsaasAccountMigrationRepository"
import { MigrateAsaasAccountUseCase } from "./MigrateAsaasAccountUseCase"
import { RequestCardReauthorizationUseCase } from "./RequestCardReauthorizationUseCase"

export class AsaasDueDateCutoverUseCase {
  constructor(
    private readonly dependencies: {
      ledgerRepository: IAsaasAccountMigrationRepository
      migrationUseCase: MigrateAsaasAccountUseCase
      requestReauthorizationUseCase: RequestCardReauthorizationUseCase
      now?: () => Date
    }
  ) {}

  async execute(): Promise<Output> {
    const now = this.dependencies.now?.() ?? new Date()
    const rows = (await this.dependencies.ledgerRepository.listDueForCutover?.(now)) ?? []
    const results: Array<{ legacyCustomerId: string; status: string; ok: boolean; skipped?: boolean }> = []
    for (const row of rows) {
      const quote = row.quoteSnapshot as BillingQuote | null
      if (!quote) {
        results.push({ legacyCustomerId: row.legacyCustomerId, status: "blocked", ok: false })
        continue
      }
      try {
        const cutover = await this.dependencies.migrationUseCase.execute({
          legacyCustomerId: row.legacyCustomerId,
          quote,
          now,
        })
        const cutoverResult = cutover.result as { status?: string; reason?: string } | null
        if (
          !cutover.isValid &&
          ["already_processing", "not_ready"].includes(cutoverResult?.reason ?? "")
        ) {
          results.push({
            legacyCustomerId: row.legacyCustomerId,
            status: "already_processing",
            ok: true,
            skipped: true,
          })
        } else if (
          cutover.isValid &&
          ["requires_card_reauth", "paused_awaiting_card"].includes(cutoverResult?.status ?? "")
        ) {
          const notification = await this.dependencies.requestReauthorizationUseCase.execute(row.legacyCustomerId, now)
          results.push({ legacyCustomerId: row.legacyCustomerId, status: notification.isValid ? "requires_card_reauth" : "failed", ok: notification.isValid })
        } else {
          results.push({
            legacyCustomerId: row.legacyCustomerId,
            status: cutover.isValid ? ((cutover.result as { status?: string } | null)?.status ?? "awaiting_due_date") : "failed",
            ok: cutover.isValid,
          })
        }
      } catch (error) {
        console.error("[AsaasDueDateCutoverUseCase] Falha em uma linha", { legacyCustomerId: row.legacyCustomerId, error })
        results.push({ legacyCustomerId: row.legacyCustomerId, status: "failed", ok: false })
      }
    }
    const succeeded = results.filter((result) => result.ok && !result.skipped).length
    const failed = results.filter((result) => !result.ok).length
    const skipped = results.filter((result) => result.skipped).length
    const allSucceeded = failed === 0
    return new Output(
      allSucceeded,
      allSucceeded ? ["Corte de vencimento processado"] : ["Corte de vencimento concluído com falhas"],
      allSucceeded ? [] : results.filter((result) => !result.ok).map((result) => `${result.legacyCustomerId}: falha no corte`),
      { processed: results.length, succeeded, failed, skipped, results },
    )
  }
}
