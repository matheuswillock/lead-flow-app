import { describe, expect, it, mock } from "bun:test"

/**
 * Review do PR #1107 (Cursor/Codex, P1). `Lead.leadCode` é `@unique` global e o
 * create derivava o código só do `radarProfile.id`. No caminho novo de
 * divergência o MESMO perfil do destinatário cria um segundo lead — o código
 * colidia (P2002) e a transação do gate abortava, deixando o prospect
 * divergente sem card: exatamente a regressão que o PR promete corrigir.
 */

mock.module("@/app/api/infra/data/prisma", () => ({ prisma: {} }))

const { RadarLeadGateUnitOfWork } = await import("./RadarLeadGateUnitOfWork")

const FORM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const PROFILE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const SUBMISSION_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"

const profile = {
  id: PROFILE_ID,
  teamId: "team-1",
  displayName: "Alexandre",
  normalizedName: "alexandre",
  displayPhone: "(13) 99788-9618",
  normalizedPhone: "5513997889618",
  primaryEmail: "alexandre@libercorretora.com.br",
  normalizedPrimaryEmail: "alexandre@libercorretora.com.br",
  leadId: "lead-vladicea",
}

const referral = {
  reason: "typed_identity_divergence" as const,
  referralOfLeadId: "lead-vladicea",
  referralOfRadarProfileId: PROFILE_ID,
  referralOfEmailLogId: "log-1",
  referralOfCampaignId: null,
}

function makeUnitOfWork() {
  const leadCreate = mock(async () => ({ id: "lead-alexandre" }))
  const submissionUpdateMany = mock(async () => ({ count: 1 }))
  const activityUpdateMany = mock(async () => ({ count: 1 }))
  const transaction = {
    $executeRaw: mock(async () => 1),
    publicForm: {
      findFirst: mock(async () => ({ assignedSdrId: null, name: "Form", publicId: "pub-1" })),
    },
    team: { findUnique: mock(async () => ({ masterId: "master-1" })) },
    lead: { create: leadCreate, update: mock(async () => ({})) },
    leadActivity: { updateMany: activityUpdateMany },
    publicFormSubmission: { updateMany: submissionUpdateMany },
    publicFormMetricEvent: { deleteMany: mock(async () => ({ count: 0 })) },
  }
  const database = {
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => work(transaction),
  }
  return {
    unitOfWork: new RadarLeadGateUnitOfWork(database as never),
    leadCreate,
    submissionUpdateMany,
    activityUpdateMany,
  }
}

function createdLeadCode(
  leadCreate: ReturnType<typeof makeUnitOfWork>["leadCreate"],
): string {
  const [call] = leadCreate.mock.calls as unknown as [[{ data: { leadCode: string } }]]
  return call[0].data.leadCode
}

function promote(leadCodeSeed: string | null) {
  const context = makeUnitOfWork()
  return context.unitOfWork
    .execute({ teamId: "team-1", radarProfileId: PROFILE_ID }, (transaction) =>
      transaction.createOrUpdateFromRadarProfile({
        teamId: "team-1",
        formId: FORM_ID,
        profile,
        existingLeadId: null,
        origin: {},
        referral: leadCodeSeed ? referral : null,
        leadCodeSeed,
      }),
    )
    .then(() => createdLeadCode(context.leadCreate))
}

describe("createOrUpdateFromRadarProfile — leadCode do lead de indicação", () => {
  it("não reutiliza o código derivado do perfil quando cria por divergência", async () => {
    const semSemente = await promote(null)
    const comSemente = await promote("sessao-alexandre")

    expect(semSemente).toBe(`R${PROFILE_ID.replaceAll("-", "").slice(0, 12).toUpperCase()}`)
    expect(comSemente).not.toBe(semSemente)
    expect(comSemente).toMatch(/^R[0-9A-F]{12}$/)
  })

  it("é determinístico por sessão — retry do mesmo gate gera o mesmo código", async () => {
    expect(await promote("sessao-alexandre")).toBe(await promote("sessao-alexandre"))
    expect(await promote("sessao-alexandre")).not.toBe(await promote("sessao-sarita"))
  })
})

