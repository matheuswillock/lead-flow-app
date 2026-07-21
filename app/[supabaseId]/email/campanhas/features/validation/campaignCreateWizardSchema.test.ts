import { describe, expect, it } from "bun:test"
import { buildCampaignCreateWizardSubmitSchema } from "./campaignCreateWizardSchema"

describe("campaignCreateWizardSubmitSchema", () => {
  const future = new Date(Date.now() + 60 * 60 * 1000)

  it("requires schedule + interval for lists above 2000", () => {
    const schema = buildCampaignCreateWizardSubmitSchema({
      recipientCount: 4500,
      recipientSource: "contact_list",
    })
    const withoutSchedule = schema.safeParse({
      name: "Campanha",
      templateId: "11111111-1111-4111-8111-111111111111",
      recipientSource: "contact_list",
      contactListId: "22222222-2222-4222-8222-222222222222",
      scheduleIntervalDays: 1,
    })
    expect(withoutSchedule.success).toBe(false)

    const withSchedule = schema.safeParse({
      name: "Campanha",
      templateId: "11111111-1111-4111-8111-111111111111",
      recipientSource: "contact_list",
      contactListId: "22222222-2222-4222-8222-222222222222",
      scheduledAt: future,
      scheduleIntervalDays: 1,
    })
    expect(withSchedule.success).toBe(true)
  })

  it("allows optional schedule for lists up to 2000", () => {
    const schema = buildCampaignCreateWizardSubmitSchema({
      recipientCount: 500,
      recipientSource: "contact_list",
    })
    const result = schema.safeParse({
      name: "Campanha",
      templateId: "11111111-1111-4111-8111-111111111111",
      recipientSource: "contact_list",
      contactListId: "22222222-2222-4222-8222-222222222222",
    })
    expect(result.success).toBe(true)
  })

  it("rejects scheduleIntervalDays below 1", () => {
    const schema = buildCampaignCreateWizardSubmitSchema({
      recipientCount: 3000,
      recipientSource: "contact_list",
    })
    const result = schema.safeParse({
      name: "Campanha",
      templateId: "11111111-1111-4111-8111-111111111111",
      recipientSource: "contact_list",
      contactListId: "22222222-2222-4222-8222-222222222222",
      scheduledAt: future,
      scheduleIntervalDays: 0,
    })
    expect(result.success).toBe(false)
  })

  it("rejects Radar segments above 2000 recipients", () => {
    const schema = buildCampaignCreateWizardSubmitSchema({
      recipientCount: 2500,
      recipientSource: "radar_segment",
    })
    const result = schema.safeParse({
      name: "Campanha Radar",
      templateId: "11111111-1111-4111-8111-111111111111",
      recipientSource: "radar_segment",
      radarSegmentSlug: "email_marketable",
    })
    expect(result.success).toBe(false)
  })

  it("allows Radar segments up to 2000 recipients", () => {
    const schema = buildCampaignCreateWizardSubmitSchema({
      recipientCount: 1500,
      recipientSource: "radar_segment",
    })
    const result = schema.safeParse({
      name: "Campanha Radar",
      templateId: "11111111-1111-4111-8111-111111111111",
      recipientSource: "radar_segment",
      radarSegmentSlug: "email_marketable",
    })
    expect(result.success).toBe(true)
  })
})
