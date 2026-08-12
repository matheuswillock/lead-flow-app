import { describe, expect, it } from "bun:test"
import {
  buildPlatformPurchaseExternalReference,
  parsePlatformPurchaseExternalReference,
} from "./platform-purchase-external-reference"

describe("platform-purchase-external-reference", () => {
  it("codifica purchaseType-ready reference com id da compra", () => {
    const ref = buildPlatformPurchaseExternalReference("11111111-1111-1111-1111-111111111111")
    expect(ref).toBe("platform-purchase-11111111-1111-1111-1111-111111111111")
  })

  it("parseia id a partir do externalReference tipado", () => {
    expect(
      parsePlatformPurchaseExternalReference(
        "platform-purchase-11111111-1111-1111-1111-111111111111"
      )
    ).toBe("11111111-1111-1111-1111-111111111111")
  })

  it("ignora prefixes legados", () => {
    expect(parsePlatformPurchaseExternalReference("pending-action-abc")).toBeNull()
  })
})
