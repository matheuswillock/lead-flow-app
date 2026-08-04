import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { IBackofficeUserRepository } from "@/app/api/infra/data/repositories/backoffice/UserRepository/IBackofficeUserRepository"

const findProfileBySupabaseIdMock = mock(
  async (): Promise<{ id: string; email: string | null } | null> => ({
    id: "profile-1",
    email: "user@test.com",
  })
)

const createOptionMock = mock(async () => ({
  created: true,
  duplicate: false,
  option: { id: "hp-1", name: "Plano A", iconUrl: null, isDefault: false },
}))

const listOptionsMock = mock(async () => [
  { id: "hp-1", name: "Plano A", normalizedName: "plano a", isActive: true, isDefault: true, iconUrl: null },
])

mock.module("@/app/api/services/healthPlans/HealthPlanService", () => ({
  healthPlanService: {
    findProfileBySupabaseId: findProfileBySupabaseIdMock,
    createOption: createOptionMock,
    listOptions: listOptionsMock,
  },
}))

const { HealthPlanUseCase, HEALTH_PLAN_ERROR_MESSAGES } = await import(
  "@/app/api/useCases/healthPlans/HealthPlanUseCase"
)

describe("HealthPlanUseCase.listHealthPlans", () => {
  beforeEach(() => {
    findProfileBySupabaseIdMock.mockReset()
    findProfileBySupabaseIdMock.mockResolvedValue({
      id: "profile-1",
      email: "user@test.com",
    })
    listOptionsMock.mockReset()
    listOptionsMock.mockResolvedValue([
      {
        id: "hp-1",
        name: "Plano A",
        normalizedName: "plano a",
        isActive: true,
        isDefault: true,
        iconUrl: null,
      },
    ])
  })

  it("retorna erro interno quando o serviço falha (ex.: pool)", async () => {
    findProfileBySupabaseIdMock.mockRejectedValueOnce(new Error("EMAXCONN"))
    const useCase = new HealthPlanUseCase()
    const output = await useCase.listHealthPlans("supabase-1")
    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toEqual([HEALTH_PLAN_ERROR_MESSAGES.INTERNAL_LIST_ERROR])
  })

  it("retorna perfil não encontrado", async () => {
    findProfileBySupabaseIdMock.mockResolvedValueOnce(null)
    const useCase = new HealthPlanUseCase()
    const output = await useCase.listHealthPlans("supabase-1")
    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toEqual([HEALTH_PLAN_ERROR_MESSAGES.PROFILE_NOT_FOUND])
  })
})

describe("HealthPlanUseCase.createHealthPlan", () => {
  it("retorna 403 para usuário sem fullAccess no backoffice", async () => {
    const repo = {
      findByProfileId: async () => ({
        id: "bo-1",
        profileId: "profile-1",
        email: "op@test.com",
        isActive: true,
        fullAccess: false,
        isSdr: false,
        isCloser: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    } as unknown as IBackofficeUserRepository

    const useCase = new HealthPlanUseCase(repo)
    const output = await useCase.createHealthPlan("supabase-1", "Plano Teste")
    expect(output.isValid).toBe(false)
    expect(output.errorMessages[0]).toContain("Acesso negado")
  })

  it("cria plano para backoffice master ativo", async () => {
    const repo = {
      findByProfileId: async () => ({
        id: "bo-1",
        profileId: "profile-1",
        email: "master@test.com",
        isActive: true,
        fullAccess: true,
        isSdr: false,
        isCloser: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    } as unknown as IBackofficeUserRepository

    const useCase = new HealthPlanUseCase(repo)
    const output = await useCase.createHealthPlan("supabase-1", "Plano Teste")
    expect(output.isValid).toBe(true)
    expect(createOptionMock).toHaveBeenCalled()
  })
})
