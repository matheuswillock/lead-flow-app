import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import { WebhookInboundV2Guide } from "./WebhookInboundV2Guide"

afterEach(cleanup)

describe("WebhookInboundV2Guide", () => {
  test("mostra a URL do próprio webhook nos exemplos e o link para o Catálogo de API", () => {
    const url = "https://app.test/api/webhooks/studio/v2/team-1"

    render(<WebhookInboundV2Guide webhookUrl={url} apiCatalogHref="/sid/integrations/api-catalog" />)

    expect(screen.getByLabelText("Exemplo sem agendamento").textContent).toContain(url)
    expect(screen.getByLabelText("Exemplo com agendamento").textContent).toContain(url)
    for (const link of screen.getAllByRole("link", { name: "Catálogo de API" })) {
      expect(link.getAttribute("href")).toBe("/sid/integrations/api-catalog")
    }
  })

  test("nunca exibe um token: só o placeholder", () => {
    render(<WebhookInboundV2Guide webhookUrl={null} apiCatalogHref="/x" />)

    expect(screen.getByLabelText("Exemplo sem agendamento").textContent).toContain("Bearer SEU_TOKEN_DO_WEBHOOK")
  })

  test("avisa que a duração vem do time e que duration_minutes é ignorado", () => {
    render(<WebhookInboundV2Guide webhookUrl={null} apiCatalogHref="/x" />)

    expect(screen.getByText(/configurada no time/)).toBeTruthy()
  })
})
