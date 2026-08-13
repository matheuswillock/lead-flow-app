import { describe, expect, it } from "bun:test"
import {
  extractOriginAttribution,
  leadMatchesOriginFilter,
  parseLeadOriginFilter,
  resolveLeadOriginFilter,
} from "./origin-filter"

describe("lead origin filter", () => {
  it("parseia valores conhecidos e rejeita o restante", () => {
    expect(parseLeadOriginFilter("email_campaign")).toBe("email_campaign")
    expect(parseLeadOriginFilter("nope")).toBe("")
  })

  it("mapeia preset legado onlyTransfer para origem transferência", () => {
    expect(resolveLeadOriginFilter("", true)).toBe("transfer")
    expect(resolveLeadOriginFilter("manual", true)).toBe("manual")
  })

  it("filtra campanha de e-mail pelo enum ou attribution legado", () => {
    expect(
      leadMatchesOriginFilter(
        { originChannel: "email_campaign", originMetadata: null, isTransfer: false },
        "email_campaign",
      ),
    ).toBe(true)
    expect(
      leadMatchesOriginFilter(
        {
          originChannel: "public_form",
          originMetadata: { attribution: "email_campaign" },
          isTransfer: false,
        },
        "email_campaign",
      ),
    ).toBe(true)
    expect(
      leadMatchesOriginFilter(
        { originChannel: "public_form", originMetadata: null, isTransfer: false },
        "email_campaign",
      ),
    ).toBe(false)
  })

  it("form público exclui attribution de campanha", () => {
    expect(
      leadMatchesOriginFilter(
        { originChannel: "public_form", originMetadata: null, isTransfer: false },
        "public_form",
      ),
    ).toBe(true)
    expect(
      leadMatchesOriginFilter(
        {
          originChannel: "public_form",
          originMetadata: { attribution: "email_campaign" },
          isTransfer: false,
        },
        "public_form",
      ),
    ).toBe(false)
  })

  it("manual inclui originChannel nulo (leads anteriores ao enum)", () => {
    expect(
      leadMatchesOriginFilter(
        { originChannel: null, originMetadata: null, isTransfer: false },
        "manual",
      ),
    ).toBe(true)
  })

  it("extractOriginAttribution devolve só attribution", () => {
    expect(extractOriginAttribution({ attribution: "email_campaign", emailLogId: "x" })).toEqual({
      attribution: "email_campaign",
    })
    expect(extractOriginAttribution({ source: "form" })).toBeNull()
  })
})
