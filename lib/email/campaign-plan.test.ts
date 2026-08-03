import { describe, expect, it } from "bun:test"
import { buildCampaignPlan, dedupeContactsFromSlices } from "@/lib/email/campaign-plan"

describe("campaign-plan", () => {
  it("merge virtual deduplica contatos por e-mail", () => {
    const merged = dedupeContactsFromSlices([
      {
        listId: "l1",
        listName: "Lista A",
        contacts: [
          { contactId: "c1", email: "a@test.com" },
          { contactId: "c2", email: "b@test.com" },
        ],
      },
      {
        listId: "l2",
        listName: "Lista B",
        contacts: [
          { contactId: "c3", email: "a@test.com" },
          { contactId: "c4", email: "c@test.com" },
        ],
      },
    ])

    expect(merged).toHaveLength(3)
    expect(merged.map((contact) => contact.email)).toEqual([
      "a@test.com",
      "b@test.com",
      "c@test.com",
    ])
  })

  it("per_list cria uma sub-campanha por lista", () => {
    const plan = buildCampaignPlan({
      campaignName: "Campanha",
      listStrategy: "per_list",
      sourceContactListIds: ["l1", "l2"],
      listAudiences: [
        {
          listId: "l1",
          listName: "Lista A",
          contacts: [{ contactId: "c1", email: "a@test.com" }],
        },
        {
          listId: "l2",
          listName: "Lista B",
          contacts: [{ contactId: "c2", email: "b@test.com" }],
        },
      ],
      scheduledAt: new Date("2030-01-01T12:00:00.000Z"),
      scheduleIntervalDays: 1,
      uniformSchedule: true,
    })

    expect(plan.subCampaigns).toHaveLength(2)
    expect(plan.isParentCampaign).toBe(true)
    expect(plan.subCampaigns[0]?.listName).toBe("Lista A")
    expect(plan.subCampaigns[1]?.listName).toBe("Lista B")
  })

  it("schedules não-uniformes exigem data por índice", () => {
    const plan = buildCampaignPlan({
      campaignName: "Campanha",
      listStrategy: "per_list",
      sourceContactListIds: ["l1", "l2"],
      listAudiences: [
        {
          listId: "l1",
          listName: "Lista A",
          contacts: [{ contactId: "c1", email: "a@test.com" }],
        },
        {
          listId: "l2",
          listName: "Lista B",
          contacts: [{ contactId: "c2", email: "b@test.com" }],
        },
      ],
      uniformSchedule: false,
      subCampaignSchedules: [
        { index: 1, scheduledAt: "2030-01-01T12:00:00.000Z" },
        { index: 2, scheduledAt: "2030-01-05T12:00:00.000Z" },
      ],
    })

    expect(plan.subCampaigns[0]?.scheduledAt).toBe("2030-01-01T12:00:00.000Z")
    expect(plan.subCampaigns[1]?.scheduledAt).toBe("2030-01-05T12:00:00.000Z")
  })
})
