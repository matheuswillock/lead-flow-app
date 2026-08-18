import { beforeEach, describe, expect, it, mock } from "bun:test"
import { CAMPAIGN_CANCELED_ALL_SUPPRESSED_MESSAGE } from "@/lib/email/campaign-audience-pruning-constants"
import { EmailCampaignAudiencePruningService } from "./EmailCampaignAudiencePruningService"

const findSuppressedContactsMock = mock(async () => [] as Array<{
  id: string
  email: string
  listId: string
  isSystemDefaultList: boolean
}>)
const findPrunableCampaignsMock = mock(async () => [] as Array<Record<string, unknown>>)
const findLeafCampaignIdsMock = mock(async () => [] as Array<{ id: string }>)
const findCampaignByIdMock = mock(async () => ({} as Record<string, unknown>))
const findSuppressedIdsInSnapshotMock = mock(async () => [] as string[])
const updateCampaignMock = mock(async () => {})
const findChildTotalsMock = mock(
  async () => [] as Array<{ totalRecipients: number; status: string }>
)

mock.module(
  "@/app/api/infra/data/repositories/emailCampaignAudience/EmailCampaignAudienceRepository",
  () => ({
    emailCampaignAudienceRepository: {
      findSuppressedContacts: findSuppressedContactsMock,
      findPrunableCampaigns: findPrunableCampaignsMock,
      findLeafCampaignIds: findLeafCampaignIdsMock,
      findCampaignById: findCampaignByIdMock,
      countSuppressedInSnapshot: mock(async () => 0),
      findSuppressedIdsInSnapshot: findSuppressedIdsInSnapshotMock,
      updateCampaign: updateCampaignMock,
      findChildTotals: findChildTotalsMock,
    },
  })
)

mock.module("@/lib/radar/list-segment-recipients", () => ({
  listRadarSegmentEmailRecipients: mock(async () => []),
  listRadarSegmentProfileEmails: mock(async () => []),
}))

const countActiveRecipientsForListMock = mock(async () => 0)
const findActiveRecipientsByIdsMock = mock(async (ids: string[]) =>
  ids.map((contactId) => ({ contactId, email: `${contactId}@test.com`, name: null, customFields: null }))
)
mock.module(
  "@/app/api/infra/data/repositories/emailCampaignRecipient/EmailCampaignRecipientRepository",
  () => ({
    emailCampaignRecipientRepository: {
      countActiveRecipientsForList: countActiveRecipientsForListMock,
      findActiveRecipientsByIds: findActiveRecipientsByIdsMock,
    },
  })
)

