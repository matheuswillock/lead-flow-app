import { describe, expect, it } from "bun:test"
import { LEAD_STATUS_MILESTONE_EVENT_TYPE } from "@/lib/radar/lead-milestone-map"

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
