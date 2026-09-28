import { describe, expect, it } from "bun:test"
import { buildDeliverabilityBreakdown } from "./deliverability-breakdown"

describe("deliverability-breakdown", () => {
  it("agrupa por domínio remetente e provedor destinatário", () => {
    const result = buildDeliverabilityBreakdown([
      { senderDomain: "MAIL.EXAMPLE.COM", recipientProvider: "Gmail", status: "delivered" },
      { senderDomain: "mail.example.com", recipientProvider: "gmail", status: "bounced" },
    ])
    expect(result).toEqual([{ key: "mail.example.com|gmail", senderDomain: "mail.example.com", recipientProvider: "gmail", total: 2, delivered: 1, bounced: 1, complained: 0, failed: 0 }])
  })
})
