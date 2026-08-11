import { beforeEach, describe, expect, it, mock } from "bun:test"
import { UserRole, type RadarIdentityType } from "@prisma/client"
import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"

const getProfileForPromotionWithCtx = mock(async () => null as Awaited<
  ReturnType<
    typeof import("@/app/api/infra/data/repositories/radar/RadarRepository").radarRepository.getProfileForPromotionWithCtx
  >
>)
const tryInsertLeadIdentityIfAbsent = mock(async () => true)
const createLead = mock(async () => new Output(true, [], [], { id: "lead-new-1" }))
const syncLeadExecute = mock(async () => new Output(true, [], [], null))
const deleteLead = mock(async () => undefined)

mock.module("@/app/api/infra/data/repositories/radar/RadarRepository", () => ({
  radarRepository: {
    getProfileForPromotionWithCtx,
    tryInsertLeadIdentityIfAbsent,
  },
}))

mock.module("@/app/api/useCases/leads/leadUseCaseFactory", () => ({
  leadUseCase: {
    createLead,
  },
}))

mock.module("@/app/api/useCases/radar/SyncLeadToRadarUseCase", () => ({
  syncLeadToRadarUseCase: {
    execute: syncLeadExecute,
  },
}))

mock.module("@/app/api/infra/data/repositories/lead/LeadRepository", () => ({
  LeadRepository: class {
    delete = deleteLead
  },
}))

const { promoteRadarProfileToLeadUseCase } = await import("./PromoteRadarProfileToLeadUseCase")

const profileWithoutLead = {
  id: "profile-1",
  displayName: "Empresa Alpha",
  displayPhone: "(11) 98765-4321",
  normalizedPhone: "5511987654321",
  primaryEmail: "alpha@example.com",
  normalizedPrimaryEmail: "alpha@example.com",
  identities: [{ type: "email" as RadarIdentityType, value: "alpha@example.com", normalizedValue: "alpha@example.com" }],
}

const profileWithoutPhone = {
  ...profileWithoutLead,
  id: "profile-2",
  displayPhone: null,
  normalizedPhone: null,
}

const profileWithLead = {
  ...profileWithoutLead,
  id: "profile-3",
  identities: [
    { type: "email" as RadarIdentityType, value: "alpha@example.com", normalizedValue: "alpha@example.com" },
    { type: "lead_id" as RadarIdentityType, value: "lead-existing", normalizedValue: "lead-existing" },
  ],
}

function makeAccess(teamId = "team-1"): TeamAccess {
  return {
    supabaseId: "supabase-1",
    teamId,
    profileId: "operator-1",
    profileEmail: "op@test.com",
    profileName: "Operator",
    isMaster: true,
    managerId: "manager-1",
    canCreateAccountUsers: false,
    canManageAccountTeams: false,
    canTransferAccountLeads: false,
    canViewAllTeams: false,
    userTimezone: "America/Sao_Paulo",
    teamMember: { role: UserRole.manager, functions: [] },
  }
}

const baseInput = {
  profileId: "profile-1",
  access: makeAccess(),
  ctx: {
    profileId: "operator-1",
    teamMember: { role: UserRole.manager, functions: [] },
  },
}

describe("PromoteRadarProfileToLeadUseCase", () => {
  beforeEach(() => {
    getProfileForPromotionWithCtx.mockReset()
    tryInsertLeadIdentityIfAbsent.mockReset()
    createLead.mockReset()
    syncLeadExecute.mockReset()
    deleteLead.mockReset()

    getProfileForPromotionWithCtx.mockImplementation(async () => profileWithoutLead)
    tryInsertLeadIdentityIfAbsent.mockImplementation(async () => true)
    createLead.mockImplementation(async () => new Output(true, [], [], { id: "lead-new-1" }))
    syncLeadExecute.mockImplementation(async () => new Output(true, [], [], null))
    deleteLead.mockImplementation(async () => undefined)
  })

  it("G2 — perfil sem leadId e com telefone cria Lead manual e sincroniza com Radar", async () => {
    const output = await promoteRadarProfileToLeadUseCase.execute(baseInput)

    expect(output.isValid).toBe(true)
    expect(createLead).toHaveBeenCalledTimes(1)
    const [, leadData] = createLead.mock.calls[0] as unknown as [
      string,
      { name: string; email?: string; phone?: string; originChannel: string; notes?: string },
    ]
    expect(leadData.name).toBe("Empresa Alpha")
    expect(leadData.email).toBe("alpha@example.com")
    expect(leadData.phone).toBe("5511987654321")
    expect(leadData.originChannel).toBe("manual")
    expect(syncLeadExecute).toHaveBeenCalledTimes(1)
    expect(syncLeadExecute).toHaveBeenCalledWith({ leadId: "lead-new-1", teamId: "team-1" })
  })

  it("G2 — perfil sem telefone cria Lead com nota automática", async () => {
    getProfileForPromotionWithCtx.mockImplementation(async () => profileWithoutPhone)

    const output = await promoteRadarProfileToLeadUseCase.execute({
      ...baseInput,
      profileId: "profile-2",
    })

    expect(output.isValid).toBe(true)
    const [, leadData] = createLead.mock.calls[0] as unknown as [
      string,
      { phone?: string; notes?: string },
    ]
    expect(leadData.phone).toBeUndefined()
    expect(leadData.notes).toContain("sem telefone")
  })

  it("G2 — perfil que já tem leadId retorna erro e não cria Lead duplicado", async () => {
    getProfileForPromotionWithCtx.mockImplementation(async () => profileWithLead)

    const output = await promoteRadarProfileToLeadUseCase.execute({
      ...baseInput,
      profileId: "profile-3",
    })

    expect(output.isValid).toBe(false)
    expect(output.errorMessages.join(" ")).toMatch(/lead/i)
    expect(createLead).not.toHaveBeenCalled()
    expect(syncLeadExecute).not.toHaveBeenCalled()
  })

  it("G2 — promoção concorrente: apenas uma vincula Lead ao perfil", async () => {
    tryInsertLeadIdentityIfAbsent
      .mockImplementationOnce(async () => true)
      .mockImplementationOnce(async () => false)
    createLead
      .mockImplementationOnce(async () => new Output(true, [], [], { id: "lead-winner" }))
      .mockImplementationOnce(async () => new Output(true, [], [], { id: "lead-loser" }))

    const first = await promoteRadarProfileToLeadUseCase.execute(baseInput)
    const second = await promoteRadarProfileToLeadUseCase.execute(baseInput)

    expect(first.isValid).toBe(true)
    expect(second.isValid).toBe(false)
    expect(createLead).toHaveBeenCalledTimes(2)
    expect(syncLeadExecute).toHaveBeenCalledTimes(1)
    expect(deleteLead).toHaveBeenCalledWith("lead-loser")
  })

  it("G2 — perfil de outro time não é promovível", async () => {
    getProfileForPromotionWithCtx.mockImplementation(async () => null)

    const output = await promoteRadarProfileToLeadUseCase.execute(baseInput)

    expect(output.isValid).toBe(false)
    expect(output.errorMessages.join(" ")).toMatch(/não encontrado|perfil/i)
    expect(createLead).not.toHaveBeenCalled()
  })
})
