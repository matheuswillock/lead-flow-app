import { Prisma } from "@prisma/client"
import { createHash } from "node:crypto"
import { prisma } from "@/app/api/infra/data/prisma"
import {
  ASAAS_ACCOUNT_MIGRATION_TRANSITIONS,
  ConcurrentAsaasAccountMigrationUpdateError,
  InvalidAsaasAccountMigrationTransitionError,
} from "./asaasAccountMigrationStateMachine"
import type {
  AsaasAccountMigrationSnapshotInput,
  AsaasAccountMigrationTransitionInput,
  IAsaasAccountMigrationRepository,
} from "./IAsaasAccountMigrationRepository"

function toDecimalOrNull(value: number | null | undefined): Prisma.Decimal | null {
  if (value === null || value === undefined) return null
  return new Prisma.Decimal(value)
}

function saoPauloCivilParts(now: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value)
  return { year: value("year"), month: value("month"), day: value("day") }
}

function persistedCivilBoundary(now: Date, dayOffset: number): Date {
  const { year, month, day } = saoPauloCivilParts(now)
  return new Date(Date.UTC(year, month - 1, day + dayOffset))
}

export class AsaasAccountMigrationRepository implements IAsaasAccountMigrationRepository {
  async recordQuoteSnapshot(legacyCustomerId: string, quote: object): Promise<void> {
    const serialized = JSON.stringify(quote)
    await prisma.asaasAccountMigration.updateMany({
      where: { legacyCustomerId, quoteSnapshot: { equals: Prisma.JsonNull } },
      data: { quoteSnapshot: quote, quoteHash: createHash("sha256").update(serialized).digest("hex") },
    })
  }

  async upsertSnapshot(snapshot: AsaasAccountMigrationSnapshotInput) {
    // Idempotente por construção (legacyCustomerId @unique, DA2/§9.3):
    // `update: {}` é proposital — rodar o populate duas vezes não deve
    // reescrever nenhuma coluna de snapshot já gravada (a trigger S4
    // bloquearia mesmo que tentássemos passar os mesmos valores de novo).
    return prisma.asaasAccountMigration.upsert({
      where: { legacyCustomerId: snapshot.legacyCustomerId },
      create: {
        profileId: snapshot.profileId,
        clientName: snapshot.clientName,
        clientEmail: snapshot.clientEmail,
        legacyCustomerId: snapshot.legacyCustomerId,
        legacySubscriptionId: snapshot.legacySubscriptionId ?? null,
        billingType: snapshot.billingType ?? null,
        cycle: snapshot.cycle ?? null,
        value: toDecimalOrNull(snapshot.value),
        nextDueDate: snapshot.nextDueDate ?? null,
      },
      update: {},
    })
  }

  async findByLegacyCustomerId(legacyCustomerId: string) {
    return prisma.asaasAccountMigration.findUnique({ where: { legacyCustomerId } })
  }

  async listDueForCutover(now: Date) {
    const nextCivilDay = persistedCivilBoundary(now, 1)
    return prisma.asaasAccountMigration.findMany({
      where: {
        nextDueDate: { lt: nextCivilDay },
        OR: [
          { status: { in: ["customer_created", "awaiting_due_date", "requires_card_reauth"] } },
          {
            status: "failed",
            resumeStatus: { in: ["awaiting_due_date", "requires_card_reauth", "paused_awaiting_card"] },
            OR: [
              { failureCode: { startsWith: "TRANSIENT:" } },
              { failureCode: { startsWith: "REMOTE_UNKNOWN:" } },
            ],
          },
        ],
      },
      orderBy: { nextDueDate: "asc" },
    })
  }

