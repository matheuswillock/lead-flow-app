import { afterEach, beforeAll, describe, expect, it } from "bun:test"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useCampanhasAnalytics } from "../features/context/useCampanhasAnalyticsHook"
import { installBrowserStubs, QueuedDispatchesCampanhasAnalyticsService, renderWithProvider } from "./testHarness"

beforeAll(() => {
  installBrowserStubs()
})

afterEach(() => {
  cleanup()
})

/**
 * Botões separados (cada clique é um evento React distinto, então o estado de
 * `draftFilters` de fato commita entre eles) para poder disparar dois
 * `refresh()` com CHAVES diferentes (team-a, depois team-b) sem esperar o
 * primeiro terminar — reproduz duas requisições de grupo concorrentes.
 */
function RaceTrigger() {
  const { draftFilters, setDraftFilters, refresh, dispatches } = useCampanhasAnalytics()
  return (
    <>
      <span data-testid="current-dispatch-id">{dispatches?.rows[0]?.id ?? "none"}</span>
      <button onClick={() => setDraftFilters({ ...draftFilters, teamIds: ["team-a"] })}>select-team-a</button>
      <button onClick={() => setDraftFilters({ ...draftFilters, teamIds: ["team-b"] })}>select-team-b</button>
      <button onClick={() => void refresh()}>refresh-now</button>
    </>
  )
}

describe("Regressão PR #1126 — resposta obsoleta de disparos não pode sobrescrever a mais nova", () => {
  it("quando a resposta do refresh MAIS ANTIGO chega DEPOIS da do MAIS NOVO, a UI fica com o dado do mais novo", async () => {
    const service = new QueuedDispatchesCampanhasAnalyticsService()
    render(renderWithProvider(service, <RaceTrigger />))

    // Fetch inicial do mount — resolve para sair do estado de loading perene.
    await waitFor(() => expect(service.dispatchesCalls.length).toBe(1))
    service.resolveDispatchesCall(0, 1)
    await waitFor(() => expect(screen.getByTestId("current-dispatch-id").textContent).toBe("page-1"))

    fireEvent.click(screen.getByText("select-team-a"))
    fireEvent.click(screen.getByText("refresh-now"))
    await waitFor(() => expect(service.dispatchesCalls.length).toBe(2))

    fireEvent.click(screen.getByText("select-team-b"))
    fireEvent.click(screen.getByText("refresh-now"))
    await waitFor(() => expect(service.dispatchesCalls.length).toBe(3))

    // Resolve o MAIS NOVO (índice 2, team-b) primeiro, com uma página
    // identificável (100); depois o MAIS ANTIGO (índice 1, team-a) chega
    // atrasado, com a página 99 — não pode sobrescrever o resultado atual.
    service.resolveDispatchesCall(2, 100)
    await waitFor(() => expect(screen.getByTestId("current-dispatch-id").textContent).toBe("page-100"))

    service.resolveDispatchesCall(1, 99)
    // Dá tempo para um possível overwrite indevido acontecer antes de checar.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.getByTestId("current-dispatch-id").textContent).toBe("page-100")
  })
})
