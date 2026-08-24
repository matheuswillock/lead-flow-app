import { describe, expect, it } from "bun:test"
import {
  assertResendDomainTrackingReady,
  checkDispatchWindow,
  getResendDomainDispatchWarnings,
  isResendDomainSendCapable,
  isResendDomainTrackingCapable,
  RESEND_DOMAIN_DNS_NOT_VERIFIED_MESSAGE,
  RESEND_DOMAIN_METRICS_DISABLED_MESSAGE,
  resolveCampaignStatusAfterDispatch,
} from "./campaign-dispatch-guards"

const ALL_RESEND_DOMAIN_STATUSES = [
  "not_started",
  "pending",
  "verified",
  "partially_verified",
  "partially_failed",
  "failed",
  "temporary_failure",
] as const

describe("isResendDomainSendCapable", () => {
  it("permite verified, partially_verified e partially_failed", () => {
    expect(isResendDomainSendCapable("verified")).toBe(true)
    expect(isResendDomainSendCapable("partially_verified")).toBe(true)
    expect(isResendDomainSendCapable("partially_failed")).toBe(true)
  })

  it("bloqueia status pendente ou falho", () => {
    expect(isResendDomainSendCapable("pending")).toBe(false)
    expect(isResendDomainSendCapable("not_started")).toBe(false)
    expect(isResendDomainSendCapable("failed")).toBe(false)
    expect(isResendDomainSendCapable("temporary_failure")).toBe(false)
    expect(isResendDomainSendCapable(null)).toBe(false)
    expect(isResendDomainSendCapable(undefined)).toBe(false)
  })

  it("cobre todos os status conhecidos do Resend", () => {
    const capable = new Set(["verified", "partially_verified", "partially_failed"])
    for (const status of ALL_RESEND_DOMAIN_STATUSES) {
      expect(isResendDomainSendCapable(status)).toBe(capable.has(status))
    }
  })
})

describe("isResendDomainTrackingCapable", () => {
  it("só permite verified", () => {
    expect(isResendDomainTrackingCapable("verified")).toBe(true)
    expect(isResendDomainTrackingCapable("partially_verified")).toBe(false)
    expect(isResendDomainTrackingCapable("partially_failed")).toBe(false)
    expect(isResendDomainTrackingCapable("pending")).toBe(false)
    expect(isResendDomainTrackingCapable(null)).toBe(false)
  })
})

describe("assertResendDomainTrackingReady", () => {
  it("permite time sem domínio próprio", () => {
    expect(assertResendDomainTrackingReady({})).toEqual({ ok: true })
    expect(assertResendDomainTrackingReady({ domainName: null })).toEqual({ ok: true })
    expect(assertResendDomainTrackingReady({ domainName: "   " })).toEqual({ ok: true })
  })

  it("métricas desligadas com DNS verificado → mensagem de MÉTRICAS", () => {
    expect(
      assertResendDomainTrackingReady({
        domainName: "example.com",
        domainStatus: "verified",
        openTracking: false,
        clickTracking: false,
      })
    ).toEqual({ ok: false, message: RESEND_DOMAIN_METRICS_DISABLED_MESSAGE })
  })

  it("partially_failed/partially_verified → mensagem de DNS, mesmo com métricas ligadas", () => {
    // A causa reportada precisa ser o DNS: mandar "habilite as métricas" aqui
    // aponta para um toggle que não destrava nada, porque o gate exige
    // `verified` exato.
    const base = {
      domainName: "example.com",
      openTracking: true,
      clickTracking: true,
    }
    expect(assertResendDomainTrackingReady({ ...base, domainStatus: "partially_failed" })).toEqual({
      ok: false,
      message: RESEND_DOMAIN_DNS_NOT_VERIFIED_MESSAGE,
    })
    expect(assertResendDomainTrackingReady({ ...base, domainStatus: "partially_verified" })).toEqual({
      ok: false,
      message: RESEND_DOMAIN_DNS_NOT_VERIFIED_MESSAGE,
    })
  })

  it("DNS não verificado E métricas desligadas → DNS tem precedência", () => {
    expect(
      assertResendDomainTrackingReady({
        domainName: "example.com",
        domainStatus: "partially_failed",
        openTracking: false,
        clickTracking: false,
      })
    ).toEqual({ ok: false, message: RESEND_DOMAIN_DNS_NOT_VERIFIED_MESSAGE })
  })

  it("permite verified com pelo menos uma métrica ligada", () => {
    expect(
      assertResendDomainTrackingReady({
        domainName: "example.com",
        domainStatus: "verified",
        openTracking: true,
        clickTracking: false,
      })
    ).toEqual({ ok: true })
    expect(
      assertResendDomainTrackingReady({
        domainName: "example.com",
        domainStatus: "verified",
        openTracking: false,
        clickTracking: true,
      })
    ).toEqual({ ok: true })
  })
})

