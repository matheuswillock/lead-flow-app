import { describe, expect, it } from "bun:test"
import { normalizeRenewalCycle } from "./renewal-cycle"

describe("normalizeRenewalCycle", () => {
  it("converte o vocabulário legado e ignora caixa e espaços", () => {
    expect(normalizeRenewalCycle("YEARLY")).toBe("annual")
    expect(normalizeRenewalCycle(" SEMIANNUALLY ")).toBe("semiannual")
    expect(normalizeRenewalCycle("MONTHLY")).toBe("monthly")
  })

  it("devolve null quando o prazo está ausente", () => {
    expect(normalizeRenewalCycle(null)).toBeNull()
    expect(normalizeRenewalCycle("  ")).toBeNull()
  })
})