describe("attachLeadToPendingSubmissions — reatribuição na divergência", () => {
  /**
   * Review #1107 (Codex P2). Uma sessão de visitante longeva pode ter conversões
   * antigas **já concluídas** no mesmo formulário — atribuições de campanha
   * diferentes são caso suportado. Um `updateMany` por sessão arrastaria esse
   * histórico para o card de indicação; a reatribuição vale só para a submissão
   * corrente.
   */
  it("reatribui apenas a submissão corrente, nunca o histórico da sessão", async () => {
    const { unitOfWork, submissionUpdateMany } = makeUnitOfWork()

    await unitOfWork.execute({ teamId: "team-1", radarProfileId: PROFILE_ID }, (transaction) =>
      transaction.attachLeadToPendingSubmissions({
        formId: FORM_ID,
        visitorSessionId: "sessao-alexandre",
        leadId: "lead-alexandre",
        replaceLeadId: "lead-vladicea",
        submissionId: SUBMISSION_ID,
      }),
    )

    expect(submissionUpdateMany).toHaveBeenCalledWith({
      where: {
        formId: FORM_ID,
        visitorSessionId: "sessao-alexandre",
        id: SUBMISSION_ID,
        OR: [{ leadId: null }, { leadId: "lead-vladicea" }],
      },
      data: { leadId: "lead-alexandre" },
    })
  })

  /**
   * Review #1107 (Codex P1, metade da corrida). Se o worker da submissão
   * concluiu antes do gate, a atividade rica já nasceu no card do destinatário.
   * A mesma transação que move a submissão move a atividade daquela submissão.
   */
  it("leva junto a atividade de conclusão daquela submissão", async () => {
    const { unitOfWork, activityUpdateMany } = makeUnitOfWork()

    await unitOfWork.execute({ teamId: "team-1", radarProfileId: PROFILE_ID }, (transaction) =>
      transaction.attachLeadToPendingSubmissions({
        formId: FORM_ID,
        visitorSessionId: "sessao-alexandre",
        leadId: "lead-alexandre",
        replaceLeadId: "lead-vladicea",
        submissionId: SUBMISSION_ID,
      }),
    )

    expect(activityUpdateMany).toHaveBeenCalledWith({
      where: {
        leadId: "lead-vladicea",
        payload: { path: ["submissionId"], equals: SUBMISSION_ID },
      },
      data: { leadId: "lead-alexandre" },
    })
  })

  it("sem submissão corrente não reatribui nada — só submissão sem lead", async () => {
    const { unitOfWork, submissionUpdateMany, activityUpdateMany } = makeUnitOfWork()

    await unitOfWork.execute({ teamId: "team-1", radarProfileId: PROFILE_ID }, (transaction) =>
      transaction.attachLeadToPendingSubmissions({
        formId: FORM_ID,
        visitorSessionId: "sessao-alexandre",
        leadId: "lead-alexandre",
        replaceLeadId: "lead-vladicea",
        submissionId: null,
      }),
    )

    expect(submissionUpdateMany).toHaveBeenCalledWith({
      where: { formId: FORM_ID, visitorSessionId: "sessao-alexandre", leadId: null },
      data: { leadId: "lead-alexandre" },
    })
    expect(activityUpdateMany).not.toHaveBeenCalled()
  })

  it("sem reatribuição pedida, continua tocando só submissão sem lead", async () => {
    const { unitOfWork, submissionUpdateMany, activityUpdateMany } = makeUnitOfWork()

    await unitOfWork.execute({ teamId: "team-1", radarProfileId: PROFILE_ID }, (transaction) =>
      transaction.attachLeadToPendingSubmissions({
        formId: FORM_ID,
        visitorSessionId: "sessao-alexandre",
        leadId: "lead-alexandre",
        replaceLeadId: null,
      }),
    )

    expect(submissionUpdateMany).toHaveBeenCalledWith({
      where: { formId: FORM_ID, visitorSessionId: "sessao-alexandre", leadId: null },
      data: { leadId: "lead-alexandre" },
    })
    expect(activityUpdateMany).not.toHaveBeenCalled()
  })
})
