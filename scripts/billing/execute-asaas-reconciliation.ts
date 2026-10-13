/**
 * Executa as decisões do inventário legacy com duas proteções:
 *
 * - sem --apply, nenhuma escrita local ou remota acontece;
 * - decisões de bloqueio local podem usar o default da reconciliação, mas
 *   customers fantasmas exigem uma decisão nominal no arquivo de entrada.
 *
 * O executor não cria cobrança nem assinatura. A migração de uma assinatura
 * pagante continua dependendo de cartão/token e do fluxo E4-E7 existente.
 */

import { createHash } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { prisma } from "@/app/api/infra/data/prisma"
import { asaasAccountMigrationRepository } from "@/app/api/infra/data/repositories/asaasAccountMigration/AsaasAccountMigrationRepository"
import { createAsaasClient } from "@/lib/asaas/asaas-client"
import { asaasMigrationGateway } from "@/app/api/infra/gateways/asaasMigration/AsaasMigrationGateway"
import { isActiveMemberProAssignment } from "@/app/api/shared/billing/memberProBillingRules"
import type { AsaasCustomer, AsaasSubscription } from "./lib/asaasInventoryTypes"
import type {
  ReconciliationDecision,
  ReconciliationPlan,
  ReconciliationWorkItem,
  ReconciliationWorkAction,
} from "./lib/asaasReconciliationPlan"
import { buildReconciliationPlan } from "./lib/asaasReconciliationPlan"
import type { ReconciliationReport } from "./lib/reconcileInventory"

type InventoryDump = {
  account: string
  customers?: { data?: AsaasCustomer[] }
  subscriptions?: { data?: AsaasSubscription[] }
  reconciliation?: ReconciliationReport
}

type Arguments = {
  plan?: string
  inventory: string
  decisions?: string
  inventoryChecksum?: string
  planChecksum?: string
  decisionsChecksum?: string
  output?: string
  apply: boolean
}

type ExecutionOutcome =
  | "planned"
  | "already-suspended"
  | "blocked-locally"
  | "ledger-reconciled"
  | "removed-remote"
  | "already-removed"
  | "remote-frozen"
  | "already-frozen"
  | "protected-member-pro-active"
  | "manual-required"
  | "blocked"
  | "failed"

type ExecutionResult = {
  key: string
  action: ReconciliationWorkAction | "pending"
  outcome: ExecutionOutcome
  detail: string
}

function parseArguments(argv: string[]): Arguments {
  const values = new Map<string, string>()
  for (const argument of argv) {
    const separator = argument.indexOf("=")
    if (separator > 2) values.set(argument.slice(2, separator), argument.slice(separator + 1))
  }
  const inventory = values.get("inventory")
  if (!inventory) {
    throw new Error("Uso: --inventory=inventory.json [--plan=plan.json] [--decisions=decisions.json] [--output=run.json] [--apply]")
  }
  return {
    plan: values.get("plan"),
    inventory,
    decisions: values.get("decisions"),
    inventoryChecksum: values.get("inventory-checksum"),
    planChecksum: values.get("plan-checksum"),
    decisionsChecksum: values.get("decisions-checksum"),
    output: values.get("output"),
    apply: argv.includes("--apply"),
  }
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T
}

function loadPlan(path: string | undefined, inventory: InventoryDump): ReconciliationPlan {
  if (path && existsSync(path)) return readJson<ReconciliationPlan>(path)
  if (!inventory.reconciliation) {
    throw new Error(
      path
        ? `Plano não encontrado em ${path} e o inventário não contém reconciliation; gere o plano antes de executar`
        : "O inventário não contém reconciliation; rode o inventário com --reconcile"
    )
  }
  if (path) console.error(`[execute-asaas-reconciliation] plano ausente em ${path}; gerando a partir do inventário`)
  return buildReconciliationPlan(inventory.reconciliation)
}

