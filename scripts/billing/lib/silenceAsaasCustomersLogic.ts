/**
 * Lógica pura do silenciamento 30-E2 (M0.3/M0.4) — sem I/O, sem
 * `process.env`, sem `fetch`. Separado do CLI para ser importável em teste
 * sem disparar rede/Prisma/`main()` (mesmo padrão de
 * `asaasAccountInventoryLogic.ts`, E1).
 */

import type { AsaasAccountId } from "@/lib/asaas/asaas-account"
import type { AsaasCustomer } from "./asaasInventoryTypes"

export type SilenceArgs = {
  /** Caminho do dump JSON do inventário E1 — entrada obrigatória (C7: nunca lista hardcoded). */
  input: string
  apply: boolean
}

const REQUIRED_APPLY_ENV = "ASAAS_SILENCE_CUSTOMERS_APPLY"

export function parseSilenceArgs(argv: string[]): SilenceArgs {
  const input = argv.find((a) => a.startsWith("--input="))?.split("=")[1]
  if (!input) {
    throw new Error(
      "--input=<path> é obrigatório: aponte para o dump JSON do inventário E1 (C7 — nunca lista hardcoded)."
    )
  }
  return { input, apply: argv.includes("--apply") }
}

/**
 * T-30.5: `--apply` sem a env de confirmação aborta. Guard isolado (sem
 * side effect de process.exit) para ser testável diretamente.
 */
export function assertApplyAuthorized(
  args: SilenceArgs,
  env: Record<string, string | undefined>
): void {
  if (!args.apply) return
  if (env[REQUIRED_APPLY_ENV] !== "1") {
    throw new Error(
      `Recusado: --apply exige ${REQUIRED_APPLY_ENV}=1 (autorização explícita do owner — escrita em produção na conta antiga).`
    )
  }
}

export type InventoryDumpShape = {
  account: AsaasAccountId
  customers: { data: AsaasCustomer[] }
}

/**
 * Achado da revisão (cursor + codex, P1): E2 silencia a conta ANTIGA. Nada
 * no fluxo exigia `account === "legacy"`, e o inventário E1 sabe gerar dump
 * `primary` — logo `--apply` sobre um dump da conta nova desligaria a
 * notificação dos clientes ativos, que é justamente o canal de cobrança
 * legítimo hoje. O escopo do estágio é a conta legada; qualquer outra conta
 * é recusada antes de o gateway de escrita existir.
 */
export function assertLegacyAccountDump(dump: InventoryDumpShape): void {
  if (dump.account !== "legacy") {
    throw new Error(
      `Recusado: E2 silencia apenas a conta "legacy", mas o dump informado é da conta "${dump.account}". ` +
        "Silenciar a conta nova desligaria a notificação de cobrança dos clientes ativos."
    )
  }
}

/**
 * T-30.6: candidatos ao silenciamento = customers não deletados cujo
 * backfill ainda não foi CONCLUÍDO. Vem do JSON do inventário (C7), nunca
 * de lista embutida.
 *
 * Achado P2 da revisão do PR #1207 (thread PRRT_...dNdO): filtrar só por
 * `!notificationDisabled` excluía permanentemente quem falhou no MEIO do
 * processo. O silenciamento tem duas fases — `disableCustomerNotifications`
 * (flag do customer) e depois listar/desligar os canais. Se a primeira
 * passa e a segunda falha, o próximo dump traz `notificationDisabled: true`
 * e o cliente nunca mais é selecionado, com os canais ainda ligados: M0.5
 * fica incompleto e invisível.
 *
 * O sinal de conclusão correto é o ledger (`AsaasNotificationBackfill`),
 * que `markCompleted`/`markFailed` já mantêm por customer — não a flag do
 * Asaas, que reflete só a primeira fase. Reprocessar quem foi silenciado
 * mas não concluiu é seguro: as duas chamadas do gateway são idempotentes.
 *
 * `completedCustomerIds` ausente (ledger indisponível) degrada para o
 * comportamento anterior — só quem tem notificação ligada —, que é o
 * correto quando não há histórico para consultar.
 */
export function selectCustomersToSilence(
  dump: InventoryDumpShape,
  completedCustomerIds?: ReadonlySet<string>
): AsaasCustomer[] {
  return dump.customers.data.filter((customer) => {
    if (customer.deleted) return false
    if (!completedCustomerIds) return !customer.notificationDisabled
    // Com ledger: concluído sai; silenciado-mas-não-concluído continua
    // elegível para o retry da fase de canais.
    return !completedCustomerIds.has(customer.id)
  })
}

export type SilenceCustomerResult = {
  customerId: string
  email: string
  outcome: "silenced" | "failed" | "dry-run"
  channelsDisabledCount: number
  error?: string
}

export type SilenceRunSummary = {
  account: AsaasAccountId
  apply: boolean
  totalCandidates: number
  succeeded: number
  failed: number
  results: SilenceCustomerResult[]
}

export function summarizeSilenceRun(
  account: AsaasAccountId,
  apply: boolean,
  results: SilenceCustomerResult[]
): SilenceRunSummary {
  return {
    account,
    apply,
    totalCandidates: results.length,
    succeeded: results.filter((r) => r.outcome === "silenced" || r.outcome === "dry-run").length,
    failed: results.filter((r) => r.outcome === "failed").length,
    results,
  }
}
