import { beforeEach, describe, expect, it, mock } from "bun:test"

// T-20.18 e T-20.19 de [[20 — Assinaturas — Backend]] E6 (C23/DA5/DA2).
const getSubscriptionMock = mock(async () => ({ value: 79.9 }) as any)
const updateSubscriptionMock = mock(async () => ({}) as any)
mock.module("@/app/api/services/AsaasSubscription/AsaasSubscriptionService", () => ({
  AsaasSubscriptionService: {
    getSubscription: getSubscriptionMock,
    updateSubscription: updateSubscriptionMock,
  },
}))

mock.module("@/lib/services/EmailService", () => ({
  emailService: { sendOperatorAccessRemovedEmail: mock(async () => ({})) },
}))
mock.module("@/lib/supabase/server", () => ({
  createSupabaseAdmin: () => ({ auth: { admin: { deleteUser: mock(async () => ({ error: null })) } } }),
}))

const { ManagerUserUseCase } = await import("./ManagerUserUseCase")

function buildRepos(masterOverrides: Record<string, unknown> = {}) {
  const operator = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    fullName: "Operador Teste",
    email: "operador@example.test",
    managerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    supabaseId: "sb-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  }
  const master = {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    fullName: "Master Teste",
    email: "master@example.test",
    isMaster: true,
    asaasSubscriptionId: "sub_master_1",
    asaasSubscriptionAccount: "primary",
    ...masterOverrides,
  }

  const profileRepository = {
    findById: mock(async (id: string) => (id === "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" ? operator : master)),
  }
  const leadRepository = {
    reassignLeadsToMaster: mock(async () => 3),
  }
  const managerUserRepository = {
    deleteOperatorHard: mock(async () => {}),
  }

  return { profileRepository, leadRepository, managerUserRepository, operator, master }
}

describe("ManagerUserUseCase.deleteOperatorWithSubscriptionUpdate — sem falha silenciosa (T-20.18/T-20.19)", () => {
  beforeEach(() => {
    getSubscriptionMock.mockClear()
    updateSubscriptionMock.mockClear()
    getSubscriptionMock.mockImplementation(async () => ({ value: 79.9 }))
    updateSubscriptionMock.mockImplementation(async () => ({}))
  })

  it("PUT falha → operador removido MESMO ASSIM, mas subscriptionUpdateFailed=true no resultado (registro observável)", async () => {
    updateSubscriptionMock.mockImplementationOnce(async () => {
      throw new Error("timeout na Asaas")
    })
    const { profileRepository, leadRepository, managerUserRepository } = buildRepos()

    const useCase = new ManagerUserUseCase(managerUserRepository as any, leadRepository as any, profileRepository as any)
    const result = await useCase.deleteOperatorWithSubscriptionUpdate("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")

    expect(result.isValid).toBe(true)
    expect(managerUserRepository.deleteOperatorHard).toHaveBeenCalledWith("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
    expect((result.result as any).subscriptionUpdateFailed).toBe(true)
  })

  it("PUT funciona → subscriptionUpdateFailed=false", async () => {
    const { profileRepository, leadRepository, managerUserRepository } = buildRepos()

    const useCase = new ManagerUserUseCase(managerUserRepository as any, leadRepository as any, profileRepository as any)
    const result = await useCase.deleteOperatorWithSubscriptionUpdate("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")

    expect(result.isValid).toBe(true)
    expect((result.result as any).subscriptionUpdateFailed).toBe(false)
  })

  it("master com asaasSubscriptionAccount=legacy → GET e PUT roteados via createAsaasClient/AsaasSubscriptionService com conta legacy", async () => {
    const { profileRepository, leadRepository, managerUserRepository } = buildRepos({
      asaasSubscriptionAccount: "legacy",
    })

    const useCase = new ManagerUserUseCase(managerUserRepository as any, leadRepository as any, profileRepository as any)
    await useCase.deleteOperatorWithSubscriptionUpdate("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")

    expect(getSubscriptionMock).toHaveBeenCalledWith("sub_master_1", "legacy")
    expect(updateSubscriptionMock).toHaveBeenCalledWith("sub_master_1", { value: 60.00000000000001 }, "legacy")
  })

  it("master primary → roteado via conta primary", async () => {
    const { profileRepository, leadRepository, managerUserRepository } = buildRepos()

    const useCase = new ManagerUserUseCase(managerUserRepository as any, leadRepository as any, profileRepository as any)
    await useCase.deleteOperatorWithSubscriptionUpdate("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")

    expect(getSubscriptionMock).toHaveBeenCalledWith("sub_master_1", "primary")
    expect(updateSubscriptionMock).toHaveBeenCalledWith("sub_master_1", { value: 60.00000000000001 }, "primary")
  })
})
