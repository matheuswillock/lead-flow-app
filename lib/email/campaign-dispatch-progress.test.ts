import { describe, expect, it } from "bun:test"
import {
  aggregateCumulativeDispatchLogCounters,
  aggregateDispatchLogCounters,
  buildCampaignDispatchProgress,
  buildCumulativeCampaignDispatchProgress,
  deriveDispatchCompletionKind,
  formatCampaignDispatchProgressLabel,
} from "./campaign-dispatch-progress"

describe("campaign-dispatch-progress helpers", () => {
  it("acceptedCount monotônico: delivered/opened/bounced contam como aceite", () => {
    const counters = aggregateDispatchLogCounters([
      { status: "queued", sentAt: null, resendEmailId: null },
      { status: "failed", sentAt: null, resendEmailId: null },
      { status: "sent", sentAt: new Date(), resendEmailId: "re_1" },
      { status: "delivered", sentAt: new Date(), resendEmailId: "re_2" },
      { status: "opened", sentAt: new Date(), resendEmailId: "re_3" },
      { status: "bounced", sentAt: new Date(), resendEmailId: "re_4" },
    ])
    expect(counters).toEqual({
      acceptedCount: 4,
      failedCount: 1,
      queuedCount: 1,
      suppressedCount: 0,
    })
  })

  it("completionKind full quando aceitos + suprimidos fecham o total", () => {
    // Regressão: `suppressedCount` passou a ser coletado mas não chegava aqui,
    // então um dispatch concluído com aceitos + suprimidos ficava "partial" e a
    // UI exibia aviso de envio parcial sem nada retentável.
    expect(
      deriveDispatchCompletionKind({
        status: "completed",
        totalRecipients: 1969,
        acceptedCount: 1782,
        failedCount: 0,
        suppressedCount: 187,
      })
    ).toBe("full")
  })

  it("dispatch failed coberto por aceitos + suprimidos é full, não partial", () => {
    // Regressão: os ramos de `status: "failed"` comparavam só `acceptedCount`.
    // O reconciler marcava a campanha `sent` e o progresso dizia `partial` ao
    // mesmo tempo — e `resolveCampaignDispatchTerminal` prioriza o progresso,
    // exibindo aviso de envio parcial sem nada retentável.
    expect(
      deriveDispatchCompletionKind({
        status: "failed",
        totalRecipients: 1969,
        acceptedCount: 1782,
        failedCount: 0,
        suppressedCount: 187,
      })
    ).toBe("full")
  })

  it("suprimido não mascara falha retentável", () => {
    expect(
      deriveDispatchCompletionKind({
        status: "completed",
        totalRecipients: 100,
        acceptedCount: 80,
        failedCount: 10,
        suppressedCount: 10,
      })
    ).toBe("partial")
  })

  it("acceptedCount continua sendo só o aceite, para o rótulo de progresso", () => {
    // O total terminal serve para decidir conclusão; o número exibido ao
    // usuário continua sendo quantos e-mails realmente saíram.
    expect(
      formatCampaignDispatchProgressLabel({
        status: "sending",
        completionKind: "pending",
        acceptedCount: 1782,
        totalRecipients: 1969,
        retryFailedOnly: false,
        errorMessage: null,
      })
    ).toBe("Enviando 1782/1969")
  })

  it("completionKind partial sem status partially_completed", () => {
    expect(
      deriveDispatchCompletionKind({
        status: "completed",
        totalRecipients: 10,
        acceptedCount: 7,
        failedCount: 3,
      })
    ).toBe("partial")
  })

  it("completionKind full quando status=failed mas 100% dos destinatários foram aceitos", () => {
    // Caso real: dispatch marcado failed internamente, mas os webhooks do Resend
    // confirmaram depois que todos os e-mails saíram (ex.: erro pós-envio).
    expect(
      deriveDispatchCompletionKind({
        status: "failed",
        totalRecipients: 2211,
        acceptedCount: 2211,
        failedCount: 0,
      })
    ).toBe("full")
  })

  it("completionKind partial quando status=failed com aceite parcial", () => {
    expect(
      deriveDispatchCompletionKind({
        status: "failed",
        totalRecipients: 10,
        acceptedCount: 4,
        failedCount: 6,
      })
    ).toBe("partial")
  })

  it("format labels cobrem estados de UI", () => {
    expect(
      formatCampaignDispatchProgressLabel({
        status: "sending",
        completionKind: "pending",
        acceptedCount: 0,
        totalRecipients: 10,
        retryFailedOnly: false,
        errorMessage: null,
      })
    ).toBe("Preparando envio")

    expect(
      formatCampaignDispatchProgressLabel({
        status: "sending",
        completionKind: "pending",
        acceptedCount: 3,
        totalRecipients: 10,
        retryFailedOnly: false,
        errorMessage: null,
      })
    ).toBe("Enviando 3/10")

    expect(
      formatCampaignDispatchProgressLabel({
        status: "sending",
        completionKind: "pending",
        acceptedCount: 2,
        totalRecipients: 5,
        retryFailedOnly: true,
        errorMessage: null,
      })
    ).toBe("Reenviando falhas 2/5")

    expect(
      formatCampaignDispatchProgressLabel({
        status: "completed",
        completionKind: "partial",
        acceptedCount: 7,
        totalRecipients: 10,
        retryFailedOnly: false,
        errorMessage: null,
      })
    ).toBe("Parcialmente enviado 7/10")

    expect(
      formatCampaignDispatchProgressLabel({
        status: "failed",
        completionKind: "failed",
        acceptedCount: 0,
        totalRecipients: 10,
        retryFailedOnly: false,
        errorMessage: "Timeout",
      })
    ).toBe("Falhou — Timeout")
  })

  it("buildCampaignDispatchProgress preserva status real do enum", () => {
    const progress = buildCampaignDispatchProgress(
      {
        id: "d1",
        dispatchNumber: 2,
        status: "completed",
        totalRecipients: 3,
        retryFailedOnly: false,
        errorMessage: null,
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      { acceptedCount: 3, failedCount: 0, queuedCount: 0, suppressedCount: 0 }
    )
    expect(progress.status).toBe("completed")
    expect(progress.completionKind).toBe("full")
  })
})

describe("aggregateCumulativeDispatchLogCounters", () => {
  it("conta `suppressed` em vez de descartar do total", () => {
    // Regressão: `suppressed` não caía em nenhum tier, então sumia da agregação.
    // O reconciler comparava `acceptedCount >= totalRecipients` e, no caso real
    // (1782 aceitos + 187 suprimidos de 1998), recalculava `partially_sent` e
    // regravava por cima do `sent` — devolvendo o botão de reenviar falhas para
    // endereços que a nossa própria pré-validação recusa de forma determinística.
    const counters = aggregateCumulativeDispatchLogCounters([
      { recipientEmail: "ok@test.com", status: "delivered", sentAt: new Date(), resendEmailId: "re_1" },
      { recipientEmail: "typo@gmial.com", status: "suppressed", sentAt: null, resendEmailId: null },
      { recipientEmail: "role@empresa.com", status: "suppressed", sentAt: null, resendEmailId: null },
    ])

    expect(counters).toEqual({
      acceptedCount: 1,
      failedCount: 0,
      queuedCount: 0,
      suppressedCount: 2,
    })
  })

  it("aceite sobrepõe supressão anterior do mesmo endereço", () => {
    // Se o endereço foi recusado num disparo e aceito noutro, vale o aceite.
    const counters = aggregateCumulativeDispatchLogCounters([
      { recipientEmail: "A@Test.com", status: "suppressed", sentAt: null, resendEmailId: null },
      { recipientEmail: "a@test.com", status: "sent", sentAt: new Date(), resendEmailId: "re_1" },
    ])
    expect(counters.acceptedCount).toBe(1)
    expect(counters.suppressedCount).toBe(0)
  })

  it("supressão sobrepõe queued e também failed", () => {
    const soQueued = aggregateCumulativeDispatchLogCounters([
      { recipientEmail: "a@test.com", status: "queued", sentAt: null, resendEmailId: null },
      { recipientEmail: "a@test.com", status: "suppressed", sentAt: null, resendEmailId: null },
    ])
    expect(soQueued.suppressedCount).toBe(1)
    expect(soQueued.queuedCount).toBe(0)

    // Falhou num disparo e, antes do retry, entrou na blocklist. O rank tem que
    // concordar com `selectFailedRecipientEmailsForRetry`, que exclui do reenvio
    // QUALQUER endereço com log suppressed, mesmo havendo failed anterior. Se
    // contasse como failed, a campanha ficaria `partially_sent` e o botão
    // "Reenviar falhas" apareceria com zero elegíveis.
    const comFailed = aggregateCumulativeDispatchLogCounters([
      { recipientEmail: "b@test.com", status: "failed", sentAt: null, resendEmailId: null },
      { recipientEmail: "b@test.com", status: "suppressed", sentAt: null, resendEmailId: null },
    ])
    expect(comFailed.suppressedCount).toBe(1)
    expect(comFailed.failedCount).toBe(0)

    // Ordem inversa dos logs: rank não pode depender da ordem de leitura.
    const ordemInversa = aggregateCumulativeDispatchLogCounters([
      { recipientEmail: "c@test.com", status: "suppressed", sentAt: null, resendEmailId: null },
      { recipientEmail: "c@test.com", status: "failed", sentAt: null, resendEmailId: null },
    ])
    expect(ordemInversa.suppressedCount).toBe(1)
    expect(ordemInversa.failedCount).toBe(0)
  })

  it("dedupe por e-mail: retry accepted sobrepõe failed anterior → 100/100", () => {
    const firstWave = Array.from({ length: 80 }, (_, i) => ({
      recipientEmail: `ok${i}@test.com`,
      status: "delivered",
      sentAt: new Date(),
      resendEmailId: `re_ok_${i}`,
    }))
    const firstFailures = Array.from({ length: 20 }, (_, i) => ({
      recipientEmail: `fail${i}@test.com`,
      status: "failed",
      sentAt: null as Date | null,
      resendEmailId: null as string | null,
    }))
    const retryAccepted = Array.from({ length: 20 }, (_, i) => ({
      recipientEmail: `fail${i}@test.com`,
      status: "sent",
      sentAt: new Date(),
      resendEmailId: `re_retry_${i}`,
    }))

    const counters = aggregateCumulativeDispatchLogCounters([
      ...firstWave,
      ...firstFailures,
      ...retryAccepted,
    ])

    expect(counters).toEqual({
      acceptedCount: 100,
      failedCount: 0,
      queuedCount: 0,
      suppressedCount: 0,
    })
  })

  it("precedência accepted > failed > queued no mesmo endereço", () => {
    expect(
      aggregateCumulativeDispatchLogCounters([
        { recipientEmail: "A@Test.com", status: "queued", sentAt: null, resendEmailId: null },
        { recipientEmail: "a@test.com", status: "failed", sentAt: null, resendEmailId: null },
        {
          recipientEmail: "a@test.com",
          status: "sent",
          sentAt: new Date(),
          resendEmailId: "re_1",
        },
      ])
    ).toEqual({ acceptedCount: 1, failedCount: 0, queuedCount: 0, suppressedCount: 0 })
  })
})

describe("buildCumulativeCampaignDispatchProgress", () => {
  it("com activeDispatch mantém sending e aplica contadores cumulativos", () => {
    const progress = buildCumulativeCampaignDispatchProgress({
      campaignId: "sub-1",
      totalRecipients: 100,
      activeDispatch: {
        dispatchId: "d2",
        dispatchNumber: 2,
        status: "sending",
        completionKind: "pending",
        totalRecipients: 20,
        acceptedCount: 5,
        failedCount: 0,
        queuedCount: 15,
        retryFailedOnly: true,
        errorMessage: null,
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
      latestDispatch: null,
      counters: { acceptedCount: 85, failedCount: 0, queuedCount: 15, suppressedCount: 0 },
    })
    expect(progress).toMatchObject({
      status: "sending",
      completionKind: "pending",
      acceptedCount: 85,
      queuedCount: 15,
      totalRecipients: 100,
      retryFailedOnly: true,
    })
  })
})
