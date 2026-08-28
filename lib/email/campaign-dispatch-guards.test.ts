import { describe, expect, it } from "bun:test"
import {
  assertResendDomainTrackingReady,
  checkDispatchWindow,
  getResendDomainDispatchWarnings,
  isResendDomainSendCapable,
  isResendDomainTrackingCapable,
  RESEND_DOMAIN_DNS_NOT_VERIFIED_MESSAGE,
  RESEND_DOMAIN_METRICS_DISABLED_MESSAGE,
  RESEND_DOMAIN_TRACKING_REQUIRED_MESSAGE,
  resolveReconciledCampaignStatus,
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

  it("métricas desligadas NÃO bloqueiam — o gate protege a entrega, não a medição", () => {
    // Regra invertida de propósito. A versão antiga bloqueava aqui, e perder a
    // taxa de abertura é recuperável a qualquer momento; não conseguir enviar,
    // não. O aviso continua existindo — em getResendDomainDispatchWarnings.
    expect(
      assertResendDomainTrackingReady({
        domainName: "example.com",
        domainStatus: "verified",
        openTracking: false,
        clickTracking: false,
      })
    ).toEqual({ ok: true })
  })

  it("caso Liber: DKIM/SPF ok e só o CNAME de tracking falhou → dispara", () => {
    // O motivo do gate ter mudado. `partially_failed` com envio íntegro travava
    // todo disparo do time, indefinidamente e sem saída pela UI.
    expect(
      assertResendDomainTrackingReady({
        domainName: "mail.example.com",
        domainStatus: "partially_failed",
        openTracking: false,
        clickTracking: false,
        sendingDnsVerified: true,
      })
    ).toEqual({ ok: true })
  })

  it("DNS de envio quebrado bloqueia, mesmo com o tracking verificado", () => {
    // O caso que "aceitar partially_failed em bloco" deixaria passar: o e-mail
    // sairia sem assinatura. É o que separa a correção de um afrouxamento cego.
    expect(
      assertResendDomainTrackingReady({
        domainName: "example.com",
        domainStatus: "partially_failed",
        openTracking: true,
        clickTracking: false,
        sendingDnsVerified: false,
      })
    ).toEqual({ ok: false, message: RESEND_DOMAIN_DNS_NOT_VERIFIED_MESSAGE })
  })

  it("verified sem a coluna populada ainda passa — fallback da transição", () => {
    // `resendSendingDnsVerified` nasce `false` para todo mundo e só é populada
    // quando o cron de 6h roda ou alguém clica "Verificar DNS". Sem o fallback,
    // subir esta mudança bloquearia na hora quem hoje dispara normalmente.
    expect(
      assertResendDomainTrackingReady({
        domainName: "example.com",
        domainStatus: "verified",
        openTracking: true,
        clickTracking: false,
        sendingDnsVerified: false,
      })
    ).toEqual({ ok: true })
  })

  it("pending sem envio verificado bloqueia", () => {
    expect(
      assertResendDomainTrackingReady({
        domainName: "example.com",
        domainStatus: "pending",
        openTracking: true,
        clickTracking: false,
      })
    ).toEqual({ ok: false, message: RESEND_DOMAIN_DNS_NOT_VERIFIED_MESSAGE })
  })
})

