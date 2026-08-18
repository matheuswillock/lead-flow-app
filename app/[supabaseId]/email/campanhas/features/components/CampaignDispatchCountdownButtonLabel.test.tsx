import { describe, expect, it } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { CampaignDispatchCountdownButtonLabel } from "./CampaignDispatchCountdownButtonLabel"

describe("CampaignDispatchCountdownButtonLabel", () => {
  it("mostra Loader2 só durante o countdown", () => {
    const idle = renderToStaticMarkup(
      <CampaignDispatchCountdownButtonLabel
        locked={false}
        countdownLabel={null}
        idleLabel="Sim, disparar"
      />
    )
    expect(idle).toContain("Sim, disparar")
    expect(idle).not.toContain("animate-spin")
    expect(idle).toContain("aria-live=\"off\"")

    const counting = renderToStaticMarkup(
      <CampaignDispatchCountdownButtonLabel
        locked
        countdownLabel="Disparando em 5 segundos"
        showLoader
        idleLabel="Sim, disparar"
      />
    )
    expect(counting).toContain("Disparando em 5 segundos")
    expect(counting).toContain("animate-spin")
    expect(counting).toContain("motion-reduce:animate-none")
    expect(counting).toContain("aria-hidden=\"true\"")
    expect(counting).toContain("aria-live=\"polite\"")
    expect(counting).not.toContain("Sim, disparar")
  })

  it("no tick Disparado esconde o spinner", () => {
    const dispatched = renderToStaticMarkup(
      <CampaignDispatchCountdownButtonLabel
        locked
        countdownLabel="Disparado"
        showLoader={false}
        idleLabel="Sim, disparar"
      />
    )
    expect(dispatched).toContain("Disparado")
    expect(dispatched).not.toContain("animate-spin")
    expect(dispatched).toContain("aria-live=\"polite\"")
  })

  it("zero enviados usa copy de Disparar, retry usa Reenviando falhas", () => {
    const firstSend = renderToStaticMarkup(
      <CampaignDispatchCountdownButtonLabel
        locked
        countdownLabel="Disparando em 4 segundos"
        showLoader
        idleLabel="Sim, disparar"
      />
    )
    expect(firstSend).toContain("Disparando em 4 segundos")
    expect(firstSend).not.toContain("Reenviando falhas")

    const retry = renderToStaticMarkup(
      <CampaignDispatchCountdownButtonLabel
        locked
        countdownLabel="Reenviando falhas em 5 segundos"
        showLoader
        idleLabel="Sim, reenviar apenas falhas"
      />
    )
    expect(retry).toContain("Reenviando falhas em 5 segundos")
  })
})
