import { describe, expect, it } from "bun:test"
import {
  AUDIENCE_DEAD_ISP_DOMAINS,
  AUDIENCE_REASON_BOUNCED,
  AUDIENCE_REASON_DEAD_ISP,
  AUDIENCE_REASON_ROLE,
  AUDIENCE_REASON_TYPO_DOMAIN,
  AUDIENCE_TYPO_DOMAINS,
  evaluateEmailForAudience,
  evaluateEmailForAudienceWithFlags,
  filterEmailsForAudience,
  isInvalidStaticAudienceEmail,
} from "./audience-prevalidation"

describe("evaluateEmailForAudience", () => {
  it("aceita e-mail de pessoa em domínio real", () => {
    expect(evaluateEmailForAudience("  Carol.O@Example.COM  ")).toEqual({
      ok: true,
      email: "carol.o@example.com",
    })
    expect(evaluateEmailForAudience("lior@liorseguros.com")).toEqual({
      ok: true,
      email: "lior@liorseguros.com",
    })
  })

  it("rejeita sintaxe já coberta pelo validador Resend", () => {
    expect(evaluateEmailForAudience("mjc.f.@terra.com.br")).toEqual({
      ok: false,
      reason: "Formato de e-mail inválido",
    })
    expect(evaluateEmailForAudience("a@b.com|c@d.com")).toEqual({
      ok: false,
      reason: "E-mail com múltiplos endereços",
    })
  })

  it("rejeita typos da planilha de bounce", () => {
    expect(evaluateEmailForAudience("ana@gmail.com.br")).toEqual({
      ok: false,
      reason: AUDIENCE_REASON_TYPO_DOMAIN,
    })
    expect(evaluateEmailForAudience("ana@gamil.com")).toEqual({
      ok: false,
      reason: AUDIENCE_REASON_TYPO_DOMAIN,
    })
    expect(evaluateEmailForAudience("ana@hotmai.com")).toEqual({
      ok: false,
      reason: AUDIENCE_REASON_TYPO_DOMAIN,
    })
    expect(evaluateEmailForAudience("ana@homail.com")).toEqual({
      ok: false,
      reason: AUDIENCE_REASON_TYPO_DOMAIN,
    })
    expect(evaluateEmailForAudience("arlindo-c@ig.combr")).toEqual({
      ok: false,
      reason: AUDIENCE_REASON_TYPO_DOMAIN,
    })
  })

  it("não trata hotmail.com.br e outlook.com.br como typo", () => {
    expect(evaluateEmailForAudience("ana@hotmail.com.br")).toEqual({
      ok: true,
      email: "ana@hotmail.com.br",
    })
    expect(evaluateEmailForAudience("ana@outlook.com.br")).toEqual({
      ok: true,
      email: "ana@outlook.com.br",
    })
  })

  it("rejeita ISPs mortos e aceita Terra/UOL no ingresso", () => {
    expect(evaluateEmailForAudience("ana@ig.com.br")).toEqual({
      ok: false,
      reason: AUDIENCE_REASON_DEAD_ISP,
    })
    expect(evaluateEmailForAudience("ana@bol.com.br")).toEqual({
      ok: false,
      reason: AUDIENCE_REASON_DEAD_ISP,
    })
    expect(evaluateEmailForAudience("ana@terra.com.br")).toEqual({
      ok: true,
      email: "ana@terra.com.br",
    })
    expect(evaluateEmailForAudience("ana@uol.com.br")).toEqual({
      ok: true,
      email: "ana@uol.com.br",
    })
  })

  it("rejeita local-part role exata", () => {
    expect(evaluateEmailForAudience("contato@liorseguros.com")).toEqual({
      ok: false,
      reason: AUDIENCE_REASON_ROLE,
    })
    expect(evaluateEmailForAudience("financeiro@empresa.com.br")).toEqual({
      ok: false,
      reason: AUDIENCE_REASON_ROLE,
    })
    expect(evaluateEmailForAudience("contato.silva@empresa.com.br")).toEqual({
      ok: true,
      email: "contato.silva@empresa.com.br",
    })
  })

  it("rejeita bounce global só com a flag", () => {
    expect(
      evaluateEmailForAudienceWithFlags("ana@gmail.com", { isGloballyBounced: true })
    ).toEqual({
      ok: false,
      reason: AUDIENCE_REASON_BOUNCED,
    })
    expect(
      evaluateEmailForAudienceWithFlags("ana@gmail.com", { isGloballyBounced: false })
    ).toEqual({
      ok: true,
      email: "ana@gmail.com",
    })
  })
})

describe("isInvalidStaticAudienceEmail", () => {
  it("marca typo, ISP morto e ponto inválido; não marca role nem Terra", () => {
    expect(isInvalidStaticAudienceEmail("ana@gamil.com")).toBe(true)
    expect(isInvalidStaticAudienceEmail("ana@ig.com.br")).toBe(true)
    expect(isInvalidStaticAudienceEmail("mjc.f.@terra.com.br")).toBe(true)
    expect(isInvalidStaticAudienceEmail("contato@empresa.com")).toBe(false)
    expect(isInvalidStaticAudienceEmail("ana@terra.com.br")).toBe(false)
    expect(isInvalidStaticAudienceEmail("ana@gmail.com")).toBe(false)
    expect(isInvalidStaticAudienceEmail("arlindo-c@ig.combr")).toBe(true)
  })

  it("exporta as listas usadas no SQL de backfill", () => {
    expect(AUDIENCE_TYPO_DOMAINS).toContain("gmail.com.br")
    expect(AUDIENCE_DEAD_ISP_DOMAINS).toContain("ig.com.br")
    expect(AUDIENCE_DEAD_ISP_DOMAINS).not.toContain("terra.com.br")
    expect(AUDIENCE_DEAD_ISP_DOMAINS).not.toContain("uol.com.br")
  })
})

describe("filterEmailsForAudience", () => {
  it("remove typo, role e bounce global", () => {
    expect(
      filterEmailsForAudience(
        ["ok@test.com", "ana@gamil.com", "contato@empresa.com", "bounce@test.com"],
        new Set(["bounce@test.com"])
      )
    ).toEqual(["ok@test.com"])
  })
})
