import { describe, expect, it, mock } from "bun:test"
import { registerPrismaModuleMock } from "@/test/support/prisma-module-mock"

/**
 * Requisitos 4/5/8 do bug `2026-08-28-liber-leads-duplicados-origem-campanha-
 * email.md` — branch `existingLeadId` do gate Radar (mesma regra do anexo do
 * `publicFormLeadSync`): resposta atribuída por campanha que anexa num lead
 * `public_form` já existente promove a origem para `email_campaign`, com
 * MERGE dos metadados anteriores. Lead que já é `email_campaign` não muda.
 *
 * Mock do módulo do prisma pela fábrica compartilhada e COMPLETA — fábrica
 * parcial aqui congela o namespace do módulo (primeiro registro vence sem
 * `--isolate`) e derruba o vizinho que importa `withPrismaRetry`.
 */

registerPrismaModuleMock()

const { RadarLeadGateUnitOfWork } = await import("./RadarLeadGateUnitOfWork")

const FORM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const PROFILE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const EXISTING_LEAD_ID = "lead-bruno"

const profile = {
  id: PROFILE_ID,
  teamId: "team-1",
  displayName: "Bruno Marcelino",
  normalizedName: "bruno marcelino",
  displayPhone: "(11) 93953-4668",
  normalizedPhone: "5511939534668",
  primaryEmail: "bruno@example.com",
  normalizedPrimaryEmail: "bruno@example.com",
  leadId: EXISTING_LEAD_ID,
}

function makeUnitOfWork(
  existingLead: { originChannel: string | null; originMetadata: unknown },
  options?: { emailLogExists?: boolean },
) {
  const leadUpdate = mock(async () => ({}))
  const leadFindUnique = mock(async () => existingLead)
  // Achado codex PR #1148 (P2): a promoção exige o EmailLog verificado no
  // time — `emailLogExists: false` simula o UUID forjado na URL.
  const emailLogFindFirst = mock(async () =>
    (options?.emailLogExists ?? true) ? { id: "emaillog-1", campaignId: "campaign-1" } : null,
  )
  const transaction = {
    $executeRaw: mock(async () => 1),
    publicForm: {
      findFirst: mock(async () => ({ assignedSdrId: null, name: "Form", publicId: "pub-1" })),
    },
    team: { findUnique: mock(async () => ({ masterId: "master-1" })) },
    lead: { create: mock(async () => ({ id: "lead-novo" })), update: leadUpdate, findUnique: leadFindUnique },
    emailLog: { findFirst: emailLogFindFirst },
  }
  const database = {
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => work(transaction),
  }
  return {
    unitOfWork: new RadarLeadGateUnitOfWork(database as never),
    leadUpdate,
    leadFindUnique,
    emailLogFindFirst,
  }
}

function updateData(leadUpdate: ReturnType<typeof makeUnitOfWork>["leadUpdate"]) {
  const [call] = leadUpdate.mock.calls as unknown as [[{ data: Record<string, unknown> }]]
  return call[0].data
}

