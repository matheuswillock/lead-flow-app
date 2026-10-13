/**
 * Gera um plano de decisão para as divergências da conta legacy.
 *
 * O comando é somente leitura em relação ao banco e ao Asaas. Ele nunca
 * exclui customer, recria assinatura, cancela cobrança ou altera ponteiros.
 * A aplicação de cada ação será feita por executores específicos, depois que
 * todas as decisões estiverem justificadas e revisadas.
 */

import { readFileSync, writeFileSync } from "node:fs"
import type { ReconciliationReport } from "./lib/reconcileInventory"
import {
  buildReconciliationPlan,
  type ReconciliationDecision,
} from "./lib/asaasReconciliationPlan"

type InventoryDump = {
  account?: string
  reconciliation?: ReconciliationReport
}

type Arguments = {
  input: string
  decisions?: string
  output?: string
}

function parseArguments(argv: string[]): Arguments {
  const values = new Map<string, string>()
  for (const argument of argv) {
    const [key, value] = argument.split("=", 2)
    if (key?.startsWith("--") && value) values.set(key.slice(2), value)
  }
  const input = values.get("input")
  if (!input) throw new Error("Uso: --input=/caminho/inventory.json [--decisions=decisions.json] [--output=plan.json]")
  return { input, decisions: values.get("decisions"), output: values.get("output") }
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T
}

function log(message: string): void {
  process.stderr.write(`${message}\n`)
}

function printSummary(plan: ReturnType<typeof buildReconciliationPlan>): void {
  const counts = plan.items.reduce<Record<string, number>>((result, item) => {
    result[item.kind] = (result[item.kind] ?? 0) + 1
    return result
  }, {})
  log("\n[plan-asaas-reconciliation] ── resumo ─────────────────")
  log(`  itens: ${plan.items.length}`)
  log(`  decisões: ${plan.decisions.length}`)
  log(`  pendentes: ${plan.unresolvedKeys.length}`)
  for (const [kind, count] of Object.entries(counts)) log(`  ${kind}: ${count}`)
  if (plan.unresolvedKeys.length > 0) {
    log("  decisões ainda necessárias:")
    for (const key of plan.unresolvedKeys) log(`    - ${key}`)
  }
  log("────────────────────────────────────────────────────────\n")
}

function main(): void {
  const args = parseArguments(process.argv.slice(2))
  const dump = readJson<InventoryDump>(args.input)
  if (dump.account !== "legacy") throw new Error("O plano só aceita inventário da conta legacy")
  if (!dump.reconciliation) throw new Error("O inventário precisa ter sido executado com --reconcile")
  const decisions = args.decisions
    ? readJson<ReconciliationDecision[]>(args.decisions)
    : []
  if (!Array.isArray(decisions)) throw new Error("--decisions deve conter um array JSON")

  const plan = buildReconciliationPlan(dump.reconciliation, decisions)
  const serialized = JSON.stringify(plan, null, 2)
  if (args.output) {
    writeFileSync(args.output, serialized, "utf-8")
    log(`[plan-asaas-reconciliation] plano gravado em ${args.output}`)
  } else {
    process.stdout.write(`${serialized}\n`)
  }
  printSummary(plan)
}

try {
  main()
} catch (error) {
  console.error("[plan-asaas-reconciliation] erro fatal:", error)
  process.exitCode = 1
}
