import { describe, expect, it } from "bun:test"
import {
  PLATFORM_FROM_EMAIL,
  PLATFORM_FROM_NAME,
  buildDeliveryFromEmail,
  isEmailAllowedForTeamDomain,
  isPlatformDefaultFromEmail,
  resolveCampaignFrom,
} from "./resolve-campaign-from"

describe("resolveCampaignFrom", () => {
  it("sem domínio e sem remetente → deliveryby@corretorstudio.com", () => {
    expect(resolveCampaignFrom({})).toEqual({
      fromName: PLATFORM_FROM_NAME,
      fromEmail: PLATFORM_FROM_EMAIL,
    })
  })

  it("com domínio e sem remetente → deliveryby@[domínio]", () => {
    expect(
      resolveCampaignFrom({
        domainName: "mail.empresa.com.br",
      })
    ).toEqual({
      fromName: PLATFORM_FROM_NAME,
      fromEmail: "deliveryby@mail.empresa.com.br",
    })
  })

  it("com remetente padrão → usa o remetente", () => {
    expect(
      resolveCampaignFrom({
        domainName: "mail.empresa.com.br",
        defaultSender: { name: "Acme Seguros", email: "contato@mail.empresa.com.br" },
      })
    ).toEqual({
      fromName: "Acme Seguros",
      fromEmail: "contato@mail.empresa.com.br",
    })
  })

  it("legacy no-reply sem remetente → trata como plataforma e aplica domínio", () => {
    expect(
      resolveCampaignFrom({
        domainName: "send.acme.com",
        legacyFromEmail: "no-reply@corretorstudio.com",
        legacyFromName: "Corretor Studio",
      })
    ).toEqual({
      fromName: "Corretor Studio",
      fromEmail: "deliveryby@send.acme.com",
    })
  })
})

describe("buildDeliveryFromEmail / isPlatformDefaultFromEmail", () => {
  it("buildDeliveryFromEmail", () => {
    expect(buildDeliveryFromEmail(null)).toBe(PLATFORM_FROM_EMAIL)
    expect(buildDeliveryFromEmail("Mail.Acme.COM")).toBe("deliveryby@mail.acme.com")
  })

  it("isPlatformDefaultFromEmail", () => {
    expect(isPlatformDefaultFromEmail(null)).toBe(true)
    expect(isPlatformDefaultFromEmail("no-reply@corretorstudio.com")).toBe(true)
    expect(isPlatformDefaultFromEmail(PLATFORM_FROM_EMAIL)).toBe(true)
    expect(isPlatformDefaultFromEmail("contato@empresa.com")).toBe(false)
  })
})

describe("isEmailAllowedForTeamDomain", () => {
  it("sem domínio libera qualquer e-mail", () => {
    expect(isEmailAllowedForTeamDomain("a@b.com", null)).toBe(true)
  })

  it("exige host igual ou subdomínio do domínio cadastrado", () => {
    expect(isEmailAllowedForTeamDomain("x@mail.acme.com", "mail.acme.com")).toBe(true)
    expect(isEmailAllowedForTeamDomain("x@sub.mail.acme.com", "mail.acme.com")).toBe(true)
    expect(isEmailAllowedForTeamDomain("x@acme.com", "mail.acme.com")).toBe(false)
    expect(isEmailAllowedForTeamDomain("x@other.com", "mail.acme.com")).toBe(false)
  })
})
