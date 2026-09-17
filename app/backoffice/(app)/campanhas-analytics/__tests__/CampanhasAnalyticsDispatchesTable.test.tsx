import { afterEach, beforeAll, describe, expect, it } from "bun:test"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { CampanhasAnalyticsDispatchesTable } from "../features/components/CampanhasAnalyticsDispatchesTable"
import {
  FakeCampanhasAnalyticsService,
  installBrowserStubs,
  makeDispatchPage,
  makeDispatchRow,
  renderWithProvider,
} from "./testHarness"

beforeAll(() => {
  installBrowserStubs()
})

afterEach(() => {
  cleanup()
})

describe("T-11.7 — paginação da DispatchesTable pede a página certa ao service", () => {
  it("clicar em Próxima chama o service com page: 2", async () => {
    const service = new FakeCampanhasAnalyticsService({
      dispatches: makeDispatchPage({ rows: [makeDispatchRow()], total: 60, page: 1, pageSize: 25 }),
    })
    render(renderWithProvider(service, <CampanhasAnalyticsDispatchesTable />))

    await waitFor(() => expect(service.dispatchesCalls.length).toBe(1))
    expect(service.dispatchesCalls[0]?.page).toBe(1)

    const nextButton = await screen.findByRole("button", { name: "Próxima" })
    fireEvent.click(nextButton)

    await waitFor(() => expect(service.dispatchesCalls.length).toBe(2))
    expect(service.dispatchesCalls[1]?.page).toBe(2)
    expect(service.dispatchesCalls[1]?.pageSize).toBe(25)
  })

  it("T-11.8 — mostra Badge destrutivo para status failed", async () => {
    const service = new FakeCampanhasAnalyticsService({
      dispatches: makeDispatchPage({ rows: [makeDispatchRow({ id: "d-failed", status: "failed", errorMessage: "SMTP timeout" })] }),
    })
    render(renderWithProvider(service, <CampanhasAnalyticsDispatchesTable />))

    const failedBadge = await screen.findByText("Falhou")
    expect(failedBadge.className).toContain("bg-destructive")
    expect(screen.getByText("SMTP timeout")).toBeDefined()
  })
})
