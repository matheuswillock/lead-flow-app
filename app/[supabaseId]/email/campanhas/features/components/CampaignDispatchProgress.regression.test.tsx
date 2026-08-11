import { describe, expect, it } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { CampaignDispatchProgressLine } from "../components/CampaignDispatchProgressLine"
import {
  aggregateDispatchLogCounters,
  deriveDispatchCompletionKind,
  formatCampaignDispatchProgressLabel,
} from "@/lib/email/campaign-dispatch-progress"
import { CAMPAIGN_DISPATCH_TERMINAL_TTL_MS } from "../context/CampaignDispatchRealtimeContext"

describe("campaign-dispatch-progress regression", () => {
  it("0 -> chunk -> chunk -> terminal usa completionKind derived, sem partially_completed", () => {
    const steps = [
      { accepted: 0, status: "sending" as const },
      { accepted: 50, status: "sending" as const },
      { accepted: 100, status: "sending" as const },
      { accepted: 100, status: "completed" as const },
    ]

    const kinds = steps.map((step) =>
      deriveDispatchCompletionKind({
        status: step.status,
        totalRecipients: 100,
        acceptedCount: step.accepted,
        failedCount: step.status === "completed" ? 0 : 0,
      })
    )

    expect(kinds).toEqual(["pending", "pending", "pending", "full"])
    expect(kinds.every((kind) => kind !== ("partially_completed" as string))).toBe(true)
  })

  it("sent -> delivered/opened/bounced não reduz acceptedCount", () => {
    const afterSent = aggregateDispatchLogCounters([
      { status: "sent", sentAt: new Date(), resendEmailId: "re_1" },
      { status: "sent", sentAt: new Date(), resendEmailId: "re_2" },
    ])
    const afterWebhooks = aggregateDispatchLogCounters([
      { status: "delivered", sentAt: new Date(), resendEmailId: "re_1" },
      { status: "opened", sentAt: new Date(), resendEmailId: "re_2" },
      { status: "bounced", sentAt: new Date(), resendEmailId: "re_3" },
    ])
    expect(afterSent.acceptedCount).toBe(2)
    expect(afterWebhooks.acceptedCount).toBe(3)
    expect(afterWebhooks.acceptedCount).toBeGreaterThanOrEqual(afterSent.acceptedCount)
  })

  it("labels de lista/indicador permanecem alinhados", () => {
    const progress = {
      status: "sending" as const,
      completionKind: "pending" as const,
      acceptedCount: 4,
      failedCount: 0,
      totalRecipients: 10,
      retryFailedOnly: false,
      errorMessage: null,
    }
    const label = formatCampaignDispatchProgressLabel(progress)
    const html = renderToStaticMarkup(<CampaignDispatchProgressLine progress={progress} />)
    expect(label).toBe("Enviando 4/10")
    expect(html).toContain("Enviando 4/10")
  })

  it("terminal curto global dura 8s", () => {
    expect(CAMPAIGN_DISPATCH_TERMINAL_TTL_MS).toBe(8_000)
  })

  it("parcialidade de falha comunica X/N", () => {
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
  })
})
