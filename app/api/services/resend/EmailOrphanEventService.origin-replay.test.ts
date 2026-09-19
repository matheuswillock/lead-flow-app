import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { EmailOrphanEvent } from "@prisma/client"

/**
 * Evento órfão (open/clique que chegou antes do `EmailLog`) precisa voltar do
 * dreno COM a origem. Os sinais crus — user-agent e IP — só existem no payload
 * do webhook; o dreno roda minutos depois. Sem o carimbo persistido em
 * `originHint`, a abertura humana recuperada não reivindicava `humanOpenedAt`
 * nem entrava nos segmentos do Radar, que exigem
 * `metadata.origin.classification = 'human'`.
 *
 * O reforço por delta entrega→evento é reaplicado AQUI: no webhook o log não
 * existia, então a janela de pré-fetch não pôde ser avaliada.
 */

type OrphanRow = EmailOrphanEvent

const orphanRows: OrphanRow[] = []

const findManyMock = mock(async () => orphanRows)
const updateManyMock = mock(async () => ({ count: 1 }))
const updateMock = mock(async () => ({}))

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    emailOrphanEvent: {
      findMany: findManyMock,
      updateMany: updateManyMock,
      update: updateMock,
      upsert: mock(async () => ({})),
    },
  },
}))

const logRecord = {
  id: "log-1",
  teamId: "team-1",
  status: "delivered" as const,
  recipientEmail: "pessoa@example.com",
  recipientName: "Pessoa",
  campaignId: "camp-1",
  dispatchId: "disp-1",
  deliveredAt: new Date("2026-09-17T16:04:00.000Z"),
  openedAt: null as Date | null,
  clickedAt: null as Date | null,
  bouncedAt: null as Date | null,
  complainedAt: null as Date | null,
}

const findByResendEmailIdMock = mock(async () => logRecord)

mock.module("@/app/api/infra/data/repositories/emailLog/EmailLogRepository", () => ({
  emailLogRepository: { findByResendEmailId: findByResendEmailIdMock },
}))

const processEmailLogWebhookMock = mock(async () => true)

mock.module("@/app/api/services/resend/ResendWebhookService", () => ({
  resendWebhookService: {
    mapEventType: (type: string) => (type === "email.opened" ? "opened" : null),
    processEmailLogWebhook: processEmailLogWebhookMock,
  },
}))

mock.module("@/app/api/services/radar/RadarService", () => ({
  radarService: { handleEmailWebhookEvent: mock(async () => {}) },
}))

mock.module("@/app/api/useCases/email/EmailCampaignAudiencePruneUseCase", () => ({
  emailCampaignAudiencePruneUseCase: {
    queuePruneForSuppressedEmail: mock(() => {}),
    queuePruneForComplaint: mock(() => {}),
  },
}))

const { EmailOrphanEventService } = await import("./EmailOrphanEventService")

const publishRadarEventMock = mock(
  async (_payload: { metadata: Record<string, unknown> }) => ({ messageId: "mid-1" })
)

function buildService() {
  return new EmailOrphanEventService(
    {
      createOrphanTeamEmailLogFromResendEmail: mock(async () => null),
    } as never,
    publishRadarEventMock as never
  )
}

function queueRow(overrides: Partial<OrphanRow>): void {
  orphanRows.length = 0
  orphanRows.push({
    id: "orphan-1",
    resendEmailId: "re_1",
    resendEventType: "email.opened",
    occurredAt: new Date("2026-09-17T19:30:00.000Z"),
    tagsHint: null,
    originHint: null,
    status: "pending",
    attempts: 0,
    lastError: null,
    processedAt: null,
    createdAt: new Date("2026-09-17T19:30:00.000Z"),
    updatedAt: new Date("2026-09-17T19:30:00.000Z"),
    ...overrides,
  } as OrphanRow)
}

type ProcessCall = {
  metadata: Record<string, unknown>
  origin?: { classification: string; botSource?: string }
}

function lastProcessCall(): ProcessCall {
  return (processEmailLogWebhookMock.mock.calls[0] as unknown as [ProcessCall])[0]
}

describe("EmailOrphanEventService — origem no dreno do órfão", () => {
  beforeEach(() => {
    processEmailLogWebhookMock.mockClear()
    publishRadarEventMock.mockClear()
    updateMock.mockClear()
  })

  it("reaplica a origem humana carimbada no webhook ao evento recuperado", async () => {
    queueRow({
      originHint: { classification: "human", uaFamily: "outlook" } as never,
      occurredAt: new Date("2026-09-17T19:30:00.000Z"),
    })

    await buildService().processPendingBatch(1)

    const call = lastProcessCall()
    expect(call.origin?.classification).toBe("human")
    expect((call.metadata.origin as { classification: string }).classification).toBe("human")

    // O Radar recebe o mesmo metadata: é dele que sai o predicado
    // `metadata->'origin'->>'classification' = 'human'` dos segmentos.
    const [radarPayload] = publishRadarEventMock.mock.calls[0] as unknown as [
      { metadata: Record<string, unknown> },
    ]
    expect((radarPayload.metadata.origin as { classification: string }).classification).toBe("human")
  })

  it("rebaixa para bot quando o evento recuperado está dentro da janela de pré-fetch da entrega", async () => {
    // Entrega 16:04:00, abertura 16:04:05 — o webhook não podia saber disso
    // (sem log, sem deliveredAt); o dreno pode.
    queueRow({
      originHint: { classification: "human", uaFamily: "chrome" } as never,
      occurredAt: new Date("2026-09-17T16:04:05.000Z"),
    })

    await buildService().processPendingBatch(1)

    const call = lastProcessCall()
    expect(call.origin?.classification).toBe("bot")
    expect(call.origin?.botSource).toBe("generic")
  })

  it("linha antiga sem originHint segue sem origem, em vez de inventar classificação", async () => {
    queueRow({ originHint: null })

    await buildService().processPendingBatch(1)

    const call = lastProcessCall()
    expect(call.origin).toBeUndefined()
    expect(call.metadata).toEqual({})
  })
})
