import { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import {
  ASAAS_ACCOUNT_MIGRATION_TRANSITIONS,
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

export class AsaasAccountMigrationRepository implements IAsaasAccountMigrationRepository {
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

    return prisma.asaasAccountMigration.update({
      where: { legacyCustomerId: input.legacyCustomerId },
      data: {
        status: input.toStatus,
        attemptCount: { increment: 1 },
        // failed carrega o erro; qualquer outra transição (inclusive o
        // retry failed -> pending) limpa o erro anterior.
        lastError: input.toStatus === "failed" ? (input.lastError ?? null) : null,
        primaryCustomerId: input.primaryCustomerId ?? current.primaryCustomerId,
        primarySubscriptionId: input.primarySubscriptionId ?? current.primarySubscriptionId,
        anomalyNotes: input.anomalyNotes ?? current.anomalyNotes,
        migratedAt:
          input.toStatus === "done" ? (input.migratedAt ?? new Date()) : current.migratedAt,
      },
    })
  }

  async countAll() {
    return prisma.asaasAccountMigration.count()
  }

  async listNonTerminalStaleSince(olderThan: Date) {
    return prisma.asaasAccountMigration.findMany({
      where: {
        status: { notIn: ["done", "failed", "requires_card_reauth"] },
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