function assertApplyAuthorization(args: Arguments): void {
  if (!args.apply) return
  if (process.env.ASAAS_RECONCILIATION_APPLY !== "1") {
    throw new Error("Recusado: --apply exige ASAAS_RECONCILIATION_APPLY=1")
  }
  if (!args.inventoryChecksum || !args.planChecksum || !args.decisionsChecksum) {
    throw new Error("Recusado: --apply exige checksums do inventário, plano e decisões")
  }
}

function checksumJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

function assertLegacyInputs(plan: ReconciliationPlan, inventory: InventoryDump): void {
  if (plan.sourceAccount !== "legacy") throw new Error("O plano precisa ser da conta legacy")
  if (inventory.account !== "legacy") throw new Error("O inventário precisa ser da conta legacy")
}

function normalizeEmail(email: string | null | undefined): string {
  return email?.trim().toLowerCase() ?? ""
}

function validateDecision(item: ReconciliationWorkItem, decision: ReconciliationDecision): void {
  if (!item.allowedActions.includes(decision.action)) {
    throw new Error(`Ação ${decision.action} não permitida para ${decision.key}`)
  }
  if (decision.reason.trim().length < 10) {
    throw new Error(`Decisão ${decision.key} precisa de justificativa com pelo menos 10 caracteres`)
  }
}

function resolveDecisions(
  plan: ReconciliationPlan,
  explicitDecisions: readonly ReconciliationDecision[]
): { decisions: Map<string, ReconciliationDecision>; ignored: string[] } {
  const itemsByKey = new Map(plan.items.map((item) => [item.key, item]))
  const decisions = new Map<string, ReconciliationDecision>()
  const ignored: string[] = []

  for (const decision of explicitDecisions) {
    const item = itemsByKey.get(decision.key)
    if (!item) {
      ignored.push(decision.key)
      console.error(`[execute-asaas-reconciliation] decisão já resolvida e ignorada: ${decision.key}`)
      continue
    }
    validateDecision(item, decision)
    decisions.set(decision.key, { ...decision, reason: decision.reason.trim() })
  }

  for (const item of plan.items) {
    if (decisions.has(item.key)) continue
    if (item.defaultAction === "block_locally") {
      decisions.set(item.key, {
        key: item.key,
        action: "block_locally",
        reason: "Fonte local indica contrato vencido ou assinatura Asaas inativa",
      })
    }
  }
  return { decisions, ignored }
}

function findInventoryCustomer(inventory: InventoryDump, customerId: string): AsaasCustomer | null {
  return inventory.customers?.data?.find((customer) => customer.id === customerId) ?? null
}

function findInventorySubscription(inventory: InventoryDump, customerId: string): AsaasSubscription | null {
  const subscriptions = inventory.subscriptions?.data?.filter((subscription) => subscription.customer === customerId) ?? []
  if (subscriptions.length > 1) throw new Error(`Múltiplas assinaturas legacy para customer ${customerId}`)
  return subscriptions[0] ?? null
}

