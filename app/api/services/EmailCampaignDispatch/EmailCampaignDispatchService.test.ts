import { describe, expect, it } from "bun:test"
import { parseResendBatchSendItems } from "./EmailCampaignDispatchService"

describe("parseResendBatchSendItems", () => {
  it("extrai array de IDs do payload aninhado do Resend v6", () => {
    const items = parseResendBatchSendItems({
      data: [{ id: "abc-123" }, { id: "def-456" }],
    })
    expect(items).toHaveLength(2)
    expect(items[0]?.id).toBe("abc-123")
  })

  it("retorna array vazio quando data é undefined", () => {
    expect(parseResendBatchSendItems(undefined)).toEqual([])
    expect(parseResendBatchSendItems(null)).toEqual([])
  })
})