describe("getResendDomainDispatchWarnings", () => {
  it("avisa com a mensagem de DNS quando o envio está bloqueado", () => {
    expect(
      getResendDomainDispatchWarnings({
        domainName: "example.com",
        domainStatus: "partially_failed",
        openTracking: true,
        clickTracking: false,
        sendingDnsVerified: false,
      })
    ).toEqual([RESEND_DOMAIN_DNS_NOT_VERIFIED_MESSAGE])
  })

  it("dispara sem medir → avisa sobre a métrica, e o gate não bloqueia", () => {
    const liber = {
      domainName: "mail.example.com",
      domainStatus: "partially_failed",
      openTracking: false,
      clickTracking: false,
      sendingDnsVerified: true,
    }
    expect(getResendDomainDispatchWarnings(liber)).toEqual([
      RESEND_DOMAIN_METRICS_DISABLED_MESSAGE,
    ])
    // O par que importa: existe aviso E o disparo está liberado. É a diferença
    // entre "degradado" e "travado", que a versão anterior não sabia expressar.
    expect(assertResendDomainTrackingReady(liber)).toEqual({ ok: true })
  })

  it("verified com abertura ligada não avisa nada", () => {
    expect(
      getResendDomainDispatchWarnings({
        domainName: "example.com",
        domainStatus: "verified",
        openTracking: true,
        clickTracking: false,
      })
    ).toEqual([])
  })

  it("verified sem métrica ligada avisa sobre a métrica", () => {
    expect(
      getResendDomainDispatchWarnings({
        domainName: "example.com",
        domainStatus: "verified",
        openTracking: false,
        clickTracking: false,
      })
    ).toEqual([RESEND_DOMAIN_METRICS_DISABLED_MESSAGE])
  })

  it("abertura desligada com clique ligado ainda avisa sobre a abertura", () => {
    // O aviso fala de TAXA DE ABERTURA, e só o pixel de abertura a produz.
    // A versão anterior aceitava `openTracking || clickTracking` e devolvia []
    // aqui: domínio `verified`, nenhum `email.opened` chegando nunca, e a tela
    // sem explicar por quê. Estado gravável até c0bf043d (dialog com os dois
    // toggles) e ainda espelhável do Resend por `syncFromResendDomain`.
    expect(
      getResendDomainDispatchWarnings({
        domainName: "example.com",
        domainStatus: "verified",
        openTracking: false,
        clickTracking: true,
      })
    ).toEqual([RESEND_DOMAIN_METRICS_DISABLED_MESSAGE])
  })

  it("time sem domínio próprio não recebe aviso", () => {
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

/**
 * Regra irma da de cima, aplicada na releitura da lista. As duas precisam
 * concordar: quando divergiram, o reconciler regravou `partially_sent` por cima
 * do `sent` que o disparo tinha acabado de persistir, e o botao de reenviar
 * falhas voltou sozinho na proxima leitura.
 */
describe("resolveReconciledCampaignStatus", () => {
  it("caso real Homens v2: 1782 aceitos + 187 suprimidos de 1998 fecha como sent", () => {
    // 1782 + 187 = 1969, NAO 1998. Os 29 restantes nunca viraram log — foram
    // descartados na materializacao. Comparar contagem de log com o total da
    // audiencia devolve `partially_sent` para sempre, que e exatamente o bug
    // que o teste acima ja documentava para o outro lado da regra.
    expect(
      resolveReconciledCampaignStatus(
        { acceptedCount: 1782, failedCount: 0, queuedCount: 0, suppressedCount: 187 }
      )
    ).toBe("sent")
  })

  it("falha retentavel mantem partially_sent", () => {
    expect(
      resolveReconciledCampaignStatus(
        { acceptedCount: 900, failedCount: 100, queuedCount: 0, suppressedCount: 0 }
      )
    ).toBe("partially_sent")
  })

  it("log ainda na fila mantem partially_sent", () => {
    expect(
      resolveReconciledCampaignStatus(
        { acceptedCount: 900, failedCount: 0, queuedCount: 100, suppressedCount: 0 }
      )
    ).toBe("partially_sent")
  })

  it("nenhum aceite e failed", () => {
    expect(
      resolveReconciledCampaignStatus(
        { acceptedCount: 0, failedCount: 50, queuedCount: 0, suppressedCount: 10 }
      )
    ).toBe("failed")
  })

  it("suprimido sozinho, sem nada retentavel, fecha como sent", () => {
    // Nao ha `totalRecipients` na assinatura de proposito: comparar contagem de
    // log com o total da audiencia foi exatamente o bug.
    expect(
      resolveReconciledCampaignStatus({
        acceptedCount: 10,
        failedCount: 0,
        queuedCount: 0,
        suppressedCount: 990,
      })
    ).toBe("sent")
  })
})
