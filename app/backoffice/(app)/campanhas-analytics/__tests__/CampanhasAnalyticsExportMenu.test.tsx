import { afterEach, beforeAll, describe, expect, it } from "bun:test"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { CampanhasAnalyticsExportMenu } from "../features/components/CampanhasAnalyticsExportMenu"
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