async function blockLocally(item: ReconciliationWorkItem, reason: string): Promise<ExecutionResult> {
  if (!item.profileId) return { key: item.key, action: "block_locally", outcome: "blocked", detail: "profileId ausente" }

  const profile = await prisma.profile.findUnique({
    where: { id: item.profileId },
    select: {
      id: true,
      subscriptionStatus: true,
      hasPermanentSubscription: true,
      subscription: { select: { id: true, subscriptionStatus: true, hasPermanentSubscription: true } },
      userTypeAssignment: {
        select: {
          accessStartsAt: true,
          accessExpiresAt: true,
          userType: { select: { slug: true } },
        },
      },
    },
  })
  if (!profile) return { key: item.key, action: "block_locally", outcome: "blocked", detail: "profile não encontrado" }
  if (profile.hasPermanentSubscription || profile.subscription?.hasPermanentSubscription) {
    return { key: item.key, action: "block_locally", outcome: "blocked", detail: "assinatura permanente protegida" }
  }
  if (
    isActiveMemberProAssignment(
      profile.userTypeAssignment?.userType
        ? {
            slug: profile.userTypeAssignment.userType.slug,
            accessStartsAt: profile.userTypeAssignment.accessStartsAt,
            accessExpiresAt: profile.userTypeAssignment.accessExpiresAt,
          }
        : null
    )
  ) {
    return {
      key: item.key,
      action: "block_locally",
      outcome: "protected-member-pro-active",
      detail: "Member PRO vigente protegido; revisão remota explícita necessária",
    }
  }
  if (profile.subscriptionStatus === "suspended" && profile.subscription?.subscriptionStatus === "suspended") {
    return { key: item.key, action: "block_locally", outcome: "already-suspended", detail: "acesso já está suspenso" }
  }

  let protectedDuringTransaction = false
  let staleDuringTransaction = false
  await prisma.$transaction(async (transaction) => {
    const fresh = await transaction.profile.findUnique({
      where: { id: profile.id },
      select: {
        subscriptionStatus: true,
        subscription: { select: { subscriptionStatus: true } },
        userTypeAssignment: {
          select: {
            accessStartsAt: true,
            accessExpiresAt: true,
            userType: { select: { slug: true } },
          },
        },
      },
    })
    if (!fresh) {
      staleDuringTransaction = true
      return
    }
    const freshMemberPro = fresh.userTypeAssignment?.userType
      ? {
          slug: fresh.userTypeAssignment.userType.slug,
          accessStartsAt: fresh.userTypeAssignment.accessStartsAt,
          accessExpiresAt: fresh.userTypeAssignment.accessExpiresAt,
        }
      : null
    if (isActiveMemberProAssignment(freshMemberPro)) {
      protectedDuringTransaction = true
      return
    }
    const updated = await transaction.profile.updateMany({
      where: { id: profile.id, subscriptionStatus: fresh.subscriptionStatus },
      data: { subscriptionStatus: "suspended" },
    })
    if (updated.count !== 1) {
      staleDuringTransaction = true
      return
    }
    if (fresh.subscription) {
      await transaction.profileSubscription.update({
        where: { profileId: profile.id },
        data: { subscriptionStatus: "suspended" },
      })
    }
    await transaction.subscriptionChangeLog.create({
      data: {
        profileId: profile.id,
        source: "asaas_reconciliation",
        changeType: "access_blocked_by_reconciliation",
        before: {
          profileStatus: profile.subscriptionStatus,
          profileSubscriptionStatus: profile.subscription?.subscriptionStatus ?? null,
        },
        after: { profileStatus: "suspended", profileSubscriptionStatus: "suspended" },
        metadata: { planKey: item.key, reason },
      },
    })
  })

  if (protectedDuringTransaction) {
    return {
      key: item.key,
      action: "block_locally",
      outcome: "protected-member-pro-active",
      detail: "Member PRO foi concedido durante a execução; nenhuma alteração aplicada",
    }
  }
  if (staleDuringTransaction) {
    return {
      key: item.key,
      action: "block_locally",
      outcome: "blocked",
      detail: "estado local mudou durante a execução; rode novo dry-run",
    }
  }

  return { key: item.key, action: "block_locally", outcome: "blocked-locally", detail: "status local atualizado para suspended" }
}

async function assertGhostIsUnreferenced(customerId: string): Promise<void> {
  const [profileCount, adhesionCount, backofficeClientCount, ledgerCount] = await Promise.all([
    prisma.profile.count({ where: { asaasCustomerId: customerId, asaasCustomerAccount: "legacy" } }),
    prisma.backofficeAdhesion.count({ where: { asaasCustomerId: customerId, asaasAccount: "legacy" } }),
    prisma.backofficeClient.count({ where: { asaasCustomerId: customerId, asaasAccount: "legacy" } }),
    prisma.asaasAccountMigration.count({ where: { legacyCustomerId: customerId } }),
  ])
  if (profileCount + adhesionCount + backofficeClientCount + ledgerCount > 0) {
    throw new Error(`customer ${customerId} passou a ter referência local; remoção abortada`)
  }
}

