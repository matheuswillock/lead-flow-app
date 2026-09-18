import { beforeEach, describe, expect, it, mock } from "bun:test"

const upsertMock = mock(async (_args: Record<string, unknown>) => ({}) as Record<string, unknown>)
const findUniqueMock = mock(
  async (_args: Record<string, unknown>) => null as Record<string, unknown> | null
)
const updateMock = mock(async (_args: Record<string, unknown>) => ({}) as Record<string, unknown>)
const countMock = mock(async () => 0)
const findManyMock = mock(
  async (_args: Record<string, unknown>) => [] as Record<string, unknown>[]
)
const updateManyMock = mock(async (_args: Record<string, unknown>) => ({ count: 0 }))

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    asaasAccountMigration: {
      upsert: upsertMock,
      findUnique: findUniqueMock,
      update: updateMock,
      count: countMock,
      findMany: findManyMock,
      updateMany: updateManyMock,
    },
  },
}))

const { AsaasAccountMigrationRepository } = await import("./AsaasAccountMigrationRepository")
const { InvalidAsaasAccountMigrationTransitionError } = await import(
  "./asaasAccountMigrationStateMachine"
)

function baseSnapshot() {
  return {
    profileId: "profile-1",
    clientName: "Cliente Teste",
    clientEmail: "cliente@example.com",
    legacyCustomerId: "cus_legacy_1",
    legacySubscriptionId: "sub_legacy_1",
    billingType: "PIX",
    cycle: "MONTHLY",
    value: 100.5,
    nextDueDate: new Date("2026-10-01T00:00:00.000Z"),
  }
}

