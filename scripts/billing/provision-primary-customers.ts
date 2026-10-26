/**
 * Provisiona customers da base local na conta Asaas `primary`.
 *
 * O comando é dry-run por padrão. `--apply` exige `ASAAS_PRIMARY_CUSTOMERS_APPLY=1`
 * e `ASAAS_ENV=production`, cria somente customers ausentes e vincula o
 * resultado ao Profile local. Não cria assinatura, cobrança ou pagamento.
 */

import { readFileSync, writeFileSync } from "node:fs"
import { prisma } from "@/app/api/infra/data/prisma"
import { createAsaasClient } from "@/lib/asaas/asaas-client"
import { createAsaasReadOnlyGateway, fetchAllPages } from "./lib/asaasReadOnlyGateway"
import type { AsaasCustomer } from "./lib/asaasInventoryTypes"
import {
  assertProvisioningApplyAuthorized,
  normalizeEmail,
  parseProvisioningArgs,
  planCustomerProvisioning,
  type CustomerProvisioningPlan,
  type CustomerProvisioningTarget,
  type ProvisioningProfile,
} from "./lib/provisionPrimaryCustomersLogic"

type ProfileRow = ProvisioningProfile

type ProvisioningResult = CustomerProvisioningPlan & {
  outcome: "dry-run" | "created" | "linked" | "already-linked" | "blocked" | "failed"
  error?: string
}

function logInfo(message: string): void {
  process.stderr.write(`${message}\n`)
}

function loadTargets(path: string): CustomerProvisioningTarget[] {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf-8"))
  if (!Array.isArray(parsed)) {
    throw new Error(`--input=${path}: esperado um array JSON de { name, email }`)
  }

  const targets = parsed.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`--input=${path}: registro ${index + 1} inválido`)
    }
    const value = entry as Record<string, unknown>
    const name = typeof value.name === "string" ? value.name.trim() : ""
    const email = typeof value.email === "string" ? normalizeEmail(value.email) : ""
    if (!name || !email || !email.includes("@")) {
      throw new Error(`--input=${path}: registro ${index + 1} precisa de name e email válidos`)
    }
    return { name, email }
  })

  const uniqueEmails = new Set(targets.map((target) => target.email))
  if (uniqueEmails.size !== targets.length) {
    throw new Error(`--input=${path}: e-mails duplicados não são permitidos`)
  }
  return targets
}

async function loadProfiles(targets: CustomerProvisioningTarget[]): Promise<ProfileRow[]> {
  const emails = targets.map((target) => target.email)
  const profiles = await prisma.profile.findMany({
    where: { email: { in: emails } },
    select: {
      id: true,
      fullName: true,
      email: true,
      cpfCnpj: true,
      phone: true,
      postalCode: true,
      address: true,
      addressNumber: true,
      complement: true,
      neighborhood: true,
      asaasCustomerId: true,
      asaasCustomerAccount: true,
    },
  })
  return profiles as ProfileRow[]
}

async function linkProfile(profileId: string, customerId: string): Promise<void> {
  await prisma.profile.update({
    where: { id: profileId },
    data: {
      asaasCustomerId: customerId,
      asaasCustomerAccount: "primary",
    },
  })
}

function buildCreatePayload(target: CustomerProvisioningTarget, profile: ProfileRow) {
  return {
    name: target.name,
    email: target.email,
    cpfCnpj: profile.cpfCnpj ?? undefined,
    phone: profile.phone ?? undefined,
    postalCode: profile.postalCode ?? undefined,
    address: profile.address ?? undefined,
    addressNumber: profile.addressNumber ?? undefined,
    complement: profile.complement ?? undefined,
    province: profile.neighborhood ?? undefined,
    externalReference: profile.id,
    notificationDisabled: true,
  }
}

async function createCustomer(
  client: ReturnType<typeof createAsaasClient>,
  target: CustomerProvisioningTarget,
  profile: ProfileRow
): Promise<string> {
  const response = await client.request(client.endpoints.customers, {
    method: "POST",
    body: JSON.stringify(buildCreatePayload(target, profile)),
  })
  if (typeof response?.id !== "string" || response.id.length === 0) {
    throw new Error("Asaas não retornou um customer ID válido")
  }
  return response.id
}

