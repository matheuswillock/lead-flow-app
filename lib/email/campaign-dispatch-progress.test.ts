import { describe, expect, it } from "bun:test"
import {
  aggregateDispatchLogCounters,
  buildCampaignDispatchProgress,
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
