import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { TeamWebhookLogItem } from "../services/ITeamWebhooksService"

const getById = mock(async () => ({
  id: "webhook-1",
  direction: "outbound" as const,
  status: "active" as const,
  name: "Lead criado",
  targetUrl: "https://example.com/events",
  destinationPreset: "generic" as const,
  selectedEvents: ["lead_created" as const],
  failureStreak: 0,
  failureThreshold: 10,
  lastUsedAt: null,
  lastSuccessAt: null,
  lastFailureAt: null,
  pausedAt: null,
  pauseReason: null,
  tokenPreview: null,
  expiryMode: null,
  expiresAt: null,
  webhookUrl: null,
  createdAt: "2026-09-24T20:00:00.000Z",
  updatedAt: "2026-09-24T20:00:00.000Z",
}))
type LogsPage = { items: TeamWebhookLogItem[]; total: number; page: number; pageSize: number }
type LogsQuery = { page?: number; pageSize?: number }
const listLogs = mock(
  async (
    _supabaseId: string,
    _teamId: string,
    _webhookId: string,
    params: LogsQuery,
  ): Promise<LogsPage> => ({
    items: [],
    total: 0,
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 20,
  }),
)
const resendLog = mock(async () => ({ ok: true, statusCode: 200, errorMessage: null }))

const originalLog = {
  id: "log-original",
  teamId: "team-1",
  webhookId: "webhook-1",
  direction: "outbound" as const,
  result: "failure" as const,
  eventKey: "lead_created" as const,
  method: "POST",
  endpoint: "https://example.com/events",
  statusCode: 503,
  requestPayload: { id: "event-original", type: "lead_created" },
  responsePayload: { unavailable: true },
  errorMessage: "HTTP 503",
  createdAt: "2026-09-24T22:20:00.000Z",
}

mock.module("@/app/context/TeamContext", () => ({
  useTeamContext: () => ({ activeTeam: { id: "team-1" } }),
}))
mock.module("@/app/context/TimezoneContext", () => ({
  useTimezone: () => ({ tz: "America/Sao_Paulo" }),
}))
mock.module("../services/TeamWebhooksService", () => ({
  teamWebhooksService: {
    getById,
    listLogs,
    update: mock(async () => null),
    changeStatus: mock(async () => null),
    testDelivery: mock(async () => null),
    resendLog,
  },
}))

const { WebhookDetailContainer } = await import("./WebhookDetailContainer")

let intervalCallback: (() => void) | null = null
const originalSetInterval = window.setInterval
const originalClearInterval = window.clearInterval
const clearIntervalMock = mock((_id: number) => undefined)

beforeEach(() => {
  getById.mockClear()
  listLogs.mockClear()
  listLogs.mockImplementation(async (_supabaseId, _teamId, _webhookId, params) => ({
    items: [],
    total: 0,
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 20,
  }))
  resendLog.mockClear()
  resendLog.mockImplementation(async () => ({ ok: true, statusCode: 200, errorMessage: null }))
  intervalCallback = null
  clearIntervalMock.mockClear()
  window.setInterval = mock((callback: TimerHandler, delay?: number) => {
    if (delay === 10_000) intervalCallback = callback as () => void
    return 77
  }) as unknown as typeof window.setInterval
  window.clearInterval = clearIntervalMock as typeof window.clearInterval
})

afterEach(() => {
  window.setInterval = originalSetInterval
  window.clearInterval = originalClearInterval
})

describe("WebhookDetailContainer", () => {
  test("consulta logs ao abrir a aba, atualiza por polling e cancela ao sair", async () => {
    render(
      <WebhookDetailContainer supabaseId="supabase-1" webhookId="webhook-1" direction="outbound" />,
    )

    await screen.findByRole("heading", { name: "Lead criado" })
    expect(listLogs).toHaveBeenCalledTimes(0)

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Logs" }), { button: 0, ctrlKey: false })
    await waitFor(() => expect(listLogs).toHaveBeenCalledTimes(1))
    expect(intervalCallback).not.toBeNull()

    await act(async () => {
      intervalCallback?.()
    })
    await waitFor(() => expect(listLogs).toHaveBeenCalledTimes(2))

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Configuração" }), {
      button: 0,
      ctrlKey: false,
    })
    expect(clearIntervalMock).toHaveBeenCalledWith(77)
  })

  test("mantém a paginação e consulta a próxima página sem recarregar a configuração", async () => {
    listLogs.mockImplementation(async (_supabaseId, _teamId, _webhookId, params) => ({
      items: [originalLog],
      total: 21,
      page: params.page ?? 1,
      pageSize: 20,
    }))
    render(
      <WebhookDetailContainer supabaseId="supabase-1" webhookId="webhook-1" direction="outbound" />,
    )

    await screen.findByRole("heading", { name: "Lead criado" })
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Logs" }), { button: 0, ctrlKey: false })
    await screen.findByText("Página 1 · 21 registro(s)")

    fireEvent.click(screen.getByRole("button", { name: "Próxima" }))

    await waitFor(() =>
      expect(listLogs).toHaveBeenLastCalledWith("supabase-1", "team-1", "webhook-1", {
        page: 2,
        pageSize: 20,
      }),
    )
    expect(getById).toHaveBeenCalledTimes(1)
  })

  test("reenvia qualquer tentativa e seleciona o novo registro criado", async () => {
    const resentLog = {
      ...originalLog,
      id: "log-resent",
      result: "success" as const,
      statusCode: 200,
      requestPayload: { id: "event-resent", type: "lead_created" },
      responsePayload: { accepted: true },
      errorMessage: null,
      createdAt: "2026-09-24T22:30:00.000Z",
    }
    listLogs
      .mockResolvedValueOnce({ items: [originalLog], total: 1, page: 1, pageSize: 20 })
      .mockResolvedValueOnce({ items: [resentLog, originalLog], total: 2, page: 1, pageSize: 20 })
    render(
      <WebhookDetailContainer supabaseId="supabase-1" webhookId="webhook-1" direction="outbound" />,
    )

    await screen.findByRole("heading", { name: "Lead criado" })
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Logs" }), { button: 0, ctrlKey: false })
    const resendButton = await screen.findByRole("button", { name: "Reenviar webhook" })
    fireEvent.click(resendButton)

    await waitFor(() =>
      expect(resendLog).toHaveBeenCalledWith("supabase-1", "team-1", "webhook-1", "log-original"),
    )
    expect(await screen.findByText(/"id": "event-resent"/)).toBeTruthy()
  })
})
