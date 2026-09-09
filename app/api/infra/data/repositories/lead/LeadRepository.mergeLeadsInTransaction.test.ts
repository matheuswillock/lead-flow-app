import { beforeEach, describe, expect, it, mock } from "bun:test"

const TARGET_LEAD_ID = "target-lead-1"
const SOURCE_LEAD_ID = "source-lead-1"

function manyMock() {
  return mock(async () => ({ count: 0 }))
}

const tx = {
  leadActivity: { updateMany: manyMock(), create: mock(async () => ({})) },
  task: { updateMany: manyMock() },
  leadsSchedule: { updateMany: manyMock() },
  leadFinalized: { updateMany: manyMock() },
  leadTransfer: { updateMany: manyMock() },
  leadAttachment: { updateMany: manyMock() },
  leadRequiredDocument: { updateMany: manyMock() },
  whatsAppConversation: { updateMany: manyMock() },
  whatsAppMessage: { updateMany: manyMock() },
  publicFormSubmission: { updateMany: manyMock() },
  leadDocumentRequest: { updateMany: manyMock() },
  leadTagAssignment: {
    findMany: mock(async () => [] as Array<{ tagId: string }>),
    updateMany: manyMock(),
  },
  leadCustomFieldValue: {
    findMany: mock(async () => [] as Array<{ definitionId: string }>),
    updateMany: manyMock(),
  },
  teamAutomationRunLog: {
    findMany: mock(async () => [] as Array<{ id: string; ruleId: string; dedupeKey: string }>),
    updateMany: manyMock(),
    deleteMany: manyMock(),
  },
  leadPortfolio: { update: mock(async () => ({})) },
  leadProposalReview: { update: mock(async () => ({})) },
  lead: {
    updateMany: manyMock(),
    delete: mock(async () => ({})),
    update: mock(async () => ({})),
  },
}

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    $transaction: async (fn: (client: typeof tx) => Promise<void>) => fn(tx),
  },
}))

const { LeadRepository } = await import("./LeadRepository")

function resetAllMocks() {
  for (const model of Object.values(tx)) {
    for (const fn of Object.values(model)) {
      ;(fn as ReturnType<typeof mock>).mockClear()
    }
  }
  tx.leadTagAssignment.findMany.mockImplementation(async () => [])
  tx.leadCustomFieldValue.findMany.mockImplementation(async () => [])
  tx.teamAutomationRunLog.findMany.mockImplementation(async () => [])
}

const baseLead = {
  id: TARGET_LEAD_ID,
  leadCode: "LF-TARGET",
  teamId: "team-1",
  isTransfer: false,
  email: null,
  phone: null,
  cnpj: null,
  razaoSocial: null,
  age: null,
  currentHealthPlan: null,
  currentValue: null,
  referenceHospital: null,
  currentTreatment: null,
  notes: null,
  soldPlan: null,
  ticket: null,
  contractDueDate: null,
  referrerName: null,
  referrerPhone: null,
  meetingTitle: null,
  meetingNotes: null,
  meetingLink: null,
  meetingType: null,
}

function baseInput() {
  return {
    targetLead: { ...baseLead, id: TARGET_LEAD_ID },
    sourceLead: { ...baseLead, id: SOURCE_LEAD_ID, leadCode: "LF-SOURCE" },
    fillPatch: {},
    mergedByProfileId: "profile-1",
    migratePortfolio: false,
    migrateProposalReview: false,
  } as never
}

