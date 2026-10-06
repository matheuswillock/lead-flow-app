import * as Sentry from "@sentry/nextjs"
import type { AsaasAccountMigration, AsaasAccountMigrationStatus } from "@prisma/client"
import { Output } from "@/lib/output"
import type { AsaasAccountId } from "@/lib/asaas/asaas-account"
import { asaasAccountMigrationRepository } from "@/app/api/infra/data/repositories/asaasAccountMigration/AsaasAccountMigrationRepository"
import type { IAsaasAccountMigrationRepository } from "@/app/api/infra/data/repositories/asaasAccountMigration/IAsaasAccountMigrationRepository"
// Reuso deliberado do inventário read-only de 30-E1 (SPEC explícita: "reusa
// o inventário E1 em modo read-only"): a classificação de divergência
// (INTEGRO/ORFAO/FANTASMA/DIVERGENCIA_STATUS) é conhecimento de negócio já
// implementado e testado (T-30.2) — duplicá-lo aqui violaria DRY (agents.md
// "duplicação de conhecimento de negócio deve ser eliminada"). `scripts/
// billing/lib/**` são módulos puros (sem I/O de topo, sem `main()`
// executando no import), seguros para importar em runtime de app.
import {
  AsaasReadOnlyGateway,
  fetchAllPages,
  type IAsaasReadOnlyGateway,
} from "@/scripts/billing/lib/asaasReadOnlyGateway"
import { BillingInventoryRepository } from "@/scripts/billing/lib/BillingInventoryRepository"
import type { IBillingInventoryRepository } from "@/scripts/billing/lib/IBillingInventoryRepository"
import { reconcileInventory, type ReconciliationCase } from "@/scripts/billing/lib/reconcileInventory"
import type { AsaasCustomer, AsaasSubscription } from "@/scripts/billing/lib/asaasInventoryTypes"

const LEDGER_STALENESS_HOURS = 24
const RECONCILED_ACCOUNTS: AsaasAccountId[] = ["primary", "legacy"]

export type AsaasStaleLedgerRow = {
  legacyCustomerId: string
  status: AsaasAccountMigrationStatus
  ageHours: number
}

export type AsaasDualAccountReconciliationReport = {
  generatedAt: string
  byAccount: Record<AsaasAccountId, { divergences: ReconciliationCase[]; error: string | null }>
  staleLedgerRows: AsaasStaleLedgerRow[]
}

export type AsaasDualAccountReconciliationDeps = {
  ledgerRepository: IAsaasAccountMigrationRepository
  inventoryRepository: IBillingInventoryRepository
  createGateway: (account: AsaasAccountId) => IAsaasReadOnlyGateway
  now: () => Date
}

function buildDefaultDeps(): AsaasDualAccountReconciliationDeps {
  return {
    ledgerRepository: asaasAccountMigrationRepository,
    inventoryRepository: new BillingInventoryRepository(),
    createGateway: (account) => new AsaasReadOnlyGateway(account),
    now: () => new Date(),
  }
}

/**
 * Distingue "conta ainda não provisionada" (esperado pré-cutover, benigno)
 * de falha real de rede/banco. A mensagem vem de `resolveAsaasAccount`
 * (`lib/asaas/asaas-account.ts`), que lança citando a env ausente.
 */
function isAccountNotProvisionedError(error: string): boolean {
  return error.includes("ASAAS_LEGACY_API_KEY")
}

function toStaleRow(row: AsaasAccountMigration, now: Date): AsaasStaleLedgerRow {
  const ageMs = now.getTime() - row.updatedAt.getTime()
  return {
    legacyCustomerId: row.legacyCustomerId,
    status: row.status,
    ageHours: Math.round(ageMs / (60 * 60_000)),
  }
}

/**
 * E7 (X3, T-30.25) — cron diário de reconciliação da janela dual.
 * `app/api/v1/billing/cron/asaas-dual-account-reconciliation/route.ts` só
 * autentica e chama `execute()`; toda a lógica mora aqui (Route -> UseCase).
 */
export class AsaasDualAccountReconciliationUseCase {
  private readonly deps: AsaasDualAccountReconciliationDeps

  constructor(deps: Partial<AsaasDualAccountReconciliationDeps> = {}) {
    this.deps = { ...buildDefaultDeps(), ...deps }
  }

