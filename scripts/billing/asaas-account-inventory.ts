/**
 * 30-E1 — Inventário + re-censo read-only das contas Asaas.
 *
 * Lê customers, subscriptions, payments (PENDING/OVERDUE/CREDIT_CARD — esta
 * última alimenta o inventário de parcelamentos em aberto) e webhooks, com
 * paginação completa, e opcionalmente reconcilia com o banco (5 casos do
 * §7.3 do plano de migração: INTEGRO/ORFAO/DIVERGENCIA_STATUS/FANTASMA/
 * SEM_BANCO) e com a planilha do owner.
 *
 * GARANTIA READ-ONLY (por construção, não por convenção): toda chamada à
 * API Asaas passa por `IAsaasReadOnlyGateway.fetchPage`, que só sabe emitir
 * GET (`scripts/billing/lib/asaasReadOnlyGateway.ts`) — não existe caminho
 * de código neste script capaz de fazer POST/PUT/DELETE contra o Asaas. A
 * única escrita é local: o arquivo de saída, se `--output` for informado.
 *
 * Uso:
 *   bun run scripts/billing/asaas-account-inventory.ts
 *   bun run scripts/billing/asaas-account-inventory.ts --account=primary
 *   bun run scripts/billing/asaas-account-inventory.ts --reconcile
 *   bun run scripts/billing/asaas-account-inventory.ts --reconcile --spreadsheet=planilha.json
 *   bun run scripts/billing/asaas-account-inventory.ts --output=asaas-inventory-legacy-2026-09-16.json
 *
 * --account=legacy|primary  conta a inventariar (default legacy — a conta a re-censear primeiro)
 * --reconcile                roda a reconciliação banco × Asaas × planilha
 * --spreadsheet=<path>       JSON `[{ "name": string, "email": string }, ...]` com os
 *                            pagantes conhecidos do owner (§3 da auditoria — pagante
 *                            nem sempre tem customer Asaas). Sem esta flag, o caso
 *                            SEM_BANCO nunca roda — o relatório marca
 *                            `reconciliation.spreadsheetChecked=false` em vez de
 *                            fingir que reconciliou.
 * --output=<path>            grava o JSON no arquivo (nome sugerido versionado:
 *                            `buildDefaultOutputFilename`, ex. asaas-inventory-legacy-2026-09-16.json).
 *                            Sem esta flag, imprime o JSON em stdout — e SÓ o JSON:
 *                            logs de progresso e o resumo humano saem sempre por
 *                            stderr, então `... | jq .` e redirecionamento funcionam.
 *
 * Decisão de desenho (30-E1, sem instrução mais específica na SPEC): o
 * formato de planilha acima é o contrato mínimo suficiente para casar por
 * e-mail com `Profile`/`BackofficeAdhesion` — qualquer coluna adicional da
 * planilha real do owner (valor, ação combinada) fica de fora deste
 * inventário técnico e continua vivendo na nota de progresso/planilha
 * original; o script só prova a ausência/presença de vínculo no banco.
 */

import { readFileSync, writeFileSync } from "node:fs"
import { prisma } from "@/app/api/infra/data/prisma"
import type { AsaasAccountId } from "@/lib/asaas/asaas-account"
import { createAsaasReadOnlyGateway, fetchAllPages } from "./lib/asaasReadOnlyGateway"
import { BillingInventoryRepository } from "./lib/BillingInventoryRepository"
import {
  buildDefaultOutputFilename,
  buildInventoryReport,
  dedupePaymentsById,
  parseInventoryArgs,
  type InventoryReport,
} from "./lib/asaasAccountInventoryLogic"
import { reconcileInventory, type OwnerSpreadsheetEntry } from "./lib/reconcileInventory"
import type { AsaasCustomer, AsaasPayment, AsaasSubscription, AsaasWebhookConfig } from "./lib/asaasInventoryTypes"

/**
 * Log operacional em stderr: stdout fica reservado para o JSON do relatório
 * (quando não há --output), mantendo a saída parseável por pipe (achado
 * Codex no PR #1189).
 */
function logInfo(message: string): void {
  process.stderr.write(`${message}\n`)
}

function loadOwnerSpreadsheet(path: string): OwnerSpreadsheetEntry[] {
  const raw = readFileSync(path, "utf-8")
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed)) {
    throw new Error(`--spreadsheet=${path}: esperado um array JSON de { name, email }`)
  }
  return parsed
}

