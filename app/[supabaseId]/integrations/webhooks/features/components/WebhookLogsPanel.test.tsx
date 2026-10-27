import { describe, expect, mock, test } from "bun:test"
import { fireEvent, render, screen } from "@testing-library/react"
import { WebhookLogsPanel } from "./WebhookLogsPanel"
import type { TeamWebhookLogItem } from "../services/ITeamWebhooksService"

const logs: TeamWebhookLogItem[] = [
  {
    id: "log-success",
    teamId: "team-1",
    webhookId: "webhook-1",
    direction: "outbound",
    result: "success",
    eventKey: "lead_created",
    method: "POST",
    endpoint: "https://example.com/current",
    statusCode: 200,
    requestPayload: { type: "lead_created", data: { lead_id: "lead-1" } },
    responsePayload: { accepted: true },
    errorMessage: null,
    createdAt: "2026-09-24T22:25:26.000Z",
  },
  {
    id: "log-failure",
    teamId: "team-1",
    webhookId: "webhook-1",
    direction: "outbound",
    result: "failure",
    eventKey: "lead_created",
    method: "POST",
    endpoint: "https://example.com/current",
    statusCode: 503,
    requestPayload: { type: "lead_created", data: { lead_id: "lead-2" } },
    responsePayload: { unavailable: true },
    errorMessage: "HTTP 503",
    createdAt: "2026-09-24T22:20:26.000Z",
  },
]

describe("WebhookLogsPanel", () => {
  test("exibe detalhes do registro selecionado e permite reenviar sucesso ou falha", () => {
    const onResend = mock((_log: TeamWebhookLogItem) => undefined)
    const onSelect = mock((_logId: string) => undefined)
    render(
      <WebhookLogsPanel
        logs={logs}
        selectedLogId="log-success"
        timezone="America/Sao_Paulo"
        isLoading={false}
        isRefreshing={false}
        resendingLogId={null}
        canResend
        onSelect={onSelect}
        onRefresh={mock(() => undefined)}
        onResend={onResend}
      />,
    )

    expect(screen.getByText("Conteúdo da requisição")).toBeTruthy()
    expect(screen.getByText(/"lead_id": "lead-1"/)).toBeTruthy()
    expect(screen.getAllByRole("button", { name: "Reenviar webhook" })).toHaveLength(2)

    fireEvent.click(screen.getAllByRole("button", { name: "Reenviar webhook" })[1]!)

    expect(onResend).toHaveBeenCalledWith(logs[1])

    fireEvent.click(screen.getByText("24/09/2026 19:20:26"))
    expect(onSelect).toHaveBeenCalledWith("log-failure")
  })

  test("informa quando um registro legado não pode ser reenviado", () => {
    render(
      <WebhookLogsPanel
        logs={[{ ...logs[0]!, requestPayload: null }]}
        selectedLogId="log-success"
        timezone="America/Sao_Paulo"
        isLoading={false}
        isRefreshing={false}
        resendingLogId={null}
        canResend
        onSelect={mock(() => undefined)}
        onRefresh={mock(() => undefined)}
        onResend={mock(() => undefined)}
      />,
    )

    expect(
      screen
        .getByRole("button", { name: "Reenvio indisponível: registro sem payload" })
        .hasAttribute("disabled"),
    ).toBe(true)
  })

  test("webhook v2: mostra o rótulo do resultado, o selo de remarcação e o link do lead", () => {
    const conflict: TeamWebhookLogItem = {
      id: "log-conflict",
      teamId: "team-1",
      webhookId: "webhook-v2",
      direction: "inbound",
      result: "success",
      eventKey: null,
      method: null,
      endpoint: null,
      statusCode: null,
      requestPayload: { lead: { name: "Maria" } },
      responsePayload: {
        event_id: "11111111-2222-3333-4444-555555555555",
        result_code: "schedule_conflict_flagged",
        lead_id: "lead-9",
        lead_code: "AB12CD",
        idempotency_key_reused: true,
      },
      errorMessage: null,
      createdAt: "2026-10-27T14:00:00.000Z",
    }

    render(
      <WebhookLogsPanel
        logs={[conflict]}
        selectedLogId="log-conflict"
        timezone="America/Sao_Paulo"
        isLoading={false}
        isRefreshing={false}
        resendingLogId={null}
        canResend={false}
        supabaseId="sid-1"
        onSelect={mock(() => undefined)}
        onRefresh={mock(() => undefined)}
        onResend={mock(() => undefined)}
      />,
    )

    expect(screen.getByText("Horário ocupado: remarcar")).toBeTruthy()
    expect(screen.getByText(/evento 11111111 · reenvio/)).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Ver detalhes" }))

    expect(screen.getByText("Remarcar urgente")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Abrir lead no CRM" }).getAttribute("href")).toBe(
      "/sid-1/crm?leadCode=AB12CD",
    )
  })

  test("webhook de entrada: 'Ver detalhes' abre o Sheet com o payload ou o estado sem dados", () => {
    const base = {
      teamId: "team-1",
      webhookId: "webhook-in",
      direction: "inbound" as const,
      eventKey: null,
      method: "POST",
      endpoint: null,
      createdAt: "2026-10-27T14:00:00.000Z",
    }
    const withPayload: TeamWebhookLogItem = {
      ...base,
      id: "in-ok",
      result: "success",
      statusCode: 202,
      requestPayload: { name: "Lead", email: "l***@e***.test" },
      responsePayload: null,
      errorMessage: null,
    }
    const withoutPayload: TeamWebhookLogItem = {
      ...base,
      id: "in-rejected",
      result: "rejected",
      statusCode: 429,
      requestPayload: null,
      responsePayload: null,
      errorMessage: "Limite de requisições do webhook excedido",
    }

    render(
      <WebhookLogsPanel
        logs={[withPayload, withoutPayload]}
        selectedLogId="in-ok"
        timezone="America/Sao_Paulo"
        isLoading={false}
        isRefreshing={false}
        resendingLogId={null}
        canResend={false}
        onSelect={mock(() => undefined)}
        onRefresh={mock(() => undefined)}
        onResend={mock(() => undefined)}
      />,
    )

    const buttons = screen.getAllByRole("button", { name: "Ver detalhes" })
    expect(buttons).toHaveLength(2)

    fireEvent.click(buttons[0]!)
    expect(screen.getByText("Detalhe do log")).toBeTruthy()
    expect(screen.getByText("Payload da requisição")).toBeTruthy()

    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" })
  })
})