  async execute(): Promise<Output> {
    const now = this.deps.now()
    const byAccount = {} as AsaasDualAccountReconciliationReport["byAccount"]

    for (const account of RECONCILED_ACCOUNTS) {
      byAccount[account] = await this.reconcileAccount(account, now)
    }

    const staleCutoff = new Date(now.getTime() - LEDGER_STALENESS_HOURS * 60 * 60_000)
    const staleRows = (await this.deps.ledgerRepository.listNonTerminalStaleSince(staleCutoff)).map(
      (row) => toStaleRow(row, now)
    )

    const report: AsaasDualAccountReconciliationReport = {
      generatedAt: now.toISOString(),
      byAccount,
      staleLedgerRows: staleRows,
    }

    this.alertIfNeeded(report)

    return new Output(true, ["Reconciliação executada"], [], report)
  }

  private async reconcileAccount(
    account: AsaasAccountId,
    now: Date
  ): Promise<{ divergences: ReconciliationCase[]; error: string | null }> {
    try {
      const gateway = this.deps.createGateway(account)
      const [asaasCustomers, asaasSubscriptions, dbCustomerPointers, dbSubscriptionPointers] =
        await Promise.all([
          fetchAllPages<AsaasCustomer>(gateway, "/customers"),
          fetchAllPages<AsaasSubscription>(gateway, "/subscriptions"),
          this.deps.inventoryRepository.listCustomerPointers(account),
          this.deps.inventoryRepository.listSubscriptionPointers(account),
        ])

      const result = reconcileInventory({
        asaasCustomers,
        asaasSubscriptions,
        asaasPayments: [],
        dbCustomerPointers,
        dbSubscriptionPointers,
        today: now,
      })

      return { divergences: result.cases.filter((c) => c.code !== "INTEGRO"), error: null }
    } catch (error) {
      // A conta legacy pode não estar provisionada ainda (pré-cutover) —
      // isso não é uma divergência, é ausência de infraestrutura. Registra
      // e segue para não derrubar o cron inteiro por uma conta ausente.
      const message = error instanceof Error ? error.message : String(error)
      console.error(
        `[AsaasDualAccountReconciliationUseCase] falha ao reconciliar conta ${account}`,
        error
      )
      return { divergences: [], error: message }
    }
  }

  private alertIfNeeded(report: AsaasDualAccountReconciliationReport): void {
    const namedDivergences = RECONCILED_ACCOUNTS.flatMap((account) =>
      report.byAccount[account].divergences.map((c) => ({ account, ...c }))
    )

    // Achado da revisão (codex, P1): antes, uma conta que falhou inteira
    // devolvia `divergences: []` + `error`, e a condição só olhava
    // divergências/ledger — ou seja, Asaas fora do ar ou banco indisponível
    // produzia SILÊNCIO, exatamente a falha silenciosa que E7 existe para
    // impedir (X3). Erro de reconciliação agora é alerta de primeira classe.
    // Exceção deliberada: pré-cutover a conta legacy legitimamente não está
    // provisionada (`resolveAsaasAccount("legacy")` lança) — alertar nisso
    // todo dia seria ruído garantido, então esse caso específico não conta.
    const failures = RECONCILED_ACCOUNTS.map((account) => ({
      account,
      error: report.byAccount[account].error,
    })).filter(
      (entry): entry is { account: AsaasAccountId; error: string } =>
        entry.error !== null && !isAccountNotProvisionedError(entry.error)
    )

    // "Ledger todo terminal -> sem alerta" (T-30.25): silêncio absoluto
    // quando não há nada a reportar — alerta é sinal, não ruído de rotina.
    if (
      namedDivergences.length === 0 &&
      report.staleLedgerRows.length === 0 &&
      failures.length === 0
    ) {
      return
    }

    // Reconciliação que não rodou é pior que divergência encontrada: não se
    // sabe o que há de errado. Por isso a falha escala a severidade.
    const message =
      failures.length > 0
        ? "[AsaasDualAccountReconciliation] reconciliação falhou — janela dual sem verificação"
        : "[AsaasDualAccountReconciliation] divergências encontradas"

    Sentry.captureMessage(message, {
      level: failures.length > 0 ? "error" : "warning",
      tags: { route: "AsaasDualAccountReconciliationCron" },
      extra: {
        divergenceCount: namedDivergences.length,
        divergences: namedDivergences,
        staleLedgerRows: report.staleLedgerRows,
        failures,
      },
    })
  }
}

export const asaasDualAccountReconciliationUseCase = new AsaasDualAccountReconciliationUseCase()
