import { Prisma } from "@prisma/client"
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
      },
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
