import { beforeEach, describe, expect, it, mock } from "bun:test"
import { UserRole, type RadarIdentityType } from "@prisma/client"
import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"

const getProfileForPromotionWithCtx = mock(async () => null as Awaited<
  ReturnType<
    typeof import("@/app/api/infra/data/repositories/radar/RadarRepository").radarRepository.getProfileForPromotionWithCtx
  >
>)
const claimProvisionalLeadIdentity = mock(
  async () => ({ identityId: "identity-1" }) as { identityId: string } | null
)
const finalizeLeadIdentityClaim = mock(async () => undefined)
const releaseLeadIdentityClaim = mock(async () => undefined)
const createLead = mock(async () => new Output(true, [], [], { id: "lead-new-1" }))
const syncLeadExecute = mock(async () => new Output(true, [], [], null))

mock.module("@/app/api/infra/data/repositories/radar/RadarRepository", () => ({
  radarRepository: {
    getProfileForPromotionWithCtx,
    claimProvisionalLeadIdentity,
    finalizeLeadIdentityClaim,
    releaseLeadIdentityClaim,
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
    claimProvisionalLeadIdentity.mockReset()
    finalizeLeadIdentityClaim.mockReset()
    releaseLeadIdentityClaim.mockReset()
    createLead.mockReset()
    syncLeadExecute.mockReset()

    getProfileForPromotionWithCtx.mockImplementation(async () => profileWithoutLead)
    claimProvisionalLeadIdentity.mockImplementation(async () => ({ identityId: "identity-1" }))
    finalizeLeadIdentityClaim.mockImplementation(async () => undefined)
    releaseLeadIdentityClaim.mockImplementation(async () => undefined)
    createLead.mockImplementation(async () => new Output(true, [], [], { id: "lead-new-1" }))
    syncLeadExecute.mockImplementation(async () => new Output(true, [], [], null))
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

  it("T-R5.2 — promoção concorrente: quem perde a corrida nem chega a criar Lead", async () => {
    claimProvisionalLeadIdentity
      .mockImplementationOnce(async () => ({ identityId: "identity-winner" }))
      .mockImplementationOnce(async () => null)
    createLead.mockImplementation(async () => new Output(true, [], [], { id: "lead-winner" }))

    const first = await promoteRadarProfileToLeadUseCase.execute(baseInput)
    const second = await promoteRadarProfileToLeadUseCase.execute(baseInput)

    expect(first.isValid).toBe(true)
    expect(second.isValid).toBe(false)

    // O ponto do estágio: a reserva vem ANTES do create, então o perdedor não
    // cria Lead nenhum — e portanto nada precisa ser deletado. Antes, o
    // perdedor criava o Lead e o rollback DELETAVA um Lead real (R5/H3).
    expect(createLead).toHaveBeenCalledTimes(1)
    expect(syncLeadExecute).toHaveBeenCalledTimes(1)
    expect(finalizeLeadIdentityClaim).toHaveBeenCalledTimes(1)
    expect(releaseLeadIdentityClaim).not.toHaveBeenCalled()
  })

  it("T-R5.2 — reserva é liberada quando a criação do Lead falha", async () => {
    createLead.mockImplementation(
      async () => new Output(false, [], ["Erro interno do servidor"], null)
    )

    const output = await promoteRadarProfileToLeadUseCase.execute(baseInput)

    expect(output.isValid).toBe(false)
    expect(releaseLeadIdentityClaim).toHaveBeenCalledWith("team-1", "identity-1")
    expect(finalizeLeadIdentityClaim).not.toHaveBeenCalled()
  })

  it("T-R5.2 — reserva é liberada quando o create lança", async () => {
    createLead.mockImplementation(async () => {
      throw new Error("connect ECONNREFUSED")
    })

    const output = await promoteRadarProfileToLeadUseCase.execute(baseInput)

    expect(output.isValid).toBe(false)
    expect(releaseLeadIdentityClaim).toHaveBeenCalledWith("team-1", "identity-1")
  })

  it("T-R5.2 — a identidade só recebe o id real depois do Lead existir", async () => {
    await promoteRadarProfileToLeadUseCase.execute(baseInput)

    expect(finalizeLeadIdentityClaim).toHaveBeenCalledWith("team-1", "identity-1", "lead-new-1")
  })
})

describe("T-R5.1 — duplicata é fluxo, não erro seco", () => {
  const duplicateOutput = () =>
    new Output(false, [], ["Possível lead duplicado neste time"], {
      requiresDuplicateConfirmation: true,
      duplicateCandidates: [
        { id: "lead-dup-1", name: "Empresa Alpha", createdAt: "2026-08-01T00:00:00.000Z" },
      ],
    })

  beforeEach(() => {
    getProfileForPromotionWithCtx.mockReset()
    claimProvisionalLeadIdentity.mockReset()
    finalizeLeadIdentityClaim.mockReset()
    releaseLeadIdentityClaim.mockReset()
    createLead.mockReset()
    syncLeadExecute.mockReset()

    getProfileForPromotionWithCtx.mockImplementation(async () => profileWithoutLead)
    claimProvisionalLeadIdentity.mockImplementation(async () => ({ identityId: "identity-1" }))
    finalizeLeadIdentityClaim.mockImplementation(async () => undefined)
    releaseLeadIdentityClaim.mockImplementation(async () => undefined)
    syncLeadExecute.mockImplementation(async () => new Output(true, [], [], null))
  })

  it("devolve os candidatos no result, não só a mensagem", async () => {
    createLead.mockImplementation(async () => duplicateOutput())

    const output = await promoteRadarProfileToLeadUseCase.execute(baseInput)
    const result = output.result as {
      requiresDuplicateConfirmation?: boolean
      duplicateCandidates?: Array<{ id: string }>
    } | null

    expect(output.isValid).toBe(false)
    // Sem isto a rota não tem como responder 409 nem o frontend como oferecer
    // "criar assim mesmo" — o usuário via só a mensagem e ficava sem saída.
    expect(result?.requiresDuplicateConfirmation).toBe(true)
    expect(result?.duplicateCandidates?.[0]?.id).toBe("lead-dup-1")
  })

  it("não pede confirmação ao LeadUseCase por conta própria", async () => {
    createLead.mockImplementation(async () => duplicateOutput())

    await promoteRadarProfileToLeadUseCase.execute(baseInput)

    const [, leadData] = createLead.mock.calls[0] as unknown as [
      string,
      { confirmDuplicate?: boolean },
    ]
    expect(leadData.confirmDuplicate).toBeUndefined()
  })

  it("confirmDuplicate:true cria o Lead e vincula o perfil", async () => {
    createLead.mockImplementation(async () => new Output(true, [], [], { id: "lead-confirmed" }))

    const output = await promoteRadarProfileToLeadUseCase.execute({
      ...baseInput,
      confirmDuplicate: true,
    })

    const [, leadData] = createLead.mock.calls[0] as unknown as [
      string,
      { confirmDuplicate?: boolean },
    ]
    expect(leadData.confirmDuplicate).toBe(true)
    expect(output.isValid).toBe(true)
    expect(finalizeLeadIdentityClaim).toHaveBeenCalledWith(
      "team-1",
      "identity-1",
      "lead-confirmed"
    )
  })

  it("libera a reserva no conflito — o perfil continua promovível depois", async () => {
    createLead.mockImplementation(async () => duplicateOutput())

    await promoteRadarProfileToLeadUseCase.execute(baseInput)

    // Sem liberar, a tentativa de confirmar logo em seguida bateria em
    // "já promovido" por causa da própria reserva.
    expect(releaseLeadIdentityClaim).toHaveBeenCalledWith("team-1", "identity-1")
  })

  it("G2 — perfil de outro time não é promovível", async () => {
    getProfileForPromotionWithCtx.mockImplementation(async () => null)

    const output = await promoteRadarProfileToLeadUseCase.execute(baseInput)

    expect(output.isValid).toBe(false)
    expect(output.errorMessages.join(" ")).toMatch(/não encontrado|perfil/i)
    expect(createLead).not.toHaveBeenCalled()
  })
})

describe("T-R5.2 — sync inline vencendo a corrida nao derruba a promocao", () => {
  beforeEach(() => {
    getProfileForPromotionWithCtx.mockReset()
    claimProvisionalLeadIdentity.mockReset()
    finalizeLeadIdentityClaim.mockReset()
    releaseLeadIdentityClaim.mockReset()
    createLead.mockReset()
    syncLeadExecute.mockReset()

    getProfileForPromotionWithCtx.mockImplementation(async () => profileWithoutLead)
    claimProvisionalLeadIdentity.mockImplementation(async () => ({ identityId: "identity-1" }))
    releaseLeadIdentityClaim.mockImplementation(async () => undefined)
    createLead.mockImplementation(async () => new Output(true, [], [], { id: "lead-new-1" }))
    syncLeadExecute.mockImplementation(async () => new Output(true, [], [], null))
  })

  // `createLead` dispara o sync inline, que grava lead_id com upsertIdentity,
  // fora do advisory lock. Se ele chegar primeiro, a reconciliacao acontece
  // dentro do repositorio; o use case nao pode transformar isso em erro.
  it("promocao continua valida quando a identidade real ja existia", async () => {
    finalizeLeadIdentityClaim.mockImplementation(async () => undefined)

    const output = await promoteRadarProfileToLeadUseCase.execute(baseInput)

    expect(output.isValid).toBe(true)
    expect((output.result as { leadId: string }).leadId).toBe("lead-new-1")
    expect(releaseLeadIdentityClaim).not.toHaveBeenCalled()
  })

  it("falha ao finalizar nao apaga o Lead ja criado", async () => {
    finalizeLeadIdentityClaim.mockImplementation(async () => {
      throw new Error("P2002")
    })

    const output = await promoteRadarProfileToLeadUseCase.execute(baseInput)

    // O Lead existe e NUNCA e deletado — a delecao que este estagio removeu nao
    // volta por aqui. Alem disso a reserva e liberada e o vinculo fica por conta
    // do sync, entao o perfil nao termina bloqueado.
    expect(createLead).toHaveBeenCalledTimes(1)
    expect(releaseLeadIdentityClaim).toHaveBeenCalledWith("team-1", "identity-1")
    expect(output.isValid).toBe(true)
  })
})

describe("reserva pending: nao bloqueia o perfil", () => {
  const profileWithPendingClaim = {
    ...profileWithoutLead,
    id: "profile-pending",
    identities: [
      { type: "email" as RadarIdentityType, value: "alpha@example.com", normalizedValue: "alpha@example.com" },
      { type: "lead_id" as RadarIdentityType, value: "pending:abc", normalizedValue: "pending:abc" },
    ],
  }

  beforeEach(() => {
    getProfileForPromotionWithCtx.mockReset()
    claimProvisionalLeadIdentity.mockReset()
    finalizeLeadIdentityClaim.mockReset()
    releaseLeadIdentityClaim.mockReset()
    createLead.mockReset()
    syncLeadExecute.mockReset()

    claimProvisionalLeadIdentity.mockImplementation(async () => ({ identityId: "identity-1" }))
    finalizeLeadIdentityClaim.mockImplementation(async () => undefined)
    releaseLeadIdentityClaim.mockImplementation(async () => undefined)
    createLead.mockImplementation(async () => new Output(true, [], [], { id: "lead-new-1" }))
    syncLeadExecute.mockImplementation(async () => new Output(true, [], [], null))
  })

  // O gate roda ANTES da claim. Tratar a reserva como vinculo real faria o
  // perfil responder "ja vinculado" para sempre quando a liberacao falhasse, e
  // a retomada de reserva orfa na claim viraria codigo morto.
  it("perfil com reserva orfa segue promovivel — o gate delega a claim", async () => {
    getProfileForPromotionWithCtx.mockImplementation(async () => profileWithPendingClaim)

    const output = await promoteRadarProfileToLeadUseCase.execute(baseInput)

    expect(output.isValid).toBe(true)
    expect(claimProvisionalLeadIdentity).toHaveBeenCalledTimes(1)
  })

  it("vinculo real continua bloqueando", async () => {
    getProfileForPromotionWithCtx.mockImplementation(async () => profileWithLead)

    const output = await promoteRadarProfileToLeadUseCase.execute(baseInput)

    expect(output.isValid).toBe(false)
    expect(claimProvisionalLeadIdentity).not.toHaveBeenCalled()
  })

  // O Lead ja existe quando o finalize falha: deixar a reserva para tras
  // bloquearia o perfil e o usuario ficaria com um Lead que nao consegue
  // revincular.
  it("falha no finalize libera a reserva e deixa o sync ligar o Lead", async () => {
    getProfileForPromotionWithCtx.mockImplementation(async () => profileWithoutLead)
    finalizeLeadIdentityClaim.mockImplementation(async () => {
      throw new Error("connection reset")
    })

    const output = await promoteRadarProfileToLeadUseCase.execute(baseInput)

    expect(releaseLeadIdentityClaim).toHaveBeenCalledWith("team-1", "identity-1")
    expect(syncLeadExecute).toHaveBeenCalledWith({ leadId: "lead-new-1", teamId: "team-1" })
    expect(output.isValid).toBe(true)
  })
})
