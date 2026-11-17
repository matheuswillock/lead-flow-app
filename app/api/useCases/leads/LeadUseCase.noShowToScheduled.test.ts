import { describe, expect, mock, test } from "bun:test"
import { LeadStatus, TeamStatusRuleType } from "@prisma/client"

mock.module("server-only", () => ({}))
mock.module("@/app/api/useCases/radar/syncLeadToRadarInline", () => ({
  syncLeadToRadarInline: mock(async () => undefined),
}))
mock.module("@/app/api/infra/data/repositories/leadActivity/LeadActivityRepository", () => ({
  leadActivityRepository: { create: mock(async () => undefined) },
}))
mock.module("@/app/api/services/teamAutomation/TeamAutomationDispatcherService", () => ({
  teamAutomationDispatcherService: { dispatch: mock(async () => undefined) },
}))
mock.module("@/app/api/services/leadStatusTransitionFieldRequirement/LeadStatusTransitionFieldRequirementService", () => ({
  leadStatusTransitionFieldRequirementService: {
    getRequiredFieldsByTargetStatus: mock(async () => []),
  },
}))
mock.module("@/app/api/services/leadStatusTransitionGate/LeadStatusTransitionGateEvaluatorService", () => ({
  leadStatusTransitionGateEvaluatorService: {
    evaluate: mock(async () => ({ statusUpdatePatch: {} })),
  },
}))
mock.module("@/app/api/services/teamWebhook/OutboundEventPublisher", () => ({
  outboundEventPublisher: {
    publish: mock(async () => ({ matchedWebhooks: 0, enqueuedWebhooks: 0, failedWebhooks: 0 })),
  },
}))

// Time configurou uma regra combined_transition exigindo "Nova oportunidade" para
// entrar em "Agendado" — sem incluir "No Show" como requiredStatus válido.
const combinedTransitionRuleRequiringNewOpportunity = {
  id: "rule-1",
  type: TeamStatusRuleType.combined_transition,
  targetStatus: LeadStatus.scheduled,
  requiredStatus: LeadStatus.new_opportunity,
  requireConfirmation: false,
  confirmationMessage: null,
}

mock.module("@/app/api/services/teamStatusRule/TeamStatusRuleService", () => ({
  teamStatusRuleService: {
    findActiveByTargetStatus: mock(async () => [combinedTransitionRuleRequiringNewOpportunity]),
  },
}))

const { LeadUseCase } = await import("./LeadUseCase")

const noShowLead = {
  id: "lead-1",
  leadCode: "A1234A",
  managerId: "manager-1",
  teamId: "team-1",
  assignedTo: null,
  status: LeadStatus.no_show,
  name: "Ana Souza",
  email: "ana@example.com",
  phone: null,
  cnpj: null,
  razaoSocial: null,
  age: null,
  currentHealthPlan: null,
  currentValue: null,
  referenceHospital: null,
  currentTreatment: null,
  meetingDate: new Date("2026-01-01T12:00:00.000Z"),
  meetingTitle: null,
  meetingNotes: null,
  meetingLink: null,
  meetingHeald: "no",
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
  statusEnteredAt: new Date("2026-01-01T12:00:00.000Z"),
  closerId: "closer-1",
  notes: null,
  createdBy: "profile-1",
  updatedBy: "profile-1",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
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

function createUseCase(currentStatus: LeadStatus = LeadStatus.no_show) {
  const lead = { ...noShowLead, status: currentStatus }
  const updateStatus = mock(async (_id: string, status: LeadStatus) => ({
    ...lead,
    status,
  }))
  const useCase = new LeadUseCase(
    {
      findById: mock(async () => lead),
      updateStatus,
    } as never,
    {
      getProfileInfoBySupabaseId: mock(async () => ({ id: "profile-1", fullName: "Ana", email: "ana@example.com" })),
    } as never,
    { publish: mock(async () => ({ matchedWebhooks: 0, enqueuedWebhooks: 0, failedWebhooks: 0 })) } as never,
  )
  return { useCase, updateStatus }
}

describe("LeadUseCase.updateLeadStatus — No Show para Agendado", () => {
  test("permite mover de No Show para Agendado mesmo quando a regra combined_transition do time exige Nova oportunidade", async () => {
    const { useCase, updateStatus } = createUseCase(LeadStatus.no_show)

    const output = await useCase.updateLeadStatus("supabase-1", "lead-1", LeadStatus.scheduled)

    expect(output.isValid).toBe(true)
    expect(updateStatus).toHaveBeenCalled()
  })

  test("continua bloqueando outras origens que não satisfazem a regra combined_transition", async () => {
    const { useCase, updateStatus } = createUseCase(LeadStatus.disqualified)

    const output = await useCase.updateLeadStatus("supabase-1", "lead-1", LeadStatus.scheduled)

    expect(output.isValid).toBe(false)
    expect(updateStatus).not.toHaveBeenCalled()
  })
})
