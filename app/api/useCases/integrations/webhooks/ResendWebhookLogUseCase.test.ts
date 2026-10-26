import { describe, expect, mock, test } from "bun:test"
import type { TeamWebhookEventLogRow } from "@/app/api/infra/data/repositories/teamWebhook/ITeamWebhookEventLogRepository"
import { ResendWebhookLogUseCase } from "./ResendWebhookLogUseCase"

const access = {
  profileId: "profile-1",
  teamId: "team-1",
} as never

const webhook = {
  id: "webhook-1",
  teamId: "team-1",
  direction: "outbound",
  status: "active",
  name: "Leads",
  targetUrl: "https://current.example.com/events",
  destinationPreset: "generic",
}

const originalLog: TeamWebhookEventLogRow = {
  id: "log-1",
  teamId: "team-1",
  webhookId: "webhook-1",
  direction: "outbound",
  result: "failure",
  eventKey: "lead_created",
  method: "POST",
  endpoint: "https://old.example.com/events",
  statusCode: 500,
  requestPayload: { id: "evt-1", type: "lead_created", data: { lead_id: "lead-1" } },
  responsePayload: { error: true },
  errorMessage: "HTTP 500",
  createdAt: new Date("2026-09-24T22:00:00.000Z"),
}

function createDependencies() {
  return {
    webhookRepository: {
      findByIdWithCtx: mock(async (): Promise<typeof webhook | null> => webhook),
      touchUsage: mock(async () => undefined),
    },
    eventLogRepository: {
      findById: mock(async (): Promise<TeamWebhookEventLogRow | null> => originalLog),
      create: mock(async () => undefined),
    },
    deliveryService: {
      deliver: mock(async () => ({
        ok: true,
        statusCode: 202,
        responseBody: { accepted: true },
        errorMessage: null,
      })),
    },
  }
}

describe("ResendWebhookLogUseCase", () => {
  test("reenvia o payload registrado para o destino atual e cria um novo log", async () => {
    const dependencies = createDependencies()
    const useCase = new ResendWebhookLogUseCase(
      dependencies.webhookRepository as never,
      dependencies.eventLogRepository as never,
      dependencies.deliveryService as never,
    )

    const output = await useCase.execute(access, "webhook-1", "log-1")

    expect(output.isValid).toBe(true)
    expect(output.result).toEqual({ ok: true, statusCode: 202, errorMessage: null })
    expect(dependencies.deliveryService.deliver).toHaveBeenCalledWith({
      targetUrl: "https://current.example.com/events",
      preset: "generic",
      body: originalLog.requestPayload,
    })
    expect(dependencies.eventLogRepository.create).toHaveBeenCalledWith({
      teamId: "team-1",
      webhookId: "webhook-1",
      direction: "outbound",
      result: "success",
      eventKey: "lead_created",
      method: "POST",
      endpoint: "https://current.example.com/events",
      statusCode: 202,
      requestPayload: originalLog.requestPayload,
      responsePayload: { accepted: true },
      errorMessage: null,
    })
    expect(dependencies.webhookRepository.touchUsage).toHaveBeenCalledWith("webhook-1", true)
  })

  test("registra uma nova falha sem transformar a tentativa executada em erro da API", async () => {
    const dependencies = createDependencies()
    dependencies.deliveryService.deliver.mockResolvedValueOnce({
      ok: false,
      statusCode: 503,
      responseBody: { unavailable: true },
      errorMessage: "HTTP 503",
    } as never)
    const useCase = new ResendWebhookLogUseCase(
      dependencies.webhookRepository as never,
      dependencies.eventLogRepository as never,
      dependencies.deliveryService as never,
    )

    const output = await useCase.execute(access, "webhook-1", "log-1")

    expect(output.isValid).toBe(true)
    expect(output.result).toEqual({ ok: false, statusCode: 503, errorMessage: "HTTP 503" })
    expect(dependencies.eventLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ result: "failure", errorMessage: "HTTP 503" }),
    )
    expect(dependencies.webhookRepository.touchUsage).toHaveBeenCalledWith("webhook-1", false)
  })

  test("permite reenvio manual quando o webhook está pausado", async () => {
    const dependencies = createDependencies()
    dependencies.webhookRepository.findByIdWithCtx.mockResolvedValueOnce({
      ...webhook,
      status: "paused",
    })
    const useCase = new ResendWebhookLogUseCase(
      dependencies.webhookRepository as never,
      dependencies.eventLogRepository as never,
      dependencies.deliveryService as never,
    )

    const output = await useCase.execute(access, "webhook-1", "log-1")

    expect(output.isValid).toBe(true)
    expect(dependencies.deliveryService.deliver).toHaveBeenCalledTimes(1)
  })

  test("bloqueia reenvio quando o webhook está desativado", async () => {
    const dependencies = createDependencies()
    dependencies.webhookRepository.findByIdWithCtx.mockResolvedValueOnce({
      ...webhook,
      status: "disabled",
    })
    const useCase = new ResendWebhookLogUseCase(
      dependencies.webhookRepository as never,
      dependencies.eventLogRepository as never,
      dependencies.deliveryService as never,
    )

    const output = await useCase.execute(access, "webhook-1", "log-1")

    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toEqual(["Ative o webhook antes de reenviar"])
    expect(dependencies.deliveryService.deliver).not.toHaveBeenCalled()
  })

  test("não encontra logs de outro webhook ou time", async () => {
    const dependencies = createDependencies()
    dependencies.eventLogRepository.findById.mockResolvedValueOnce(null)
    const useCase = new ResendWebhookLogUseCase(
      dependencies.webhookRepository as never,
      dependencies.eventLogRepository as never,
      dependencies.deliveryService as never,
    )

    const output = await useCase.execute(access, "webhook-1", "foreign-log")

    expect(output.isValid).toBe(false)
    expect(dependencies.eventLogRepository.findById).toHaveBeenCalledWith({
      id: "foreign-log",
      webhookId: "webhook-1",
      teamId: "team-1",
    })
    expect(dependencies.deliveryService.deliver).not.toHaveBeenCalled()
  })

  test("recusa registro legado sem payload", async () => {
    const dependencies = createDependencies()
    dependencies.eventLogRepository.findById.mockResolvedValueOnce({
      ...originalLog,
      requestPayload: null,
    })
    const useCase = new ResendWebhookLogUseCase(
      dependencies.webhookRepository as never,
      dependencies.eventLogRepository as never,
      dependencies.deliveryService as never,
    )

    const output = await useCase.execute(access, "webhook-1", "log-1")

    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toEqual(["Este registro não possui payload para reenvio"])
    expect(dependencies.deliveryService.deliver).not.toHaveBeenCalled()
  })
})
