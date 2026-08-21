import { describe, expect, it } from "bun:test"
import {
  formatPermanentBounceAlert,
  formatSuppressedAudienceSummary,
} from "./campaign-audience-copy"

describe("campaign-audience-copy", () => {
  it("formata o alerta de bounce permanente", () => {
    expect(formatPermanentBounceAlert(3)).toBe(
      "3 contatos não receberão esta campanha por já terem bounce permanente."
    )
  })

  it("separa bounce, descadastro e reclamação", () => {
    expect(
      formatSuppressedAudienceSummary({
        bounced: 3,
        unsubscribed: 1,
        complained: 2,
      })
    ).toBe("3 bounce permanente · 1 descadastro · 2 reclamação")
  })

  it("omite buckets zerados", () => {
    expect(
      formatSuppressedAudienceSummary({
        bounced: 0,
        unsubscribed: 4,
        complained: 0,
      })
    ).toBe("4 descadastro")
    expect(
      formatSuppressedAudienceSummary({
        bounced: 0,
        unsubscribed: 0,
        complained: 0,
      })
    ).toBeNull()
  })
})
