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
    expect(counters).toEqual({ acceptedCount: 4, failedCount: 1, queuedCount: 1 })
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
      { acceptedCount: 3, failedCount: 0, queuedCount: 0 }
    )
    expect(progress.status).toBe("completed")
    expect(progress.completionKind).toBe("full")
  })
})

describe("aggregateCumulativeDispatchLogCounters", () => {
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

    expect(counters).toEqual({ acceptedCount: 100, failedCount: 0, queuedCount: 0 })
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
    ).toEqual({ acceptedCount: 1, failedCount: 0, queuedCount: 0 })
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
      counters: { acceptedCount: 85, failedCount: 0, queuedCount: 15 },
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
