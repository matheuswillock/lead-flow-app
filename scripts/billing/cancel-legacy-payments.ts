/**
 * Cancela cobranças legacy explicitamente autorizadas após a reconciliação.
 *
 * O script só aceita cobranças presentes no inventário fornecido, confirma o
 * customer e a assinatura esperados e exige dois gates no modo apply. Assim,
 * uma cobrança ativa legítima não entra por engano no lote de cancelamento.
 */

import { readFileSync, writeFileSync } from "node:fs"
import { asaasMigrationGateway } from "@/app/api/infra/gateways/asaasMigration/AsaasMigrationGateway"
import type { AsaasPayment } from "./lib/asaasInventoryTypes"

type Inventory = {
  pendingPayments?: { data?: AsaasPayment[] }
  overduePayments?: { data?: AsaasPayment[] }
}

type Target = {
  paymentId: string
  customerId: string
  subscriptionId: string | null
  reason: string
}

type Arguments = {
  inventory: string
  targets: string
  output?: string
  apply: boolean
}

type Result = {
  paymentId: string
  outcome: "planned" | "canceled" | "already-resolved" | "blocked"
  detail: string
}

function parseArguments(argv: string[]): Arguments {
  const values = new Map<string, string>()
  for (const argument of argv) {
    const separator = argument.indexOf("=")
    if (separator > 2) values.set(argument.slice(2, separator), argument.slice(separator + 1))
  }
  const inventory = values.get("inventory")
  const targets = values.get("targets")
  if (!inventory || !targets) {
    throw new Error("Uso: --inventory=inventory.json --targets=targets.json [--output=run.json] [--apply]")
  }
  return { inventory, targets, output: values.get("output"), apply: argv.includes("--apply") }
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T
}

function assertApplyAuthorized(args: Arguments): void {
  if (!args.apply) return
  if (process.env.ASAAS_RECONCILIATION_APPLY !== "1") {
    throw new Error("Recusado: --apply exige ASAAS_RECONCILIATION_APPLY=1")
  }
  if (process.env.ASAAS_ALLOW_LEGACY_PAYMENT_CANCEL !== "1") {
    throw new Error("Recusado: --apply exige ASAAS_ALLOW_LEGACY_PAYMENT_CANCEL=1")
  }
}

function listOpenPayments(inventory: Inventory): AsaasPayment[] {
  return [...(inventory.pendingPayments?.data ?? []), ...(inventory.overduePayments?.data ?? [])]
}

function validateTarget(target: Target, payment: AsaasPayment): void {
  if (payment.customer !== target.customerId) {
    throw new Error(`${target.paymentId}: customer divergente no inventário`)
  }
  if ((payment.subscription ?? null) !== target.subscriptionId) {
    throw new Error(`${target.paymentId}: assinatura divergente no inventário`)
  }
  if (!(["PENDING", "OVERDUE"] as string[]).includes(payment.status)) {
    throw new Error(`${target.paymentId}: status ${payment.status} não é cancelável`)
  }
  if (target.reason.trim().length < 10) {
    throw new Error(`${target.paymentId}: justificativa insuficiente`)
  }
}

async function executeTarget(target: Target, payment: AsaasPayment | undefined, apply: boolean): Promise<Result> {
  if (!payment) {
    return { paymentId: target.paymentId, outcome: "already-resolved", detail: "não está mais no inventário de cobranças abertas" }
  }
  validateTarget(target, payment)
  if (!apply) return { paymentId: target.paymentId, outcome: "planned", detail: target.reason }
  const canceled = await asaasMigrationGateway.cancelLegacyPayment?.(target.paymentId)
  if (!canceled) return { paymentId: target.paymentId, outcome: "blocked", detail: "Asaas não confirmou o cancelamento" }
  return { paymentId: target.paymentId, outcome: "canceled", detail: target.reason }
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2))
  assertApplyAuthorized(args)
  const inventory = readJson<Inventory>(args.inventory)
  const targets = readJson<Target[]>(args.targets)
  if (!Array.isArray(targets) || targets.length === 0) throw new Error("--targets deve conter um array não vazio")
  const payments = new Map(listOpenPayments(inventory).map((payment) => [payment.id, payment]))
  const results: Result[] = []
  for (const target of targets) results.push(await executeTarget(target, payments.get(target.paymentId), args.apply))
  const report = {
    generatedAt: new Date().toISOString(),
    account: "legacy",
    apply: args.apply,
    results,
    failures: results.filter((result) => result.outcome === "blocked").map((result) => result.paymentId),
  }
  if (args.output) writeFileSync(args.output, JSON.stringify(report, null, 2), "utf-8")
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  if (report.failures.length > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error("[cancel-legacy-payments] erro fatal:", error)
  process.exitCode = 1
})
