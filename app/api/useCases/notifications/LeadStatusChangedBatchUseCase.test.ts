import { beforeEach, describe, expect, it, mock } from "bun:test"

type StatusChangedLeadRow = {
  id: string
  leadCode: string | null
  name: string | null
  status: string | null
  teamId: string | null
  assignedTo: string | null
  closerId: string | null
  managerId: string | null
  statusEnteredAt: Date | null
}

type StatusChangedPageOptions = {
  take?: number
  cursor?: { id: string; statusEnteredAt: Date }
}

const findLeadsWithStatusChangedBetweenMock = mock(
  async (
    _batchStart: Date,
    _batchEnd: Date,
    _options?: StatusChangedPageOptions
  ): Promise<StatusChangedLeadRow[]> => []
)
const findTeamMemberProfileIdsMock = mock(async () => [] as string[])
const enqueueLeadStatusChangedMock = mock(async () => {})

mock.module(
  "@/app/api/infra/data/repositories/leadStatusChangedBatch/LeadStatusChangedBatchRepository",
  () => ({
    leadStatusChangedBatchRepository: {
      findLeadsWithStatusChangedBetween: findLeadsWithStatusChangedBetweenMock,
      findTeamMemberProfileIds: findTeamMemberProfileIdsMock,
    },
    LeadStatusChangedBatchRepository: class {},
  })
)

mock.module("@/app/api/services/backofficeBot/StudioBotOutboxService", () => ({
  studioBotOutboxService: {
    enqueueLeadStatusChanged: enqueueLeadStatusChangedMock,
  },
}))

const { LeadStatusChangedBatchUseCase } = await import(
  "@/app/api/useCases/notifications/LeadStatusChangedBatchUseCase"
)

describe("LeadStatusChangedBatchUseCase.processBatch", () => {
  beforeEach(() => {
    findLeadsWithStatusChangedBetweenMock.mockClear()
    findTeamMemberProfileIdsMock.mockClear()
    enqueueLeadStatusChangedMock.mockClear()
    findLeadsWithStatusChangedBetweenMock.mockImplementation(
      async (_batchStart: Date, _batchEnd: Date, _options?: StatusChangedPageOptions) => []
    )
    findTeamMemberProfileIdsMock.mockImplementation(async () => [])
  })

  it("pagina com cursor até esgotar a janela", async () => {
    const firstPageEnteredAt = new Date("2026-08-19T00:00:00.000Z")
    findLeadsWithStatusChangedBetweenMock.mockImplementation(
      async (_batchStart: Date, _batchEnd: Date, options?: StatusChangedPageOptions) => {
        if (!options?.cursor) {
          return Array.from({ length: 200 }, (_, index) => ({
            id: `lead-${index}`,
            leadCode: `L${index}`,
            name: "Ana",
            status: "new_opportunity",
            teamId: "team-1",
            assignedTo: "p1",
            closerId: null,
            managerId: null,
            statusEnteredAt: firstPageEnteredAt,
          }))
        }
        return []
      }
    )
    findTeamMemberProfileIdsMock.mockImplementation(async () => ["p1"])

    const output = await new LeadStatusChangedBatchUseCase().processBatch(
      new Date("2026-08-19T00:20:00.000Z")
    )

    expect(output.isValid).toBe(true)
    expect(findLeadsWithStatusChangedBetweenMock).toHaveBeenCalledTimes(2)
    const secondCall = findLeadsWithStatusChangedBetweenMock.mock.calls[1] as unknown as [
      Date,
      Date,
      { take: number; cursor?: { id: string } },
    ]
    expect(secondCall[2].cursor?.id).toBe("lead-199")
    expect((output.result as { leadsProcessed: number; truncated: boolean }).leadsProcessed).toBe(200)
    expect((output.result as { truncated: boolean }).truncated).toBe(false)
    expect(enqueueLeadStatusChangedMock).toHaveBeenCalledTimes(200)
  })
})