  async listForReauthorizationReminder(now: Date) {
    const today = persistedCivilBoundary(now, 0)
    const inEightDays = persistedCivilBoundary(now, 8)
    const sevenDaysAgo = persistedCivilBoundary(now, -7)
    return prisma.asaasAccountMigration.findMany({
      where: {
        OR: [
          {
            status: { in: ["pending", "customer_created", "awaiting_due_date"] },
            nextDueDate: { gte: today, lt: inEightDays },
          },
          {
            status: { in: ["requires_card_reauth", "paused_awaiting_card"] },
            nextDueDate: { gte: sevenDaysAgo },
            OR: [
              { reauthorizationRequestedAt: null },
              { reauthorizationRequestedAt: { lt: today } },
            ],
          },
        ],
      },
      orderBy: { nextDueDate: "asc" },
    })
  }

  async claimForExecution(legacyCustomerId: string, leaseOwner: string, now: Date, leaseDurationMs: number) {
    const updated = await prisma.asaasAccountMigration.updateMany({
      where: {
        legacyCustomerId,
        OR: [
          { leaseOwner: null },
          { leaseExpiresAt: null },
          { leaseExpiresAt: { lt: now } },
        ],
      },
      data: {
        leaseOwner,
        leaseExpiresAt: new Date(now.getTime() + leaseDurationMs),
      },
    })
    if (updated.count === 0) return null
    const migration = await prisma.asaasAccountMigration.findUnique({ where: { legacyCustomerId } })
    return migration ? { migration, leaseOwner } : null
  }

  async renewExecutionLease(legacyCustomerId: string, leaseOwner: string, now: Date, leaseDurationMs: number) {
    const updated = await prisma.asaasAccountMigration.updateMany({
      where: { legacyCustomerId, leaseOwner },
      data: { leaseExpiresAt: new Date(now.getTime() + leaseDurationMs) },
    })
    return updated.count > 0
  }

  async releaseExecutionLease(legacyCustomerId: string, leaseOwner: string) {
    const updated = await prisma.asaasAccountMigration.updateMany({
      where: { legacyCustomerId, leaseOwner },
      data: { leaseOwner: null, leaseExpiresAt: null },
    })
    return updated.count > 0
  }

  async resumeFailedExecution(legacyCustomerId: string) {
    const current = await prisma.asaasAccountMigration.findUnique({ where: { legacyCustomerId } })
    if (
      !current ||
      current.status !== "failed" ||
      !current.resumeStatus ||
      !current.failureCode ||
      (!current.failureCode.startsWith("TRANSIENT:") &&
        !current.failureCode.startsWith("REMOTE_UNKNOWN:"))
    ) return null
    const updated = await prisma.asaasAccountMigration.updateMany({
      where: {
        legacyCustomerId,
        status: "failed",
        attemptCount: current.attemptCount,
      },
      data: {
        status: current.resumeStatus,
        resumeStatus: null,
        failureStep: null,
        failureCode: null,
        lastError: null,
        attemptCount: { increment: 1 },
      },
    })
    if (updated.count === 0) return null
    return prisma.asaasAccountMigration.findUnique({ where: { legacyCustomerId } })
  }

  async markReauthorizationRequested(legacyCustomerId: string, requestedAt: Date) {
    const updated = await prisma.asaasAccountMigration.updateMany({
      where: {
        legacyCustomerId,
        status: {
          in: [
            "requires_card_reauth",
            "legacy_removed",
            "paused_awaiting_card",
          ],
        },
      },
      data: { reauthorizationRequestedAt: requestedAt },
    })
    return updated.count > 0
  }

