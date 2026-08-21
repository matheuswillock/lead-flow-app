import { beforeEach, describe, expect, it, mock } from "bun:test"
import type {
  IRadarLeadGateUnitOfWork,
  RadarLeadGateProfile,
  RadarLeadGateTransaction,
} from "@/app/api/infra/data/repositories/radar/IRadarLeadGateUnitOfWork"
import { CreateCrmLeadFromRadarFormGateUseCase } from "./CreateCrmLeadFromRadarFormGateUseCase"
import { EvaluateRadarProfileLeadEligibilityUseCase } from "./EvaluateRadarProfileLeadEligibilityUseCase"

const profile: RadarLeadGateProfile = {
  id: "profile-1",
  teamId: "team-1",
  displayName: "Maria",
  normalizedName: "maria",
  displayPhone: "(11) 3897-1122",
  normalizedPhone: "551138971122",
  primaryEmail: null,
  normalizedPrimaryEmail: null,
  leadId: null,
}

const reloadProfile = mock(async () => profile as RadarLeadGateProfile | null)
const findIdentityMatches = mock(async () => ({
  leadIdMatch: null as string | null,
  phoneMatch: null as string | null,
  emailMatch: null as string | null,
}))
const createOrUpdateFromRadarProfile = mock(async () => ({ leadId: "lead-1", created: true }))
const linkLeadIdentity = mock(async () => {})
const appendGateEvent = mock(async () => {})
const attachLeadToPendingSubmissions = mock(async () => {})

const transaction: RadarLeadGateTransaction = {
  reloadProfile,
  findIdentityMatches,
  createOrUpdateFromRadarProfile,
  linkLeadIdentity,
  appendGateEvent,
  attachLeadToPendingSubmissions,
}
const unitOfWork: IRadarLeadGateUnitOfWork = {
  async execute<T>(
    _input: { teamId: string; radarProfileId: string },
    work: (unit: RadarLeadGateTransaction) => Promise<T>,
  ) {
    return work(transaction)
  },
}
const eligibility = new EvaluateRadarProfileLeadEligibilityUseCase(unitOfWork)
const useCase = new CreateCrmLeadFromRadarFormGateUseCase(unitOfWork, eligibility)

const input = {
  teamId: "team-1",
  formId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  visitorSessionId: "session-1",
  radarProfileId: "profile-1",
  eventId: "session-1:question_answered:phone",
}

describe("CreateCrmLeadFromRadarFormGateUseCase", () => {
  beforeEach(() => {
    reloadProfile.mockReset()
    findIdentityMatches.mockReset()
    createOrUpdateFromRadarProfile.mockReset()
    linkLeadIdentity.mockReset()
    appendGateEvent.mockReset()
    attachLeadToPendingSubmissions.mockReset()
    reloadProfile.mockImplementation(async () => profile)
    findIdentityMatches.mockImplementation(async () => ({
      leadIdMatch: null,
      phoneMatch: null,
      emailMatch: null,
    }))
    createOrUpdateFromRadarProfile.mockImplementation(async () => ({
      leadId: "lead-1",
      created: true,
    }))
    linkLeadIdentity.mockImplementation(async () => {})
    appendGateEvent.mockImplementation(async () => {})
    attachLeadToPendingSubmissions.mockImplementation(async () => {})
  })

  it("cria com nome de uma palavra e telefone brasileiro válido sem exigir e-mail", async () => {
    const output = await useCase.execute(input)

    expect(output.isValid).toBe(true)
    expect(output.result).toEqual({ leadId: "lead-1", created: true })
    expect(createOrUpdateFromRadarProfile).toHaveBeenCalledWith({
      teamId: "team-1",
      profile,
      existingLeadId: null,
    })
    expect(linkLeadIdentity).toHaveBeenCalledTimes(1)
    expect(attachLeadToPendingSubmissions).toHaveBeenCalledWith({
      formId: input.formId,
      visitorSessionId: "session-1",
      leadId: "lead-1",
    })
  })

  it("não cria quando o perfil materializado ainda não tem telefone válido", async () => {
    reloadProfile.mockImplementation(async () => ({ ...profile, normalizedPhone: "123" }))

    const output = await useCase.execute(input)

    expect(output.result).toEqual({ skipped: "not_eligible", reason: "invalid_phone" })
    expect(createOrUpdateFromRadarProfile).not.toHaveBeenCalled()
  })

  it("prioriza lead_id e atualiza o lead existente", async () => {
    findIdentityMatches.mockImplementation(async () => ({
      leadIdMatch: "lead-linked",
      phoneMatch: "lead-linked",
      emailMatch: null,
    }))
    createOrUpdateFromRadarProfile.mockImplementation(async () => ({
      leadId: "lead-linked",
      created: false,
    }))

    const output = await useCase.execute(input)

    expect(output.result).toEqual({ leadId: "lead-linked", created: false })
    expect(createOrUpdateFromRadarProfile).toHaveBeenCalledWith(
      expect.objectContaining({ existingLeadId: "lead-linked" }),
    )
  })

  it("registra conflito e não cria terceiro lead quando telefone e e-mail divergem", async () => {
    findIdentityMatches.mockImplementation(async () => ({
      leadIdMatch: null,
      phoneMatch: "lead-phone",
      emailMatch: "lead-email",
    }))

    const output = await useCase.execute(input)

    expect(output.result).toEqual({ skipped: "identity_conflict", eligible: true })
    expect(createOrUpdateFromRadarProfile).not.toHaveBeenCalled()
    expect(appendGateEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "radar.crm_identity_conflict" }),
    )
  })

  it("transforma falha técnica da transação em Output inválido", async () => {
    reloadProfile.mockImplementation(async () => {
      throw new Error("database unavailable")
    })

    const output = await useCase.execute(input)

    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toContain("database unavailable")
  })
})