describe("createOrUpdateFromRadarProfile — promoção de origem no anexo (existingLeadId)", () => {
  it("promove originChannel preservando metadados anteriores quando a resposta é de campanha", async () => {
    const { unitOfWork, leadUpdate } = makeUnitOfWork({
      originChannel: "public_form",
      originMetadata: { source: "Form X", formId: "form-antigo" },
    })

    await unitOfWork.execute({ teamId: "team-1", radarProfileId: PROFILE_ID }, (transaction) =>
      transaction.createOrUpdateFromRadarProfile({
        teamId: "team-1",
        formId: FORM_ID,
        profile,
        existingLeadId: EXISTING_LEAD_ID,
        origin: { emailLogId: "emaillog-1", campaignId: "campaign-1" },
      }),
    )

    const data = updateData(leadUpdate)
    expect(data.originChannel).toBe("email_campaign")
    expect(data.originMetadata).toMatchObject({
      source: "Form X",
      formId: "form-antigo",
      attribution: "email_campaign",
      emailLogId: "emaillog-1",
      campaignId: "campaign-1",
    })
  })

  it("idempotente: lead já email_campaign com os MESMOS ids não recebe update de origem", async () => {
    const { unitOfWork, leadUpdate } = makeUnitOfWork({
      originChannel: "email_campaign",
      originMetadata: { attribution: "email_campaign", emailLogId: "emaillog-1", campaignId: "campaign-1" },
    })

    await unitOfWork.execute({ teamId: "team-1", radarProfileId: PROFILE_ID }, (transaction) =>
      transaction.createOrUpdateFromRadarProfile({
        teamId: "team-1",
        formId: FORM_ID,
        profile,
        existingLeadId: EXISTING_LEAD_ID,
        origin: { emailLogId: "emaillog-1", campaignId: "campaign-1" },
      }),
    )

    const data = updateData(leadUpdate)
    expect(data.originChannel).toBeUndefined()
    expect(data.originMetadata).toBeUndefined()
  })

  it("controle: sem atribuição de campanha no origin, a origem não é tocada", async () => {
    const { unitOfWork, leadUpdate, leadFindUnique } = makeUnitOfWork({
      originChannel: "public_form",
      originMetadata: { source: "Form X" },
    })

    await unitOfWork.execute({ teamId: "team-1", radarProfileId: PROFILE_ID }, (transaction) =>
      transaction.createOrUpdateFromRadarProfile({
        teamId: "team-1",
        formId: FORM_ID,
        profile,
        existingLeadId: EXISTING_LEAD_ID,
        origin: {},
      }),
    )

    const data = updateData(leadUpdate)
    expect(data.originChannel).toBeUndefined()
    expect(data.originMetadata).toBeUndefined()
    expect(leadFindUnique).not.toHaveBeenCalled()
  })

  // Achado codex PR #1148 (P2): para `question_answered` o origin não passa
  // pelo resolver de atribuição — pode carregar um UUID forjado que o
  // sanitizador aceita pelo formato. Sem EmailLog do time, não promove.
  it("emailLogId forjado (EmailLog inexistente no time) → atualiza o lead sem promover a origem", async () => {
    const { unitOfWork, leadUpdate, emailLogFindFirst } = makeUnitOfWork(
      { originChannel: "public_form", originMetadata: { source: "Form X" } },
      { emailLogExists: false },
    )

    await unitOfWork.execute({ teamId: "team-1", radarProfileId: PROFILE_ID }, (transaction) =>
      transaction.createOrUpdateFromRadarProfile({
        teamId: "team-1",
        formId: FORM_ID,
        profile,
        existingLeadId: EXISTING_LEAD_ID,
        origin: { emailLogId: "ffffffff-ffff-4fff-8fff-ffffffffffff" },
      }),
    )

    expect(emailLogFindFirst).toHaveBeenCalledTimes(1)
    const data = updateData(leadUpdate)
    expect(data.originChannel).toBeUndefined()
    expect(data.originMetadata).toBeUndefined()
  })

  // Sem emailLogId (só campaignId no origin) não há o que verificar — a
  // promoção exige o rastro `cs_el`→EmailLog; origin só com campaignId não
  // promove nem consulta o log.
  it("origin só com campaignId (sem emailLogId) → não promove nem consulta o EmailLog", async () => {
    const { unitOfWork, leadUpdate, emailLogFindFirst } = makeUnitOfWork({
      originChannel: "public_form",
      originMetadata: { source: "Form X" },
    })

    await unitOfWork.execute({ teamId: "team-1", radarProfileId: PROFILE_ID }, (transaction) =>
      transaction.createOrUpdateFromRadarProfile({
        teamId: "team-1",
        formId: FORM_ID,
        profile,
        existingLeadId: EXISTING_LEAD_ID,
        origin: { campaignId: "campaign-1" },
      }),
    )

    expect(emailLogFindFirst).not.toHaveBeenCalled()
    const data = updateData(leadUpdate)
    expect(data.originChannel).toBeUndefined()
    expect(data.originMetadata).toBeUndefined()
  })
})
