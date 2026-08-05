import { describe, expect, it } from "bun:test"
import {
  LEAD_STATUS_MILESTONE_EVENT_TYPE,
  resolveLeadStatusMilestoneEventType,
} from "@/lib/radar/lead-milestone-map"

describe("LEAD_STATUS_MILESTONE_EVENT_TYPE", () => {
  it("mapeia os 4 status de marco para o eventType correto", () => {
    expect(LEAD_STATUS_MILESTONE_EVENT_TYPE.new_opportunity).toBe("lead.milestone.new_opportunity")
    expect(LEAD_STATUS_MILESTONE_EVENT_TYPE.invoicePayment).toBe("lead.milestone.invoice_payment")
    expect(LEAD_STATUS_MILESTONE_EVENT_TYPE.future_sale).toBe("lead.milestone.future_sale")
    expect(LEAD_STATUS_MILESTONE_EVENT_TYPE.contract_finalized).toBe("lead.milestone.contract_finalized")
  })

  it("demais status não têm marco associado", () => {
    const nonMilestoneStatuses = [
      "scheduled",
      "no_show",
      "pricingRequest",
      "offerNegotiation",
      "pending_documents",
      "offerSubmission",
      "dps_agreement",
      "disqualified",
      "opportunityLost",
      "operator_denied",
    ] as const

    for (const status of nonMilestoneStatuses) {
      expect(LEAD_STATUS_MILESTONE_EVENT_TYPE[status]).toBeUndefined()
    }
  })
})

describe("resolveLeadStatusMilestoneEventType (E2)", () => {
  const bornAt = new Date("2026-08-05T12:00:00.000Z")
  const laterAt = new Date("2026-08-05T15:00:00.000Z")

  it("nascimento em new_opportunity: não emite milestone (status_changed fica a cargo do service)", () => {
    expect(
      resolveLeadStatusMilestoneEventType("new_opportunity", bornAt, bornAt)
    ).toBeUndefined()
  })

  it("transição real para new_opportunity: emite milestone", () => {
    expect(
      resolveLeadStatusMilestoneEventType("new_opportunity", bornAt, laterAt)
    ).toBe("lead.milestone.new_opportunity")
  })

  it("outros 3 milestones não usam a heurística de nascimento", () => {
    expect(
      resolveLeadStatusMilestoneEventType("invoicePayment", bornAt, bornAt)
    ).toBe("lead.milestone.invoice_payment")
    expect(
      resolveLeadStatusMilestoneEventType("future_sale", bornAt, bornAt)
    ).toBe("lead.milestone.future_sale")
    expect(
      resolveLeadStatusMilestoneEventType("contract_finalized", bornAt, bornAt)
    ).toBe("lead.milestone.contract_finalized")

    expect(
      resolveLeadStatusMilestoneEventType("invoicePayment", bornAt, laterAt)
    ).toBe("lead.milestone.invoice_payment")
  })

  it("status sem marco continua undefined", () => {
    expect(
      resolveLeadStatusMilestoneEventType("scheduled", bornAt, laterAt)
    ).toBeUndefined()
  })
})
