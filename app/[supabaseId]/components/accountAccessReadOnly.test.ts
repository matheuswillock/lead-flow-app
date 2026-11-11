import { describe, expect, test } from "bun:test"
import {
  getReadOnlyHomeHref,
  getReadOnlyNavItems,
  isReadOnlyAllowedPath,
} from "./accountAccessReadOnly"

describe("isReadOnlyAllowedPath", () => {
  test("libera o CRM e a Carteira, com as subrotas", () => {
    expect(isReadOnlyAllowedPath("/conta-1/crm", false)).toBe(true)
    expect(isReadOnlyAllowedPath("/conta-1/crm/", false)).toBe(true)
    expect(isReadOnlyAllowedPath("/conta-1/carteira", false)).toBe(true)
    expect(isReadOnlyAllowedPath("/conta-1/carteira/lead-9", false)).toBe(true)
  })

  test("libera a página de pagamento só para o master", () => {
    expect(isReadOnlyAllowedPath("/conta-1/billing-grace-payment", true)).toBe(true)
    expect(isReadOnlyAllowedPath("/conta-1/billing-grace-payment", false)).toBe(false)
    expect(isReadOnlyAllowedPath("/conta-1/billing-grace-payment/extra", true)).toBe(false)
  })

  test("bloqueia todo o resto da plataforma, inclusive para o master", () => {
    for (const area of [
      "dashboard",
      "board",
      "pipeline",
      "calendar",
      "performance",
      "pme-simulador",
      "automations",
      "radar",
      "forms",
      "landing-pages",
      "email/campanhas",
      "whatsapp",
      "integrations/webhooks",
      "teams",
      "manager-users",
      "associados",
      "lead-transfers",
      "notifications",
      "subscription",
      "account",
      "docs",
    ]) {
      expect(isReadOnlyAllowedPath(`/conta-1/${area}`, true)).toBe(false)
      expect(isReadOnlyAllowedPath(`/conta-1/${area}`, false)).toBe(false)
    }
  })

  test("não confunde rotas parecidas nem caminhos fora do padrão", () => {
    expect(isReadOnlyAllowedPath("/conta-1/crm-extra", false)).toBe(false)
    expect(isReadOnlyAllowedPath("/conta-1/carteirax", false)).toBe(false)
    expect(isReadOnlyAllowedPath("/conta-1/x/crm", false)).toBe(false)
    expect(isReadOnlyAllowedPath("/crm", false)).toBe(false)
    expect(isReadOnlyAllowedPath("", false)).toBe(false)
    expect(isReadOnlyAllowedPath(null, false)).toBe(false)
    expect(isReadOnlyAllowedPath(undefined, true)).toBe(false)
  })
})

describe("getReadOnlyNavItems", () => {
  test("quem gerencia vê CRM e Carteira, nada mais", () => {
    expect(getReadOnlyNavItems("conta-1", true).map((item) => item.title)).toEqual(["CRM", "Carteira"])
    expect(getReadOnlyNavItems("conta-1", true).map((item) => item.url)).toEqual([
      "/conta-1/crm",
      "/conta-1/carteira",
    ])
  })

  test("quem não gerencia vê só o CRM", () => {
    expect(getReadOnlyNavItems("conta-1", false).map((item) => item.title)).toEqual(["CRM"])
  })
})

describe("getReadOnlyHomeHref", () => {
  test("leva para o CRM da conta", () => {
    expect(getReadOnlyHomeHref("conta-1")).toBe("/conta-1/crm")
  })
})
