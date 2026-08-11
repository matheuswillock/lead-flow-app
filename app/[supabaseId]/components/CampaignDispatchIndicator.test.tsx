import { afterEach, describe, expect, it, mock } from "bun:test"
import { act } from "react"
import { createRoot } from "react-dom/client"
/**
 * Requer DOM: rode via `bun run test:ui` ou
 * `bun test --isolate --preload ./test/setup-happy-dom.ts app/[supabaseId]/components/CampaignDispatchIndicator.test.tsx`
 */
import {
  CAMPAIGN_DISPATCH_TERMINAL_TTL_MS,
  type SendingCampaign,
  type TerminalCampaign,
} from "@/app/[supabaseId]/email/campanhas/features/context/CampaignDispatchRealtimeContext"

const useCampaignDispatchRealtimeMock = mock(() => ({
  sendingCampaigns: [] as SendingCampaign[],
  terminalCampaigns: [] as TerminalCampaign[],
}))

mock.module(
  "@/app/[supabaseId]/email/campanhas/features/context/CampaignDispatchRealtimeContext",
  () => ({
    CAMPAIGN_DISPATCH_TERMINAL_TTL_MS,
    useCampaignDispatchRealtime: useCampaignDispatchRealtimeMock,
  })
)

const { CampaignDispatchIndicator } = await import("./CampaignDispatchIndicator")

describe("CampaignDispatchIndicator", () => {
  afterEach(() => {
    useCampaignDispatchRealtimeMock.mockClear()
    document.body.innerHTML = ""
  })

  it("mostra terminais recentes com label alinhado e sem dismiss", async () => {
    useCampaignDispatchRealtimeMock.mockImplementation(() => ({
      sendingCampaigns: [],
      terminalCampaigns: [
        {
          id: "camp-1",
          name: "Campanha A",
          totalRecipients: 10,
          totalSent: 10,
          acceptedCount: 10,
          failedCount: 0,
          completionKind: "full",
          dispatchId: "dispatch-1",
          terminalUntil: Date.now() + CAMPAIGN_DISPATCH_TERMINAL_TTL_MS,
          status: "completed",
          retryFailedOnly: false,
          errorMessage: null,
        },
      ],
    }))

    const host = document.createElement("div")
    document.body.appendChild(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(<CampaignDispatchIndicator />)
    })

    expect(host.textContent).toContain("Disparo concluído")
    expect(host.textContent).toContain("Campanha A")
    expect(host.textContent).toContain("Enviado")
    expect(host.querySelector("button")).toBeNull()

    await act(async () => {
      root.unmount()
    })
  })

  it("TTL terminal é 8s", () => {
    expect(CAMPAIGN_DISPATCH_TERMINAL_TTL_MS).toBe(8000)
  })

  it("banner global distingue failed e partial no TTL de 8s", async () => {
    useCampaignDispatchRealtimeMock.mockImplementation(() => ({
      sendingCampaigns: [],
      terminalCampaigns: [
        {
          id: "camp-fail",
          name: "Campanha Falha",
          totalRecipients: 10,
          totalSent: 0,
          acceptedCount: 0,
          failedCount: 10,
          completionKind: "failed",
          dispatchId: "dispatch-fail",
          terminalUntil: Date.now() + CAMPAIGN_DISPATCH_TERMINAL_TTL_MS,
          status: "failed",
          retryFailedOnly: false,
          errorMessage: "timeout",
        },
        {
          id: "camp-partial",
          name: "Campanha Parcial",
          totalRecipients: 10,
          totalSent: 7,
          acceptedCount: 7,
          failedCount: 3,
          completionKind: "partial",
          dispatchId: "dispatch-partial",
          terminalUntil: Date.now() + CAMPAIGN_DISPATCH_TERMINAL_TTL_MS,
          status: "completed",
          retryFailedOnly: false,
          errorMessage: null,
        },
      ],
    }))

    const host = document.createElement("div")
    document.body.appendChild(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(<CampaignDispatchIndicator />)
    })

    expect(host.textContent).toContain("Disparo falhou")
    expect(host.textContent).toContain("Disparo parcial")
    expect(host.textContent).toContain("Campanha Falha")
    expect(host.textContent).toContain("Campanha Parcial")
    expect(host.textContent).toContain("Parcialmente enviado 7/10")
    expect(host.textContent).not.toContain("Disparo concluído")

    await act(async () => {
      root.unmount()
    })
  })
})
