import { afterEach, beforeAll, describe, expect, it } from "bun:test"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { CampanhasAnalyticsFiltersBar } from "../features/components/CampanhasAnalyticsFiltersBar"
import { useCampanhasAnalytics } from "../features/context/useCampanhasAnalyticsHook"
import { FakeCampanhasAnalyticsService, installBrowserStubs, renderWithProvider } from "./testHarness"

beforeAll(() => {
  installBrowserStubs()
})

afterEach(() => {
  cleanup()
})

function FilterSetter() {
  const { draftFilters, setDraftFilters } = useCampanhasAnalytics()
  return (
    <button
      onClick={() =>
        setDraftFilters({ ...draftFilters, from: "2026-01-01", to: "2026-12-31" })
      }
    >
      set-invalid-range
    </button>
  )
}

function TeamToggle() {
  const { draftFilters, setDraftFilters } = useCampanhasAnalytics()
  return (
    <button onClick={() => setDraftFilters({ ...draftFilters, teamIds: ["t1"] })}>
      toggle-team
    </button>
  )
}

/**
 * Chama `refresh()` duas vezes no mesmo handler síncrono, sem passar pelo
 * `disabled` do botão da FiltersBar — isola o guard de in-flight do Context
 * (`inFlightKeyRef`) do lock de UI (botão desabilitado durante isUpdating),
 * que por si só já impediria o duplo clique real.
 */
function DoubleRefreshTrigger() {
  const { refresh } = useCampanhasAnalytics()
  return (
    <button
      onClick={() => {
        void refresh()
        void refresh()
      }}
    >
      double-refresh
    </button>
  )
}

describe("T-11.1 — on-demand: filtro não busca, Atualizar busca, duplo-clique = 1 request", () => {
  it("mudar filtro não dispara request, e Atualizar dispara exatamente 1 request com a chave nova", async () => {
    const service = new FakeCampanhasAnalyticsService()
    render(
      renderWithProvider(
        service,
        <>
          <CampanhasAnalyticsFiltersBar />
          <TeamToggle />
        </>
      )
    )

    await waitFor(() => expect(service.summaryCalls.length).toBe(1))

    fireEvent.click(screen.getByText("toggle-team"))
    // Mudar o filtro (rascunho) não deve dispachar request nenhuma.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(service.summaryCalls.length).toBe(1)

    fireEvent.click(screen.getByRole("button", { name: /Atualizar/ }))
    await waitFor(() => expect(service.summaryCalls.length).toBe(2))
    expect(service.summaryCalls[1]?.teamIds).toEqual(["t1"])
  })

  it("guard de in-flight: chamar refresh() duas vezes em voo dispara só 1 request nova", async () => {
    const service = new FakeCampanhasAnalyticsService({ neverResolve: true })
    render(renderWithProvider(service, <DoubleRefreshTrigger />))

    // A fetch inicial do mount já está em voo (neverResolve trava o loading).
    await waitFor(() => expect(service.summaryCalls.length).toBe(1))

    fireEvent.click(screen.getByText("double-refresh"))

    // Sem o guard de in-flight (`inFlightKeyRef`), as duas chamadas síncronas
    // a refresh() dentro do mesmo handler disparariam 2 requests extras (key
    // igual, force:true) — com o guard, a segunda vê a mesma key já em voo e
    // é descartada. Ver "controle negativo" no resumo da sessão: comentar a
    // linha `if (inFlightKeyRef.current === key) return` em
    // CampanhasAnalyticsContext.tsx faz este assert falhar (2 em vez de 1).
    expect(service.summaryCalls.length).toBe(1)
  })
})

describe("T-11.2 — range > 92 dias bloqueia o botão Atualizar", () => {
  it("desabilita Atualizar e mostra a mensagem do backend quando o rascunho excede 92 dias", async () => {
    const service = new FakeCampanhasAnalyticsService()
    render(
      renderWithProvider(
        service,
        <>
          <CampanhasAnalyticsFiltersBar />
          <FilterSetter />
        </>
      )
    )

    await waitFor(() => expect(service.summaryCalls.length).toBe(1))

    fireEvent.click(screen.getByText("set-invalid-range"))

    const message = await screen.findByText(
      "O período não pode ultrapassar 92 dias — selecione um intervalo menor."
    )
    expect(message).toBeDefined()

    const button = screen.getByRole("button", { name: /Atualizar/ })
    expect((button as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(button)
    await new Promise((resolve) => setTimeout(resolve, 0))
    // Botão desabilitado (e o próprio refresh() valida de novo) — nenhuma request extra.
    expect(service.summaryCalls.length).toBe(1)
  })
})
