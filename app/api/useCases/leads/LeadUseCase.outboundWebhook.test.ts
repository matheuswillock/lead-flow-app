import { describe, expect, mock, test } from "bun:test"

mock.module("server-only", () => ({}))
mock.module("@/app/api/infra/data/repositories/team/TeamRepository", () => ({
  teamRepository: { findMasterRef: mock(async () => ({ masterId: "manager-1" })) },
}))
mock.module("@/app/api/services/healthPlans/HealthPlanService", () => ({
  healthPlanService: {
    validateAndCanonicalizePlans: mock(async () => ({
      missing: [],
      canonicalByNormalized: new Map(),
    })),
  },
}))
mock.module("@/app/api/services/leadDuplicateCheck/LeadDuplicateCheckService", () => ({
  leadDuplicateCheckService: { findCandidates: mock(async () => []) },
}))
mock.module("@/app/api/services/teamAutomation/TeamAutomationDispatcherService", () => ({
  teamAutomationDispatcherService: { dispatch: mock(async () => undefined) },
}))
mock.module("@/app/api/useCases/radar/syncLeadToRadarInline", () => ({
  syncLeadToRadarInline: mock(async () => undefined),
}))
mock.module("@/app/api/services/leadCustomField/LeadCustomFieldService", () => ({
  leadCustomFieldService: { getLeadCustomFieldValues: mock(async () => []) },
}))

const fallbackPublish = mock(async () => ({
  matchedWebhooks: 0,
  enqueuedWebhooks: 0,
  failedWebhooks: 0,
}))
mock.module("@/app/api/services/teamWebhook/OutboundEventPublisher", () => ({
  outboundEventPublisher: { publish: fallbackPublish },
}))

const { LeadUseCase } = await import("./LeadUseCase")

const persistedLead = {
  id: "lead-1",
  leadCode: "A1234A",
  managerId: "manager-1",
  teamId: "team-1",
  assignedTo: null,
  status: "new_opportunity",
  name: "Ana Souza",
  email: null,
  phone: null,
  cnpj: null,
  razaoSocial: null,
  age: null,
  currentHealthPlan: null,
  currentValue: null,
  referenceHospital: null,
  currentTreatment: null,
  meetingDate: null,
  meetingTitle: null,
  meetingNotes: null,
  meetingLink: null,
  meetingHeald: null,
  meetingPresenceConfirmed: false,
  meetingPresenceConfirmedAt: null,
  isTransfer: false,
  originChannel: "manual",
  originMetadata: null,
  followUpAt: null,
  followUpNotes: null,
  followUpSourceStatus: null,
  lossReason: null,
  lossReasonDetails: null,
  statusEnteredAt: new Date("2026-09-24T22:00:00.000Z"),
  closerId: null,
  notes: null,
  createdBy: "profile-1",
  updatedBy: "profile-1",
  createdAt: new Date("2026-09-24T22:00:00.000Z"),
  updatedAt: new Date("2026-09-24T22:00:00.000Z"),
  ticket: null,
  contractDueDate: null,
  soldPlan: null,
  meetingType: null,
  isReferral: null,
  referrerLeadId: null,
  referrerName: null,
  referrerPhone: null,
  leadTimeDueAt: null,
  isLeadTimeBreached: false,
}

function createUseCase() {
  const order: string[] = []
  const create = mock(async () => {
    order.push("persisted")
    return persistedLead
  })
  const publish = mock(async () => {
    order.push("published")
    return { matchedWebhooks: 1, enqueuedWebhooks: 1, failedWebhooks: 0 }
  })
  const useCase = new LeadUseCase(
    { findByLeadCode: mock(async () => null), create } as never,
    {
      getProfileInfoBySupabaseId: mock(async () => ({ id: "profile-1", role: "manager" })),
    } as never,
    { publish } as never,
  )
  return { useCase, create, publish, order }
}

describe("LeadUseCase.createLead — webhook de saída", () => {
  test("publica lead_created somente depois de persistir o lead", async () => {
    const { useCase, publish, order } = createUseCase()

    const output = await useCase.createLead("supabase-1", { name: "Ana Souza" } as never, "team-1")

    expect(output.isValid).toBe(true)
    expect(order).toEqual(["persisted", "published"])
    expect(publish).toHaveBeenCalledWith({
      teamId: "team-1",
      eventKey: "lead_created",
      leadId: "lead-1",
      payload: {
        lead: {
          id: "lead-1",
          leadCode: "A1234A",
          name: "Ana Souza",
          status: "new_opportunity",
          email: null,
          phone: null,
        },
      },
    })
    expect(fallbackPublish).not.toHaveBeenCalled()
  })

  test("não publica quando a persistência falha", async () => {
    const { useCase, create, publish } = createUseCase()
    create.mockRejectedValueOnce(new Error("database unavailable"))

    const output = await useCase.createLead("supabase-1", { name: "Ana Souza" } as never, "team-1")

    expect(output.isValid).toBe(false)
    expect(publish).not.toHaveBeenCalled()
  })
})