async function updateExistingCustomer(
  client: ReturnType<typeof createAsaasClient>,
  plan: CustomerProvisioningPlan,
  profile: ProfileRow
): Promise<void> {
  if (!plan.customerId) throw new Error("Plano de vínculo existente sem customerId")
  await client.request(`${client.endpoints.customers}/${plan.customerId}`, {
    method: "PUT",
    body: JSON.stringify({
      name: plan.target.name,
      email: plan.target.email,
      externalReference: profile.id,
      notificationDisabled: true,
    }),
  })
}

async function applyPlan(
  plan: CustomerProvisioningPlan,
  profile: ProfileRow,
  client: ReturnType<typeof createAsaasClient>
): Promise<ProvisioningResult> {
  try {
    if (plan.action === "blocked") {
      return { ...plan, outcome: "blocked" }
    }
    if (plan.action === "already-linked") {
      return { ...plan, outcome: "already-linked" }
    }

    if (plan.action === "create") {
      // Reconsulta imediatamente antes do POST para manter idempotência em
      // caso de uma execução concorrente ou de um dry-run antigo.
      const existing = await client.request(
        `${client.endpoints.customers}?externalReference=${encodeURIComponent(profile.id)}`,
        { method: "GET" }
      )
      if (Array.isArray(existing?.data) && existing.data.length > 1) {
        throw new Error(`Asaas retornou múltiplos customers para profile ${profile.id}`)
      }
      const existingId = Array.isArray(existing?.data) && existing.data.length === 1 ? existing.data[0]?.id : null
      const customerId = existingId ?? (await createCustomer(client, plan.target, profile))
      await linkProfile(profile.id, String(customerId))
      return { ...plan, customerId: String(customerId), outcome: existingId ? "linked" : "created" }
    }

    await updateExistingCustomer(client, plan, profile)
    await linkProfile(profile.id, plan.customerId!)
    return { ...plan, outcome: "linked" }
  } catch (error) {
    return {
      ...plan,
      outcome: "failed",
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function printSummary(results: ProvisioningResult[], apply: boolean): void {
  const counts = results.reduce<Record<string, number>>((accumulator, result) => {
    accumulator[result.outcome] = (accumulator[result.outcome] ?? 0) + 1
    return accumulator
  }, {})
  logInfo("\n[provision-primary-customers] ── resumo ─────────────────")
  logInfo(`  modo: ${apply ? "APPLY" : "dry-run"}`)
  logInfo(`  total: ${results.length}`)
  for (const [outcome, count] of Object.entries(counts)) logInfo(`  ${outcome}: ${count}`)
  for (const result of results.filter((item) => item.outcome === "blocked" || item.outcome === "failed")) {
    logInfo(`  [${result.outcome}] ${result.target.email}: ${result.error ?? result.reason}`)
  }
  logInfo("────────────────────────────────────────────────────────────\n")
}

async function main(): Promise<void> {
  const args = parseProvisioningArgs(process.argv.slice(2))
  assertProvisioningApplyAuthorized(args, process.env)
  const targets = loadTargets(args.input)
  const profiles = await loadProfiles(targets)
  const client = createAsaasClient("primary")
  const customers = await fetchAllPages<AsaasCustomer>(createAsaasReadOnlyGateway("primary"), "/customers")
  const plans = planCustomerProvisioning({ targets, profiles, customers })
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
  const results: ProvisioningResult[] = args.apply
    ? await Promise.all(
        plans.map((plan) => {
          const profile = plan.profileId ? profileById.get(plan.profileId) : undefined
          return profile
            ? applyPlan(plan, profile, client)
            : Promise.resolve({ ...plan, outcome: "blocked" as const, error: "profile local ausente" })
        })
      )
    : plans.map((plan) => ({
        ...plan,
        outcome:
          plan.action === "blocked"
            ? ("blocked" as const)
            : plan.action === "already-linked"
              ? ("already-linked" as const)
              : ("dry-run" as const),
      }))

  const report = { generatedAt: new Date().toISOString(), account: "primary", apply: args.apply, results }
  if (args.output) writeFileSync(args.output, JSON.stringify(report, null, 2))
  process.stdout.write(JSON.stringify(report, null, 2) + "\n")
  printSummary(results, args.apply)
  if (results.some((result) => result.outcome === "blocked" || result.outcome === "failed")) {
    process.exitCode = 1
  }
}

main()
  .catch((error) => {
    console.error("[provision-primary-customers] erro fatal:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
