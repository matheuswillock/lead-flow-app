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
})
