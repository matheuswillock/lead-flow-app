/**
 * Gera o plano E5 por assinatura. Dry-run only: nenhuma chamada Asaas ou
 * escrita no banco é feita por este comando.
 */

import { readFileSync, writeFileSync } from "node:fs"
import { buildAsaasBatchMigrationPlan, type AsaasBatchMigrationPlanInput } from "./lib/asaasBatchMigrationPlan"
import type { AsaasCustomer, AsaasSubscription } from "./lib/asaasInventoryTypes"

type Inventory = {
  account: string
  customers?: { data?: AsaasCustomer[] }
  subscriptions?: { data?: AsaasSubscription[] }
}

type Arguments = {
  legacyInventory: string
  primaryInventory: string
  profileMap?: string
  output?: string
}

function parseArguments(argv: string[]): Arguments {
  const values = new Map<string, string>()
  for (const argument of argv) {
    const separator = argument.indexOf("=")
    if (separator > 2) values.set(argument.slice(2, separator), argument.slice(separator + 1))
  }
  const legacyInventory = values.get("legacy-inventory")
  const primaryInventory = values.get("primary-inventory")
  if (!legacyInventory || !primaryInventory) {
    throw new Error("Uso: --legacy-inventory=... --primary-inventory=... [--profile-map=...] [--output=...]")
  }
  return { legacyInventory, primaryInventory, profileMap: values.get("profile-map"), output: values.get("output") }
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

function buildProfileMap(inventory: Inventory, path?: string): Record<string, string> {
  if (path) return readJson<Record<string, string>>(path)
  return Object.fromEntries(
    (inventory.customers?.data ?? [])
      .filter((customer): customer is AsaasCustomer & { externalReference: string } => typeof customer.externalReference === "string")
      .map((customer) => [customer.id, customer.externalReference]),
  )
}

function main(): void {
  const args = parseArguments(process.argv.slice(2))
  const legacy = readJson<Inventory>(args.legacyInventory)
  const primary = readJson<Inventory>(args.primaryInventory)
  if (legacy.account !== "legacy" || primary.account !== "primary") throw new Error("Inventários precisam ser legacy e primary")

  const input: AsaasBatchMigrationPlanInput = {
    legacyCustomers: legacy.customers?.data ?? [],
    legacySubscriptions: legacy.subscriptions?.data ?? [],
    primaryCustomers: primary.customers?.data ?? [],
    primarySubscriptions: primary.subscriptions?.data ?? [],
    profileByLegacyCustomerId: buildProfileMap(legacy, args.profileMap),
  }
  const plan = buildAsaasBatchMigrationPlan(input)
  const report = {
    generatedAt: new Date().toISOString(),
    mode: "dry-run",
    source: { legacyInventory: args.legacyInventory, primaryInventory: args.primaryInventory },
    summary: {
      total: plan.length,
      migrate: plan.filter((item) => item.action === "migrate").length,
      alreadyMigrated: plan.filter((item) => item.action === "already_migrated").length,
      blockedAccess: plan.filter((item) => item.action === "block_access").length,
      blocked: plan.filter((item) => item.action === "blocked").length,
    },
    plan,
    applyCommand: "bun run scripts/billing/execute-asaas-batch-migration.ts --plan=<este-arquivo> --apply",
  }
  if (args.output) writeFileSync(args.output, JSON.stringify(report, null, 2), "utf8")
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
}

main()
