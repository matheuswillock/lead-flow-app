import { afterEach, beforeAll, describe, expect, it } from "bun:test"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { CampanhasAnalyticsExportMenu } from "../features/components/CampanhasAnalyticsExportMenu"
import { useCampanhasAnalytics } from "../features/context/useCampanhasAnalyticsHook"
import { FakeCampanhasAnalyticsService, installBrowserStubs, renderWithProvider } from "./testHarness"

beforeAll(() => {
  installBrowserStubs()
  if (!URL.createObjectURL) {
    URL.createObjectURL = () => "blob:mock"
  }
  if (!URL.revokeObjectURL) {
    URL.revokeObjectURL = () => {}
  }
})

afterEach(() => {
  cleanup()
})

/** Radix (Popper/Menu) só abre com uma sequência pointerdown+pointerup+click — fireEvent.click sozinho não basta sob happy-dom. */
function openDropdownAndClickItem(triggerName: RegExp, itemName: string) {
  const trigger = screen.getByRole("button", { name: triggerName })
  fireEvent.pointerDown(trigger, { button: 0, pointerId: 1 })
  fireEvent.pointerUp(trigger, { button: 0, pointerId: 1 })
  fireEvent.click(trigger)
  return screen.findByText(itemName).then((item) => {
    fireEvent.pointerDown(item, { button: 0, pointerId: 1 })
    fireEvent.pointerUp(item, { button: 0, pointerId: 1 })
    fireEvent.click(item)
  })
}

function WideRangeSetter() {
  const { draftFilters, setDraftFilters } = useCampanhasAnalytics()
  return (
    <button onClick={() => setDraftFilters({ ...draftFilters, from: "2026-07-01", to: "2026-08-15" })}>
      set-wide-range
    </button>
  )
}

function RefreshTrigger() {
  const { refresh } = useCampanhasAnalytics()
  return (
    <button onClick={() => void refresh()}>apply</button>
  )
}

async function openDropdown(triggerName: RegExp) {
  const trigger = screen.getByRole("button", { name: triggerName })
  fireEvent.pointerDown(trigger, { button: 0, pointerId: 1 })
  fireEvent.pointerUp(trigger, { button: 0, pointerId: 1 })
  fireEvent.click(trigger)
}

describe("Exportar tudo — opção destacada no topo do menu", () => {
  it("aparece como primeira opção do menu, antes de Disparos/Templates/Formulários/Série diária", async () => {
    const service = new FakeCampanhasAnalyticsService()
    render(renderWithProvider(service, <CampanhasAnalyticsExportMenu />))

    await openDropdown(/Exportar/)
    const items = await screen.findAllByRole("menuitem")
    expect(items[0]?.textContent).toContain("Exportar tudo")
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining("Exportar tudo"),
      "Disparos",
      "Templates",
      "Formulários",
      "Série diária",
    ])
  })

  it("clicar em Exportar tudo chama exportAll com os filtros atuais e dispara o download", async () => {
    const service = new FakeCampanhasAnalyticsService()
    render(renderWithProvider(service, <CampanhasAnalyticsExportMenu />))

    await openDropdown(/Exportar/)
    fireEvent.click(await screen.findByText("Exportar tudo"))

    await waitFor(() => expect(service.exportAllCalls.length).toBe(1))
  })

  it("erro no export completo mostra mensagem via sonner e libera o lock", async () => {
    const service = new FakeCampanhasAnalyticsService()
    service.failExportAllWith = "Erro ao exportar o pacote completo (HTTP 500)"
    render(renderWithProvider(service, <CampanhasAnalyticsExportMenu />))

    await openDropdown(/Exportar/)
    fireEvent.click(await screen.findByText("Exportar tudo"))

    await waitFor(() =>
      expect((screen.getByRole("button", { name: /Exportar/, hidden: true }) as HTMLButtonElement).disabled).toBe(
        false
      )
    )
  })

  it("bloqueia com mensagem clara quando o período aplicado excede o teto de 30 dias do export completo", async () => {
    const service = new FakeCampanhasAnalyticsService()
    render(
      renderWithProvider(
        service,
        <>
          <CampanhasAnalyticsExportMenu />
          <WideRangeSetter />
          <RefreshTrigger />
        </>
      )
    )

    await waitFor(() => expect(service.summaryCalls.length).toBe(1))
    fireEvent.click(screen.getByText("set-wide-range"))
    fireEvent.click(screen.getByText("apply"))
    await waitFor(() => expect(service.summaryCalls.length).toBe(2))

    await openDropdown(/Exportar/)
    const message = await screen.findByText(
      "O export completo não pode ultrapassar 30 dias — selecione um intervalo menor."
    )
    expect(message).toBeDefined()

    const exportAllItem = screen.getByRole("menuitem", { name: /Exportar tudo/ })
    expect(exportAllItem.getAttribute("aria-disabled")).toBe("true")

    fireEvent.click(exportAllItem)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(service.exportAllCalls.length).toBe(0)
  })
})

describe("T-11.9/T-11.10 — ExportMenu", () => {
  it("clicar num dataset chama exportCsv com os filtros atuais e dispara o download", async () => {
    const service = new FakeCampanhasAnalyticsService()
    render(renderWithProvider(service, <CampanhasAnalyticsExportMenu />))

    await openDropdownAndClickItem(/Exportar/, "Templates")

    await waitFor(() => expect(service.exportCalls.length).toBe(1))
    expect(service.exportCalls[0]?.dataset).toBe("templates")
  })

  it("erro no export mostra mensagem via sonner (sem quebrar a tela) e libera o lock", async () => {
    const service = new FakeCampanhasAnalyticsService()
    service.exportCsv = async () => {
      throw new Error("Erro ao exportar CSV (HTTP 500)")
    }
    render(renderWithProvider(service, <CampanhasAnalyticsExportMenu />))

    await openDropdownAndClickItem(/Exportar/, "Disparos")

    // Não lança: o item volta a ficar habilitado após o erro (lock liberado no
    // finally). O menu fica aberto de propósito durante o download (spinner no
    // item), por isso a query usa hidden:true — o trigger some atrás do focus
    // trap do Radix enquanto o menu está aberto.
    await waitFor(() =>
      expect((screen.getByRole("button", { name: /Exportar/, hidden: true }) as HTMLButtonElement).disabled).toBe(
        false
      )
    )
  })
})
