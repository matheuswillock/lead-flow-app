import { describe, expect, it } from "bun:test"
import {
  CAMPAIGN_FROM_DOMAIN_NOT_VERIFIED_MESSAGE,
  CAMPAIGN_FROM_SENDER_OUTSIDE_DOMAIN_MESSAGE,
  PLATFORM_FROM_EMAIL,
  PLATFORM_FROM_NAME,
  SENDER_EMAIL_DOMAIN_NOT_VERIFIED_MESSAGE,
  assertCampaignFromIsSendable,
  assertSenderEmailIsAllowed,
  buildDeliveryFromEmail,
  isEmailAllowedForTeamDomain,
  isEmailOnPlatformDomain,
  isPlatformDefaultFromEmail,
  resolveCampaignFrom,
} from "./resolve-campaign-from"

describe("resolveCampaignFrom", () => {
  it("sem domínio e sem remetente → contato@mail.corretorstudio.com", () => {
    expect(resolveCampaignFrom({})).toEqual({
      fromName: PLATFORM_FROM_NAME,
      fromEmail: "contato@mail.corretorstudio.com",
    })
    expect(PLATFORM_FROM_EMAIL).toBe("contato@mail.corretorstudio.com")
  })

  it("com domínio e sem remetente → contato@[domínio]", () => {
    expect(
      resolveCampaignFrom({
        domainName: "mail.empresa.com.br",
      })
    ).toEqual({
      fromName: PLATFORM_FROM_NAME,
      fromEmail: "contato@mail.empresa.com.br",
    })
  })

  it("com remetente padrão → usa o remetente", () => {
    expect(
      resolveCampaignFrom({
        domainName: "mail.empresa.com.br",
        defaultSender: { name: "Acme Seguros", email: "vendas@mail.empresa.com.br" },
      })
    ).toEqual({
      fromName: "Acme Seguros",
      fromEmail: "vendas@mail.empresa.com.br",
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
      fromEmail: "contato@send.acme.com",
    })
  })

  it("legacy deliveryby (default antigo do banco) → migra para contato@, não vira remetente próprio", () => {
    expect(
      resolveCampaignFrom({
        domainName: "send.acme.com",
        legacyFromEmail: "deliveryby@corretorstudio.com",
        legacyFromName: "Corretor Studio",
      })
    ).toEqual({
      fromName: "Corretor Studio",
      fromEmail: "contato@send.acme.com",
    })

    expect(
      resolveCampaignFrom({
        legacyFromEmail: "deliveryby@corretorstudio.com",
        legacyFromName: "Corretor Studio",
      })
    ).toEqual({
      fromName: "Corretor Studio",
      fromEmail: "contato@mail.corretorstudio.com",
    })
  })
})

describe("buildDeliveryFromEmail / isPlatformDefaultFromEmail", () => {
  it("buildDeliveryFromEmail", () => {
    expect(buildDeliveryFromEmail(null)).toBe(PLATFORM_FROM_EMAIL)
    expect(buildDeliveryFromEmail("Mail.Acme.COM")).toBe("contato@mail.acme.com")
  })

  it("isPlatformDefaultFromEmail", () => {
    expect(isPlatformDefaultFromEmail(null)).toBe(true)
    expect(isPlatformDefaultFromEmail("no-reply@corretorstudio.com")).toBe(true)
    expect(isPlatformDefaultFromEmail("deliveryby@corretorstudio.com")).toBe(true)
    expect(isPlatformDefaultFromEmail("contato@corretorstudio.com")).toBe(true)
    expect(isPlatformDefaultFromEmail(PLATFORM_FROM_EMAIL)).toBe(true)
    expect(isPlatformDefaultFromEmail("contato@empresa.com")).toBe(false)
  })

  it("isEmailOnPlatformDomain", () => {
    expect(isEmailOnPlatformDomain(null)).toBe(false)
    expect(isEmailOnPlatformDomain("contato@corretorstudio.com")).toBe(true)
    expect(isEmailOnPlatformDomain("a@mail.corretorstudio.com")).toBe(true)
    expect(isEmailOnPlatformDomain("contato@mail.corretorstudio.com")).toBe(true)
    expect(isEmailOnPlatformDomain("bruno@backstageclub.com.br")).toBe(false)
  })
})

describe("isEmailAllowedForTeamDomain", () => {
  it("sem domínio libera qualquer e-mail", () => {
    expect(isEmailAllowedForTeamDomain("a@b.com", null)).toBe(true)
  })

  it("aceita host igual e equivalência de domínio raiz com prefixo mail", () => {
    expect(isEmailAllowedForTeamDomain("x@mail.acme.com", "mail.acme.com")).toBe(true)
    expect(isEmailAllowedForTeamDomain("x@acme.com", "mail.acme.com")).toBe(true)
    expect(isEmailAllowedForTeamDomain("x@mail.acme.com", "acme.com")).toBe(true)
    expect(isEmailAllowedForTeamDomain("x@sub.mail.acme.com", "mail.acme.com")).toBe(false)
    expect(isEmailAllowedForTeamDomain("x@other.com", "mail.acme.com")).toBe(false)
  })
})