function printSummary(report: InventoryReport, account: AsaasAccountId, suggestedFilename: string) {
  logInfo("\n[inventory] ── resumo ──────────────────────────────────────")
  logInfo(`  conta               : ${account}`)
  logInfo(`  gerado em           : ${report.generatedAt}`)
  logInfo(`  customers total     : ${report.customers.total}`)
  logInfo(`  notificações LIGADAS: ${report.customers.withNotificationsEnabled}  ← candidatos ao silenciamento (E2)`)
  logInfo(`  assinaturas total   : ${report.subscriptions.total}`)
  for (const [status, count] of Object.entries(report.subscriptions.byStatus)) {
    logInfo(`    status ${status.padEnd(12)}: ${count}`)
  }
  logInfo(`  cartão de crédito   : ${report.subscriptions.creditCardCount}  ← dimensiona E6`)
  logInfo(`  pagamentos pendentes: ${report.pendingPayments.total} (R$ ${report.pendingPayments.totalValue})`)
  logInfo(`  pagamentos vencidos : ${report.overduePayments.total} (R$ ${report.overduePayments.totalValue})`)
  logInfo(`  webhooks configurados: ${report.webhooks.total} (${report.webhooks.enabled} habilitados)`)

  if (report.reconciliation) {
    const r = report.reconciliation
    logInfo(`  ── reconciliação ───────────────────────────────────────`)
    logInfo(`  INTEGRO             : ${r.countsByCode.INTEGRO}`)
    logInfo(`  ORFAO               : ${r.countsByCode.ORFAO}`)
    logInfo(`  DIVERGENCIA_STATUS  : ${r.countsByCode.DIVERGENCIA_STATUS}`)
    logInfo(`  FANTASMA            : ${r.countsByCode.FANTASMA}`)
    logInfo(
      `  SEM_BANCO           : ${r.spreadsheetChecked ? r.countsByCode.SEM_BANCO : "não checado (sem --spreadsheet)"}`
    )
    logInfo(`  due > fim (anomalias): ${r.dueAfterEnd.length}`)
    logInfo(`  installments abertos : ${r.openInstallments.length}  ← dimensiona E9 (X5)`)

    const namedIssues = r.cases.filter((c) => c.code !== "INTEGRO")
    if (namedIssues.length > 0) {
      logInfo(`\n[inventory] divergências (linha nomeada, nunca média silenciosa):`)
      for (const issue of namedIssues) {
        logInfo(`  [${issue.code}] ${issue.detail}`)
      }
    }
  } else {
    logInfo(`  reconciliação        : não executada (rode com --reconcile)`)
  }

  logInfo(`  nome sugerido p/ dump versionado (C34): ${suggestedFilename}`)
  logInfo("────────────────────────────────────────────────────────────\n")
}

async function main() {
  const args = parseInventoryArgs(process.argv.slice(2))
  const gateway = createAsaasReadOnlyGateway(args.account)

  logInfo(`[inventory] iniciando  conta=${args.account}  reconcile=${args.reconcile}`)

  const [customers, subscriptions, pendingPayments, overduePayments, creditCardPayments, webhooks] =
    await Promise.all([
      fetchAllPages<AsaasCustomer>(gateway, "/customers"),
      fetchAllPages<AsaasSubscription>(gateway, "/subscriptions"),
      fetchAllPages<AsaasPayment>(gateway, "/payments?status=PENDING"),
      fetchAllPages<AsaasPayment>(gateway, "/payments?status=OVERDUE"),
      fetchAllPages<AsaasPayment>(gateway, "/payments?billingType=CREDIT_CARD"),
      fetchAllPages<AsaasWebhookConfig>(gateway, "/webhooks"),
    ])

  const report = buildInventoryReport({
    account: args.account,
    customers,
    subscriptions,
    pendingPayments,
    overduePayments,
    creditCardPayments,
    webhooks,
  })

  if (args.reconcile) {
    logInfo("[inventory] reconciliando com o banco...")
    const repository = new BillingInventoryRepository()
    const [dbCustomerPointers, dbSubscriptionPointers] = await Promise.all([
      repository.listCustomerPointers(args.account),
      repository.listSubscriptionPointers(args.account),
    ])

    const ownerSpreadsheet = args.spreadsheet ? loadOwnerSpreadsheet(args.spreadsheet) : undefined
    if (args.spreadsheet) {
      logInfo(`[inventory] planilha do owner carregada: ${ownerSpreadsheet!.length} pagantes`)
    }

    report.reconciliation = reconcileInventory({
      asaasCustomers: customers,
      asaasSubscriptions: subscriptions,
      asaasPayments: dedupePaymentsById(pendingPayments, overduePayments, creditCardPayments),
      dbCustomerPointers,
      dbSubscriptionPointers,
      ownerSpreadsheet,
    })
  }

  const json = JSON.stringify(report, null, 2)

  if (args.output) {
    writeFileSync(args.output, json, "utf-8")
    logInfo(`[inventory] relatório gravado em ${args.output}`)
  } else {
    process.stdout.write(json + "\n")
  }

  printSummary(report, args.account, buildDefaultOutputFilename(args.account, new Date()))
}

main()
  .catch((err) => {
    console.error("[inventory] erro fatal:", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
