import { describe, expect, test } from "bun:test"
import { FEATURE_SLUGS } from "@/lib/features/feature-slugs"
import { getReadOnlyHomeHref, isReadOnlyAllowedPath } from "./accountAccessReadOnly"

const hasOnlyCrmAndWallet = (slug: string) =>
  slug === FEATURE_SLUGS.CRM || slug === FEATURE_SLUGS.CRM_WALLET
const hasNothing = () => false
const hasEverything = () => true

describe("isReadOnlyAllowedPath", () => {
  test("libera uma rota só se a conta tem pelo menos um dos slugs que ela exige", () => {
    expect(isReadOnlyAllowedPath("/conta-1/crm", false, hasOnlyCrmAndWallet)).toBe(true)
    expect(isReadOnlyAllowedPath("/conta-1/carteira", false, hasOnlyCrmAndWallet)).toBe(true)
    expect(isReadOnlyAllowedPath("/conta-1/carteira/lead-9", false, hasOnlyCrmAndWallet)).toBe(true)
    // Dashboard exige crm-dashboard, que não está no conjunto contratado deste teste —
    // prova de que a generalização olha o slug exigido, não um prefixo fixo de rota.
    expect(isReadOnlyAllowedPath("/conta-1/dashboard", false, hasOnlyCrmAndWallet)).toBe(false)
    expect(isReadOnlyAllowedPath("/conta-1/whatsapp", false, hasOnlyCrmAndWallet)).toBe(false)
  })

  test("generaliza: com tudo contratado, tudo que exige slug fica visível", () => {
    for (const area of ["crm", "carteira", "dashboard", "whatsapp", "radar", "email/campanhas"]) {
      expect(isReadOnlyAllowedPath(`/conta-1/${area}`, false, hasEverything)).toBe(true)
    }
  })

  test("sem nada contratado, só a rota de pagamento (pro master) e rotas sem slug obrigatório ficam de pé", () => {
    for (const area of ["crm", "carteira", "dashboard", "whatsapp"]) {
      expect(isReadOnlyAllowedPath(`/conta-1/${area}`, false, hasNothing)).toBe(false)
    }
    // Rotas sem slug de feature associado (ex.: notificações, conta) nunca são bloqueadas por feature.
    for (const area of ["notifications", "account", "docs", "subscription"]) {
      expect(isReadOnlyAllowedPath(`/conta-1/${area}`, false, hasNothing)).toBe(true)
    }
  })

  test("libera uma rota com múltiplos slugs aceitos quando a conta tem qualquer um deles", () => {
    const hasOnlyRadar = (slug: string) => slug === FEATURE_SLUGS.RADAR
    expect(isReadOnlyAllowedPath("/conta-1/integrations/webhooks", false, hasOnlyRadar)).toBe(true)
  })

  test("libera a página de pagamento só para o master", () => {
    expect(isReadOnlyAllowedPath("/conta-1/billing-grace-payment", true, hasNothing)).toBe(true)
    expect(isReadOnlyAllowedPath("/conta-1/billing-grace-payment", false, hasNothing)).toBe(false)
  })

  test("não confunde caminhos fora do padrão", () => {
    expect(isReadOnlyAllowedPath("", false, hasEverything)).toBe(false)
    expect(isReadOnlyAllowedPath(null, false, hasEverything)).toBe(false)
    expect(isReadOnlyAllowedPath(undefined, true, hasEverything)).toBe(false)
  })
})

describe("getReadOnlyHomeHref", () => {
  test("leva para o CRM da conta", () => {
    expect(getReadOnlyHomeHref("conta-1")).toBe("/conta-1/crm")
  })
})
