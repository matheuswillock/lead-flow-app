import { afterEach, beforeAll, describe, expect, it } from "bun:test"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { BackofficeCronExecutionsFiltersBar } from "../features/components/BackofficeCronExecutionsFiltersBar"
import { BackofficeCronExecutionsTable } from "../features/components/BackofficeCronExecutionsTable"
import { BackofficeCronExecutionDetailsSheet } from "../features/components/BackofficeCronExecutionDetailsSheet"
import { useCronExecutions } from "../features/context/useCronExecutionsHook"
import {
  FakeCronExecutionsService,
  QueuedCronExecutionsService,
  installBrowserStubs,
  makeExecution,
  renderWithProvider,
} from "./testHarness"

beforeAll(() => {
  installBrowserStubs()
})

afterEach(() => {
  cleanup()
})

const EXECUTIONS = [
  makeExecution({
    id: "a",
    cronKey: "radar-import",
    status: "failed",
    errorSummary: "Transaction API error",
    errorDetail: "PrismaClientKnownRequestError: P2028 stack",
  }),
  makeExecution({
    id: "b",
    cronKey: "webhook-outbox",
    cronPath: "/cron/webhook-outbox",
    status: "success",
  }),
  makeExecution({
    id: "c",
    cronKey: "evaluate-idle",
    cronPath: "/cron/evaluate-idle",
    status: "running",
    durationMs: null,
  }),
]

function renderScreen(executions = EXECUTIONS) {
  const service = new FakeCronExecutionsService(executions)
  const utils = render(
    renderWithProvider(
      service,
      <>
        <BackofficeCronExecutionsFiltersBar />
        <BackofficeCronExecutionsTable />
        <BackofficeCronExecutionDetailsSheet />
      </>
    )
  )
  return { ...utils, service }
}

/**
 * Os cabeçalhos ordenáveis da tabela ("Cron", "Status") têm o mesmo nome
 * acessível dos gatilhos de filtro; o gatilho é o que abre um popover.
 */
function getFilterTrigger(name: RegExp): HTMLElement {
  const trigger = screen
    .getAllByRole("button", { name })
    .find((button) => button.getAttribute("aria-haspopup") === "dialog")
  if (!trigger) throw new Error(`Gatilho de filtro não encontrado para ${name}`)
  return trigger
}

function getBodyRows(): HTMLElement[] {
  const rowGroups = screen.getAllByRole("rowgroup")
  const body = rowGroups[rowGroups.length - 1] as HTMLElement
  return within(body).queryAllByRole("row")
}

describe("T9 — lista vazia", () => {
  it("mostra o estado vazio padrão da tabela", async () => {
    renderScreen([])
    expect(await screen.findByText("Nenhum resultado encontrado.")).toBeDefined()
  })
})

describe("T10 — carregando", () => {
  it("mostra linhas de Skeleton enquanto a requisição não resolve", () => {
    const service = new FakeCronExecutionsService([], { never: true })
    const { container } = render(
      renderWithProvider(service, <BackofficeCronExecutionsTable />)
    )

    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0)
    expect(screen.queryByText("Nenhum resultado encontrado.")).toBeNull()
  })
})

describe("T11 — badges de status", () => {
  it("renderiza Sucesso, Falhou e Executando com tokens semânticos", async () => {
    renderScreen()

    const failed = await screen.findByText("Falhou")
    expect(screen.getByText("Sucesso")).toBeDefined()
    expect(screen.getByText("Executando")).toBeDefined()

    expect(failed.className).toContain("text-destructive")
    expect(failed.className).not.toMatch(/dark:/)
    expect(failed.className).not.toMatch(/(blue|green|red|gray)-\d/)
  })
})

describe("T12 — sheet de detalhes", () => {
  it("abre o Sheet ao clicar em Ver detalhes, com corpo rolável e rodapé fixo", async () => {
    renderScreen()

    const rows = await waitFor(() => {
      const found = getBodyRows()
      expect(found.length).toBe(3)
      return found
    })

    const failedRow = rows.find((row) => within(row).queryByText("radar-import"))
    expect(failedRow).toBeDefined()

    fireEvent.click(within(failedRow as HTMLElement).getByRole("button", { name: "Ver detalhes" }))

    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("Detalhes da execução")).toBeDefined()
    expect(within(dialog).getByText("PrismaClientKnownRequestError: P2028 stack")).toBeDefined()
    expect(within(dialog).getByRole("button", { name: "Fechar" })).toBeDefined()

    // Regra do CLAUDE.md: overlay com altura limitada, corpo rolável e rodapé fora do scroll.
    expect(dialog.className).toContain("flex")
    expect(dialog.className).toContain("flex-col")
    expect(dialog.className).toContain("max-h-[100dvh]")
    expect(dialog.querySelectorAll(".overflow-y-auto.flex-1").length).toBe(1)
  })
})

