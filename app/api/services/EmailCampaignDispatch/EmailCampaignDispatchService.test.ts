import { describe, expect, it, mock, beforeEach } from "bun:test"

// ---------- mocks (antes de qualquer import do módulo) ----------

const batchSendMock = mock(async () => ({
  data: [] as Array<{ id?: string }>,
  error: null as null | { name: string; message: string; statusCode: number },
}))

mock.module("@/lib/email", () => ({
  resend: { batch: { send: batchSendMock } },
  buildResendBatchIdempotencyKey: (type: string, id: string) => `batch-${type}/${id}`,
}))

mock.module("@/lib/email/campaign-unsubscribe-footer", () => ({
  buildCampaignUnsubscribeUrl: () => "https://test.com/unsub/token",
  appendCampaignUnsubscribeFooter: (html: string) => html,
  buildListUnsubscribeHeaders: () => ({ "List-Unsubscribe": "<https://test.com/unsub>" }),
}))

const { parseResendBatchSendItems, EmailCampaignDispatchService } = await import(
  "./EmailCampaignDispatchService"
)

// ---------- helpers ----------

function makeRecipients(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    email: `r${i}@test.com`,
    name: `R${i}`,
    contactId: null as string | null,
    customFields: null as Record<string, unknown> | null,
  }))
}

function makeBaseParams(recipients = makeRecipients(3)) {
  return {
    from: "Test <test@sender.com>",
    replyTo: null as string | null,
    recipients,
    subject: "Assunto",
    html: "<p>Olá</p>",
    campaignId: "camp-1",
    teamId: "team-1",
    dispatchNumber: 1,
    globalDefaults: null,
    templateVariables: null,
  }
}

// ---------- parseResendBatchSendItems (testes existentes) ----------

describe("parseResendBatchSendItems", () => {
  it("extrai array de IDs quando batchResult.data já é o array (SDK v6)", () => {
    const items = parseResendBatchSendItems([{ id: "abc-123" }, { id: "def-456" }])
    expect(items).toHaveLength(2)
    expect(items[0]?.id).toBe("abc-123")
  })

  it("extrai array de IDs do payload aninhado (retrocompatibilidade)", () => {
    const items = parseResendBatchSendItems({
      data: [{ id: "abc-123" }, { id: "def-456" }],
    })
    expect(items).toHaveLength(2)
    expect(items[0]?.id).toBe("abc-123")
  })

  it("retorna array vazio quando data é undefined", () => {
    expect(parseResendBatchSendItems(undefined)).toEqual([])
    expect(parseResendBatchSendItems(null)).toEqual([])
  })
})

// ---------- EmailCampaignDispatchService.dispatchBatch ----------

describe("EmailCampaignDispatchService.dispatchBatch", () => {
  let service: InstanceType<typeof EmailCampaignDispatchService>

  beforeEach(() => {
    service = new EmailCampaignDispatchService()
    batchSendMock.mockClear()
    batchSendMock.mockResolvedValue({ data: [], error: null })
  })

  it("D1 — happy path: 3 destinatários, 1 chunk, onChunkDispatched chamado com 3 entradas", async () => {
    batchSendMock.mockResolvedValueOnce({
      data: [{ id: "re_0" }, { id: "re_1" }, { id: "re_2" }],
      error: null,
    })

    const onChunkDispatched = mock(async () => {})
    const result = await service.dispatchBatch({ ...makeBaseParams(), onChunkDispatched })

    expect(batchSendMock).toHaveBeenCalledTimes(1)
    expect(result.sent).toBe(3)
    expect(result.failed).toBe(0)
    expect(result.dispatched).toHaveLength(3)
    expect(onChunkDispatched).toHaveBeenCalledTimes(1)
    expect((onChunkDispatched.mock.calls[0] as unknown[][])[0]).toHaveLength(3)
  })

  it("D2 — 200 destinatários → 2 chunks de 100, onChunkDispatched chamado 2×", async () => {
    batchSendMock.mockImplementation(async () => ({
      data: Array.from({ length: 100 }, (_, i) => ({ id: `re_${i}` })),
      error: null,
    }))

    const onChunkDispatched = mock(async () => {})
    const result = await service.dispatchBatch({
      ...makeBaseParams(makeRecipients(200)),
      onChunkDispatched,
    })

    expect(batchSendMock).toHaveBeenCalledTimes(2)
    expect(onChunkDispatched).toHaveBeenCalledTimes(2)
    expect(result.sent).toBe(200)
    expect(result.failed).toBe(0)
  })

  it("D4 — batchResult.error set → failed += chunk.length; onChunkDispatched NÃO chamado", async () => {
    batchSendMock.mockResolvedValueOnce({
      data: null as unknown as Array<{ id?: string }>,
      error: { name: "rate_limit_exceeded", message: "Too many requests", statusCode: 429 },
    })

    const onChunkDispatched = mock(async () => {})
    const result = await service.dispatchBatch({ ...makeBaseParams(), onChunkDispatched })

    expect(result.failed).toBe(3)
    expect(result.sent).toBe(0)
    expect(onChunkDispatched).not.toHaveBeenCalled()
  })

  it("D5 — resposta parcial: items.length < chunk.length → failed conta o gap", async () => {
    batchSendMock.mockResolvedValueOnce({
      data: [{ id: "re_0" }, { id: "re_1" }],
      error: null,
    })

    const onChunkDispatched = mock(async () => {})
    const result = await service.dispatchBatch({ ...makeBaseParams(), onChunkDispatched })

    expect(result.sent).toBe(2)
    expect(result.failed).toBe(1)
    expect((onChunkDispatched.mock.calls[0] as unknown[][])[0]).toHaveLength(2)
  })

  it("D6 — item sem id na resposta do Resend → contado como failed", async () => {
    batchSendMock.mockResolvedValueOnce({
      data: [{ id: "re_0" }, {}, { id: "re_2" }],
      error: null,
    })

    const onChunkDispatched = mock(async () => {})
    const result = await service.dispatchBatch({ ...makeBaseParams(), onChunkDispatched })

    expect(result.sent).toBe(2)
    expect(result.failed).toBe(1)
    expect((onChunkDispatched.mock.calls[0] as unknown[][])[0]).toHaveLength(2)
  })

  it("D7 — resend.batch.send lança exceção → failed += chunk.length; dispatchBatch resolve", async () => {
    batchSendMock.mockImplementation(async () => {
      throw new Error("network timeout")
    })

    const onChunkDispatched = mock(async () => {})
    const result = await service.dispatchBatch({ ...makeBaseParams(), onChunkDispatched })

    expect(result.failed).toBe(3)
    expect(result.sent).toBe(0)
    expect(onChunkDispatched).not.toHaveBeenCalled()
  })

  it("D8 — zero destinatários → retorna zeros sem chamar Resend", async () => {
    const result = await service.dispatchBatch(makeBaseParams(makeRecipients(0)))

    expect(batchSendMock).not.toHaveBeenCalled()
    expect(result.sent).toBe(0)
    expect(result.failed).toBe(0)
    expect(result.dispatched).toHaveLength(0)
  })
})