describe("AsaasAccountMigrationRepository", () => {
  beforeEach(() => {
    upsertMock.mockClear()
    findUniqueMock.mockClear()
    updateMock.mockClear()
    countMock.mockClear()
    findManyMock.mockClear()
    updateManyMock.mockClear()
    findUniqueMock.mockImplementation(async () => null)
    findManyMock.mockImplementation(async () => [])
    updateManyMock.mockImplementation(async () => ({ count: 0 }))
  })

  describe("upsertSnapshot (T-30.11)", () => {
    it("idempotente por legacyCustomerId: create no primeiro upsert, update vazio (no-op) no conflito", async () => {
      const repo = new AsaasAccountMigrationRepository()

      await repo.upsertSnapshot(baseSnapshot())

      expect(upsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { legacyCustomerId: "cus_legacy_1" },
          create: expect.objectContaining({
            legacyCustomerId: "cus_legacy_1",
            profileId: "profile-1",
          }),
          update: {},
        })
      )
    })

    it("rodar duas vezes delega duas vezes ao mesmo upsert idempotente (unicidade fica a cargo do @unique do schema)", async () => {
      const repo = new AsaasAccountMigrationRepository()

      await repo.upsertSnapshot(baseSnapshot())
      await repo.upsertSnapshot(baseSnapshot())

      expect(upsertMock).toHaveBeenCalledTimes(2)
      // As duas chamadas usam a MESMA chave de conflito e o MESMO update
      // vazio — nenhuma reescreve o snapshot já gravado.
      for (const call of upsertMock.mock.calls) {
        expect((call[0] as { update: unknown }).update).toEqual({})
      }
    })

    it("converte value numérico em Prisma.Decimal", async () => {
      const repo = new AsaasAccountMigrationRepository()

      await repo.upsertSnapshot(baseSnapshot())

      const call = upsertMock.mock.calls[0]?.[0] as { create: { value: { toString(): string } } }
      expect(call.create.value?.toString()).toBe("100.5")
    })
  })

  describe("transition (T-30.11) — máquina de estados §9.4", () => {
    it("pending -> customer_created é uma transição válida", async () => {
      findUniqueMock.mockImplementation(async () => ({
        legacyCustomerId: "cus_1",
        status: "pending",
        primaryCustomerId: null,
        primarySubscriptionId: null,
        anomalyNotes: null,
        migratedAt: null,
      }))

      const repo = new AsaasAccountMigrationRepository()
      await repo.transition({
        legacyCustomerId: "cus_1",
        toStatus: "customer_created",
        primaryCustomerId: "cus_new_1",
      })

      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { legacyCustomerId: "cus_1" },
          data: expect.objectContaining({
            status: "customer_created",
            attemptCount: { increment: 1 },
            primaryCustomerId: "cus_new_1",
          }),
        })
      )
    })

    it("transição inválida pending -> legacy_deactivated (pulando etapas) é recusada e NÃO escreve no banco", async () => {
      findUniqueMock.mockImplementation(async () => ({
        legacyCustomerId: "cus_2",
        status: "pending",
        primaryCustomerId: null,
        primarySubscriptionId: null,
        anomalyNotes: null,
        migratedAt: null,
      }))

      const repo = new AsaasAccountMigrationRepository()

      await expect(
        repo.transition({ legacyCustomerId: "cus_2", toStatus: "legacy_deactivated" })
      ).rejects.toThrow(InvalidAsaasAccountMigrationTransitionError)

      expect(updateMock).not.toHaveBeenCalled()
    })

    it("subscription_created -> legacy_deactivated só avança com o novo confirmado (invariante 1) — subscription_created -> done direto é recusado", async () => {
      findUniqueMock.mockImplementation(async () => ({
        legacyCustomerId: "cus_3",
        status: "subscription_created",
        primaryCustomerId: "cus_new_3",
        primarySubscriptionId: null,
        anomalyNotes: null,
        migratedAt: null,
      }))

      const repo = new AsaasAccountMigrationRepository()

      await expect(
        repo.transition({ legacyCustomerId: "cus_3", toStatus: "done" })
      ).rejects.toThrow(InvalidAsaasAccountMigrationTransitionError)
      expect(updateMock).not.toHaveBeenCalled()
    })

    it("failed -> pending é o único retry permitido a partir de failed", async () => {
      findUniqueMock.mockImplementation(async () => ({
        legacyCustomerId: "cus_4",
        status: "failed",
        primaryCustomerId: null,
        primarySubscriptionId: null,
        anomalyNotes: null,
        migratedAt: null,
      }))

      const repo = new AsaasAccountMigrationRepository()
      await repo.transition({ legacyCustomerId: "cus_4", toStatus: "pending" })

      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "pending", lastError: null }),
        })
      )
    })

    it("transição para failed grava lastError; transição de saída de failed limpa lastError", async () => {
      findUniqueMock.mockImplementation(async () => ({
        legacyCustomerId: "cus_5",
        status: "pending",
        primaryCustomerId: null,
        primarySubscriptionId: null,
        anomalyNotes: null,
        migratedAt: null,
      }))

      const repo = new AsaasAccountMigrationRepository()
      await repo.transition({
        legacyCustomerId: "cus_5",
        toStatus: "failed",
        lastError: "Asaas 500",
      })

      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "failed", lastError: "Asaas 500" }),
        })
      )
    })

    it("legacy_deactivated -> done grava migratedAt", async () => {
      findUniqueMock.mockImplementation(async () => ({
        legacyCustomerId: "cus_6",
        status: "legacy_deactivated",
        primaryCustomerId: "cus_new_6",
        primarySubscriptionId: "sub_new_6",
        anomalyNotes: null,
        migratedAt: null,
      }))

      const repo = new AsaasAccountMigrationRepository()
      await repo.transition({ legacyCustomerId: "cus_6", toStatus: "done" })

      const call = updateMock.mock.calls[0]?.[0] as { data: { migratedAt: Date } }
      expect(call.data.migratedAt).toBeInstanceOf(Date)
    })

    it("lança erro claro quando a linha não existe no ledger", async () => {
      findUniqueMock.mockImplementation(async () => null)

      const repo = new AsaasAccountMigrationRepository()

      await expect(
        repo.transition({ legacyCustomerId: "cus_inexistente", toStatus: "customer_created" })
      ).rejects.toThrow(/não encontrado/)
      expect(updateMock).not.toHaveBeenCalled()
    })
  })

  describe("countAll", () => {
    it("delega para prisma.count", async () => {
      countMock.mockImplementation(async () => 7)
      const repo = new AsaasAccountMigrationRepository()

      const total = await repo.countAll()

      expect(total).toBe(7)
      expect(countMock).toHaveBeenCalledTimes(1)
    })
  })

  describe("listNonTerminalStaleSince (T-30.25 — E7/X3)", () => {
    it("filtra status fora de done/failed/requires_card_reauth e updatedAt antes do corte", async () => {
      const cutoff = new Date("2026-09-17T00:00:00.000Z")
      const repo = new AsaasAccountMigrationRepository()

      await repo.listNonTerminalStaleSince(cutoff)

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: { notIn: ["done", "failed", "requires_card_reauth"] },
            updatedAt: { lt: cutoff },
          },
        })
      )
    })
  })

  describe("markNotificationsDisabled (E2/M0.3-M0.4)", () => {
    it("retorna true quando a linha existe e é atualizada", async () => {
      updateManyMock.mockImplementation(async () => ({ count: 1 }))
      const repo = new AsaasAccountMigrationRepository()

      const updated = await repo.markNotificationsDisabled("cus_1")

      expect(updated).toBe(true)
      expect(updateManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { legacyCustomerId: "cus_1" },
          data: { notificationsDisabled: true },
        })
      )
    })

    it("retorna false (no-op) quando a linha ainda não existe (silenciamento roda antes do populate de E4)", async () => {
      updateManyMock.mockImplementation(async () => ({ count: 0 }))
      const repo = new AsaasAccountMigrationRepository()

      const updated = await repo.markNotificationsDisabled("cus_sem_ledger")

      expect(updated).toBe(false)
    })
  })
})