describe("assertCampaignFromIsSendable", () => {
  const resolvers = [
    { fromName: "Corretor Studio", fromEmail: "deliveryby@corretorstudio.com" },
    { fromName: "Corretor Studio", fromEmail: "no-reply@corretorstudio.com" },
  ]

  it("plataforma → ok sempre (mesmo sem domínio / domínio não verificado)", () => {
    for (const resolved of resolvers) {
      expect(
        assertCampaignFromIsSendable({
          resolved,
          domainName: undefined,
          domainStatus: undefined,
        })
      ).toEqual({ ok: true })
      expect(
        assertCampaignFromIsSendable({
          resolved,
          domainName: "example.com",
          domainStatus: "failed",
        })
      ).toEqual({ ok: true })
    }

    expect(
      assertCampaignFromIsSendable({
        resolved: { fromName: "Contato", fromEmail: "contato@corretorstudio.com" },
        domainName: null,
        domainStatus: null,
      })
    ).toEqual({ ok: true })
    expect(
      assertCampaignFromIsSendable({
        resolved: { fromName: "Contato", fromEmail: "contato@mail.corretorstudio.com" },
        domainName: null,
        domainStatus: null,
      })
    ).toEqual({ ok: true })
  })

  it("domínio null + sender próprio → bloqueia com CAMPAIGN_FROM_DOMAIN_NOT_VERIFIED_MESSAGE", () => {
    const resolved = { fromName: "Vendas", fromEmail: "vendas@empresaxyz.com.br" }
    expect(
      assertCampaignFromIsSendable({
        resolved,
        domainName: null,
        domainStatus: null,
      })
    ).toEqual({ ok: false, message: CAMPAIGN_FROM_DOMAIN_NOT_VERIFIED_MESSAGE })
  })

  it("domínio setado com status pending/failed → bloqueia mesma mensagem", () => {
    const resolved = { fromName: "Vendas", fromEmail: "vendas@empresaxyz.com.br" }
    for (const status of ["pending", "failed", "temporary_failure", "not_started"]) {
      expect(
        assertCampaignFromIsSendable({
          resolved,
          domainName: "empresaxyz.com.br",
          domainStatus: status,
        })
      ).toEqual({ ok: false, message: CAMPAIGN_FROM_DOMAIN_NOT_VERIFIED_MESSAGE })
    }
  })

  it("domínio verified + sender de outro domínio → bloqueia com CAMPAIGN_FROM_SENDER_OUTSIDE_DOMAIN_MESSAGE", () => {
    const resolved = { fromName: "Vendas", fromEmail: "vendas@empresaxyz.com.br" }
    expect(
      assertCampaignFromIsSendable({
        resolved,
        domainName: "example.com",
        domainStatus: "verified",
      })
    ).toEqual({
      ok: false,
      message: CAMPAIGN_FROM_SENDER_OUTSIDE_DOMAIN_MESSAGE,
    })
  })

  it("domínio verified + sender no mesmo domínio → ok", () => {
    const resolved = { fromName: "Vendas", fromEmail: "vendas@empresaxyz.com.br" }
    expect(
      assertCampaignFromIsSendable({
        resolved,
        domainName: "empresaxyz.com.br",
        domainStatus: "verified",
      })
    ).toEqual({ ok: true })
  })

  it("domínio verified com prefixo mail + sender no domínio raiz → ok", () => {
    expect(
      assertCampaignFromIsSendable({
        resolved: { fromName: "Alexandre", fromEmail: "alexandre@libercorretora.com.br" },
        domainName: "mail.libercorretora.com.br",
        domainStatus: "verified",
      })
    ).toEqual({ ok: true })
  })

  it("domínio verified raiz + sender com prefixo mail → ok", () => {
    expect(
      assertCampaignFromIsSendable({
        resolved: { fromName: "Alexandre", fromEmail: "alexandre@mail.libercorretora.com.br" },
        domainName: "libercorretora.com.br",
        domainStatus: "verified",
      })
    ).toEqual({ ok: true })
  })

  it("domínio verified com prefixo mail + sender em outro subdomínio raiz → bloqueia", () => {
    expect(
      assertCampaignFromIsSendable({
        resolved: { fromName: "Alexandre", fromEmail: "alexandre@app.libercorretora.com.br" },
        domainName: "mail.libercorretora.com.br",
        domainStatus: "verified",
      })
    ).toEqual({
      ok: false,
      message: CAMPAIGN_FROM_SENDER_OUTSIDE_DOMAIN_MESSAGE,
    })
  })

  it("domínio partially_verified/partially_failed + sender no domínio → ok (envio permitido)", () => {
    const resolved = { fromName: "Vendas", fromEmail: "vendas@empresaxyz.com.br" }
    for (const status of ["partially_verified", "partially_failed"]) {
      expect(
        assertCampaignFromIsSendable({
          resolved,
          domainName: "empresaxyz.com.br",
          domainStatus: status,
        })
      ).toEqual({ ok: true })
    }
  })
})

describe("assertSenderEmailIsAllowed", () => {
  it("mapeia domínio não verificado para mensagem de cadastro de remetente", () => {
    expect(
      assertSenderEmailIsAllowed({
        email: "bruno@backstageclub.com.br",
        domainName: null,
        domainStatus: null,
      })
    ).toEqual({ ok: false, message: SENDER_EMAIL_DOMAIN_NOT_VERIFIED_MESSAGE })
  })

  it("plataforma → ok sem domínio", () => {
    expect(
      assertSenderEmailIsAllowed({
        email: "contato@mail.corretorstudio.com",
        domainName: null,
        domainStatus: null,
      })
    ).toEqual({ ok: true })
  })
})
