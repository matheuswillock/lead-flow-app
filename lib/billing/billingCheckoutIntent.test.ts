import { describe, expect, it } from "bun:test"
import { hashBillingQuote } from "./billingCheckoutIntent"

describe("hashBillingQuote", () => {
  it("ignora a ordem das chaves em objetos aninhados, preservando arrays", () => {
    const first = {
      amount: 102.9,
      customer: { account: "primary", id: "cus-1" },
      items: [{ cycle: "monthly", product: "crm" }],
    }
    const reordered = {
      items: [{ product: "crm", cycle: "monthly" }],
      customer: { id: "cus-1", account: "primary" },
      amount: 102.9,
    }

    expect(hashBillingQuote(first)).toBe(hashBillingQuote(reordered))
  })
})
