import { readFileSync, writeFileSync } from "node:fs"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import { featureAccessService } from "@/app/api/services/featureAccess/FeatureAccessService"
import {
  assertApprovedCrmEntitlementPolicy,
  BILLING_GRACE_CRM_ENTITLEMENT_APPLY_ENV,
  BILLING_GRACE_CRM_ENTITLEMENT_CHANGE_TYPE,
  BILLING_GRACE_CRM_ENTITLEMENT_SOURCE,
  BILLING_GRACE_OPERATOR_ENV,
  buildCrmEntitlementReport,
  classifyTeamCrmEntitlement,
  computeCrmEntitlementChecksum,
  createCrmEntitlementPolicy,
  CRM_ENTITLEMENT_REASONS,
  EXPECTED_CRM_ENTITLEMENT_TEAMS,
  resolveApplyDecision,
  type CrmEntitlementEntry,
  type CrmEntitlementPolicy,
  type CrmEntitlementReport,
  type CrmProductSnapshot,
  type TeamCrmEntitlementSnapshot,
} from "./lib/billingGraceCrmEntitlement"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const MASTER_TEAM_CONTEXT = {
  isMaster: true,
  role: "manager",
  functions: [] as string[],
  canManageAccountTeams: true,
  canCreateAccountUsers: true,
}

type Args = {
  apply: boolean
  input?: string
  output?: string
  checksum?: string
}

type ApplyResult = {
  teamId: string
  teamName: string
  masterId: string
  status: "applied" | "skipped" | "failed"
  plannedAction: "create" | null
  entitlementId: string | null
  reason: string | null
  committed: boolean
  verified: boolean
  finalCrmAccess: boolean
  featureAccessSlugs: string[]
  activeUsers: number
  bannedActiveUsers: number
  error: string | null
}

type ApplyReport = {
  generatedAt: string
  apply: true
  sourceReport: { checksum: string; generatedAt: string }
  policy: CrmEntitlementPolicy
  product: CrmProductSnapshot
  warnings: string[]
  summary: {
    plannedTeams: number
    applied: number
    skipped: number
    failed: number
    committed: number
    verified: number
    activeUsersCovered: number
    bannedActiveUsersCovered: number
  }
  results: ApplyResult[]
  checksum: string
}

type DatabaseClient = Prisma.TransactionClient | typeof prisma

type SubscriptionRow = {
  id: string
  profileId: string
  productId: string
  status: string
  startDate: Date
  endDate: Date | null
  product: {
    id: string
    name: string
    featureSlugs: string[]
  }
}

type TransactionOutcome =
  | {
      status: "applied"
      entitlementId: string
      current: CrmEntitlementEntry
    }
  | { status: "skipped"; reason: string }

function parseArguments(argv: readonly string[]): Args {
  const value = (name: string) =>
    argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)

  return {
    apply: argv.includes("--apply"),
    input: value("input"),
    output: value("output"),
    checksum: value("checksum"),
  }
}

function requireOperatorProfileId(): string {
  const operatorProfileId = process.env[BILLING_GRACE_OPERATOR_ENV]
  if (!operatorProfileId) {
    throw new Error(`Recusado: informe ${BILLING_GRACE_OPERATOR_ENV}`)
  }
  if (!UUID_PATTERN.test(operatorProfileId)) {
    throw new Error(
      `Recusado: ${BILLING_GRACE_OPERATOR_ENV} deve ser um UUID real`
    )
  }
  return operatorProfileId
}

function assertApplyAuthorization(args: Args): void {
  if (!args.apply) return
  if (process.env[BILLING_GRACE_CRM_ENTITLEMENT_APPLY_ENV] !== "1") {
    throw new Error(
      `Recusado: --apply exige ${BILLING_GRACE_CRM_ENTITLEMENT_APPLY_ENV}=1`
    )
  }
  if (!args.input || !args.checksum) {
    throw new Error(
      "Recusado: --apply exige --input=<dry-run.json> e --checksum=<checksum>"
    )
  }
}

