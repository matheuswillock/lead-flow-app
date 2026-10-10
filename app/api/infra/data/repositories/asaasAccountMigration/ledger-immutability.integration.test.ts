import { afterAll, describe, expect, it } from "bun:test"
import { randomUUID } from "crypto"

/**
 * T-30.10 — 30 — Migração de Conta (execução) E3 (DA2/C3/S4).
 *
 * Prova a trigger `trg_protect_asaas_account_migration_snapshot`
 * (`supabase/migrations/20260918010237_protect-asaas-account-migrations-ledger.sql`)
 * contra Postgres real — mock não prova nada sobre a existência de uma
 * trigger no banco. Roda só com opt-in explícito (mesmo padrão de
 * `lib/billing/subscription-state-snapshot.integration.test.ts`, T-20.1):
 *
 *   ASAAS_LEDGER_INTEGRATION_TEST=1 DATABASE_URL=postgresql://... \
 *   bun test app/api/infra/data/repositories/asaasAccountMigration/ledger-immutability.integration.test.ts
 *
 * Controle negativo (executado em 2026-09-18 contra um container Postgres
 * descartável com a migration já aplicada, não fica automatizado no
 * código porque exigiria DDL de teste rodando fora do Prisma): `drop
 * trigger trg_protect_asaas_account_migration_snapshot on
 * corretor_studio_asaas_account_migrations;` e reexecutar este arquivo —
 * os 5 testes de "bloqueado" ficaram vermelhos (as 6 mutações proibidas
 * completaram sem lançar), confirmando que é a trigger — não uma
 * constraint, não uma RLS policy — quem impede a mutação. Trigger
 * recriada em seguida via replay da própria migration (`create or
 * replace function` + `create trigger`, idempotente) e os 7 testes
 * voltaram a verde.
 */
const RUN_INTEGRATION =
  process.env.ASAAS_LEDGER_INTEGRATION_TEST === "1" && Boolean(process.env.DATABASE_URL)

let prisma: typeof import("@/app/api/infra/data/prisma").prisma

if (RUN_INTEGRATION) {
  ;({ prisma } = await import("@/app/api/infra/data/prisma"))
}

async function createLedgerRow(overrides: Partial<{ legacyCustomerId: string }> = {}) {
  return prisma.asaasAccountMigration.create({
    data: {
      profileId: randomUUID(),
      clientName: "Cliente Teste",
      clientEmail: `ledger-${randomUUID()}@example.test`,
      legacyCustomerId: overrides.legacyCustomerId ?? `cus_legacy_${randomUUID()}`,
      billingType: "PIX",
      cycle: "MONTHLY",
      value: 100,
      nextDueDate: new Date("2026-10-01T00:00:00.000Z"),
    },
  })
}

/**
 * `PrismaPromise` não é reconhecido pelo `expect(...).rejects` do bun:test
 * (mesmo motivo pelo qual o precedente T-20.1 usa try/catch em vez de
 * `.rejects`) — captura a mensagem de erro real em vez de depender do
 * matcher de promise.
 */
