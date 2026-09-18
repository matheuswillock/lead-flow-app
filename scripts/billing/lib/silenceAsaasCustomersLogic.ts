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
 * T-30.6: candidatos ao silenciamento = customers com notificação LIGADA
 * e não deletados. Vem do JSON do inventário (C7), nunca de lista embutida.
 */
export function selectCustomersToSilence(dump: InventoryDumpShape): AsaasCustomer[] {
  return dump.customers.data.filter(
    (customer) => !customer.notificationDisabled && !customer.deleted
  )
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