async function fetchCrmProduct(
  db: DatabaseClient,
  policy: CrmEntitlementPolicy
): Promise<CrmProductSnapshot> {
  const product = await db.backofficeProduct.findUnique({
    where: { id: policy.productId },
    select: {
      id: true,
      name: true,
      featureSlugs: true,
      isActive: true,
      type: true,
    },
  })

  if (!product) {
    throw new Error(`Produto CRM não encontrado: ${policy.productId}`)
  }

  return {
    id: product.id,
    name: product.name,
    featureSlugs: product.featureSlugs,
    isActive: product.isActive,
    type: String(product.type),
  }
}

function toSubscriptionSnapshot(
  subscription: SubscriptionRow
): TeamCrmEntitlementSnapshot["activeBackofficeSubscriptions"][number] {
  return {
    id: subscription.id,
    productId: subscription.productId,
    productName: subscription.product.name,
    featureSlugs: subscription.product.featureSlugs,
    status: String(subscription.status),
    startDate: subscription.startDate,
    endDate: subscription.endDate,
  }
}

async function fetchTeamSnapshots(
  db: DatabaseClient,
  policy: CrmEntitlementPolicy,
  now: Date,
  teamIds: readonly string[] | null
): Promise<TeamCrmEntitlementSnapshot[]> {
  const batchWhere = teamIds
    ? {
        isActive: true,
        expiresAt: new Date(policy.expiry),
        grantedByProfileId: policy.operatorProfileId,
        teamId: { in: [...teamIds] },
      }
    : {
        isActive: true,
        expiresAt: new Date(policy.expiry),
        grantedByProfileId: policy.operatorProfileId,
      }

  const batchGraces = await db.billingAccessGrace.findMany({
    where: batchWhere,
    select: {
      id: true,
      teamId: true,
      expiresAt: true,
      isActive: true,
      reason: true,
      grantedByProfileId: true,
      createdAt: true,
    },
  })

  const ids = teamIds
    ? [...teamIds]
    : [...new Set(batchGraces.map((grace) => grace.teamId))]

  if (ids.length === 0) return []

  const teams = await db.team.findMany({
    where: { id: { in: ids }, deletedAt: null },
    select: {
      id: true,
      name: true,
      masterId: true,
      master: {
        select: {
          id: true,
          email: true,
          fullName: true,
          deletedAt: true,
          hasPermanentSubscription: true,
          subscriptionStatus: true,
          subscription: {
            select: {
              hasPermanentSubscription: true,
              subscriptionStatus: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  featureSlugs: true,
                },
              },
            },
          },
          userTypeAssignment: {
            select: {
              accessStartsAt: true,
              accessExpiresAt: true,
              userType: { select: { slug: true } },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  })

  if (teams.length === 0) return []

  const selectedIds = teams.map((team) => team.id)
  const masterIds = [...new Set(teams.map((team) => team.masterId))]

  const [activeUsers, activeGraces, activeBans, subscriptions] =
    await Promise.all([
      db.profile.findMany({
        where: { deletedAt: null, activeTeamId: { in: selectedIds } },
        select: {
          id: true,
          email: true,
          fullName: true,
          activeTeamId: true,
        },
      }),
      db.billingAccessGrace.findMany({
        where: { teamId: { in: selectedIds }, isActive: true },
        select: {
          id: true,
          teamId: true,
          expiresAt: true,
          isActive: true,
          reason: true,
          grantedByProfileId: true,
          createdAt: true,
        },
      }),
      db.backofficeBannedUser.findMany({
        where: { status: "ACTIVE" },
        select: {
          id: true,
          profileId: true,
          scope: true,
          email: true,
          reason: true,
        },
      }),
      db.backofficeUserSubscription.findMany({
        where: { profileId: { in: masterIds } },
        select: {
          id: true,
          profileId: true,
          productId: true,
          status: true,
          startDate: true,
          endDate: true,
          product: {
            select: {
              id: true,
              name: true,
              featureSlugs: true,
            },
          },
        },
      }),
    ])

  const usersByTeam = new Map<string, TeamCrmEntitlementSnapshot["activeUsers"]>()
  for (const user of activeUsers) {
    if (!user.activeTeamId) continue
    const list = usersByTeam.get(user.activeTeamId) ?? []
    list.push({ id: user.id, email: user.email, fullName: user.fullName })
    usersByTeam.set(user.activeTeamId, list)
  }

  const gracesByTeam = new Map<
    string,
    TeamCrmEntitlementSnapshot["activeGraces"]
  >()
  for (const grace of activeGraces) {
    const list = gracesByTeam.get(grace.teamId) ?? []
    list.push({
      id: grace.id,
      expiresAt: grace.expiresAt,
      isActive: grace.isActive,
      reason: grace.reason,
      grantedByProfileId: grace.grantedByProfileId,
      createdAt: grace.createdAt,
    })
    gracesByTeam.set(grace.teamId, list)
  }

  const bansByProfile = new Map<
    string,
    TeamCrmEntitlementSnapshot["masterBans"]
  >()
  for (const ban of activeBans) {
    const list = bansByProfile.get(ban.profileId) ?? []
    list.push({
      id: ban.id,
      profileId: ban.profileId,
      scope: String(ban.scope),
      email: ban.email,
      reason: ban.reason,
    })
    bansByProfile.set(ban.profileId, list)
  }

  const subscriptionsByProfile = new Map<string, SubscriptionRow[]>()
  for (const subscription of subscriptions) {
    const list = subscriptionsByProfile.get(subscription.profileId) ?? []
    list.push({
      id: subscription.id,
      profileId: subscription.profileId,
      productId: subscription.productId,
      status: String(subscription.status),
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      product: {
        id: subscription.product.id,
        name: subscription.product.name,
        featureSlugs: subscription.product.featureSlugs,
      },
    })
    subscriptionsByProfile.set(subscription.profileId, list)
  }

  return teams.map((team) => {
    const master = team.master
    const users = usersByTeam.get(team.id) ?? []
    const masterBans = bansByProfile.get(team.masterId) ?? []
    const masterSubscriptions =
      subscriptionsByProfile.get(team.masterId) ?? []
    const activeSubscriptions = masterSubscriptions.filter(
      (subscription) =>
        subscription.status === "active" &&
        (!subscription.endDate ||
          subscription.endDate.getTime() >= now.getTime())
    )
    const profileProduct = master.subscription?.product
      ? {
          productId: master.subscription.product.id,
          productName: master.subscription.product.name,
          featureSlugs: master.subscription.product.featureSlugs,
        }
      : null
    const memberPro = master.userTypeAssignment
      ? {
          slug: master.userTypeAssignment.userType.slug,
          accessStartsAt: master.userTypeAssignment.accessStartsAt,
          accessExpiresAt: master.userTypeAssignment.accessExpiresAt,
        }
      : null

    return {
      teamId: team.id,
      teamName: team.name,
      masterId: team.masterId,
      masterEmail: master.email,
      masterName: master.fullName,
      masterDeleted: master.deletedAt !== null,
      profileSubscriptionStatus:
        master.subscription?.subscriptionStatus ??
        master.subscriptionStatus ??
        null,
      hasPermanentAccess:
        master.hasPermanentSubscription ||
        master.subscription?.hasPermanentSubscription === true,
      profileProduct,
      activeBackofficeSubscriptions: activeSubscriptions.map(
        toSubscriptionSnapshot
      ),
      existingCrmEntitlements: masterSubscriptions
        .filter(
          (subscription) => subscription.productId === policy.productId
        )
        .map(toSubscriptionSnapshot),
      memberPro,
      masterBans,
      activeGraces: gracesByTeam.get(team.id) ?? [],
      activeUsers: users,
      activeUserBans: users.flatMap(
        (user) => bansByProfile.get(user.id) ?? []
      ),
    }
  })
}

function featureAccessInput(entry: {
  teamId: string
  masterId: string
}) {
  return {
    profileId: entry.masterId,
    managerId: entry.masterId,
    activeTeamId: entry.teamId,
    teamContext: MASTER_TEAM_CONTEXT,
  }
}

async function buildDryRunReport(
  now: Date,
  operatorProfileId: string
): Promise<CrmEntitlementReport> {
  const policy = createCrmEntitlementPolicy(operatorProfileId)
  const product = await fetchCrmProduct(prisma, policy)
  assertApprovedCrmEntitlementPolicy(policy, product, now)

  const snapshots = await fetchTeamSnapshots(prisma, policy, now, null)
  const entries = snapshots.map((snapshot) =>
    classifyTeamCrmEntitlement(snapshot, policy, now)
  )

  const enriched = await Promise.all(
    entries.map(async (entry) => {
      if (entry.decision !== "included") return entry

      const access = await featureAccessService.resolveAllowedSlugs(
        featureAccessInput(entry)
      )
      const currentCrmAccess = access.slugs.includes(
        policy.requiredFeatureSlug
      )

      if (currentCrmAccess) {
        return {
          ...entry,
          currentFeatureSlugs: access.slugs,
          currentCrmAccess,
          decision: "excluded" as const,
          reason: CRM_ENTITLEMENT_REASONS.alreadyEntitled,
          action: null,
        }
      }

      return {
        ...entry,
        currentFeatureSlugs: access.slugs,
        currentCrmAccess,
      }
    })
  )

  const report = buildCrmEntitlementReport(enriched, policy, product, now)

  if (report.summary.includedTeams !== EXPECTED_CRM_ENTITLEMENT_TEAMS) {
    throw new Error(
      `Dry-run divergente: esperava ${EXPECTED_CRM_ENTITLEMENT_TEAMS} times, encontrou ${report.summary.includedTeams}. Nada foi escrito.`
    )
  }

  return report
}

function readDryRunReport(
  path: string,
  expectedChecksum: string,
  operatorProfileId: string
): CrmEntitlementReport {
  const report = JSON.parse(readFileSync(path, "utf8")) as CrmEntitlementReport

  if (report.apply !== false) {
    throw new Error("Relatório inválido: o arquivo de entrada não é um dry-run")
  }
  if (
    typeof report.checksum !== "string" ||
    report.checksum !== expectedChecksum
  ) {
    throw new Error(
      "Dry-run inválido ou checksum divergente; gere um novo relatório"
    )
  }
  if (!report.policy || typeof report.policy !== "object") {
    throw new Error("Relatório inválido: política ausente")
  }
  if (report.policy.operatorProfileId !== operatorProfileId) {
    throw new Error("Relatório gerado por outro operador; recusado")
  }
  assertApprovedCrmEntitlementPolicy(
    report.policy,
    report.product,
    new Date()
  )
  if (!Array.isArray(report.teams)) {
    throw new Error("Relatório inválido: lista de times ausente")
  }
  if (report.teams.length !== EXPECTED_CRM_ENTITLEMENT_TEAMS) {
    throw new Error(
      `Relatório inválido: esperava ${EXPECTED_CRM_ENTITLEMENT_TEAMS} times, recebeu ${report.teams.length}`
    )
  }
  if (
    computeCrmEntitlementChecksum(report.policy, report.teams) !==
    expectedChecksum
  ) {
    throw new Error("Checksum do grant CRM divergente; gere um novo relatório")
  }
  if (typeof report.generatedAt !== "string") {
    throw new Error("Relatório inválido: generatedAt ausente")
  }

  for (const entry of report.teams) {
    if (!entry || typeof entry !== "object") {
      throw new Error("Relatório contém uma entrada de time inválida")
    }
    if (!UUID_PATTERN.test(entry.teamId) || !UUID_PATTERN.test(entry.masterId)) {
      throw new Error(
        `Relatório contém IDs inválidos: ${entry.teamName ?? entry.teamId}`
      )
    }
    if (entry.decision !== "included" || entry.action !== "create") {
      throw new Error(
        `Relatório contém time não incluído ou ação inválida: ${entry.teamName}`
      )
    }
    if (!entry.graceId || entry.graceExpiresAt !== report.policy.expiry) {
      throw new Error(`Relatório sem grace válida: ${entry.teamName}`)
    }
    if (
      entry.productId !== report.policy.productId ||
      entry.productName !== report.policy.productName ||
      entry.requiredFeatureSlug !== report.policy.requiredFeatureSlug
    ) {
      throw new Error(`Relatório com produto divergente: ${entry.teamName}`)
    }
    if (entry.currentCrmAccess !== false) {
      throw new Error(
        `Relatório com CRM já ativo no feature access: ${entry.teamName}`
      )
    }
    if (!Array.isArray(entry.currentFeatureSlugs)) {
      throw new Error(
        `Relatório sem evidência de feature access: ${entry.teamName}`
      )
    }
  }

  return report
}

async function applyEntry(
  planned: CrmEntitlementEntry,
  report: CrmEntitlementReport,
  operatorProfileId: string
): Promise<ApplyResult> {
  const now = new Date()
  const policy = report.policy
  const currentSnapshots = await fetchTeamSnapshots(
    prisma,
    policy,
    now,
    [planned.teamId]
  )
  const currentSnapshot = currentSnapshots[0]

  if (!currentSnapshot) {
    return failedResult(planned, null, "time não encontrado na revalidação")
  }

  const current = classifyTeamCrmEntitlement(currentSnapshot, policy, now)
  const decision = resolveApplyDecision(planned, current)

  if (decision.action === "skip") {
    return skippedResult(planned, decision.reason)
  }
  if (decision.action === "conflict") {
    return failedResult(planned, null, decision.reason)
  }

  const beforeAccess = await featureAccessService.resolveAllowedSlugs(
    featureAccessInput(planned)
  )
  if (beforeAccess.slugs.includes(policy.requiredFeatureSlug)) {
    return skippedResult(
      planned,
      CRM_ENTITLEMENT_REASONS.alreadyEntitled
    )
  }

  let committed = false
  let entitlementId: string | null = null

  try {
    const outcome = await prisma.$transaction(
      async (tx): Promise<TransactionOutcome> => {
        const operator = await tx.profile.findUnique({
          where: { id: operatorProfileId },
          select: { id: true },
        })
        if (!operator) {
          throw new Error(`Operador não encontrado: ${operatorProfileId}`)
        }

        const txSnapshots = await fetchTeamSnapshots(
          tx,
          policy,
          now,
          [planned.teamId]
        )
        const txCurrentSnapshot = txSnapshots[0]
        if (!txCurrentSnapshot) {
          throw new Error(`Time não encontrado na transação: ${planned.teamId}`)
        }

        const txCurrent = classifyTeamCrmEntitlement(
          txCurrentSnapshot,
          policy,
          now
        )
        const txDecision = resolveApplyDecision(planned, txCurrent)
        if (txDecision.action === "skip") {
          return { status: "skipped", reason: txDecision.reason }
        }
        if (txDecision.action === "conflict") {
          throw new Error(txDecision.reason)
        }

        const existing = await tx.backofficeUserSubscription.findUnique({
          where: {
            profileId_productId: {
              profileId: planned.masterId,
              productId: policy.productId,
            },
          },
          select: { id: true },
        })
        if (existing) {
          throw new Error(
            `Já existe entitlement CRM para o master ${planned.masterId}; nada foi escrito`
          )
        }

        const entitlement = await tx.backofficeUserSubscription.create({
          data: {
            profileId: planned.masterId,
            productId: policy.productId,
            startDate: now,
            endDate: new Date(policy.expiry),
          },
          select: {
            id: true,
            status: true,
            startDate: true,
            endDate: true,
          },
        })

        await tx.subscriptionChangeLog.create({
          data: {
            profileId: planned.masterId,
            source: BILLING_GRACE_CRM_ENTITLEMENT_SOURCE,
            actorProfileId: operatorProfileId,
            changeType: BILLING_GRACE_CRM_ENTITLEMENT_CHANGE_TYPE,
            before: {
              teamId: planned.teamId,
              teamName: planned.teamName,
              subscriptionStatus: txCurrent.subscriptionStatus,
              profileProduct: txCurrent.profileProduct,
              activeBackofficeSubscriptions:
                txCurrent.activeBackofficeSubscriptions.map(
                  toSubscriptionJson
                ),
              existingCrmEntitlements:
                txCurrent.existingCrmEntitlements.map(toSubscriptionJson),
              currentFeatureSlugs: beforeAccess.slugs,
              currentCrmAccess: beforeAccess.slugs.includes(
                policy.requiredFeatureSlug
              ),
              activeUsers: txCurrent.activeUsers,
              bannedActiveUsers: txCurrent.bannedActiveUsers,
            },
            after: {
              teamId: planned.teamId,
              entitlementId: entitlement.id,
              productId: policy.productId,
              productName: policy.productName,
              featureSlugs: [policy.requiredFeatureSlug],
              status: String(entitlement.status),
              startDate: entitlement.startDate.toISOString(),
              endDate: entitlement.endDate?.toISOString() ?? null,
            },
            metadata: {
              reason: "billing grace CRM entitlement",
              policyVersion: policy.version,
              dryRunChecksum: report.checksum,
              dryRunGeneratedAt: report.generatedAt,
              graceId: planned.graceId,
              graceExpiresAt: planned.graceExpiresAt,
              activeUsers: txCurrent.activeUsers,
              bannedActiveUsers: txCurrent.bannedActiveUsers,
              asaasMutation: false,
              subscriptionMutation: false,
              banMutation: false,
              featureAccessCacheSeconds: 60,
            },
          },
        })

        return {
          status: "applied",
          entitlementId: entitlement.id,
          current: txCurrent,
        }
      }
    )

    if (outcome.status === "skipped") {
      return skippedResult(planned, outcome.reason)
    }

    committed = true
    entitlementId = outcome.entitlementId

    const afterAccess = await featureAccessService.resolveAllowedSlugs(
      featureAccessInput(planned)
    )
    const finalCrmAccess = afterAccess.slugs.includes(
      policy.requiredFeatureSlug
    )

    return {
      teamId: planned.teamId,
      teamName: planned.teamName,
      masterId: planned.masterId,
      status: finalCrmAccess ? "applied" : "failed",
      plannedAction: planned.action,
      entitlementId,
      reason: null,
      committed,
      verified: finalCrmAccess,
      finalCrmAccess,
      featureAccessSlugs: afterAccess.slugs,
      activeUsers: outcome.current.activeUsers,
      bannedActiveUsers: outcome.current.bannedActiveUsers.length,
      error: finalCrmAccess
        ? null
        : "Grant commitado, mas o feature access não confirmou o slug crm",
    }
  } catch (error) {
    return {
      teamId: planned.teamId,
      teamName: planned.teamName,
      masterId: planned.masterId,
      status: "failed",
      plannedAction: planned.action,
      entitlementId,
      reason: null,
      committed,
      verified: false,
      finalCrmAccess: false,
      featureAccessSlugs: [],
      activeUsers: current.activeUsers,
      bannedActiveUsers: current.bannedActiveUsers.length,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function toSubscriptionJson(
  subscription: TeamCrmEntitlementSnapshot["activeBackofficeSubscriptions"][number]
) {
  return {
    id: subscription.id,
    productId: subscription.productId,
    productName: subscription.productName,
    featureSlugs: subscription.featureSlugs,
    status: subscription.status,
    startDate: subscription.startDate?.toISOString() ?? null,
    endDate: subscription.endDate?.toISOString() ?? null,
  }
}

function skippedResult(
  planned: CrmEntitlementEntry,
  reason: string
): ApplyResult {
  return {
    teamId: planned.teamId,
    teamName: planned.teamName,
    masterId: planned.masterId,
    status: "skipped",
    plannedAction: planned.action,
    entitlementId: null,
    reason,
    committed: false,
    verified: false,
    finalCrmAccess: false,
    featureAccessSlugs: [],
    activeUsers: planned.activeUsers,
    bannedActiveUsers: planned.bannedActiveUsers.length,
    error: null,
  }
}

function failedResult(
  planned: CrmEntitlementEntry,
  entitlementId: string | null,
  error: string
): ApplyResult {
  return {
    teamId: planned.teamId,
    teamName: planned.teamName,
    masterId: planned.masterId,
    status: "failed",
    plannedAction: planned.action,
    entitlementId,
    reason: null,
    committed: false,
    verified: false,
    finalCrmAccess: false,
    featureAccessSlugs: [],
    activeUsers: planned.activeUsers,
    bannedActiveUsers: planned.bannedActiveUsers.length,
    error,
  }
}

async function applyCrmEntitlementReport(
  report: CrmEntitlementReport,
  operatorProfileId: string
): Promise<ApplyReport> {
  const currentProduct = await fetchCrmProduct(prisma, report.policy)
  assertApprovedCrmEntitlementPolicy(
    report.policy,
    currentProduct,
    new Date()
  )

  const results: ApplyResult[] = []
  for (const planned of report.teams) {
    try {
      results.push(await applyEntry(planned, report, operatorProfileId))
    } catch (error) {
      results.push(
        failedResult(
          planned,
          null,
          error instanceof Error ? error.message : String(error)
        )
      )
    }
  }

  const applied = results.filter((result) => result.status === "applied")

  return {
    generatedAt: new Date().toISOString(),
    apply: true,
    sourceReport: {
      checksum: report.checksum,
      generatedAt: report.generatedAt,
    },
    policy: report.policy,
    product: currentProduct,
    warnings: report.warnings,
    summary: {
      plannedTeams: report.teams.length,
      applied: applied.length,
      skipped: results.filter((result) => result.status === "skipped").length,
      failed: results.filter((result) => result.status === "failed").length,
      committed: results.filter((result) => result.committed).length,
      verified: results.filter((result) => result.verified).length,
      activeUsersCovered: applied.reduce(
        (total, result) => total + result.activeUsers,
        0
      ),
      bannedActiveUsersCovered: applied.reduce(
        (total, result) => total + result.bannedActiveUsers,
        0
      ),
    },
    results,
    checksum: report.checksum,
  }
}

function emitDryRunReport(
  report: CrmEntitlementReport,
  outputPath?: string
): void {
  const json = JSON.stringify(report, null, 2)
  if (!outputPath) {
    process.stdout.write(`${json}\n`)
    return
  }

  writeFileSync(outputPath, json, { encoding: "utf8", mode: 0o600 })
  process.stdout.write(
    `${JSON.stringify(
      {
        output: outputPath,
        checksum: report.checksum,
        summary: report.summary,
        warnings: report.warnings,
        teams: report.teams.map((team) => ({
          teamId: team.teamId,
          teamName: team.teamName,
          masterId: team.masterId,
          masterEmail: team.masterEmail,
          activeUsers: team.activeUsers,
          bannedActiveUsers: team.bannedActiveUsers,
          subscriptionStatus: team.subscriptionStatus,
          graceExpiresAt: team.graceExpiresAt,
          currentCrmAccess: team.currentCrmAccess,
          action: team.action,
        })),
      },
      null,
      2
    )}\n`
  )
}

function emitApplyReport(report: ApplyReport, outputPath?: string): void {
  const json = JSON.stringify(report, null, 2)
  if (!outputPath) {
    process.stdout.write(`${json}\n`)
    return
  }

  writeFileSync(outputPath, json, { encoding: "utf8", mode: 0o600 })
  process.stdout.write(
    `${JSON.stringify(
      {
        output: outputPath,
        checksum: report.checksum,
        summary: report.summary,
        results: report.results,
      },
      null,
      2
    )}\n`
  )
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2))
  const operatorProfileId = requireOperatorProfileId()
  assertApplyAuthorization(args)

  if (!args.apply) {
    const report = await buildDryRunReport(new Date(), operatorProfileId)
    emitDryRunReport(report, args.output)
    return
  }

  const report = readDryRunReport(
    args.input!,
    args.checksum!,
    operatorProfileId
  )
  const applyReport = await applyCrmEntitlementReport(
    report,
    operatorProfileId
  )
  emitApplyReport(applyReport, args.output)

  if (applyReport.summary.failed > 0) {
    process.exitCode = 1
  }
}

main()
  .catch((error) => {
    console.error(
      "[grant-billing-grace-crm-entitlement] erro fatal:",
      error
    )
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
