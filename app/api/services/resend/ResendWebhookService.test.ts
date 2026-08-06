import { describe, expect, it, mock, beforeEach } from "bun:test"
import { ResendWebhookService } from "./ResendWebhookService"
import type { IEmailLogRepository, EmailLogWebhookRecord } from "@/app/api/infra/data/repositories/emailLog/IEmailLogRepository"
import type { EmailEventType } from "@prisma/client"

// ResendWebhookService aceita IEmailLogRepository pelo construtor — sem mock.module necessário

// ---------- helpers ----------

function makeRepo(
  overrides: Partial<IEmailLogRepository> = {}
): IEmailLogRepository {
  return {
    hasDuplicateEvent: mock(async () => false),
    applyWebhookEvent: mock(async () => {}),
    // stubs mínimos para satisfazer o tipo
    createQueuedLog: mock(async () => {}),
    createManyQueuedLogs: mock(async () => {}),
    markSent: mock(async () => {}),
    markManySent: mock(async () => {}),
    markFailed: mock(async () => {}),
    findByResendEmailId: mock(async () => null),
    ...overrides,
  } as unknown as IEmailLogRepository
}

function makeLog(overrides: Partial<EmailLogWebhookRecord> = {}): EmailLogWebhookRecord {
  return {
    id: "log-1",
    teamId: "team-1",
    status: "sent",
    recipientEmail: "r@test.com",
    recipientName: "R",
    campaignId: "camp-1",
    dispatchId: "disp-1",
    deliveredAt: null,
    openedAt: null,
    clickedAt: null,
    bouncedAt: null,
    complainedAt: null,
    ...overrides,
  }
}

// ---------- mapEventType ----------

describe("ResendWebhookService.mapEventType", () => {
  const service = new ResendWebhookService(makeRepo())

  const mappings: Array<[string, EmailEventType | null]> = [
    ["email.sent", "sent"],
    ["email.delivered", "delivered"],
    ["email.opened", "opened"],
    ["email.clicked", "clicked"],
    ["email.bounced", "bounced"],
    ["email.complained", "complained"],
    ["email.delivery_delayed", "delivery_delayed"],
    ["email.unsubscribed", "unsubscribed"],
    ["email.failed", "failed"],
    ["email.unknown_event", null],
    ["", null],
    ["unknown", null],
  ]

  for (const [input, expected] of mappings) {
    it(`W1 — "${input}" → ${expected === null ? "null" : `"${expected}"`}`, () => {
      expect(service.mapEventType(input)).toBe(expected)
    })
  }
})

// ---------- processEmailLogWebhook ----------

describe("ResendWebhookService.processEmailLogWebhook", () => {
  let hasDuplicateEventMock: ReturnType<typeof mock>
  let applyWebhookEventMock: ReturnType<typeof mock>
  let service: ResendWebhookService

  beforeEach(() => {
    hasDuplicateEventMock = mock(async () => false)
    applyWebhookEventMock = mock(async () => {})
    service = new ResendWebhookService(
      makeRepo({
        hasDuplicateEvent: hasDuplicateEventMock as unknown as IEmailLogRepository["hasDuplicateEvent"],
        applyWebhookEvent: applyWebhookEventMock as unknown as IEmailLogRepository["applyWebhookEvent"],
      })
    )
  })

  it("W2 — evento duplicado: hasDuplicateEvent=true → applyWebhookEvent NÃO chamado; retorna true", async () => {
    hasDuplicateEventMock.mockResolvedValueOnce(true)

    const result = await service.processEmailLogWebhook({
      log: makeLog(),
      eventType: "delivered",
      occurredAt: new Date(),
      metadata: {},
      resendEventType: "email.delivered",
      svixId: null,
    })

    expect(result).toBe(true)
    expect(applyWebhookEventMock).not.toHaveBeenCalled()
  })

  it("W3 — evento novo com svixId: applyWebhookEvent chamado com svixId no metadata", async () => {
    await service.processEmailLogWebhook({
      log: makeLog(),
      eventType: "delivered",
      occurredAt: new Date(),
      metadata: {},
      resendEventType: "email.delivered",
      svixId: "svix-123",
    })

    expect(applyWebhookEventMock).toHaveBeenCalledTimes(1)
    const input = (applyWebhookEventMock.mock.calls[0] as [{ metadata: Record<string, unknown> }])[0]
    expect(input.metadata.svixId).toBe("svix-123")
  })

  it("W4 — svixId null: svixId ausente do metadata passado para applyWebhookEvent", async () => {
    await service.processEmailLogWebhook({
      log: makeLog(),
      eventType: "opened",
      occurredAt: new Date(),
      metadata: {},
      resendEventType: "email.opened",
      svixId: null,
    })

    expect(applyWebhookEventMock).toHaveBeenCalledTimes(1)
    const input = (applyWebhookEventMock.mock.calls[0] as [{ metadata: Record<string, unknown> }])[0]
    expect("svixId" in input.metadata).toBe(false)
  })

  it("W5 — retorna true após applyWebhookEvent bem-sucedido", async () => {
    const result = await service.processEmailLogWebhook({
      log: makeLog(),
      eventType: "clicked",
      occurredAt: new Date(),
      metadata: {},
      resendEventType: "email.clicked",
      svixId: null,
    })

    expect(result).toBe(true)
  })

  it("W6 — applyWebhookEvent recebe o eventType correto", async () => {
    await service.processEmailLogWebhook({
      log: makeLog(),
      eventType: "bounced",
      occurredAt: new Date(),
      metadata: {},
      resendEventType: "email.bounced",
      svixId: null,
    })

    const input = (applyWebhookEventMock.mock.calls[0] as [{ eventType: string }])[0]
    expect(input.eventType).toBe("bounced")
  })

  it("E5 — webhook duplicado (mesmo logId+type+occurredAt): applyWebhookEvent não lança; retorna true (HTTP 200)", async () => {
    const occurredAt = new Date("2026-08-05T12:00:00.000Z")
    const payload = {
      log: makeLog(),
      eventType: "delivered" as const,
      occurredAt,
      metadata: {},
      resendEventType: "email.delivered",
      svixId: null,
    }

    // Primeira entrega grava o evento.
    const first = await service.processEmailLogWebhook(payload)
    expect(first).toBe(true)

    // Race / reentrega Resend: hasDuplicateEvent ainda false, mas upsert no repo é no-op sem throw.
    hasDuplicateEventMock.mockResolvedValueOnce(false)
    applyWebhookEventMock.mockImplementation(async () => {
      // Simula EmailLogRepository.applyWebhookEvent com upsert update: {} — sem P2002.
    })

    await expect(service.processEmailLogWebhook(payload)).resolves.toBe(true)
    expect(applyWebhookEventMock).toHaveBeenCalled()
  })
})