async function assertRemoteCustomerMatchesInventory(customer: AsaasCustomer): Promise<void> {
  const client = createAsaasClient("legacy")
  const remote = await client.request(`${client.endpoints.customers}/${encodeURIComponent(customer.id)}`) as AsaasCustomer
  if (
    remote.id !== customer.id ||
    normalizeEmail(remote.email) !== normalizeEmail(customer.email) ||
    remote.deleted === true
  ) {
    throw new Error(`customer ${customer.id} mudou desde o inventário; mutação abortada`)
  }
}

async function removeGhostCustomer(item: ReconciliationWorkItem, inventory: InventoryDump, apply: boolean): Promise<ExecutionResult> {
  if (item.kind !== "ghost_customer") return { key: item.key, action: "remove_ghost_customer", outcome: "blocked", detail: "ação só vale para customer fantasma" }
  const customer = findInventoryCustomer(inventory, item.identifier)
  if (!customer) return { key: item.key, action: "remove_ghost_customer", outcome: "blocked", detail: "customer não está no inventário fornecido" }
  if (normalizeEmail(customer.email) !== normalizeEmail(item.email)) {
    return { key: item.key, action: "remove_ghost_customer", outcome: "blocked", detail: "e-mail do inventário diverge do plano" }
  }
  await assertGhostIsUnreferenced(customer.id)
  if (!apply) return { key: item.key, action: "remove_ghost_customer", outcome: "planned", detail: "remoção legacy planejada; sem escrita no dry-run" }
  if (process.env.ASAAS_ALLOW_LEGACY_GHOST_DELETE !== "1") {
    return { key: item.key, action: "remove_ghost_customer", outcome: "blocked", detail: "remoção exige ASAAS_ALLOW_LEGACY_GHOST_DELETE=1" }
  }
  await assertRemoteCustomerMatchesInventory(customer)
  await assertGhostIsUnreferenced(customer.id)
  const client = createAsaasClient("legacy")
  try {
    const response = await client.request(`${client.endpoints.customers}/${encodeURIComponent(customer.id)}`, { method: "DELETE" })
    return { key: item.key, action: "remove_ghost_customer", outcome: "removed-remote", detail: `Asaas respondeu ${JSON.stringify(response)}` }
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 404) {
      return { key: item.key, action: "remove_ghost_customer", outcome: "already-removed", detail: "customer já não existe no Asaas" }
    }
    throw error
  }
}

async function reconcileGhostCustomer(item: ReconciliationWorkItem, inventory: InventoryDump, apply: boolean): Promise<ExecutionResult> {
  if (item.kind !== "ghost_customer") return { key: item.key, action: "reconcile_existing_customer", outcome: "blocked", detail: "ação só vale para customer fantasma" }
  const customer = findInventoryCustomer(inventory, item.identifier)
  if (!customer || !item.email) return { key: item.key, action: "reconcile_existing_customer", outcome: "blocked", detail: "customer ou e-mail ausente" }
  const profiles = await prisma.profile.findMany({
    where: { email: { equals: item.email, mode: "insensitive" }, deletedAt: null },
    select: { id: true, fullName: true, email: true },
  })
  if (profiles.length !== 1) return { key: item.key, action: "reconcile_existing_customer", outcome: "blocked", detail: `encontrados ${profiles.length} profiles para o e-mail` }
  const profile = profiles[0]!
  const subscription = findInventorySubscription(inventory, customer.id)
  if (!apply) return { key: item.key, action: "reconcile_existing_customer", outcome: "planned", detail: `ledger será reconciliado com profile ${profile.id}` }
  await assertRemoteCustomerMatchesInventory(customer)
  await asaasAccountMigrationRepository.upsertSnapshot({
    profileId: profile.id,
    clientName: profile.fullName ?? customer.name,
    clientEmail: profile.email,
    legacyCustomerId: customer.id,
    legacySubscriptionId: subscription?.id ?? null,
    billingType: subscription?.billingType ?? null,
    cycle: subscription?.cycle ?? null,
    value: subscription?.value ?? null,
    nextDueDate: subscription?.nextDueDate ? new Date(subscription.nextDueDate) : null,
  })
  return { key: item.key, action: "reconcile_existing_customer", outcome: "ledger-reconciled", detail: `ledger reconciliado com profile ${profile.id}` }
}

