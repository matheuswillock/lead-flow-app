/**
 * 30-E2 — Silenciar a conta antiga (M0.3/M0.4/M0.5).
 *
 * Mata hoje o sintoma do bug Member PRO (§4 da auditoria): `PUT
 * /v3/customers/{id}` com `notificationDisabled: true` em todos os
 * customers do inventário E1 (entrada = dump JSON, nunca lista hardcoded —
 * C7), e desabilita os canais de notificação por customer (M0.5 — `GET
 * /v3/customers/{id}/notifications` + patch em lote). Alimenta
 * `corretor_studio_asaas_notification_backfill` (M0.4) e, quando a linha já
 * existe no ledger de 30-E3 (populate ainda não roda antes de E4 — normal
 * não existir ainda), marca `notifications_disabled = true` lá também.
 *
 * dry-run por padrão (espelha `scripts/billing/cutover-dry-run.ts`):
 * nenhuma chamada de escrita à API Asaas acontece sem `--apply` E
 * `ASAAS_SILENCE_CUSTOMERS_APPLY=1` no ambiente (T-30.5).
 *
 * Uso:
 *   bun run scripts/billing/silence-asaas-customers.ts --input=dump.json
 *   ASAAS_SILENCE_CUSTOMERS_APPLY=1 \
 *     bun run scripts/billing/silence-asaas-customers.ts --input=dump.json --apply
 *
 * --input=<path>  dump JSON do inventário E1 (`asaas-account-inventory.ts`,
 *                  com --output ou redirecionado) — obrigatório (C7).
 * --apply         emite as escritas de verdade; sem a env de confirmação, aborta.
 */

import { readFileSync } from "node:fs"
import { prisma } from "@/app/api/infra/data/prisma"
import { asaasNotificationBackfillRepository } from "@/app/api/infra/data/repositories/asaasNotificationBackfill/AsaasNotificationBackfillRepository"
import { asaasAccountMigrationRepository } from "@/app/api/infra/data/repositories/asaasAccountMigration/AsaasAccountMigrationRepository"
import {
  createAsaasCustomerSilencingGateway,
  type IAsaasCustomerSilencingGateway,
} from "./lib/asaasCustomerSilencingGateway"
import {
  assertApplyAuthorized,
  assertLegacyAccountDump,
  parseSilenceArgs,
  selectCustomersToSilence,
  summarizeSilenceRun,
  type InventoryDumpShape,
  type SilenceCustomerResult,
} from "./lib/silenceAsaasCustomersLogic"

/** Log operacional em stderr — stdout fica reservado para o JSON final (mesmo padrão de E1). */
function logInfo(message: string): void {
  process.stderr.write(`${message}\n`)
}

function loadInventoryDump(path: string): InventoryDumpShape {
  const raw = readFileSync(path, "utf-8")
  const parsed = JSON.parse(raw)
  if (!parsed?.customers?.data || !Array.isArray(parsed.customers.data)) {
    throw new Error(`--input=${path}: JSON não tem o formato esperado (customers.data[])`)
  }
  return parsed as InventoryDumpShape
}

async function silenceOneCustomer(
  gateway: IAsaasCustomerSilencingGateway | null,
  customerId: string,
  email: string,
  apply: boolean
): Promise<SilenceCustomerResult> {
  if (!apply || !gateway) {
    return { customerId, email, outcome: "dry-run", channelsDisabledCount: 0 }
  }

  try {
    await gateway.disableCustomerNotifications(customerId)
    const channels = await gateway.listCustomerNotificationChannels(customerId)
    const updated = await gateway.disableNotificationChannelsBatch(customerId, channels)

    await asaasNotificationBackfillRepository.markCompleted(customerId)
    // Best-effort: a linha só existe no ledger depois do populate de E4 —
    // pré-E4 isso é sempre um no-op silencioso, e está correto que seja.
    await asaasAccountMigrationRepository.markNotificationsDisabled(customerId).catch(() => false)

    return { customerId, email, outcome: "silenced", channelsDisabledCount: updated.length }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await asaasNotificationBackfillRepository.markFailed(customerId, message).catch(() => {})
    return { customerId, email, outcome: "failed", channelsDisabledCount: 0, error: message }
  }
}

function printSummary(summary: ReturnType<typeof summarizeSilenceRun>): void {
  logInfo("\n[silence] ── resumo ──────────────────────────────────────")
  logInfo(`  conta               : ${summary.account}`)
  logInfo(`  modo                : ${summary.apply ? "APPLY (escrita real)" : "dry-run"}`)
  logInfo(`  candidatos          : ${summary.totalCandidates}`)
  logInfo(`  sucesso             : ${summary.succeeded}`)
  logInfo(`  falha               : ${summary.failed}`)
  if (summary.failed > 0) {
    logInfo(`\n[silence] falhas (linha nomeada, nunca média silenciosa):`)
    for (const result of summary.results.filter((r) => r.outcome === "failed")) {
      logInfo(`  [${result.customerId}] ${result.email}: ${result.error}`)
    }
  }
  logInfo("────────────────────────────────────────────────────────────\n")
}

async function main() {
  const args = parseSilenceArgs(process.argv.slice(2))
  assertApplyAuthorized(args, process.env)

  const dump = loadInventoryDump(args.input)
  // Antes de qualquer coisa que possa escrever: E2 é da conta legada.
  assertLegacyAccountDump(dump)

  // Achado P2 (thread PRRT_...dNdO): o sinal de "já terminou" é o ledger,
  // não a flag do Asaas — quem falhou na fase de canais tem a flag ligada
  // e o backfill incompleto, e precisa continuar elegível ao retry. Se o
  // ledger não puder ser lido, seguimos sem ele (degrada para a flag).
  const completedCustomerIds = await asaasNotificationBackfillRepository
    .listCompletedCustomerIds()
    .then((ids) => new Set(ids))
    .catch((error) => {
      logInfo(
        `[silence] aviso: ledger de backfill indisponível (${
          error instanceof Error ? error.message : String(error)
        }) — caindo para a flag notificationDisabled do dump.`
      )
      return undefined
    })

  const candidates = selectCustomersToSilence(dump, completedCustomerIds)

  logInfo(
    `[silence] conta=${dump.account} candidatos=${candidates.length} modo=${args.apply ? "APPLY" : "dry-run"}`
  )

  // Lazy: em dry-run, nenhuma credencial Asaas precisa estar configurada —
  // pré-cutover ASAAS_LEGACY_API_KEY nem existe ainda, e o dry-run MUST
  // continuar rodável mesmo assim (é a forma de prever o que --apply faria).
  const gateway = args.apply ? createAsaasCustomerSilencingGateway(dump.account) : null

  const results: SilenceCustomerResult[] = []
  for (const customer of candidates) {
    const result = await silenceOneCustomer(gateway, customer.id, customer.email, args.apply)
    results.push(result)
    logInfo(`  [${result.outcome}] ${customer.id} (${customer.email})`)
  }

  const summary = summarizeSilenceRun(dump.account, args.apply, results)
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n")
  printSummary(summary)

  // Achado da revisão (codex, P2): silenciamento parcial saía com exit 0 e
  // um orquestrador leria "sucesso" com N customers ainda notificando. O
  // relatório já nomeia cada falha; o exit code passa a refletir isso.
  if (summary.failed > 0) {
    logInfo(`[silence] ${summary.failed} customer(s) falharam — exit 1`)
    process.exitCode = 1
  }
}

main()
  .catch((err) => {
    console.error("[silence] erro fatal:", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
