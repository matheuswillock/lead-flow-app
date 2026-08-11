import { describe, expect, it } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import {
  CampaignDispatchProgressLine,
  resolveCampaignDispatchProgressDisplay,
} from "./CampaignDispatchProgressLine"

describe("CampaignDispatchProgressLine", () => {
  it("renderiza Preparando envio / Enviando / Reenviando falhas / Parcial / Falhou", () => {
    const preparing = renderToStaticMarkup(
      <CampaignDispatchProgressLine
        progress={{
          status: "sending",
          completionKind: "pending",
          acceptedCount: 0,
          failedCount: 0,
          totalRecipients: 10,
          retryFailedOnly: false,
          errorMessage: null,
        }}
      />
    )
    expect(preparing).toContain("Preparando envio")

    const sending = renderToStaticMarkup(
      <CampaignDispatchProgressLine
        progress={{
          status: "sending",
          completionKind: "pending",
          acceptedCount: 3,
          failedCount: 0,
          totalRecipients: 10,
          retryFailedOnly: false,
          errorMessage: null,
        }}
      />
    )
    expect(sending).toContain("Enviando 3/10")

    const retry = renderToStaticMarkup(
      <CampaignDispatchProgressLine
        progress={{
          status: "sending",
          completionKind: "pending",
          acceptedCount: 2,
          failedCount: 0,
          totalRecipients: 5,
          retryFailedOnly: true,
          errorMessage: null,
        }}
      />
    )
    expect(retry).toContain("Reenviando falhas 2/5")

    const partial = renderToStaticMarkup(
      <CampaignDispatchProgressLine
        progress={{
          status: "completed",
          completionKind: "partial",
          acceptedCount: 7,
          failedCount: 3,
          totalRecipients: 10,
          retryFailedOnly: false,
          errorMessage: null,
        }}
      />
    )
    expect(partial).toContain("Parcialmente enviado 7/10")

    const failed = renderToStaticMarkup(
      <CampaignDispatchProgressLine
        progress={{
          status: "failed",
          completionKind: "failed",
          acceptedCount: 0,
          failedCount: 10,
          totalRecipients: 10,
          retryFailedOnly: false,
          errorMessage: "Timeout",
        }}
      />
    )
    expect(failed).toContain("Falhou — Timeout")
  })

  it("pai usa dispatchProgressSummary agregado", () => {
    const progress = resolveCampaignDispatchProgressDisplay({
      isParentCampaign: true,
      dispatchProgressSummary: {
        activeDispatchCount: 1,
        terminalDispatchCount: 0,
        totalRecipients: 20,
        acceptedCount: 4,
        failedCount: 0,
        queuedCount: 16,
        completionKind: "pending",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    })
    expect(progress).toMatchObject({
      status: "sending",
      acceptedCount: 4,
      totalRecipients: 20,
    })
  })
})