  async transition(input: AsaasAccountMigrationTransitionInput) {
    const current = await prisma.asaasAccountMigration.findUnique({
      where: { legacyCustomerId: input.legacyCustomerId },
    })

    if (!current) {
      throw new Error(
        `AsaasAccountMigration não encontrado para legacyCustomerId=${input.legacyCustomerId}`
      )
    }

    const allowedNextStatuses = ASAAS_ACCOUNT_MIGRATION_TRANSITIONS[current.status]
    if (!allowedNextStatuses.includes(input.toStatus)) {
      throw new InvalidAsaasAccountMigrationTransitionError(
        current.status,
        input.toStatus,
        input.legacyCustomerId
      )
    }

    // Achado da revisão (codex, P1): o par read-then-update casava só por
    // `legacyCustomerId`, então dois workers podiam ler o MESMO `status`,
    // ambos validar a transição e ambos escrever — o segundo aplicando uma
    // transição que já não era válida para o estado real. Numa máquina de
    // estados que governa "desativar o legado" (invariante 1), essa é
    // exatamente a corrida que não pode existir. O update vira
    // compare-and-swap: 0 linhas afetadas significa que alguém mudou o
    // estado no meio do caminho.
    //
    // Achado P2 da 6ª rodada (thread PRRT_...dNdV): `status` sozinho NÃO é
    // um CAS completo — a máquina permite `pending → failed → pending`, um
    // ciclo ABA. Um worker pausado depois de ler o primeiro `pending` podia
    // acordar depois do ciclo, satisfazer o predicado e sobrescrever os ids
    // primários da tentativa mais nova com valores velhos. `attemptCount` é
    // monotônico (todo `transition` faz `increment: 1`), então incluí-lo no
    // `where` distingue as duas visitas ao mesmo status.
    const updated = await prisma.asaasAccountMigration.updateMany({
      where: {
        legacyCustomerId: input.legacyCustomerId,
        status: current.status,
        attemptCount: current.attemptCount,
        ...(input.leaseOwner
          ? {
              leaseOwner: input.leaseOwner,
              leaseExpiresAt: { gt: input.leaseNow ?? new Date() },
            }
          : {}),
      },
      data: {
        status: input.toStatus,
        attemptCount: { increment: 1 },
        // failed carrega o erro; qualquer outra transição (inclusive o
        // retry failed -> pending) limpa o erro anterior.
        lastError: input.toStatus === "failed" ? (input.lastError ?? null) : null,
        primaryCustomerId: input.primaryCustomerId ?? current.primaryCustomerId,
        primarySubscriptionId: input.primarySubscriptionId ?? current.primarySubscriptionId,
        primaryPaymentId: input.primaryPaymentId ?? current.primaryPaymentId,
        legacyRemovedAt: input.legacyRemovedAt ?? current.legacyRemovedAt,
        reauthorizationRequestedAt:
          input.reauthorizationRequestedAt ?? current.reauthorizationRequestedAt,
        reauthorizationCompletedAt:
          input.reauthorizationCompletedAt ?? current.reauthorizationCompletedAt,
        anomalyNotes: input.anomalyNotes ?? current.anomalyNotes,
        resumeStatus: input.toStatus === "failed" ? (input.resumeStatus ?? current.status) : (input.resumeStatus ?? null),
        failureStep: input.toStatus === "failed" ? (input.failureStep ?? null) : null,
        failureCode: input.toStatus === "failed" ? (input.failureCode ?? input.lastError ?? null) : null,
        migratedAt:
          input.toStatus === "done" ? (input.migratedAt ?? new Date()) : current.migratedAt,
      },
    })

    if (updated.count === 0) {
      throw new ConcurrentAsaasAccountMigrationUpdateError(
        input.legacyCustomerId,
        current.status,
        input.toStatus
      )
    }

    const refreshed = await prisma.asaasAccountMigration.findUnique({
      where: { legacyCustomerId: input.legacyCustomerId },
    })
    if (!refreshed) {
      throw new Error(
        `AsaasAccountMigration desapareceu após a transição (legacyCustomerId=${input.legacyCustomerId})`
      )
    }
    return refreshed
  }

  async countAll() {
    return prisma.asaasAccountMigration.count()
  }

  async listNonTerminalStaleSince(olderThan: Date) {
    return prisma.asaasAccountMigration.findMany({
      where: {
        status: { notIn: ["done"] },
        updatedAt: { lt: olderThan },
      },
      orderBy: { updatedAt: "asc" },
    })
  }

  async markNotificationsDisabled(legacyCustomerId: string): Promise<boolean> {
    const result = await prisma.asaasAccountMigration.updateMany({
      where: { legacyCustomerId },
      data: { notificationsDisabled: true },
    })
    return result.count > 0
  }
}

export const asaasAccountMigrationRepository = new AsaasAccountMigrationRepository()
