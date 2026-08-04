import { describe, expect, it } from "bun:test"
import {
  buildLeadCrmHref,
  filterDisplayableIdentities,
  getRadarIdentityDisplayValue,
  isDisplayableRadarIdentity,
  isRawUuid,
} from "./radarIdentityDisplay"

describe("isRawUuid", () => {
  it("reconhece UUID v4", () => {
    expect(isRawUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true)
  })

  it("rejeita telefone, e-mail e texto", () => {
    expect(isRawUuid("11999998888")).toBe(false)
    expect(isRawUuid("a@b.com")).toBe(false)
    expect(isRawUuid("lead-code-1")).toBe(false)
    expect(isRawUuid(null)).toBe(false)
  })
})

describe("isDisplayableRadarIdentity", () => {
  it("mantém phone, email, document e lead_id", () => {
    expect(
      isDisplayableRadarIdentity({ type: "phone", value: "1199", normalizedValue: "551199" })
    ).toBe(true)
    expect(
      isDisplayableRadarIdentity({ type: "email", value: "a@b.com", normalizedValue: "a@b.com" })
    ).toBe(true)
    expect(
      isDisplayableRadarIdentity({ type: "document", value: "123", normalizedValue: "123" })
    ).toBe(true)
    expect(
      isDisplayableRadarIdentity({
        type: "lead_id",
        value: "550e8400-e29b-41d4-a716-446655440000",
        normalizedValue: "550e8400-e29b-41d4-a716-446655440000",
      })
    ).toBe(true)
  })

  it("oculta tipos internos com UUID", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000"
    for (const type of [
      "email_contact_id",
      "portfolio_id",
      "whatsapp_contact_id",
      "visitor_session",
    ] as const) {
      expect(isDisplayableRadarIdentity({ type, value: uuid, normalizedValue: uuid })).toBe(false)
    }
  })

  it("oculta tipo desconhecido cujo valor é UUID cru", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000"
    expect(isDisplayableRadarIdentity({ type: "custom_ref", value: uuid, normalizedValue: uuid })).toBe(
      false
    )
  })
})

describe("getRadarIdentityDisplayValue / filter / href", () => {
  it("prefers value over normalizedValue", () => {
    expect(
      getRadarIdentityDisplayValue({ type: "email", value: "A@B.com", normalizedValue: "a@b.com" })
    ).toBe("A@B.com")
  })

  it("filtra a lista para só identidades exibíveis", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000"
    const result = filterDisplayableIdentities([
      { type: "email", value: "a@b.com", normalizedValue: "a@b.com" },
      { type: "portfolio_id", value: uuid, normalizedValue: uuid },
      { type: "lead_id", value: uuid, normalizedValue: uuid },
    ])
    expect(result.map((i) => i.type)).toEqual(["email", "lead_id"])
  })

  it("monta deep-link do CRM com leadCode", () => {
    expect(buildLeadCrmHref("user-1", "L-42")).toBe("/user-1/crm?leadCode=L-42")
  })
})
