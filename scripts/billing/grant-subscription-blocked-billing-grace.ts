import { readFileSync, writeFileSync } from "node:fs"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import { accountAccessDecisionUseCase } from "@/app/api/useCases/accountAccessDecision/AccountAccessDecisionUseCase"
import {
  assertApprovedCensusPolicy,
  buildCensusReport,
  buildGraceReason,
  classifyTeamSnapshot,
  computeCensusChecksum,
  DEFAULT_CENSUS_POLICY,
  resolveApplyDecision,
  SUBSCRIPTION_BLOCKED_GRACE_EXPIRY,
  SUBSCRIPTION_BLOCKED_GRACE_SOURCE,
  type BanSnapshot,
  type CensusPolicy,
  type CensusReport,
  type GraceSnapshot,
  type SubscriptionSnapshot,
  type TeamBillingSnapshot,
  type TeamCensusEntry,
} from "./lib/subscriptionBlockedBillingGrace"

const APPLY_ENV = "SUBSCRIPTION_BLOCKED_GRACE_APPLY"
const OPERATOR_ENV = "BILLING_GRACE_OPERATOR_PROFILE_ID"
const CHANGE_TYPE = "temporary_billing_access_granted"
const REPAIR_CHANGE_TYPE = "temporary_billing_access_expiry_repaired"
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
  plannedAction: "grant" | "repair-expiry" | null
  graceId: string | null
  reason: string | null
  committed: boolean
  verified: boolean
  finalDecision: string | null
  activeUsers: number
  bannedActiveUsers: number
  error: string | null
}

type ApplyReport = {
  generatedAt: string
  apply: true
  sourceReport: { checksum: string; generatedAt: string }
  policy: CensusPolicy
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

type SubscriptionSource = {
  subscriptionStatus: string | null
  subscriptionNextDueDate: Date | null
  hasPermanentSubscription: boolean
  subscriptionCycle: string | null
  subscriptionStartDate: Date | null
  subscriptionEndDate: Date | null
}

type AccessVerification = {
  allowed: boolean
  state: string | null
  error: string | null
}

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
  const operatorProfileId = process.env[OPERATOR_ENV]
  if (!operatorProfileId) {
    throw new Error(`Recusado: informe ${OPERATOR_ENV}`)
  }
  if (!UUID_PATTERN.test(operatorProfileId)) {
    throw new Error(`Recusado: ${OPERATOR_ENV} deve ser um UUID real`)
  }
  return operatorProfileId
}

function assertApplyAuthorization(args: Args): void {
  if (!args.apply) return
  if (process.env[APPLY_ENV] !== "1") {
    throw new Error(`Recusado: --apply exige ${APPLY_ENV}=1`)
  }
  if (!args.input || !args.checksum) {
    throw new Error(
      "Recusado: --apply exige --input=<dry-run.json> e --checksum=<checksum>"
    )
  }
  requireOperatorProfileId()
}

function readCensusReport(path: string, expectedChecksum: string): CensusReport {
  const report = JSON.parse(readFileSync(path, "utf8")) as CensusReport

  if (report.apply !== false) {
    throw new Error("Relatório inválido: o arquivo de entrada não é um dry-run")
  }
  if (
    typeof report.checksum !== "string" ||
    report.checksum !== expectedChecksum
  ) {
    throw new Error("Dry-run inválido ou checksum divergente; gere um novo relatório")
  }
  if (!report.policy || typeof report.policy !== "object") {
    throw new Error("Relatório inválido: política ausente")
  }
  assertApprovedCensusPolicy(report.policy)
  if (!Array.isArray(report.teams) || report.teams.length === 0) {
    throw new Error("Relatório inválido: lista de times ausente ou vazia")
  }
  if (computeCensusChecksum(report.policy, report.teams) !== expectedChecksum) {
    throw new Error("Checksum do censo divergente; gere um novo relatório")
  }
  if (typeof report.generatedAt !== "string") {
    throw new Error("Relatório inválido: generatedAt ausente")
  }

  for (const entry of report.teams) {
    if (!entry || typeof entry !== "object") {
      throw new Error("Relatório contém uma entrada de time inválida")
    }
    if (!UUID_PATTERN.test(entry.teamId) || !UUID_PATTERN.test(entry.masterId)) {
      throw new Error(`Relatório contém IDs inválidos: ${entry.teamName ?? entry.teamId}`)
    }
    if (entry.decision !== "included") {
      throw new Error(`Relatório contém time não incluído: ${entry.teamName}`)
    }
    if (entry.action !== "grant" && entry.action !== "repair-expiry") {
      throw new Error(`Relatório contém ação inválida: ${entry.teamName}`)
    }
    if (entry.action === "grant" && entry.currentGrace !== null) {
      throw new Error(`Relatório com grace inesperada para grant: ${entry.teamName}`)
    }
    if (
      entry.action === "repair-expiry" &&
      (!entry.currentGrace || !entry.currentGrace.expiresAt)
    ) {
      throw new Error(`Relatório sem grace expirada para reparo: ${entry.teamName}`)
    }
  }

  report.warnings = Array.isArray(report.warnings) ? report.warnings : []
  return report
}

