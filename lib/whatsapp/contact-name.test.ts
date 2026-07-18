import { describe, expect, it } from "bun:test"
import {
  canApplyContactName,
  getContactNameSourceRank,
  resolveContactNameUpdate,
  resolveDisplayName,
} from "./contact-name"

describe("getContactNameSourceRank", () => {
  it("ordena MANUAL > LEAD > PHONE_BOOK > PUSH_NAME", () => {
    expect(getContactNameSourceRank("MANUAL")).toBeGreaterThan(getContactNameSourceRank("LEAD"))
    expect(getContactNameSourceRank("LEAD")).toBeGreaterThan(getContactNameSourceRank("PHONE_BOOK"))
    expect(getContactNameSourceRank("PHONE_BOOK")).toBeGreaterThan(getContactNameSourceRank("PUSH_NAME"))
  })
})

describe("canApplyContactName", () => {
  it("bloqueia sobrescrever MANUAL com PUSH_NAME", () => {
    expect(canApplyContactName("MANUAL", "PUSH_NAME")).toBe(false)
  })
})

describe("resolveContactNameUpdate", () => {
  it("aplica PHONE_BOOK sobre PUSH_NAME", () => {
    expect(
      resolveContactNameUpdate({
        currentName: "Ana",
        currentSource: "PUSH_NAME",
        incomingName: " Ana Silva ",
        incomingSource: "PHONE_BOOK",
      })
    ).toEqual({ contactName: "Ana Silva", contactNameSource: "PHONE_BOOK" })
  })
})

describe("resolveDisplayName", () => {
  it("prioriza contactName", () => {
    expect(
      resolveDisplayName({
        contactName: "Maria",
        contactPhone: "5511999999999",
        externalChatId: "5511999999999@s.whatsapp.net",
      })
    ).toBe("Maria")
  })

  it("não usa Contato como fallback", () => {
    expect(
      resolveDisplayName({
        contactName: null,
        contactPhone: "",
        externalChatId: "123@lid",
      })
    ).toBe("Número não disponível")
  })
})