async function freezeExpiredLegacySubscription(
  item: ReconciliationWorkItem,
  inventory: InventoryDump,
  apply: boolean,
  reason: string,
): Promise<ExecutionResult> {
  if (item.kind !== "due_after_contract_end") {
    return { key: item.key, action: "block_locally", outcome: "blocked", detail: "congelamento remoto só vale para contrato expirado" }
  }
  const subscription = inventory.subscriptions?.data?.find((candidate) => candidate.id === item.identifier)
  if (!subscription) {
    return { key: item.key, action: "block_locally", outcome: "blocked", detail: "assinatura não está no inventário fornecido" }
  }
  if (!apply) {
    return {
      key: item.key,
      action: "block_locally",
      outcome: "planned",
      detail: `bloqueio local + congelamento remoto planejados (${reason})`,
    }
  }
  if (process.env.ASAAS_ALLOW_LEGACY_SUBSCRIPTION_FREEZE !== "1") {
    return {
      key: item.key,
      action: "block_locally",
      outcome: "blocked",
      detail: "congelamento remoto exige ASAAS_ALLOW_LEGACY_SUBSCRIPTION_FREEZE=1",
    }
  }

  const remoteSubscription = await asaasMigrationGateway.findLegacySubscription?.(subscription.id)
  const payments = (await asaasMigrationGateway.listLegacySubscriptionPayments?.(subscription.id)) ?? []
  if (
    remoteSubscription &&
    (remoteSubscription.id !== subscription.id ||
      remoteSubscription.customer !== subscription.customer ||
      (subscription.externalReference && remoteSubscription.externalReference !== subscription.externalReference))
  ) {
    throw new Error(`assinatura ${subscription.id} mudou desde o inventário; mutação abortada`)
  }
  if (remoteSubscription && (!remoteSubscription.customer || (subscription.externalReference && !remoteSubscription.externalReference))) {
    throw new Error(`assinatura ${subscription.id} não retornou customer/referência completos; mutação abortada`)
  }
  if (payments.some((payment) => !payment.customer || payment.customer !== subscription.customer || (payment.subscription && payment.subscription !== subscription.id))) {
    throw new Error(`cobrança vinculada incorretamente à assinatura ${subscription.id}; mutação abortada`)
  }
  const payablePayments = payments.filter((candidate) => ["PENDING", "OVERDUE"].includes(candidate.status))
  for (const payment of payablePayments) {
    await asaasMigrationGateway.cancelLegacyPayment?.(payment.id)
  }
  const refreshedSubscription = await asaasMigrationGateway.findLegacySubscription?.(subscription.id)
  if (
    refreshedSubscription &&
    (refreshedSubscription.id !== subscription.id ||
      refreshedSubscription.customer !== subscription.customer ||
      (subscription.externalReference && refreshedSubscription.externalReference !== subscription.externalReference))
  ) {
    throw new Error(`assinatura ${subscription.id} mudou antes da inativação; mutação abortada`)
  }
  if (refreshedSubscription && (!refreshedSubscription.customer || (subscription.externalReference && !refreshedSubscription.externalReference))) {
    throw new Error(`assinatura ${subscription.id} não retornou customer/referência completos antes da inativação; mutação abortada`)
  }
  if (!refreshedSubscription || refreshedSubscription.status === "INACTIVE") {
    return {
      key: item.key,
      action: "block_locally",
      outcome: "already-frozen",
      detail: `assinatura legacy já está inativa ou não existe; ${payablePayments.length} cobrança(s) pagável(is) cancelada(s)`,
    }
  }
  await asaasMigrationGateway.inactivateLegacySubscription(subscription.id)
  return {
    key: item.key,
    action: "block_locally",
    outcome: "remote-frozen",
    detail: `assinatura legacy inativada e ${payablePayments.length} cobrança(s) pagável(is) cancelada(s)`,
  }
}