function toSubscriptionSnapshot(source: SubscriptionSource): SubscriptionSnapshot {
  return {
    subscriptionStatus: source.subscriptionStatus,
    subscriptionNextDueDate: source.subscriptionNextDueDate,
    hasPermanentSubscription: source.hasPermanentSubscription,
    subscriptionCycle: source.subscriptionCycle,
    subscriptionStartDate: source.subscriptionStartDate,
    subscriptionEndDate: source.subscriptionEndDate,
  }
}

async function fetchTeamSnapshots(
  db: DatabaseClient,
  teamIds: readonly string[] | null
): Promise<TeamBillingSnapshot[]> {
  const teams = await db.team.findMany({
    where:
      teamIds === null
        ? { deletedAt: null }
        : { id: { in: [...teamIds] }, deletedAt: null },
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
          subscriptionNextDueDate: true,
          subscriptionStatus: true,
          subscriptionCycle: true,
          subscriptionStartDate: true,
          subscriptionEndDate: true,
          subscription: {
            select: {
              hasPermanentSubscription: true,
              subscriptionNextDueDate: true,
              subscriptionStatus: true,
              subscriptionCycle: true,
              subscriptionStartDate: true,
              subscriptionEndDate: true,
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

  const ids = teams.map((team) => team.id)
  if (ids.length === 0) return []

  const [activeUsers, activeGraces, activeBans] = await Promise.all([
    db.profile.findMany({
      where: { deletedAt: null, activeTeamId: { in: ids } },
      select: { id: true, email: true, fullName: true, activeTeamId: true },
    }),
    db.billingAccessGrace.findMany({
      where: { teamId: { in: ids }, isActive: true },
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
  ])

  const usersByTeam = new Map<string, TeamBillingSnapshot["activeUsers"]>()
  for (const user of activeUsers) {
    if (!user.activeTeamId) continue
    const list = usersByTeam.get(user.activeTeamId) ?? []
    list.push({ id: user.id, email: user.email, fullName: user.fullName })
    usersByTeam.set(user.activeTeamId, list)
  }

  const gracesByTeam = new Map<string, GraceSnapshot[]>()
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

  const bansByProfile = new Map<string, BanSnapshot[]>()
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

  return teams.map((team) => {
    const master = team.master
    const users = usersByTeam.get(team.id) ?? []
    const masterBans = bansByProfile.get(team.masterId) ?? []
    const activeUserBans = users.flatMap(
      (user) => bansByProfile.get(user.id) ?? []
    )

    return {
      teamId: team.id,
      teamName: team.name,
      masterId: team.masterId,
      masterEmail: master.email,
      masterName: master.fullName,
      masterDeleted: master.deletedAt !== null,
      profileSubscription: toSubscriptionSnapshot(master),
      canonicalSubscription: master.subscription
        ? toSubscriptionSnapshot(master.subscription)
        : null,
      memberPro: master.userTypeAssignment?.userType
        ? {
            slug: master.userTypeAssignment.userType.slug,
            accessStartsAt: master.userTypeAssignment.accessStartsAt,
            accessExpiresAt: master.userTypeAssignment.accessExpiresAt,
          }
        : null,
      masterBans,
      activeGraces: gracesByTeam.get(team.id) ?? [],
      activeUsers: users,
      activeUserBans,
    }
  })
}

async function fetchTeamSnapshot(
  db: DatabaseClient,
  teamId: string
): Promise<TeamBillingSnapshot | null> {
  const snapshots = await fetchTeamSnapshots(db, [teamId])
  return snapshots[0] ?? null
}

async function buildDryRunReport(now: Date): Promise<CensusReport> {
  assertApprovedCensusPolicy(DEFAULT_CENSUS_POLICY, now)
  const snapshots = await fetchTeamSnapshots(prisma, null)
  const entries = snapshots.map((snapshot) =>
    classifyTeamSnapshot(snapshot, now)
  )
  return buildCensusReport(entries, now)
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function verifyTeamAccess(teamId: string): Promise<AccessVerification> {
  try {
    const output = await accountAccessDecisionUseCase.executeForTeam(teamId)
    const result = output.result as { state?: unknown; reason?: unknown } | null
    const state = typeof result?.state === "string" ? result.state : null

    if (!output.isValid || state !== "allowed") {
      const details = [
        ...output.errorMessages,
        typeof result?.reason === "string" ? `motivo=${result.reason}` : null,
        state ? `state=${state}` : null,
      ].filter((value): value is string => Boolean(value))

      return {
        allowed: false,
        state,
        error: details.join("; ") || "decisão final não está allowed",
      }
    }

    return { allowed: true, state, error: null }
  } catch (error) {
    return { allowed: false, state: null, error: errorMessage(error) }
  }
}

async function applyEntry(
  planned: TeamCensusEntry,
  checksum: string
): Promise<ApplyResult> {
  if (planned.action === null) {
    return {
      teamId: planned.teamId,
      teamName: planned.teamName,
      masterId: planned.masterId,
      status: "failed",
      plannedAction: null,
      graceId: null,
      reason: "entrada planejada sem ação",
      committed: false,
      verified: false,
      finalDecision: null,
      activeUsers: planned.activeUsers,
      bannedActiveUsers: planned.bannedActiveUsers.length,
      error: "entrada planejada sem ação",
    }
  }

  const operatorProfileId = requireOperatorProfileId()
  const base = {
    teamId: planned.teamId,
    teamName: planned.teamName,
    masterId: planned.masterId,
    plannedAction: planned.action,
  }

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const operator = await tx.profile.findUnique({
        where: { id: operatorProfileId },
        select: { id: true },
      })
      if (!operator) throw new Error("Operador de auditoria não encontrado")

      const currentSnapshot = await fetchTeamSnapshot(tx, planned.teamId)
      if (!currentSnapshot) throw new Error("Time não encontrado ou removido")
      if (currentSnapshot.teamName !== planned.teamName) {
        throw new Error("Nome do time mudou desde o dry-run")
      }
      if (currentSnapshot.masterId !== planned.masterId) {
        throw new Error("Master do time mudou desde o dry-run")
      }

      const current = classifyTeamSnapshot(currentSnapshot, new Date())
      const decision = resolveApplyDecision(planned, current)

      if (decision.action === "skip") {
        return {
          kind: "skipped" as const,
          reason: decision.reason,
          current,
          graceId: null,
        }
      }
      if (decision.action === "conflict") {
        throw new Error(`Estado divergente: ${decision.reason}`)
      }
      if (current.action === null) {
        throw new Error("Time incluído sem ação após revalidação")
      }

      const reason = buildGraceReason(SUBSCRIPTION_BLOCKED_GRACE_EXPIRY)
      let graceId: string

      if (current.action === "repair-expiry") {
        if (!current.currentGrace) {
          throw new Error("Grace expirada não encontrada para reparo")
        }
        await tx.billingAccessGrace.update({
          where: { id: current.currentGrace.id },
          data: {
            expiresAt: new Date(SUBSCRIPTION_BLOCKED_GRACE_EXPIRY),
            reason,
            grantedByProfileId: operatorProfileId,
            isActive: true,
            resolvedAt: null,
            resolvedReason: null,
          },
        })
        graceId = current.currentGrace.id
      } else {
        const createdGrace = await tx.billingAccessGrace.create({
          data: {
            teamId: planned.teamId,
            reason,
            expiresAt: new Date(SUBSCRIPTION_BLOCKED_GRACE_EXPIRY),
            grantedByProfileId: operatorProfileId,
          },
        })
        graceId = createdGrace.id
      }

      await tx.subscriptionChangeLog.create({
        data: {
          profileId: planned.masterId,
          actorProfileId: operatorProfileId,
          source: SUBSCRIPTION_BLOCKED_GRACE_SOURCE,
          changeType:
            current.action === "repair-expiry"
              ? REPAIR_CHANGE_TYPE
              : CHANGE_TYPE,
          before: {
            teamId: planned.teamId,
            subscriptionStatus: current.subscriptionStatus,
            subscriptionNextDueDate: current.subscriptionNextDueDate,
            accessState: current.accessDecision?.state ?? null,
            activeGrace: current.currentGrace
              ? {
                  id: current.currentGrace.id,
                  expiresAt: current.currentGrace.expiresAt,
                }
              : null,
            activeUsers: current.activeUsers,
          },
          after: {
            teamId: planned.teamId,
            subscriptionStatus: current.subscriptionStatus,
            subscriptionNextDueDate: current.subscriptionNextDueDate,
            accessState: "allowed",
            graceId,
            temporaryAccessUntil: SUBSCRIPTION_BLOCKED_GRACE_EXPIRY,
            activeUsers: current.activeUsers,
          },
          metadata: {
            reason: "bulk subscription billing grace",
            policyVersion: DEFAULT_CENSUS_POLICY.version,
            censusChecksum: checksum,
            asaasMutation: false,
            paymentStatusUnchanged: true,
            memberProPolicy: DEFAULT_CENSUS_POLICY.includeExpiredMemberPro
              ? "included_login_only"
              : "excluded",
            masterBans: current.masterBans,
            bannedActiveUsers: current.bannedActiveUsers,
          },
        },
      })

      return { kind: "applied" as const, current, graceId }
    })

    if (outcome.kind === "skipped") {
      return {
        ...base,
        status: "skipped",
        graceId: null,
        reason: outcome.reason,
        committed: false,
        verified: false,
        finalDecision: null,
        activeUsers: outcome.current.activeUsers,
        bannedActiveUsers: outcome.current.bannedActiveUsers.length,
        error: null,
      }
    }

    const verification = await verifyTeamAccess(planned.teamId)
    if (!verification.allowed) {
      return {
        ...base,
        status: "failed",
        graceId: outcome.graceId,
        reason: "grace aplicada, mas a decisão final não ficou allowed",
        committed: true,
        verified: false,
        finalDecision: verification.state,
        activeUsers: outcome.current.activeUsers,
        bannedActiveUsers: outcome.current.bannedActiveUsers.length,
        error: verification.error,
      }
    }

    return {
      ...base,
      status: "applied",
      graceId: outcome.graceId,
      reason: null,
      committed: true,
      verified: true,
      finalDecision: verification.state,
      activeUsers: outcome.current.activeUsers,
      bannedActiveUsers: outcome.current.bannedActiveUsers.length,
      error: null,
    }
  } catch (error) {
    return {
      ...base,
      status: "failed",
      graceId: null,
      reason: "erro durante a aplicação do time",
      committed: false,
      verified: false,
      finalDecision: null,
      activeUsers: planned.activeUsers,
      bannedActiveUsers: planned.bannedActiveUsers.length,
      error: errorMessage(error),
    }
  }
}

async function applyCensusReport(report: CensusReport): Promise<ApplyReport> {
  const results: ApplyResult[] = []

  for (const planned of report.teams) {
    const result = await applyEntry(planned, report.checksum)
    results.push(result)
    process.stderr.write(
      `[grant-subscription-blocked-billing-grace] ${result.status}: ${result.teamName}` +
        `${result.reason ? ` (${result.reason})` : ""}` +
        `${result.error ? ` - ${result.error}` : ""}\n`
    )
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
    warnings: report.warnings ?? [],
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

function emitCensusReport(report: CensusReport, outputPath?: string): void {
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
          reason: team.reason,
          action: team.action,
          activeUsers: team.activeUsers,
          bannedActiveUsers: team.bannedActiveUsers,
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
  assertApplyAuthorization(args)

  if (!args.apply) {
    const report = await buildDryRunReport(new Date())
    emitCensusReport(report, args.output)
    return
  }

  const report = readCensusReport(args.input!, args.checksum!)
  const applyReport = await applyCensusReport(report)
  emitApplyReport(applyReport, args.output)

  if (applyReport.summary.failed > 0) {
    process.exitCode = 1
  }
}

main()
  .catch((error) => {
    console.error(
      "[grant-subscription-blocked-billing-grace] erro fatal:",
      error
    )
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
