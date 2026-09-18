import { describe, expect, it } from "bun:test"
import {
  disposableEmailDomainCount,
  isDisposableEmailDomain,
} from "./disposable-email-domains"
import {
  AUDIENCE_REASON_DISPOSABLE,
  evaluateEmailForAudience,
} from "./audience-prevalidation"

describe("isDisposableEmailDomain — lista pública consolidada", () => {
  it("a lista embarcada tem milhares de domínios (fonte ~4k+)", () => {
    expect(disposableEmailDomainCount()).toBeGreaterThan(4000)
  })

  it("reconhece descartáveis clássicos", () => {
    expect(isDisposableEmailDomain("mailinator.com")).toBe(true)
    expect(isDisposableEmailDomain("yopmail.com")).toBe(true)
    expect(isDisposableEmailDomain("guerrillamail.com")).toBe(true)
  })

  it("subdomínio de descartável também é descartável", () => {
    expect(isDisposableEmailDomain("qualquercoisa.mailinator.com")).toBe(true)
  })

  it("não condena provedores reais", () => {
    expect(isDisposableEmailDomain("gmail.com")).toBe(false)
    expect(isDisposableEmailDomain("uol.com.br")).toBe(false)
    expect(isDisposableEmailDomain("corretorstudio.com")).toBe(false)
  })

  it("normaliza caixa e ponto final; vazio nunca é descartável", () => {
    expect(isDisposableEmailDomain("MAILINATOR.COM.")).toBe(true)
    expect(isDisposableEmailDomain("")).toBe(false)
    expect(isDisposableEmailDomain("semponto")).toBe(false)
  })
})

describe("gate de audiência — descartável rejeitado na entrada", () => {
  it("evaluateEmailForAudience recusa com o motivo dedicado", () => {
    const result = evaluateEmailForAudience("lead@mailinator.com")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe(AUDIENCE_REASON_DISPOSABLE)
    }
  })

  it("endereço legítimo continua passando", () => {
    const result = evaluateEmailForAudience("ana@empresa.com.br")
    expect(result.ok).toBe(true)
  })
})
