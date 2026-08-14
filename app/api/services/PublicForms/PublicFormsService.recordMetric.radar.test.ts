import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Output } from "@/lib/output"
import type { PublicFormMetricEventInput } from "@/lib/public-forms/types"

const FORM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const PUBLIC_ID = "11111111-1111-4111-8111-111111111111"
const PUBLICATION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const TEAM_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"

const findPublishedByPublicId = mock(async () => ({
  publicationId: PUBLICATION_ID,
  snapshot: {
    formId: FORM_ID,
    questions: [] as Array<{ id: string }>,
  },
}))
const findAvailabilityTeamContext = mock(async () => ({
  teamId: TEAM_ID,
  name: "Form",
  publicId: PUBLIC_ID,
  emailCampaignTrackingEnabled: false,
  team: { master: { timezone: "America/Sao_Paulo" } },
}))
const upsertMetricEvent = mock(async () => {})
const radarExecute = mock(async () => new Output(true, [], [], { created: true }))
const syncPublicFormMetricToRadarInline = mock(() => {})

mock.module("@/app/api/infra/data/repositories/publicForms/PublicFormsRepository", () => ({
  publicFormsRepository: {
    findPublishedByPublicId,
    findAvailabilityTeamContext,
    upsertMetricEvent,
  },
}))

mock.module("@/app/api/useCases/radar/SyncPublicFormMetricToRadarUseCase", () => ({
  syncPublicFormMetricToRadarUseCase: { execute: radarExecute },
}))

mock.module("@/app/api/useCases/radar/syncPublicFormMetricToRadarInline", () => ({
  syncPublicFormMetricToRadarInline,
}))

mock.module("@/app/api/useCases/publicForms/ResolveEmailCampaignFormAttributionUseCase", () => ({
  resolveEmailCampaignFormAttributionUseCase: {
    execute: mock(async () => new Output(true, [], [], null)),
  },
}))

const { PublicFormsService } = await import("./PublicFormsService")

const input: PublicFormMetricEventInput = {
  visitorSessionId: "session_abcdefghij",
  eventType: "form_started",
  eventKey: "session_abcdefghij:form_started:form",
  origin: {},
}

describe("PublicFormsService.recordMetric radarMode", () => {
  const service = new PublicFormsService()

  beforeEach(() => {
    findPublishedByPublicId.mockClear()
    findAvailabilityTeamContext.mockClear()
    upsertMetricEvent.mockClear()
    radarExecute.mockReset()
    radarExecute.mockResolvedValue(new Output(true, [], [], { created: true }))
    syncPublicFormMetricToRadarInline.mockClear()
  })

  it("radarMode inline aguarda execute e não chama after()", async () => {
    const accepted = await service.recordMetric(PUBLIC_ID, input, { radarMode: "inline" })
    expect(accepted).toBe(true)
    expect(upsertMetricEvent).toHaveBeenCalledTimes(1)
    expect(radarExecute).toHaveBeenCalledTimes(1)
    expect(syncPublicFormMetricToRadarInline).not.toHaveBeenCalled()
  })

  it("radarMode skip não chama Radar", async () => {
    await service.recordMetric(PUBLIC_ID, input, { radarMode: "skip" })
    expect(upsertMetricEvent).toHaveBeenCalledTimes(1)
    expect(radarExecute).not.toHaveBeenCalled()
    expect(syncPublicFormMetricToRadarInline).not.toHaveBeenCalled()
  })

  it("radarMode inline: Output inválido lança para retry", async () => {
    radarExecute.mockResolvedValueOnce(new Output(false, [], ["Perfil Radar não resolvido"], null))
    await expect(service.recordMetric(PUBLIC_ID, input, { radarMode: "inline" })).rejects.toThrow(
      "Perfil Radar não resolvido",
    )
    expect(upsertMetricEvent).toHaveBeenCalledTimes(1)
  })
})
