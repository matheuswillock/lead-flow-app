import { describe, expect, it } from "bun:test"
import {
  selectFailedRecipientEmailsForRetry,
  type CampaignFailedRecipientLogRow,
} from "./campaign-failed-recipients"

describe("selectFailedRecipientEmailsForRetry", () => {
  it("inclui apenas e-mails com failed e sem sucesso no provedor", () => {
    const logs: CampaignFailedRecipientLogRow[] = [
      { recipientEmail: "a@test.com", status: "failed" },
      { recipientEmail: "b@test.com", status: "sent" },
      { recipientEmail: "c@test.com", status: "failed" },
      { recipientEmail: "c@test.com", status: "delivered" },
      { recipientEmail: "d@test.com", status: "failed" },
      { recipientEmail: "d@test.com", status: "bounced" },
      { recipientEmail: "e@test.com", status: "suppressed" },
      { recipientEmail: "e@test.com", status: "failed" },
      { recipientEmail: "A@test.com", status: "failed" },
    ]

    expect(selectFailedRecipientEmailsForRetry(logs)).toEqual(["a@test.com"])
  })

  it("normaliza e-mail e ignora queued sem failed", () => {
    const logs: CampaignFailedRecipientLogRow[] = [
      { recipientEmail: "  F@Test.com ", status: "failed" },
      { recipientEmail: "queued@test.com", status: "queued" },
    ]

    expect(selectFailedRecipientEmailsForRetry(logs)).toEqual(["f@test.com"])
  })
})
