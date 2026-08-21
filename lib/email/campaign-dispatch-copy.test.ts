import { describe, expect, it } from "bun:test"
import {
  CAMPAIGN_CANCEL_SENDING_ACCEPTED_COPY,
  CAMPAIGN_CANCEL_SENDING_UNSENT_COPY,
  CAMPAIGN_DISPATCH_INTERNAL_ERROR_MESSAGE,
  EMAIL_CAMPAIGN_USER_CANCELED_MESSAGE,
  campaignDispatchSendOptions,
  formatCampaignDispatchErrorMessage,
  isCampaignFailedRetry,
} from "./campaign-dispatch-copy"

describe("isCampaignFailedRetry", () => {
  it("failed com totalSent > 0 é retry de falhas", () => {
    expect(isCampaignFailedRetry({ status: "failed", totalSent: 3 })).toBe(true)
  })

  it("partially_sent com totalSent > 0 é retry de falhas", () => {
    expect(isCampaignFailedRetry({ status: "partially_sent", totalSent: 1 })).toBe(true)
  })

  it("failed com totalSent === 0 é o primeiro Disparar (Lista Fria)", () => {
    expect(isCampaignFailedRetry({ status: "failed", totalSent: 0 })).toBe(false)
  })

  it("partially_sent com totalSent === 0 não é retry", () => {
    expect(isCampaignFailedRetry({ status: "partially_sent", totalSent: 0 })).toBe(false)
  })

  it("draft, scheduled e sent nunca são retry de falhas", () => {
    expect(isCampaignFailedRetry({ status: "draft", totalSent: 0 })).toBe(false)
    expect(isCampaignFailedRetry({ status: "scheduled", totalSent: 0 })).toBe(false)
    expect(isCampaignFailedRetry({ status: "sent", totalSent: 10 })).toBe(false)
  })

  it("totalSent ausente trata como zero", () => {
    expect(isCampaignFailedRetry({ status: "failed" })).toBe(false)
    expect(isCampaignFailedRetry({ status: "failed", totalSent: null })).toBe(false)
  })
})

describe("campaignDispatchSendOptions", () => {
  it("passa retryFailedOnly só no ramo de retry", () => {
    expect(
      campaignDispatchSendOptions({ status: "failed", totalSent: 4 })
    ).toEqual({ retryFailedOnly: true })
    expect(
      campaignDispatchSendOptions({ status: "failed", totalSent: 0 })
    ).toBeUndefined()
    expect(
      campaignDispatchSendOptions({ status: "draft", totalSent: 0 })
    ).toBeUndefined()
  })
})

describe("formatCampaignDispatchErrorMessage", () => {
  it("INTERNAL antiga vira copy amigável", () => {
    expect(formatCampaignDispatchErrorMessage("Erro interno durante o disparo")).toBe(
      CAMPAIGN_DISPATCH_INTERNAL_ERROR_MESSAGE
    )
  })

  it("INTERNAL nova permanece a copy amigável", () => {
    expect(
      formatCampaignDispatchErrorMessage(CAMPAIGN_DISPATCH_INTERNAL_ERROR_MESSAGE)
    ).toBe(CAMPAIGN_DISPATCH_INTERNAL_ERROR_MESSAGE)
  })

  it("HTTP INTERNAL curto vira a mesma copy", () => {
    expect(formatCampaignDispatchErrorMessage("Erro ao disparar campanha")).toBe(
      CAMPAIGN_DISPATCH_INTERNAL_ERROR_MESSAGE
    )
  })

  it("qualquer string com Erro interno é mascarada", () => {
    expect(
      formatCampaignDispatchErrorMessage("Erro interno: P2035 bind limit")
    ).toBe(CAMPAIGN_DISPATCH_INTERNAL_ERROR_MESSAGE)
  })

  it("motivo específico permanece visível", () => {
    expect(
      formatCampaignDispatchErrorMessage(
        "Sem assinatura de créditos de e-mail ativa. Ative um plano em Assinaturas"
      )
    ).toBe("Sem assinatura de créditos de e-mail ativa. Ative um plano em Assinaturas")
  })

  it("timeout de disparo travado (30 min) vira a copy genérica", () => {
    expect(
      formatCampaignDispatchErrorMessage(
        "Disparo interrompido: tempo limite de envio excedido (30 min)"
      )
    ).toBe(CAMPAIGN_DISPATCH_INTERNAL_ERROR_MESSAGE)
  })

  it("null e vazio não inventam copy", () => {
    expect(formatCampaignDispatchErrorMessage(null)).toBeNull()
    expect(formatCampaignDispatchErrorMessage(undefined)).toBeNull()
    expect(formatCampaignDispatchErrorMessage("")).toBe("")
  })
})

describe("copy de disparo — ramo zero enviados", () => {
  it("não trata failed/0 enviados como Reenviar falhas", () => {
    const listaFria = { status: "failed" as const, totalSent: 0, name: "Lista Fria" }
    expect(isCampaignFailedRetry(listaFria)).toBe(false)
    expect(campaignDispatchSendOptions(listaFria)).toBeUndefined()
  })

  it("filho zero-enviados do pai usa Disparar, não retry", () => {
    const zeroSentChild = { status: "failed" as const, totalSent: 0 }
    const retryChild = { status: "failed" as const, totalSent: 12 }
    expect(isCampaignFailedRetry(zeroSentChild)).toBe(false)
    expect(isCampaignFailedRetry(retryChild)).toBe(true)

    const parentTooltip = isCampaignFailedRetry(zeroSentChild)
      ? 'Abra a campanha e use "Reenviar apenas falhas" nas partes com falha'
      : 'Abra a campanha e use "Disparar" nas partes'
    expect(parentTooltip).toContain("Disparar")
    expect(parentTooltip).not.toContain("Reenviar apenas falhas")
  })
})

describe("copy de cancelar envio", () => {
  it("deixa explícito que não enviados não saem e o Resend aceito permanece", () => {
    expect(CAMPAIGN_CANCEL_SENDING_UNSENT_COPY).toContain("não serão disparados")
    expect(CAMPAIGN_CANCEL_SENDING_ACCEPTED_COPY).toContain("Resend")
    expect(EMAIL_CAMPAIGN_USER_CANCELED_MESSAGE).toBe("Cancelado pelo usuário")
  })
})
