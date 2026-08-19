import { describe, expect, it } from "bun:test"
import { countUniqueFormMetricRecipients, uniqueFormMetricRecipientKey } from "./unique-form-metric-recipients"

describe("countUniqueFormMetricRecipients", () => {
  it("conta o mesmo e-mail uma única vez mesmo com várias sessões", () => {
    const count = countUniqueFormMetricRecipients([
      { visitorSessionId: "s1", origin: { recipientEmail: "ana@test.com", campaignId: "c1" } },
      { visitorSessionId: "s2", origin: { recipientEmail: "ANA@test.com", campaignId: "c1" } },
      { visitorSessionId: "s3", origin: { recipientEmail: "bob@test.com", campaignId: "c1" } },
    ])
    expect(count).toBe(2)
  })

  it("usa emailLogId quando não há recipientEmail", () => {
    const count = countUniqueFormMetricRecipients([
      { visitorSessionId: "s1", origin: { emailLogId: "log-1" } },
      { visitorSessionId: "s2", origin: { emailLogId: "log-1" } },
      { visitorSessionId: "s3", origin: { emailLogId: "log-2" } },
    ])
    expect(count).toBe(2)
  })

  it("cai na sessão quando o evento não tem e-mail nem log", () => {
    const count = countUniqueFormMetricRecipients([
      { visitorSessionId: "s1", origin: {} },
      { visitorSessionId: "s1", origin: null },
      { visitorSessionId: "s2", origin: { campaignId: "c1" } },
    ])
    expect(count).toBe(2)
  })

  it("prioriza e-mail sobre sessão e log", () => {
    expect(
      uniqueFormMetricRecipientKey({
        visitorSessionId: "s1",
        origin: { recipientEmail: "ana@test.com", emailLogId: "log-1" },
      }),
    ).toBe("email:ana@test.com")
  })
})