describe("T13 — filtro multi-seleção por cron", () => {
  it("filtra a tabela e exibe badge de contagem no trigger", async () => {
    renderScreen()
    await waitFor(() => expect(getBodyRows().length).toBe(3))

    fireEvent.click(getFilterTrigger(/^Cron/))

    const listbox = await screen.findByRole("listbox")
    fireEvent.click(within(listbox).getByText("radar-import"))
    fireEvent.click(within(listbox).getByText("evaluate-idle"))

    await waitFor(() => expect(getBodyRows().length).toBe(2))
    // Escopo no corpo da tabela: o popover aberto também lista "webhook-outbox".
    const visibleCronKeys = getBodyRows().map((row) => row.textContent ?? "")
    expect(visibleCronKeys.some((text) => text.includes("webhook-outbox"))).toBe(false)

    const trigger = getFilterTrigger(/^Cron/)
    expect(within(trigger).getAllByText("2").length).toBeGreaterThan(0)
  })
})

describe("T14 — filtro multi-seleção por status", () => {
  it("filtra a tabela e exibe badge de contagem no trigger", async () => {
    renderScreen()
    await waitFor(() => expect(getBodyRows().length).toBe(3))

    fireEvent.click(getFilterTrigger(/^Status/))

    const listbox = await screen.findByRole("listbox")
    fireEvent.click(within(listbox).getByText("Falhou"))
    fireEvent.click(within(listbox).getByText("Executando"))

    await waitFor(() => expect(getBodyRows().length).toBe(2))

    const trigger = getFilterTrigger(/^Status/)
    expect(within(trigger).getAllByText("2").length).toBeGreaterThan(0)
  })
})

describe("T15 — filtro de período via Calendar", () => {
  it("seleciona um intervalo e refaz a consulta com startDate/endDate", async () => {
    const { service } = renderScreen()
    await waitFor(() => expect(service.calls.length).toBe(1))

    fireEvent.click(getFilterTrigger(/^Período/))

    const grid = await screen.findAllByRole("grid")
    const days = within(grid[0] as HTMLElement)
      .getAllByRole("button")
      .filter((day) => !(day as HTMLButtonElement).disabled)
    expect(days.length).toBeGreaterThan(1)

    fireEvent.click(days[0])
    fireEvent.click(days[1])

    await waitFor(() => expect(service.calls.length).toBe(2))
    const lastCall = service.calls[service.calls.length - 1]
    expect(lastCall?.startDate).toBeDefined()
    expect(lastCall?.endDate).toBeDefined()
  })
})

describe("T16 — visibilidade do botão Limpar", () => {
  it("só aparece quando há filtro ativo e some ao limpar", async () => {
    renderScreen()
    await waitFor(() => expect(getBodyRows().length).toBe(3))

    expect(screen.queryByRole("button", { name: /^Limpar/ })).toBeNull()

    fireEvent.change(screen.getByPlaceholderText("Filtrar por cron, rota ou erro..."), {
      target: { value: "radar" },
    })

    const clearButton = await screen.findByRole("button", { name: /^Limpar/ })
    await waitFor(() => expect(getBodyRows().length).toBe(1))

    fireEvent.click(clearButton)

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /^Limpar/ })).toBeNull()
    )
    expect(getBodyRows().length).toBe(3)
  })
})

describe("T17 — descarta respostas obsoletas ao trocar o período rapidamente", () => {
  function PeriodSwitcher() {
    const { setFilters } = useCronExecutions()
    return (
      <>
        <button onClick={() => setFilters({ query: "", cronKeyFilter: [], statusFilter: [], periodStart: "2026-08-01", periodEnd: "2026-08-01" })}>
          period-a
        </button>
        <button onClick={() => setFilters({ query: "", cronKeyFilter: [], statusFilter: [], periodStart: "2026-08-02", periodEnd: "2026-08-02" })}>
          period-b
        </button>
      </>
    )
  }

  it("mantém o resultado da última requisição mesmo se a mais antiga resolver por último", async () => {
    const service = new QueuedCronExecutionsService()
    render(
      renderWithProvider(
        service,
        <>
          <PeriodSwitcher />
          <BackofficeCronExecutionsTable />
        </>
      )
    )

    // Requisição inicial (montagem) — índice 0.
    await waitFor(() => expect(service.calls.length).toBe(1))

    // Dispara a requisição de "period-a" (índice 1) e, antes dela resolver,
    // troca para "period-b" (índice 2) — duas requisições em voo.
    fireEvent.click(screen.getByText("period-a"))
    await waitFor(() => expect(service.calls.length).toBe(2))
    fireEvent.click(screen.getByText("period-b"))
    await waitFor(() => expect(service.calls.length).toBe(3))

    // A resposta mais antiga (period-a) resolve por último — deve ser
    // descartada em favor do resultado de period-b, que é o filtro atual.
    service.resolveCall(2, [makeExecution({ id: "b", cronKey: "webhook-outbox" })])
    await waitFor(() => expect(getBodyRows().length).toBe(1))
    service.resolveCall(1, [makeExecution({ id: "a", cronKey: "radar-import" })])

    // Dá tempo para um possível overwrite indevido acontecer antes de checar.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(getBodyRows().length).toBe(1)
    expect(screen.getByText("webhook-outbox")).toBeDefined()
    expect(screen.queryByText("radar-import")).toBeNull()
  })
})