async function captureErrorMessage(operation: Promise<unknown>): Promise<string> {
  try {
    await operation
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  throw new Error("Esperava que a operação lançasse um erro, mas ela completou normalmente")
}

describe.skipIf(!RUN_INTEGRATION)(
  "corretor_studio_asaas_account_migrations — S4 parcial (T-30.10)",
  () => {
    const createdIds: string[] = []

    afterAll(() => {
      // Ledger é append-only por desenho — nada a limpar via DELETE (a
      // trigger bloquearia mesmo que tentássemos). Resíduo de teste
      // esperado no Postgres local, mesmo padrão do T-20.1.
      void createdIds
    })

    it("DELETE é sempre bloqueado, mesmo numa linha recém-criada sem nenhuma coluna preenchida além do obrigatório", async () => {
      const row = await createLedgerRow()
      createdIds.push(row.id)

      const message = await captureErrorMessage(
        prisma.asaasAccountMigration.delete({ where: { id: row.id } })
      )
      expect(message).toMatch(/append-only/)
    })

    it("UPDATE em coluna de snapshot já preenchida (value) é bloqueado", async () => {
      const row = await createLedgerRow()
      createdIds.push(row.id)

      const message = await captureErrorMessage(
        prisma.asaasAccountMigration.update({
          where: { id: row.id },
          data: { value: 999.99 },
        })
      )
      expect(message).toMatch(/value is immutable/)
    })

    it("UPDATE em legacy_customer_id é sempre bloqueado (identidade da linha)", async () => {
      const row = await createLedgerRow()
      createdIds.push(row.id)

      const message = await captureErrorMessage(
        prisma.asaasAccountMigration.update({
          where: { id: row.id },
          data: { legacyCustomerId: `cus_hacked_${randomUUID()}` },
        })
      )
      expect(message).toMatch(/legacy_customer_id is immutable/)
    })

    it("UPDATE em next_due_date/cycle/billing_type já preenchidos é bloqueado", async () => {
      const row = await createLedgerRow()
      createdIds.push(row.id)

      const nextDueDateMessage = await captureErrorMessage(
        prisma.asaasAccountMigration.update({
          where: { id: row.id },
          data: { nextDueDate: new Date("2027-01-01T00:00:00.000Z") },
        })
      )
      expect(nextDueDateMessage).toMatch(/next_due_date is immutable/)

      const cycleMessage = await captureErrorMessage(
        prisma.asaasAccountMigration.update({ where: { id: row.id }, data: { cycle: "ANNUAL" } })
      )
      expect(cycleMessage).toMatch(/cycle is immutable/)

      const billingTypeMessage = await captureErrorMessage(
        prisma.asaasAccountMigration.update({
          where: { id: row.id },
          data: { billingType: "CREDIT_CARD" },
        })
      )
      expect(billingTypeMessage).toMatch(/billing_type is immutable/)
    })

    it("UPDATE de status/attempt_count/last_error/primary_*/migrated_at/notifications_disabled/anomaly_notes passa livre (retry failed -> pending vivo)", async () => {
      const row = await createLedgerRow()
      createdIds.push(row.id)

      const updated = await prisma.asaasAccountMigration.update({
        where: { id: row.id },
        data: {
          status: "failed",
          attemptCount: { increment: 1 },
          lastError: "Asaas 500",
          primaryCustomerId: "cus_new_1",
          primarySubscriptionId: "sub_new_1",
          migratedAt: new Date(),
          notificationsDisabled: true,
          anomalyNotes: "nota operacional",
        },
      })

      expect(updated.status).toBe("failed")
      expect(updated.attemptCount).toBe(1)
      expect(updated.lastError).toBe("Asaas 500")
      expect(updated.notificationsDisabled).toBe(true)

      // Retry: failed -> pending também é uma escrita livre (coluna
      // operacional `status`) mesmo depois do UPDATE anterior.
      const retried = await prisma.asaasAccountMigration.update({
        where: { id: row.id },
        data: { status: "pending" },
      })
      expect(retried.status).toBe("pending")
    })

    it("UPDATE que reenvia o MESMO valor de uma coluna de snapshot já preenchida passa (IS DISTINCT FROM é false)", async () => {
      const row = await createLedgerRow()
      createdIds.push(row.id)

      const updated = await prisma.asaasAccountMigration.update({
        where: { id: row.id },
        data: { cycle: "MONTHLY" }, // mesmo valor gravado na criação
      })

      expect(updated.cycle).toBe("MONTHLY")
    })

    it("UPDATE que preenche pela primeira vez uma coluna de snapshot nula (legacy_subscription_id) passa", async () => {
      const row = await createLedgerRow()
      createdIds.push(row.id)
      expect(row.legacySubscriptionId).toBeNull()

      const updated = await prisma.asaasAccountMigration.update({
        where: { id: row.id },
        data: { legacySubscriptionId: "sub_legacy_first_fill" },
      })

      expect(updated.legacySubscriptionId).toBe("sub_legacy_first_fill")

      // Mas a segunda tentativa de mudar o mesmo campo já preenchido bloqueia.
      const message = await captureErrorMessage(
        prisma.asaasAccountMigration.update({
          where: { id: row.id },
          data: { legacySubscriptionId: "sub_legacy_second_fill" },
        })
      )
      expect(message).toMatch(/legacy_subscription_id is immutable/)
    })
  }
)
