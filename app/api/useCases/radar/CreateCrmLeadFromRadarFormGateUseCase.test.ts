import { beforeEach, describe, expect, it, mock } from "bun:test"
import { LeadStatus } from "@prisma/client"
import type {
  IRadarLeadGateUnitOfWork,
  RadarCrmIdentityMatch,
  RadarLeadGateProfile,
  RadarLeadGateTransaction,
  RadarLeadIdentity,
  RadarSubmittedIdentity,
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
const findIdentityMatches = mock(
  async (): Promise<RadarCrmIdentityMatch> => ({
    leadIdMatch: null,
    phoneMatch: null,
    emailMatch: null,
  }),
)
const createOrUpdateFromRadarProfile = mock(async () => ({ leadId: "lead-1", created: true }))
const linkLeadIdentity = mock(async () => {})
const appendGateEvent = mock(async () => {})
const attachLeadToPendingSubmissions = mock(async () => {})
const findSubmittedIdentity = mock(async () => null as RadarSubmittedIdentity | null)
const findLeadIdentity = mock(
  async (_input: { teamId: string; leadId: string }) => null as RadarLeadIdentity | null,
)

const transaction: RadarLeadGateTransaction = {
  reloadProfile,
  findIdentityMatches,
  findLeadIdentity,
  createOrUpdateFromRadarProfile,
  linkLeadIdentity,
  appendGateEvent,
  attachLeadToPendingSubmissions,
  findSubmittedIdentity,
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
    findSubmittedIdentity.mockReset()
    findLeadIdentity.mockReset()
    findSubmittedIdentity.mockImplementation(async () => null)
    findLeadIdentity.mockImplementation(async () => null)
  })

  it("cria com nome de uma palavra e telefone brasileiro válido sem exigir e-mail", async () => {
    const output = await useCase.execute(input)

    expect(output.isValid).toBe(true)
    expect(output.result).toEqual({ leadId: "lead-1", created: true })
    expect(createOrUpdateFromRadarProfile).toHaveBeenCalledWith({
      teamId: "team-1",
      formId: input.formId,
      profile,
      existingLeadId: null,
      origin: {},
      referral: null,
      leadCodeSeed: null,
    })
    expect(linkLeadIdentity).toHaveBeenCalledTimes(1)
    expect(attachLeadToPendingSubmissions).toHaveBeenCalledWith({
      formId: input.formId,
      visitorSessionId: "session-1",
      leadId: "lead-1",
      replaceLeadId: null,
      submissionId: null,
    })
  })

  it("não cria quando o perfil materializado ainda não tem telefone válido", async () => {
    reloadProfile.mockImplementation(async () => ({ ...profile, normalizedPhone: "123" }))

    const output = await useCase.execute(input)

    expect(output.result).toEqual({ skipped: "not_eligible", reason: "invalid_phone" })
    expect(createOrUpdateFromRadarProfile).not.toHaveBeenCalled()
  })

  it("prioriza lead_id e atualiza o lead existente quando está em nova oportunidade", async () => {
    findIdentityMatches.mockImplementation(async () => ({
      leadIdMatch: { leadId: "lead-linked", status: LeadStatus.new_opportunity },
      phoneMatch: { leadId: "lead-linked", status: LeadStatus.new_opportunity },
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
      phoneMatch: { leadId: "lead-phone", status: LeadStatus.new_opportunity },
      emailMatch: { leadId: "lead-email", status: LeadStatus.new_opportunity },
    }))

    const output = await useCase.execute(input)

    expect(output.result).toEqual({ skipped: "identity_conflict", eligible: true })
    expect(createOrUpdateFromRadarProfile).not.toHaveBeenCalled()
    expect(appendGateEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "radar.crm_identity_conflict" }),
    )
  })

  /**
   * Caso real de produção (31/08, Liber): o perfil do `alexandre@` está
   * vinculado desde 11/08 ao lead "vladicea", em `new_opportunity`. Toda
   * resposta que entra pelo link dos e-mails dele caía naquele card, seja
   * qual for a identidade digitada.
   */
  const alexandreProfile: RadarLeadGateProfile = {
    ...profile,
    displayName: "Alexandre",
    normalizedName: "alexandre",
    displayPhone: "(13) 99788-9618",
    normalizedPhone: "5513997889618",
    primaryEmail: "alexandre@libercorretora.com.br",
    normalizedPrimaryEmail: "alexandre@libercorretora.com.br",
    leadId: "lead-vladicea",
  }
  const alexandreTyped: RadarSubmittedIdentity = {
    name: "Alexandre",
    phone: "(13) 99788-9618",
    email: "alexandre@libercorretora.com.br",
    submissionId: "sub-corrente",
    sessionLeadId: null,
  }
  const vladiceaLead: RadarLeadIdentity = {
    id: "lead-vladicea",
    name: "vladicea",
    phone: "(11) 94072-9650",
    email: "diretoria@libercorretora.com.br",
    referralOfRadarProfileId: null,
  }

  function arrangeDivergentSubmission() {
    reloadProfile.mockImplementation(async () => alexandreProfile)
    findIdentityMatches.mockImplementation(async () => ({
      leadIdMatch: { leadId: "lead-vladicea", status: LeadStatus.new_opportunity },
      phoneMatch: null,
      emailMatch: null,
    }))
    findSubmittedIdentity.mockImplementation(async () => alexandreTyped)
    findLeadIdentity.mockImplementation(async () => vladiceaLead)
    createOrUpdateFromRadarProfile.mockImplementation(async () => ({
      leadId: "lead-alexandre",
      created: true,
    }))
  }

  it("cria card novo quando a identidade digitada diverge do lead vinculado ao perfil", async () => {
    arrangeDivergentSubmission()

    const output = await useCase.execute({
      ...input,
      origin: { emailLogId: "log-1", campaignId: "campaign-1" },
    })

    expect(output.result).toEqual({ leadId: "lead-alexandre", created: true })
    expect(createOrUpdateFromRadarProfile).toHaveBeenCalledTimes(1)
    const [firstCall] = createOrUpdateFromRadarProfile.mock.calls as unknown as [
      [
        {
          existingLeadId: string | null
          profile: RadarLeadGateProfile
          referral: Record<string, unknown> | null
        },
      ],
    ]
    const call = firstCall[0]
    // Lead antigo intocado: nenhuma chamada carrega o id dele.
    expect(call.existingLeadId).toBeNull()
    expect(call.profile.displayPhone).toBe("(13) 99788-9618")
    expect(call.profile.primaryEmail).toBe("alexandre@libercorretora.com.br")
    expect(call.referral).toEqual({
      reason: "typed_identity_divergence",
      referralOfLeadId: "lead-vladicea",
      referralOfRadarProfileId: "profile-1",
      referralOfEmailLogId: "log-1",
      referralOfCampaignId: "campaign-1",
    })
    expect(appendGateEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "radar.crm_lead_created" }),
    )
    // O vínculo do perfil continua com o lead do destinatário original.
    expect(linkLeadIdentity).not.toHaveBeenCalled()
    expect(attachLeadToPendingSubmissions).toHaveBeenCalledWith({
      formId: input.formId,
      visitorSessionId: "session-1",
      leadId: "lead-alexandre",
      // Na divergência a submissão nunca pode ficar no card do destinatário,
      // mesmo que uma resposta anterior já a tenha anexado lá.
      replaceLeadId: "lead-vladicea",
      submissionId: "sub-corrente",
    })
  })

  it("reaproveita o lead já materializado pela sessão em vez de criar outro", async () => {
    arrangeDivergentSubmission()
    findSubmittedIdentity.mockImplementation(async () => ({
      ...alexandreTyped,
      sessionLeadId: "lead-alexandre",
    }))
    // O reaproveitamento exige que o lead da sessão seja indicação DESTE gate
    // para ESTE perfil — senão o gate estaria assumindo card de outro fluxo.
    findLeadIdentity.mockImplementation(async ({ leadId }) => {
      if (leadId === "lead-alexandre") {
        return {
          id: "lead-alexandre",
          name: "Alexandre",
          phone: "(13) 99788-9618",
          email: "alexandre@libercorretora.com.br",
          referralOfRadarProfileId: "profile-1",
        }
      }
      return vladiceaLead
    })
    createOrUpdateFromRadarProfile.mockImplementation(async () => ({
      leadId: "lead-alexandre",
      created: false,
    }))

    const output = await useCase.execute(input)

    expect(output.result).toEqual({ leadId: "lead-alexandre", created: false })
    expect(createOrUpdateFromRadarProfile).toHaveBeenCalledWith(
      expect.objectContaining({ existingLeadId: "lead-alexandre" }),
    )
    expect(linkLeadIdentity).not.toHaveBeenCalled()
  })

  /**
   * Review do PR #1107 (Codex P1). O gate roda a cada resposta de identidade:
   * quando o telefone chega antes do e-mail, a identidade ainda está incompleta
   * e a submissão é anexada ao lead do destinatário. Na resposta seguinte a
   * divergência aparece — mas `attachLeadToPendingSubmissions` só preenchia
   * `leadId` nulo, então a submissão continuava apontando para o card errado e
   * cada revisão seguinte criava mais um lead.
   */
  it("reatribui a submissão já anexada ao lead do destinatário quando a divergência aparece", async () => {
    arrangeDivergentSubmission()
    findSubmittedIdentity.mockImplementation(async () => ({
      ...alexandreTyped,
      sessionLeadId: "lead-vladicea",
    }))

    const output = await useCase.execute(input)

    expect(output.result).toEqual({ leadId: "lead-alexandre", created: true })
    expect(createOrUpdateFromRadarProfile).toHaveBeenCalledWith(
      expect.objectContaining({ existingLeadId: null }),
    )
    expect(attachLeadToPendingSubmissions).toHaveBeenCalledWith({
      formId: input.formId,
      visitorSessionId: "session-1",
      leadId: "lead-alexandre",
      replaceLeadId: "lead-vladicea",
      submissionId: "sub-corrente",
    })
  })

  /**
   * Review do PR #1107 (Cursor/Codex P1). `Lead.leadCode` é `@unique` global e
   * o create derivava o código só do perfil: no caminho de divergência o mesmo
   * perfil cria um segundo lead e o código colidia (P2002), abortando a
   * transação — o prospect divergente ficaria sem card nenhum.
   */
  it("semeia o leadCode com a submissão, não com a sessão", async () => {
    arrangeDivergentSubmission()

    await useCase.execute(input)

    // A sessão dura 30 dias e o mesmo formulário aceita uma segunda conversão
    // (outra campanha) dentro dela. Semeando pela sessão, duas indicações
    // divergentes derivariam o MESMO `leadCode` e a segunda morreria em P2002.
    expect(createOrUpdateFromRadarProfile).toHaveBeenCalledWith(
      expect.objectContaining({ leadCodeSeed: "sub-corrente" }),
    )
  })

  /**
   * Review #1107 (Codex P2). O respondente digita identidade divergente, ganha
   * card de indicação, e então CORRIGE o telefone/e-mail para o do destinatário.
   * A divergência some — e sem trazer a submissão de volta, a conclusão ficaria
   * gravada no card de indicação enquanto o CRM aponta para o candidato.
   */
  it("traz a sessão de volta quando a identidade corrigida passa a bater com o lead", async () => {
    arrangeDivergentSubmission()
    findSubmittedIdentity.mockImplementation(async () => ({
      ...alexandreTyped,
      phone: vladiceaLead.phone,
      submissionId: "sub-corrente",
      sessionLeadId: "lead-alexandre",
    }))
    findLeadIdentity.mockImplementation(async ({ leadId }) => {
      if (leadId === "lead-alexandre") {
        return {
          id: "lead-alexandre",
          name: "Alexandre",
          phone: "(13) 99788-9618",
          email: "alexandre@libercorretora.com.br",
          referralOfRadarProfileId: "profile-1",
        }
      }
      return vladiceaLead
    })
    createOrUpdateFromRadarProfile.mockImplementation(async () => ({
      leadId: "lead-vladicea",
      created: false,
    }))

    await useCase.execute(input)

    expect(createOrUpdateFromRadarProfile).toHaveBeenCalledWith(
      expect.objectContaining({ existingLeadId: "lead-vladicea" }),
    )
    expect(attachLeadToPendingSubmissions).toHaveBeenCalledWith({
      formId: input.formId,
      visitorSessionId: "session-1",
      leadId: "lead-vladicea",
      replaceLeadId: "lead-alexandre",
      submissionId: "sub-corrente",
    })
  })

  /**
   * Guarda do mesmo caminho: lead que a sessão ganhou por OUTRO fluxo (ex.:
   * atribuição de campanha) não é indicação nossa e não pode ser remanejado —
   * senão o gate passaria a mover submissão alheia entre cards.
   */
  it("não remaneja a sessão quando o lead dela não é indicação deste gate", async () => {
    arrangeDivergentSubmission()
    findSubmittedIdentity.mockImplementation(async () => ({
      ...alexandreTyped,
      phone: vladiceaLead.phone,
      submissionId: "sub-corrente",
      sessionLeadId: "lead-de-outro-fluxo",
    }))
    findLeadIdentity.mockImplementation(async ({ leadId }) => {
      if (leadId === "lead-de-outro-fluxo") {
        return {
          id: "lead-de-outro-fluxo",
          name: "Outro",
          phone: null,
          email: null,
          referralOfRadarProfileId: null,
        }
      }
      return vladiceaLead
    })
    createOrUpdateFromRadarProfile.mockImplementation(async () => ({
      leadId: "lead-vladicea",
      created: false,
    }))

    await useCase.execute(input)

    expect(attachLeadToPendingSubmissions).toHaveBeenCalledWith(
      expect.objectContaining({ replaceLeadId: null }),
    )
  })

  /**
   * Adenda do owner (31/08, pós-#1107) — regra 1, guarda do comportamento
   * atual: lead casado (por vínculo/telefone/e-mail) em `new_opportunity`
   * continua recebendo ANEXO. Caso real "vladicea" (nota do vault): o card
   * ainda não foi trabalhado, então a mesma identidade cai nele.
   */
  it("anexa quando o telefone digitado bate com o lead vinculado E o lead está em nova oportunidade", async () => {
    arrangeDivergentSubmission()
    findSubmittedIdentity.mockImplementation(async () => ({
      ...alexandreTyped,
      phone: vladiceaLead.phone,
    }))
    createOrUpdateFromRadarProfile.mockImplementation(async () => ({
      leadId: "lead-vladicea",
      created: false,
    }))

    const output = await useCase.execute(input)

    expect(output.result).toEqual({ leadId: "lead-vladicea", created: false })
    expect(createOrUpdateFromRadarProfile).toHaveBeenCalledWith(
      expect.objectContaining({ existingLeadId: "lead-vladicea" }),
    )
    expect(linkLeadIdentity).toHaveBeenCalledTimes(1)
  })

  it("anexa quando a submissão não trouxe identidade digitada completa", async () => {
    arrangeDivergentSubmission()
    findSubmittedIdentity.mockImplementation(async () => ({
      ...alexandreTyped,
      email: null,
    }))
    createOrUpdateFromRadarProfile.mockImplementation(async () => ({
      leadId: "lead-vladicea",
      created: false,
    }))

    const output = await useCase.execute(input)

    expect(createOrUpdateFromRadarProfile).toHaveBeenCalledWith(
      expect.objectContaining({ existingLeadId: "lead-vladicea" }),
    )
  })

  /**
   * Adenda do owner (31/08, pós-#1107) — regra 1, o caso vermelho central: o
   * lead casado (mesma identidade, sem divergência) está em QUALQUER status
   * diferente de `new_opportunity` — aqui, `opportunityLost`, o mesmo cenário
   * da nota do vault ("simule o mesmo perfil com lead em opportunityLost").
   * Dedupe por identidade não basta mais: o card antigo já foi trabalhado e
   * fechado, então a resposta materializa um card NOVO — e esse card novo é
   * vinculado ao perfil (regra 2 é o que torna isso possível: antes,
   * `linkLeadIdentity` recusaria o segundo vínculo).
   */
  it("cria card novo e vincula ao perfil quando o lead vinculado não está em nova oportunidade", async () => {
    reloadProfile.mockImplementation(async () => alexandreProfile)
    findIdentityMatches.mockImplementation(async () => ({
      leadIdMatch: { leadId: "lead-vladicea", status: LeadStatus.opportunityLost },
      phoneMatch: null,
      emailMatch: null,
    }))
    // Sem identidade digitada ainda — isola o efeito do status do divergente.
    findSubmittedIdentity.mockImplementation(async () => null)
    createOrUpdateFromRadarProfile.mockImplementation(async () => ({
      leadId: "lead-vladicea-reaberto",
      created: true,
    }))

    const output = await useCase.execute(input)

    expect(output.result).toEqual({ leadId: "lead-vladicea-reaberto", created: true })
    expect(createOrUpdateFromRadarProfile).toHaveBeenCalledWith(
      expect.objectContaining({ existingLeadId: null, referral: null }),
    )
    expect(linkLeadIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ leadId: "lead-vladicea-reaberto" }),
    )
    expect(appendGateEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "radar.crm_lead_created",
        metadata: expect.objectContaining({
          statusReopened: true,
          previousLeadId: "lead-vladicea",
        }),
      }),
    )
  })

  /**
   * Mesma regra 1, via telefone/e-mail casado (sem vínculo `lead_id` ainda no
   * perfil) — a checagem de status vale para qualquer um dos três matches, não
   * só para `leadIdMatch`.
   */
  it("cria card novo quando o lead casado por telefone não está em nova oportunidade", async () => {
    findIdentityMatches.mockImplementation(async () => ({
      leadIdMatch: null,
      phoneMatch: { leadId: "lead-fechado", status: LeadStatus.contract_finalized },
      emailMatch: null,
    }))
    createOrUpdateFromRadarProfile.mockImplementation(async () => ({
      leadId: "lead-fechado-novo",
      created: true,
    }))

    const output = await useCase.execute(input)

    expect(output.result).toEqual({ leadId: "lead-fechado-novo", created: true })
    expect(createOrUpdateFromRadarProfile).toHaveBeenCalledWith(
      expect.objectContaining({ existingLeadId: null }),
    )
    expect(linkLeadIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ leadId: "lead-fechado-novo" }),
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
