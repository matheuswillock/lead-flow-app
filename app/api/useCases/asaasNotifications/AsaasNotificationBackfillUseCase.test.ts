import { describe, expect, it, mock } from "bun:test"
import type { AsaasNotificationBackfillStatus } from "@prisma/client"
import { AsaasNotificationBackfillUseCase } from "./AsaasNotificationBackfillUseCase"
import type { IAsaasNotificationBackfillRepository } from "@/app/api/infra/data/repositories/asaasNotificationBackfill/IAsaasNotificationBackfillRepository"
import type { IAsaasCustomerService } from "@/app/api/services/AsaasCustomer/IAsaasCustomerService"

// Testes cobrem T04/T06 do ticket Backend 03 via UseCase (camada canônica).

function createAsaasMock(
  overrides: Partial<IAsaasCustomerService> = {}
): IAsaasCustomerService {
  return {
    createCustomer: async () => ({
      success: true,
      customerId: "cus_1",
      data: { id: "cus_1" } as never,
    }),
    getCustomer: async () => ({ id: "cus_1" }) as never,
    getCustomerByCpfCnpj: async () => null,
    listCustomers: async () => ({ data: [], hasMore: false, totalCount: 0, limit: 10, offset: 0 }),
    updateCustomer: async () => ({ id: "cus_1" }) as never,
    deleteCustomer: async () => ({ deleted: true }),
    restoreCustomer: async () => ({ id: "cus_1" }) as never,
    listCustomerNotifications: async () => [],
    updateCustomerNotification: async () => ({ id: "not_1" }) as never,
    updateCustomerNotificationsBatch: async () => [],
    disableCustomerFacingNotifications: async () => ({ updatedCount: 2, notifications: [] }),
    ...overrides,
  }
}

class FakeStateRepo implements IAsaasNotificationBackfillRepository {
  statusByCustomer = new Map<string, AsaasNotificationBackfillStatus>()
  lastErrorByCustomer = new Map<string, string | null>()

  async markCompleted(asaasCustomerId: string) {
    this.statusByCustomer.set(asaasCustomerId, "completed")
    this.lastErrorByCustomer.set(asaasCustomerId, null)
  }

  async markFailed(asaasCustomerId: string, error: string) {
    this.statusByCustomer.set(asaasCustomerId, "failed")
    this.lastErrorByCustomer.set(asaasCustomerId, error)
  }

  async getStatus(asaasCustomerId: string) {
    return this.statusByCustomer.get(asaasCustomerId) ?? null
  }

  async listCompletedCustomerIds() {
    return [...this.statusByCustomer.entries()]
      .filter(([, status]) => status === "completed")
      .map(([id]) => id)
  }

  async listProfileAsaasCustomerIds() {
    return []
  }
}

describe("AsaasNotificationBackfillUseCase", () => {
  it("T04: sincroniza customer existente e marca backfill completed", async () => {
    const state = new FakeStateRepo()
    const disable = mock(async () => ({ updatedCount: 3, notifications: [] }))
    const useCase = new AsaasNotificationBackfillUseCase(
      createAsaasMock({ disableCustomerFacingNotifications: disable }),
      state
    )

    const output = await useCase.processCustomer("cus_1")

    expect(output.isValid).toBe(true)
    expect((output.result as { completed: boolean; updatedCount: number }).completed).toBe(true)
    expect((output.result as { updatedCount: number }).updatedCount).toBe(3)
    expect(await state.getStatus("cus_1")).toBe("completed")
    expect(disable).toHaveBeenCalledTimes(1)
  })

  it("T06: falha Asaas não marca backfill como completed", async () => {
    const state = new FakeStateRepo()
    const useCase = new AsaasNotificationBackfillUseCase(
      createAsaasMock({
        disableCustomerFacingNotifications: async () => {
          throw new Error("Asaas 500")
        },
      }),
      state
    )

    const output = await useCase.processCustomer("cus_fail")

    expect(output.isValid).toBe(false)
    expect(output.errorMessages.join(" ")).toContain("Asaas 500")
    expect(await state.getStatus("cus_fail")).toBe("failed")
    expect(state.lastErrorByCustomer.get("cus_fail")).toContain("Asaas 500")
  })
})
