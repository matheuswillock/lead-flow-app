import { afterEach, describe, expect, it } from "bun:test"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { BackofficeBethaniaProvider } from "./BackofficeBethaniaContext"
import { BackofficeBethaniaOverview } from "./BackofficeBethaniaOverview"
import type { BackofficeBethaniaServiceContract } from "./BackofficeBethaniaTypes"

const event = {
  eventType: "schedule.created_or_rescheduled",
  description: "Agendamento criado ou reagendado",
  paused: false,
}

function fakeService(): BackofficeBethaniaServiceContract & { calls: unknown[] } {
  const calls: unknown[] = []
  return {
    calls,
    getOverview: async () => ({
      paused: false,
      events: [event],
      sender: { configured: true, health: "healthy", webhookUrl: "https://sender.example.com/" },
    }),
    setSenderUrl: async (webhookUrl) => { calls.push({ senderUrl: webhookUrl }) },
    setPause: async (input) => { calls.push(input) },
    listLogs: async (input) => {
      calls.push(input)
      return {
        logs: [{ id: "log-1", eventType: event.eventType, status: "failed", errorCode: "HTTP_503", createdAt: "2026-11-23T12:00:00.000Z", attempts: 2 }],
        page: 1,
        pageSize: 25,
        total: 1,
      }
    },
  }
}

afterEach(cleanup)

describe("BackofficeBethaniaOverview", () => {
  it("exibe estado, saúde, URL não exposta, controles de evento e logs filtrados", async () => {
    const service = fakeService()
    render(<BackofficeBethaniaProvider service={service}><BackofficeBethaniaOverview /></BackofficeBethaniaProvider>)

    expect(await screen.findByText("Bethânia está ativa")).toBeDefined()
    expect(screen.getByText("Conector saudável")).toBeDefined()
    expect(screen.getByRole("textbox", { name: "URL do webhook" })).toHaveProperty("value", "https://sender.example.com/")
    expect(screen.getAllByText(event.description).length).toBeGreaterThan(0)
    expect(await screen.findByText(/HTTP_503/)).toBeDefined()

    fireEvent.click(screen.getByRole("switch", { name: "Pausar agendamento criado ou reagendado" }))
    await waitFor(() => expect(service.calls).toContainEqual({ scope: "event", eventType: event.eventType, paused: true }))
    expect(service.calls).toContainEqual({ eventType: event.eventType, page: 1, pageSize: 25 })
  })

  it("paginates the event log with the API page size", async () => {
    const service = fakeService()
    service.listLogs = async (input) => {
      service.calls.push(input)
      return {
        logs: [{ id: `log-${input.page}`, eventType: event.eventType, status: "sent", errorCode: null, createdAt: "2026-11-23T12:00:00.000Z", attempts: 1 }],
        page: input.page,
        pageSize: input.pageSize,
        total: 26,
      }
    }
    render(<BackofficeBethaniaProvider service={service}><BackofficeBethaniaOverview /></BackofficeBethaniaProvider>)
    fireEvent.click(await screen.findByRole("button", { name: "Próxima página" }))
    await waitFor(() => expect(service.calls).toContainEqual({ eventType: event.eventType, page: 2, pageSize: 25 }))
  })

  it("allows saving an editable, non-secret webhook URL", async () => {
    const service = fakeService()
    render(<BackofficeBethaniaProvider service={service}><BackofficeBethaniaOverview /></BackofficeBethaniaProvider>)
    const urlInput = await screen.findByRole("textbox", { name: "URL do webhook" })
    fireEvent.change(urlInput, { target: { value: "https://new-sender.example.com" } })
    fireEvent.click(screen.getByRole("button", { name: "Salvar URL" }))
    await waitFor(() => expect(service.calls).toContainEqual({ senderUrl: "https://new-sender.example.com" }))
  })

  it("preserves navigation links to the existing Studio Bot screens", async () => {
    const service = fakeService()
    render(<BackofficeBethaniaProvider service={service}><BackofficeBethaniaOverview /></BackofficeBethaniaProvider>)

    const nav = await screen.findByRole("navigation", { name: "Navegação do Studio Bot" })
    expect(nav).toBeDefined()
    for (const [name, href] of [
      ["Gerenciar canal", "/backoffice/studio-bot/canal"],
      ["Ver vinculações", "/backoffice/studio-bot/vinculacoes"],
      ["Abrir inbox", "/backoffice/studio-bot/conversas"],
      ["Auditoria de verificações", "/backoffice/studio-bot/verificacoes"],
      ["Ops / Host", "/backoffice/studio-bot/ops"],
      ["IA", "/backoffice/studio-bot/ia"],
    ]) {
      expect(screen.getByRole("link", { name }).getAttribute("href")).toBe(href)
    }
  })
})