async function executeItem(item: ReconciliationWorkItem, decision: ReconciliationDecision | undefined, inventory: InventoryDump, apply: boolean): Promise<ExecutionResult> {
  if (!decision) return { key: item.key, action: "pending", outcome: "manual-required", detail: "decisão nominal ausente" }
  if (decision.action === "block_locally") {
    if (item.profileId && (await isActiveMemberProProfile(item.profileId))) {
      return {
        key: item.key,
        action: "block_locally",
        outcome: "protected-member-pro-active",
        detail: "Member PRO vigente protegido; revisão remota explícita necessária",
      }
    }
    if (!apply) {
      return item.kind === "due_after_contract_end"
        ? freezeExpiredLegacySubscription(item, inventory, false, decision.reason)
        : { key: item.key, action: decision.action, outcome: "planned", detail: "bloqueio local planejado" }
    }
    const localResult = await blockLocally(item, decision.reason)
    if (["blocked", "protected-member-pro-active"].includes(localResult.outcome)) return localResult
    if (item.kind === "due_after_contract_end") {
      return freezeExpiredLegacySubscription(item, inventory, true, decision.reason)
    }
    return localResult
  }
  if (decision.action === "remove_ghost_customer") return removeGhostCustomer(item, inventory, apply)
  if (decision.action === "reconcile_existing_customer") return reconcileGhostCustomer(item, inventory, apply)
  return { key: item.key, action: decision.action, outcome: "manual-required", detail: decision.reason }
}

async function isActiveMemberProProfile(profileId: string): Promise<boolean> {
  const assignment = await prisma.profileUserTypeAssignment.findUnique({
    where: { profileId },
    select: {
      accessStartsAt: true,
      accessExpiresAt: true,
      userType: { select: { slug: true } },
    },
  })

  return isActiveMemberProAssignment(
    assignment?.userType
      ? {
          slug: assignment.userType.slug,
          accessStartsAt: assignment.accessStartsAt,
          accessExpiresAt: assignment.accessExpiresAt,
        }
      : null
  )
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2))
  assertApplyAuthorization(args)
  const inventory = readJson<InventoryDump>(args.inventory)
  const plan = loadPlan(args.plan, inventory)
  assertLegacyInputs(plan, inventory)
  const decisions = args.decisions ? readJson<ReconciliationDecision[]>(args.decisions) : []
  if (!Array.isArray(decisions)) throw new Error("--decisions deve conter um array JSON")
  const checksums = {
    inventory: checksumJson(inventory),
    plan: checksumJson(plan),
    decisions: checksumJson(decisions),
  }
  if (args.apply && (
    args.inventoryChecksum !== checksums.inventory ||
    args.planChecksum !== checksums.plan ||
    args.decisionsChecksum !== checksums.decisions
  )) {
    throw new Error("Checksums divergentes; gere um novo dry-run antes do --apply")
  }
  const resolved = resolveDecisions(plan, decisions)
  const results: ExecutionResult[] = []
  for (const item of plan.items) {
    results.push(await executeItem(item, resolved.decisions.get(item.key), inventory, args.apply))
  }
  const report = {
    generatedAt: new Date().toISOString(),
    apply: args.apply,
    checksums,
    ignoredDecisions: resolved.ignored,
    results,
    pending: results
      .filter((result) => ["manual-required", "protected-member-pro-active"].includes(result.outcome))
      .map((result) => result.key),
    failures: results.filter((result) => ["blocked", "failed"].includes(result.outcome)).map((result) => result.key),
  }
  if (args.output) writeFileSync(args.output, JSON.stringify(report, null, 2), "utf-8")
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  if (args.apply && (report.pending.length > 0 || report.failures.length > 0)) process.exitCode = 1
}

main()
  .catch((error) => {
    console.error("[execute-asaas-reconciliation] erro fatal:", error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