describe("EmailCampaignAudiencePruningService", () => {
  beforeEach(() => {
    findSuppressedContactsMock.mockClear()
    findPrunableCampaignsMock.mockClear()
    findLeafCampaignIdsMock.mockClear()
    findCampaignByIdMock.mockClear()
    findSuppressedIdsInSnapshotMock.mockClear()
    updateCampaignMock.mockClear()
    findChildTotalsMock.mockClear()
    countActiveRecipientsForListMock.mockClear()
    findActiveRecipientsByIdsMock.mockClear()

    findSuppressedContactsMock.mockImplementation(async () => [])
    findPrunableCampaignsMock.mockImplementation(async () => [])
    findLeafCampaignIdsMock.mockImplementation(async () => [])
    findSuppressedIdsInSnapshotMock.mockImplementation(async () => [])
    findChildTotalsMock.mockImplementation(async () => [])
    countActiveRecipientsForListMock.mockImplementation(async () => 0)
    findActiveRecipientsByIdsMock.mockImplementation(async (ids: string[]) =>
      ids.map((contactId) => ({
        contactId,
        email: `${contactId}@test.com`,
        name: null,
        customFields: null,
      }))
    )
  })

  it("remove IDs suprimidos de campanhas com snapshot", async () => {
    findSuppressedContactsMock.mockImplementation(async () => [
      { id: "c1", email: "a@test.com", listId: "l1", isSystemDefaultList: false },
    ])
    findPrunableCampaignsMock.mockImplementation(async () => [
      {
        id: "camp-1",
        teamId: "team-1",
        parentCampaignId: null,
        totalRecipients: 2,
        audienceContactIds: ["c1", "c2"],
        contactListId: null,
        sourceContactListIds: [],
        radarSegmentSlug: null,
      },
    ])

    const service = new EmailCampaignAudiencePruningService()
    const result = await service.pruneSuppressedContacts({
      teamId: "team-1",
      contactIds: ["c1"],
    })

    expect(result.prunedCampaignIds).toEqual(["camp-1"])
    expect(updateCampaignMock).toHaveBeenCalledWith("camp-1", {
      totalRecipients: 1,
      errorMessage: null,
      audienceContactIds: ["c2"],
    })
  })

  it("cancela campanha quando audiência zera após poda", async () => {
    findSuppressedContactsMock.mockImplementation(async () => [
      { id: "c1", email: "a@test.com", listId: "l1", isSystemDefaultList: false },
    ])
    findPrunableCampaignsMock.mockImplementation(async () => [
      {
        id: "camp-2",
        teamId: "team-1",
        parentCampaignId: null,
        totalRecipients: 1,
        audienceContactIds: ["c1"],
        contactListId: null,
        sourceContactListIds: [],
        radarSegmentSlug: null,
      },
    ])

    const service = new EmailCampaignAudiencePruningService()
    const result = await service.pruneSuppressedContacts({
      teamId: "team-1",
      emails: ["a@test.com"],
    })

    expect(result.canceledCampaignIds).toEqual(["camp-2"])
    expect(updateCampaignMock).toHaveBeenCalledWith("camp-2", {
      status: "canceled",
      errorMessage: CAMPAIGN_CANCELED_ALL_SUPPRESSED_MESSAGE,
      totalRecipients: 0,
      audienceContactIds: [],
    })
  })

  it("recount dinâmico quando snapshot está vazio", async () => {
    findSuppressedContactsMock.mockImplementation(async () => [
      { id: "c1", email: "a@test.com", listId: "l1", isSystemDefaultList: false },
    ])
    findPrunableCampaignsMock.mockImplementation(async () => [
      {
        id: "camp-3",
        teamId: "team-1",
        parentCampaignId: null,
        totalRecipients: 5,
        audienceContactIds: [],
        contactListId: "l1",
        sourceContactListIds: [],
        radarSegmentSlug: null,
      },
    ])
    countActiveRecipientsForListMock.mockImplementation(async () => 3)

    const service = new EmailCampaignAudiencePruningService()
    const result = await service.pruneSuppressedContacts({
      teamId: "team-1",
      emails: ["a@test.com"],
    })

    expect(result.prunedCampaignIds).toEqual(["camp-3"])
    expect(updateCampaignMock).toHaveBeenCalledWith("camp-3", {
      totalRecipients: 3,
      errorMessage: null,
    })
  })

  it("atualiza total do pai e cancela quando todas as filhas foram canceladas", async () => {
    findSuppressedContactsMock.mockImplementation(async () => [
      { id: "c1", email: "a@test.com", listId: "l1", isSystemDefaultList: false },
    ])
    findPrunableCampaignsMock.mockImplementation(async () => [
      {
        id: "child-1",
        teamId: "team-1",
        parentCampaignId: "parent-1",
        totalRecipients: 1,
        audienceContactIds: ["c1"],
        contactListId: null,
        sourceContactListIds: [],
        radarSegmentSlug: null,
      },
    ])
    findChildTotalsMock.mockImplementation(async () => [
      { totalRecipients: 0, status: "canceled" },
      { totalRecipients: 0, status: "canceled" },
    ])

    const service = new EmailCampaignAudiencePruningService()
    await service.pruneSuppressedContacts({
      teamId: "team-1",
      emails: ["a@test.com"],
    })

    expect(updateCampaignMock).toHaveBeenCalledWith("parent-1", {
      totalRecipients: 0,
      status: "canceled",
      errorMessage: CAMPAIGN_CANCELED_ALL_SUPPRESSED_MESSAGE,
    })
  })

  it("reconcile remove IDs suprimidos do snapshot (caso Rio)", async () => {
    findLeafCampaignIdsMock.mockImplementation(async () => [{ id: "rio-4" }])
    findCampaignByIdMock.mockImplementation(async () => ({
      id: "rio-4",
      teamId: "team-1",
      parentCampaignId: "rio-parent",
      totalRecipients: 1997,
      audienceContactIds: ["bounced-1", "ok-1"],
      contactListId: null,
      sourceContactListIds: [],
      radarSegmentSlug: null,
    }))
    findSuppressedIdsInSnapshotMock.mockImplementation(async () => ["bounced-1"])
    findChildTotalsMock.mockImplementation(async () => [
      { totalRecipients: 1604, status: "scheduled" },
    ])

    const service = new EmailCampaignAudiencePruningService()
    const result = await service.reconcileTeamCampaigns("team-1")

    expect(result.prunedCampaignIds).toEqual(["rio-4"])
    expect(updateCampaignMock).toHaveBeenCalledWith("rio-4", {
      totalRecipients: 1,
      errorMessage: null,
      audienceContactIds: ["ok-1"],
    })
    expect(updateCampaignMock).toHaveBeenCalledWith("rio-parent", {
      totalRecipients: 1604,
    })
  })
})