describe("getResendDomainDispatchWarnings", () => {
  it("avisa quando o gate de tracking bloqueia o disparo", () => {
    expect(
      getResendDomainDispatchWarnings({
        domainName: "example.com",
        domainStatus: "partially_failed",
        openTracking: true,
        clickTracking: true,
      })
    ).toEqual([RESEND_DOMAIN_DNS_NOT_VERIFIED_MESSAGE])
    expect(
      getResendDomainDispatchWarnings({
        domainName: "example.com",
        domainStatus: "partially_verified",
        openTracking: true,
        clickTracking: true,
      })
    ).toEqual([RESEND_DOMAIN_DNS_NOT_VERIFIED_MESSAGE])
    expect(
      getResendDomainDispatchWarnings({
        domainName: "example.com",
        domainStatus: "verified",
        openTracking: false,
        clickTracking: false,
      })
    ).toEqual([RESEND_DOMAIN_METRICS_DISABLED_MESSAGE])
    expect(
      getResendDomainDispatchWarnings({
        domainName: "example.com",
        domainStatus: "verified",
        openTracking: true,
        clickTracking: true,
      })
    ).toEqual([])
    expect(getResendDomainDispatchWarnings({})).toEqual([])
  })
})

describe("checkDispatchWindow", () => {
  it("permite disparo dentro da janela no fuso America/Sao_Paulo", () => {
    const now = new Date("2026-07-06T14:00:00.000Z")
    const result = checkDispatchWindow(now, "America/Sao_Paulo", {
      dispatchTimeFrom: "08:00",
      dispatchTimeTo: "18:00",
    })
    expect(result.blocked).toBe(false)
  })

  it("adianta campanha fora da janela em vez de falhar", () => {
    const now = new Date("2026-07-06T02:00:00.000Z")
    const result = checkDispatchWindow(now, "America/Sao_Paulo", {
      dispatchTimeFrom: "08:00",
      dispatchTimeTo: "18:00",
    })
    expect(result.blocked).toBe(true)
    if (result.blocked) {
      expect(result.defer).toBe(true)
      expect(result.reason).toContain("Fora da janela")
    }
  })

  it("bloqueia data específica com defer", () => {
    const now = new Date("2026-07-06T15:00:00.000Z")
    const result = checkDispatchWindow(now, "America/Sao_Paulo", {
      dispatchBlockedDates: [{ date: "2026-07-06" }],
    })
    expect(result.blocked).toBe(true)
    if (result.blocked) {
      expect(result.defer).toBe(true)
    }
  })
})

describe("resolveCampaignStatusAfterDispatch", () => {
  it("marca sent apenas quando sent > 0", () => {
    expect(resolveCampaignStatusAfterDispatch(3).campaignStatus).toBe("sent")
    expect(resolveCampaignStatusAfterDispatch(0).campaignStatus).toBe("failed")
    expect(resolveCampaignStatusAfterDispatch(0).errorMessage).toBeTruthy()
  })

  it("usa detalhe de falha quando enviado", () => {
    expect(resolveCampaignStatusAfterDispatch(0, "422 — Invalid `to`").errorMessage).toBe(
      "422 — Invalid `to`"
    )
  })

  it("marca partially_sent quando houve envios mas faltam destinatários", () => {
    // Cota excedida deixa 5441 logs `failed` — recusa do provedor, retentável.
    const terminal = resolveCampaignStatusAfterDispatch(7223, "Cota mensal excedida", 12664, 5441)
    expect(terminal.campaignStatus).toBe("partially_sent")
    expect(terminal.dispatchStatus).toBe("completed")
    expect(terminal.errorMessage).toBe("Cota mensal excedida")
  })

  it("marca sent quando sentCount cobre totalRecipients", () => {
    const terminal = resolveCampaignStatusAfterDispatch(10, null, 10)
    expect(terminal.campaignStatus).toBe("sent")
    expect(terminal.errorMessage).toBeNull()
  })

  // `partially_sent` = sobrou alguem que vale retentar. Suprimido (nossa
  // pre-validacao) e bounce nao valem: reprovam de novo na mesma regra.
  it("so suprimidos fecham a campanha como sent, sem oferecer reenvio", () => {
    // Homens v2 (1/4), 22/08/2026: 1998 na audiencia, 1969 logs, 1782 enviados,
    // 187 suprimidos, 0 falhas reais. Os 29 restantes nunca viraram log.
    const terminal = resolveCampaignStatusAfterDispatch(1782, null, 1998, 0)
    expect(terminal.campaignStatus).toBe("sent")
    expect(terminal.dispatchStatus).toBe("completed")
    expect(terminal.errorMessage).toBeNull()
  })

  it("uma falha real ja basta para partially_sent", () => {
    const terminal = resolveCampaignStatusAfterDispatch(1782, "429 — rate limit", 1998, 1)
    expect(terminal.campaignStatus).toBe("partially_sent")
    expect(terminal.errorMessage).toBe("429 — rate limit")
  })

  it("audiencia inteiramente suprimida nao e sucesso", () => {
    const terminal = resolveCampaignStatusAfterDispatch(0, null, 500, 0)
    expect(terminal.campaignStatus).toBe("failed")
    expect(terminal.errorMessage).toBeTruthy()
  })

  it("total nao fechado sem falha real nao segura a campanha em partially_sent", () => {
    // Era o bug: 1969 < 1998 mantinha reenvio disponivel para sempre.
    expect(resolveCampaignStatusAfterDispatch(1969, null, 1998, 0).campaignStatus).toBe("sent")
  })
})