describe("LeadRepository.mergeLeadsInTransaction", () => {
  beforeEach(() => {
    resetAllMocks()
  })

  it("transfere a submissão de formulário público do lead de origem para o alvo (SetNull orfanava)", async () => {
    const repo = new LeadRepository()
    await repo.mergeLeadsInTransaction(baseInput())

    expect(tx.publicFormSubmission.updateMany).toHaveBeenCalledWith({
      where: { leadId: SOURCE_LEAD_ID },
      data: { leadId: TARGET_LEAD_ID },
    })
  })

  it("transfere a tag exclusiva do lead de origem e deduplica a tag repetida (alvo vence)", async () => {
    tx.leadTagAssignment.findMany.mockImplementationOnce(async () => [{ tagId: "tag-shared" }])

    const repo = new LeadRepository()
    await repo.mergeLeadsInTransaction(baseInput())

    expect(tx.leadTagAssignment.findMany).toHaveBeenCalledWith({
      where: { leadId: TARGET_LEAD_ID },
      select: { tagId: true },
    })
    expect(tx.leadTagAssignment.updateMany).toHaveBeenCalledWith({
      where: { leadId: SOURCE_LEAD_ID, tagId: { notIn: ["tag-shared"] } },
      data: { leadId: TARGET_LEAD_ID },
    })
  })

  it("transfere o custom field exclusivo e preserva o valor do alvo quando os dois preencheram a mesma definição", async () => {
    tx.leadCustomFieldValue.findMany.mockImplementationOnce(async () => [
      { definitionId: "def-shared" },
    ])

    const repo = new LeadRepository()
    await repo.mergeLeadsInTransaction(baseInput())

    expect(tx.leadCustomFieldValue.updateMany).toHaveBeenCalledWith({
      where: { leadId: SOURCE_LEAD_ID, definitionId: { notIn: ["def-shared"] } },
      data: { leadId: TARGET_LEAD_ID },
    })
  })

  it("transfere solicitação de documento do lead de origem (Cascade apagava em silêncio)", async () => {
    const repo = new LeadRepository()
    await repo.mergeLeadsInTransaction(baseInput())

    expect(tx.leadDocumentRequest.updateMany).toHaveBeenCalledWith({
      where: { leadId: SOURCE_LEAD_ID },
      data: { leadId: TARGET_LEAD_ID },
    })
  })

  it("teamAutomationRunLog: transfere log sem conflito e apaga o redundante (mesma regra+dedupeKey do alvo)", async () => {
    tx.teamAutomationRunLog.findMany.mockImplementationOnce(async () => [
      { ruleId: "rule-1", dedupeKey: "key-shared", id: "target-log" },
    ])
    tx.teamAutomationRunLog.findMany.mockImplementationOnce(async () => [
      { id: "log-transfer", ruleId: "rule-2", dedupeKey: "key-unique" },
      { id: "log-redundant", ruleId: "rule-1", dedupeKey: "key-shared" },
    ])

    const repo = new LeadRepository()
    await repo.mergeLeadsInTransaction(baseInput())

    expect(tx.teamAutomationRunLog.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["log-transfer"] } },
      data: { leadId: TARGET_LEAD_ID },
    })
    expect(tx.teamAutomationRunLog.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["log-redundant"] } },
    })
  })

  it("teamAutomationRunLog: não chama updateMany/deleteMany quando não há logs para transferir/remover", async () => {
    const repo = new LeadRepository()
    await repo.mergeLeadsInTransaction(baseInput())

    expect(tx.teamAutomationRunLog.updateMany).not.toHaveBeenCalled()
    expect(tx.teamAutomationRunLog.deleteMany).not.toHaveBeenCalled()
  })

  it("apaga o lead de origem só depois de transferir todas as relações novas", async () => {
    const callOrder: string[] = []
    tx.publicFormSubmission.updateMany.mockImplementationOnce(async () => {
      callOrder.push("publicFormSubmission")
      return { count: 0 }
    })
    tx.leadDocumentRequest.updateMany.mockImplementationOnce(async () => {
      callOrder.push("leadDocumentRequest")
      return { count: 0 }
    })
    tx.lead.delete.mockImplementationOnce(async () => {
      callOrder.push("lead.delete")
      return {}
    })

    const repo = new LeadRepository()
    await repo.mergeLeadsInTransaction(baseInput())

    expect(callOrder).toEqual(["publicFormSubmission", "leadDocumentRequest", "lead.delete"])
  })
})
