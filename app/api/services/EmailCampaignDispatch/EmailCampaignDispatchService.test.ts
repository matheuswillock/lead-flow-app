import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test"

// ---------- mocks (antes de qualquer import do módulo) ----------

const batchSendMock = mock(async () => ({
  data: [] as Array<{ id?: string }>,
  error: null as null | { name: string; message: string; statusCode: number },
}))

mock.module("@/lib/email/is-retryable-resend-batch-error", () => ({
  isRetryableResendBatchError: (error: {
    statusCode?: number
    message?: string
    name?: string
  }) => {
    const name = error.name?.toLowerCase() ?? ""
    const message = error.message?.toLowerCase() ?? ""
    if (name === "monthly_quota_exceeded" || message.includes("monthly email sending quota")) {
      return false
    }
    const NON_RETRYABLE = new Set([401, 403, 422])
    const statusCode = error.statusCode
    if (statusCode !== undefined && NON_RETRYABLE.has(statusCode)) return false
    if (statusCode === 409) return true
    if (statusCode === undefined) return true
    if (statusCode === 429 || statusCode >= 500) return true
    return false
  },
  isResendMonthlyQuotaExceeded: (error: { name?: string; message?: string }) => {
    const name = error.name?.toLowerCase() ?? ""
    const message = error.message?.toLowerCase() ?? ""
    return name === "monthly_quota_exceeded" || message.includes("monthly email sending quota")
  },
  MAX_BATCH_SEND_ATTEMPTS: 3,
  resendBatchRetryBackoffMs: () => 0,
}))

mock.module("@/lib/email", () => ({
  resend: { batch: { send: batchSendMock } },
  buildResendBatchIdempotencyKey: (type: string, id: string) => `batch-${type}/${id}`,
  buildResendIdempotencyKeyWithVariant: (type: string, id: string, variant: string) =>
    `batch-${type}/${id}/${variant}`,
}))

mock.module("@/lib/email/campaign-unsubscribe-footer", () => ({
  buildCampaignUnsubscribeUrl: () => "https://test.com/unsub/token",
  appendCampaignUnsubscribeFooter: (html: string) => `${html}<!--AUTO_FOOTER-->`,
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
    dispatchId: "dispatch-uuid-1",
    dispatchNumber: 1,
    batchIdempotencyScheme: "contentHash" as const,
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

  it("D1b — e-mail typo (gamil.com) falha local e não vai ao Resend", async () => {
    batchSendMock.mockResolvedValueOnce({
      data: [{ id: "re_ok" }],
      error: null,
    })
    const onChunkDispatched = mock(async () => {})
    const result = await service.dispatchBatch({
      ...makeBaseParams([
        {
          email: "ana@gamil.com",
          name: "Ana",
          contactId: "c-1",
          customFields: null,
        },
        {
          email: "ok@test.com",
          name: "Ok",
          contactId: "c-2",
          customFields: null,
        },
      ]),
      onChunkDispatched,
    })

    expect(result.failed).toBe(1)
    expect(result.sent).toBe(1)
    expect(result.providerErrors[0]?.emails).toEqual(["ana@gamil.com"])
    expect(batchSendMock).toHaveBeenCalledTimes(1)
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

  it("não duplica footer quando o HTML usa alias unsubscribe_url", async () => {
    batchSendMock.mockResolvedValueOnce({
      data: [{ id: "re_0" }],
      error: null,
    })

    await service.dispatchBatch({
      ...makeBaseParams([
        {
          email: "r0@test.com",
          name: "R0",
          contactId: "contact-1",
          customFields: null,
        },
      ]),
      html: '<p>Cancele em <a href="{{unsubscribe_url}}">sair</a></p>',
      onChunkDispatched: mock(async () => {}),
    })

    const payload = (batchSendMock.mock.calls[0] as unknown[][])[0] as Array<{ html: string }>
    expect(payload[0]?.html).toContain("https://test.com/unsub/token")
    expect(payload[0]?.html).not.toContain("{{unsubscribe_url}}")
    expect(payload[0]?.html).not.toContain("<!--AUTO_FOOTER-->")
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

  it("D4 — batchResult.error 429 → retenta até 3× e falha; onChunkDispatched NÃO chamado", async () => {
    batchSendMock.mockResolvedValue({
      data: null as unknown as Array<{ id?: string }>,
      error: { name: "rate_limit_exceeded", message: "Too many requests", statusCode: 429 },
    })

    const onChunkDispatched = mock(async () => {})
    const result = await service.dispatchBatch({ ...makeBaseParams(), onChunkDispatched })

    expect(batchSendMock).toHaveBeenCalledTimes(3)
    expect(result.failed).toBe(3)
    expect(result.sent).toBe(0)
    expect(onChunkDispatched).not.toHaveBeenCalled()
    expect(result.providerErrors).toHaveLength(1)
    expect(result.providerErrors[0]?.statusCode).toBe(429)
    expect(result.providerErrors[0]?.message).toBe("Too many requests")
    expect(result.providerErrors[0]?.emails).toHaveLength(3)
  })

  it("D4-quota — 429 monthly_quota_exceeded aborta sem retry e não processa chunks restantes", async () => {
    batchSendMock.mockResolvedValue({
      data: null as unknown as Array<{ id?: string }>,
      error: {
        name: "monthly_quota_exceeded",
        message: "You have exceeded your monthly email sending quota.",
        statusCode: 429,
      },
    })

    const onChunkDispatched = mock(async () => {})
    const result = await service.dispatchBatch({
      ...makeBaseParams(),
      recipients: makeRecipients(250),
      onChunkDispatched,
    })

    expect(batchSendMock).toHaveBeenCalledTimes(1)
    expect(result.abortedReason).toBe("monthly_quota_exceeded")
    expect(result.sent).toBe(0)
    expect(result.failed).toBe(100)
    expect(onChunkDispatched).not.toHaveBeenCalled()
  })

  it("D4-retry — 429 na 1ª tentativa e sucesso na 2ª", async () => {
    batchSendMock
      .mockResolvedValueOnce({
        data: null as unknown as Array<{ id?: string }>,
        error: { name: "rate_limit_exceeded", message: "Too many requests", statusCode: 429 },
      })
      .mockResolvedValueOnce({
        data: [{ id: "re_0" }, { id: "re_1" }, { id: "re_2" }],
        error: null,
      })

    const onChunkDispatched = mock(async () => {})
    const result = await service.dispatchBatch({ ...makeBaseParams(), onChunkDispatched })

    expect(batchSendMock).toHaveBeenCalledTimes(2)
    expect(result.sent).toBe(3)
    expect(result.failed).toBe(0)
    expect(onChunkDispatched).toHaveBeenCalledTimes(1)
  })

  it("D4-no-retry — 403 não retenta", async () => {
    batchSendMock.mockResolvedValueOnce({
      data: null as unknown as Array<{ id?: string }>,
      error: {
        name: "forbidden",
        message: "The corretorstudio.com.br domain is not verified",
        statusCode: 403,
      },
    })

    const onChunkDispatched = mock(async () => {})
    const result = await service.dispatchBatch({ ...makeBaseParams(), onChunkDispatched })

    expect(batchSendMock).toHaveBeenCalledTimes(1)
    expect(result.failed).toBe(3)
    expect(onChunkDispatched).not.toHaveBeenCalled()
  })

  it("D10 — destinatário com e-mail inválido não vai ao Resend e entra em providerErrors", async () => {
    batchSendMock.mockResolvedValueOnce({
      data: [{ id: "re_0" }, { id: "re_1" }],
      error: null,
    })

    const recipients = [
      ...makeRecipients(2),
      {
        email: "carol.ocipriani@gmail.com|hugopoli@gmail.com",
        name: "Inválido",
        contactId: null as string | null,
        customFields: null as Record<string, unknown> | null,
      },
    ]

    const result = await service.dispatchBatch({
      ...makeBaseParams(recipients),
      onChunkDispatched: mock(async () => {}),
    })

    expect(batchSendMock).toHaveBeenCalledTimes(1)
    expect(result.sent).toBe(2)
    expect(result.failed).toBe(1)
    expect(result.providerErrors.some((error) => error.emails.includes("carol.ocipriani@gmail.com|hugopoli@gmail.com"))).toBe(true)
  })

  it("D13 — canonicaliza ordem do chunk antes de idempotency key e payload", async () => {
    batchSendMock.mockResolvedValueOnce({
      data: [{ id: "re_0" }, { id: "re_1" }, { id: "re_2" }],
      error: null,
    })

    const recipients = [
      {
        email: "zeta@test.com",
        name: "Z",
        contactId: null as string | null,
        customFields: null as Record<string, unknown> | null,
      },
      {
        email: "alpha@test.com",
        name: "A",
        contactId: null as string | null,
        customFields: null as Record<string, unknown> | null,
      },
      {
        email: "middle@test.com",
        name: "M",
        contactId: null as string | null,
        customFields: null as Record<string, unknown> | null,
      },
    ]

    await service.dispatchBatch({
      ...makeBaseParams(recipients),
      onChunkDispatched: mock(async () => {}),
    })

    const firstPayload = (batchSendMock.mock.calls[0] as unknown[][])[0] as Array<{ to: string }>
    const firstKey = (batchSendMock.mock.calls[0] as unknown[][])[1]
    expect(firstPayload.map((entry) => entry.to)).toEqual([
      "alpha@test.com",
      "middle@test.com",
      "zeta@test.com",
    ])

    batchSendMock.mockClear()
    batchSendMock.mockResolvedValueOnce({
      data: [{ id: "re_0" }, { id: "re_1" }, { id: "re_2" }],
      error: null,
    })

    await service.dispatchBatch({
      ...makeBaseParams([...recipients].reverse()),
      onChunkDispatched: mock(async () => {}),
    })

    const secondPayload = (batchSendMock.mock.calls[0] as unknown[][])[0] as Array<{ to: string }>
    const secondKey = (batchSendMock.mock.calls[0] as unknown[][])[1]
    expect(secondPayload.map((entry) => entry.to)).toEqual([
      "alpha@test.com",
      "middle@test.com",
      "zeta@test.com",
    ])
    expect(secondKey).toEqual(firstKey)
  })

  it("D11 — Resend 422 Invalid `to`: bisect isola destinatários e falha um a um", async () => {
    const resendMessage =
      "Invalid `to` field. The email address needs to follow the `email@example.com` or `Name <email@example.com>` format."
    batchSendMock.mockImplementation(async () => ({
      data: null as unknown as Array<{ id?: string }>,
      error: {
        name: "validation_error",
        message: resendMessage,
        statusCode: 422,
      },
    }))

    const onChunkDispatched = mock(async () => {})
    const result = await service.dispatchBatch({ ...makeBaseParams(), onChunkDispatched })

    expect(result.sent).toBe(0)
    expect(result.failed).toBe(3)
    expect(onChunkDispatched).not.toHaveBeenCalled()
    expect(batchSendMock.mock.calls.length).toBeGreaterThan(1)
    expect(result.providerErrors).toHaveLength(3)
    expect(
      result.providerErrors.every((error) =>
        error.message.startsWith("E-mail rejeitado pelo Resend (Invalid to):")
      )
    ).toBe(true)
    expect(result.providerErrors.flatMap((error) => error.emails).sort()).toEqual([
      "r0@test.com",
      "r1@test.com",
      "r2@test.com",
    ])
  })

  it("D11b — 422 Invalid `to` com 1 inválido: válidos enviados após bisect", async () => {
    const resendMessage =
      "Invalid `to` field. The email address needs to follow the `email@example.com` or `Name <email@example.com>` format."
    const recipients = [
      {
        email: "ok1@test.com",
        name: "A",
        contactId: null as string | null,
        customFields: null as Record<string, unknown> | null,
      },
      {
        email: "bad@test.com",
        name: "B",
        contactId: null as string | null,
        customFields: null as Record<string, unknown> | null,
      },
      {
        email: "ok2@test.com",
        name: "C",
        contactId: null as string | null,
        customFields: null as Record<string, unknown> | null,
      },
    ]

    batchSendMock.mockImplementation(async (...args: unknown[]) => {
      const payload = args[0] as Array<{ to: string }>
      const emails = payload.map((entry) => entry.to)
      if (emails.includes("bad@test.com")) {
        return {
          data: null as unknown as Array<{ id?: string }>,
          error: {
            name: "validation_error",
            message: resendMessage,
            statusCode: 422,
          },
        }
      }
      return {
        data: emails.map((_, i) => ({ id: `re_${i}` })),
        error: null,
      }
    })

    const onChunkDispatched = mock(async () => {})
    const result = await service.dispatchBatch({
      ...makeBaseParams(recipients),
      onChunkDispatched,
    })

    expect(result.sent).toBe(2)
    expect(result.failed).toBe(1)
    expect(result.providerErrors).toEqual([
      {
        message: "E-mail rejeitado pelo Resend (Invalid to): bad@test.com",
        statusCode: 422,
        emails: ["bad@test.com"],
      },
    ])
    expect(result.dispatched.map((entry) => entry.email).sort()).toEqual([
      "ok1@test.com",
      "ok2@test.com",
    ])
  })

  it("D11c — 422 sem Invalid to: falha o chunk inteiro sem bisect", async () => {
    batchSendMock.mockResolvedValueOnce({
      data: null as unknown as Array<{ id?: string }>,
      error: {
        name: "validation_error",
        message: "Template variables are invalid",
        statusCode: 422,
      },
    })

    const onChunkDispatched = mock(async () => {})
    const result = await service.dispatchBatch({ ...makeBaseParams(), onChunkDispatched })

    expect(batchSendMock).toHaveBeenCalledTimes(1)
    expect(result.sent).toBe(0)
    expect(result.failed).toBe(3)
    expect(onChunkDispatched).not.toHaveBeenCalled()
    expect(result.providerErrors).toEqual([
      {
        message: "Template variables are invalid",
        statusCode: 422,
        emails: ["r0@test.com", "r1@test.com", "r2@test.com"],
      },
    ])
  })

  it("D12 — lote só com e-mails pipe: não chama Resend e falha todos localmente", async () => {
    const recipients = [
      {
        email: "carol.ocipriani@gmail.com|hugopoli@gmail.com",
        name: "A",
        contactId: null as string | null,
        customFields: null as Record<string, unknown> | null,
      },
      {
        email: "financeiro@newcorban.com.br|financeiro@grupodigital.com.br",
        name: "B",
        contactId: null as string | null,
        customFields: null as Record<string, unknown> | null,
      },
    ]

    const result = await service.dispatchBatch({
      ...makeBaseParams(recipients),
      onChunkDispatched: mock(async () => {}),
    })

    expect(batchSendMock).not.toHaveBeenCalled()
    expect(result.sent).toBe(0)
    expect(result.failed).toBe(2)
    expect(result.providerErrors).toHaveLength(2)
    expect(result.providerErrors.every((error) => error.message.includes("E-mail inválido para o Resend"))).toBe(
      true
    )
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

  it("D7 — resend.batch.send lança exceção → retenta e falha após 3 tentativas", async () => {
    batchSendMock.mockImplementation(async () => {
      throw new Error("network timeout")
    })

    const onChunkDispatched = mock(async () => {})
    const result = await service.dispatchBatch({ ...makeBaseParams(), onChunkDispatched })

    expect(batchSendMock).toHaveBeenCalledTimes(3)
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

  it("D13 — retomada com subconjunto usa idempotencyKey distinta da tentativa original", async () => {
    const capturedKeys: string[] = []
    batchSendMock.mockImplementation(async (...args: unknown[]) => {
      const opts = args[1] as { idempotencyKey?: string } | undefined
      capturedKeys.push(opts?.idempotencyKey ?? "")
      return {
        data: [{ id: "re_0" }, { id: "re_1" }, { id: "re_2" }],
        error: null,
      }
    })

    await service.dispatchBatch(makeBaseParams(makeRecipients(3)))
    const originalKey = capturedKeys[0]
    expect(originalKey).toMatch(/^batch-campaign\/dispatch-uuid-1\//)
    expect(originalKey).not.toBe("batch-campaign/dispatch-uuid-1/0")

    capturedKeys.length = 0
    batchSendMock.mockImplementation(async (...args: unknown[]) => {
      const opts = args[1] as { idempotencyKey?: string } | undefined
      capturedKeys.push(opts?.idempotencyKey ?? "")
      return {
        data: [{ id: "re_0" }, { id: "re_1" }],
        error: null,
      }
    })

    await service.dispatchBatch({
      ...makeBaseParams([
        {
          email: "r1@test.com",
          name: "R1",
          contactId: null,
          customFields: null,
        },
        {
          email: "r2@test.com",
          name: "R2",
          contactId: null,
          customFields: null,
        },
      ]),
    })

    expect(capturedKeys[0]).not.toBe(originalKey)
  })

  it("D13 — mesma composição de lote reutiliza idempotencyKey na retentativa", async () => {
    const capturedKeys: string[] = []
    batchSendMock.mockImplementation(async (...args: unknown[]) => {
      const opts = args[1] as { idempotencyKey?: string } | undefined
      capturedKeys.push(opts?.idempotencyKey ?? "")
      return {
        data: [{ id: "re_0" }, { id: "re_1" }],
        error: null,
      }
    })

    const subsetParams = makeBaseParams([
      {
        email: "r1@test.com",
        name: "R1",
        contactId: null,
        customFields: null,
      },
      {
        email: "r2@test.com",
        name: "R2",
        contactId: null,
        customFields: null,
      },
    ])

    await service.dispatchBatch(subsetParams)
    const firstKey = capturedKeys[0]

    capturedKeys.length = 0
    await service.dispatchBatch(subsetParams)

    expect(capturedKeys[0]).toBe(firstKey)
  })

  it("D13-P1 — scheme positional preserva chave legada dispatchId/chunkIndex", async () => {
    const capturedKeys: string[] = []
    batchSendMock.mockImplementation(async (...args: unknown[]) => {
      const opts = args[1] as { idempotencyKey?: string } | undefined
      capturedKeys.push(opts?.idempotencyKey ?? "")
      return { data: [{ id: "re_0" }, { id: "re_1" }, { id: "re_2" }], error: null }
    })

    await service.dispatchBatch({
      ...makeBaseParams(makeRecipients(3)),
      batchIdempotencyScheme: "positional",
    })

    expect(capturedKeys[0]).toBe("batch-campaign/dispatch-uuid-1/0")
  })

  it("D13-P1 — positional com fallback usa contentHash após 409 idempotency esgotar variantes", async () => {
    const capturedKeys: string[] = []
    let callCount = 0
    batchSendMock.mockImplementation(async (...args: unknown[]) => {
      const opts = args[1] as { idempotencyKey?: string } | undefined
      capturedKeys.push(opts?.idempotencyKey ?? "")
      callCount += 1
      if (callCount <= 3) {
        return {
          data: null as unknown as Array<{ id?: string }>,
          error: {
            name: "idempotency_error",
            message: "Idempotency key conflict",
            statusCode: 409,
          },
        }
      }
      return { data: [{ id: "re_0" }, { id: "re_1" }], error: null }
    })

    const result = await service.dispatchBatch({
      ...makeBaseParams([
        {
          email: "r1@test.com",
          name: "R1",
          contactId: null,
          customFields: null,
        },
        {
          email: "r2@test.com",
          name: "R2",
          contactId: null,
          customFields: null,
        },
      ]),
      batchIdempotencyScheme: "positional",
      enableContentHashFallbackOnIdempotencyConflict: true,
    })

    expect(capturedKeys[0]).toBe("batch-campaign/dispatch-uuid-1/0")
    expect(capturedKeys.some((key) => key.includes("attempt-1"))).toBe(true)
    expect(capturedKeys.some((key) => key.includes("attempt-2"))).toBe(true)
    expect(
      capturedKeys.some((key) => key.match(/^batch-campaign\/dispatch-uuid-1\/[a-f0-9]{16}$/))
    ).toBe(true)
    expect(result.sent).toBe(2)
  })

  it("D9 — falha em onChunkDispatched propaga (não engole como falha de batch Resend)", async () => {
    batchSendMock.mockResolvedValueOnce({
      data: [{ id: "re_1" }, { id: "re_2" }, { id: "re_3" }],
      error: null,
    })

    const onChunkDispatched = mock(async () => {
      throw new Error("db write failed")
    })

    await expect(
      service.dispatchBatch({ ...makeBaseParams(), onChunkDispatched })
    ).rejects.toThrow("db write failed")

    expect(onChunkDispatched).toHaveBeenCalledTimes(1)
  })
})

// ---------- EmailCampaignDispatchService.dispatchBatch — concorrência de chunks ----------

describe("EmailCampaignDispatchService.dispatchBatch — EMAIL_DISPATCH_CHUNK_CONCURRENCY", () => {
  let service: InstanceType<typeof EmailCampaignDispatchService>

  beforeEach(() => {
    service = new EmailCampaignDispatchService()
    batchSendMock.mockClear()
  })

  afterEach(() => {
    delete process.env.EMAIL_DISPATCH_CHUNK_CONCURRENCY
  })

  function mockBatchSendWithConcurrencyTracking(delayMs: number) {
    let inFlight = 0
    let maxInFlight = 0
    batchSendMock.mockImplementation(async (...args: unknown[]) => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      inFlight--
      const payload = args[0] as Array<{ to: string }>
      return { data: payload.map((_, i) => ({ id: `re_${i}` })), error: null }
    })
    return () => maxInFlight
  }

  it("sem env var: comportamento default preservado — no máximo 1 chunk em voo por vez", async () => {
    const getMaxInFlight = mockBatchSendWithConcurrencyTracking(5)

    const result = await service.dispatchBatch(makeBaseParams(makeRecipients(300)))

    expect(batchSendMock).toHaveBeenCalledTimes(3)
    expect(getMaxInFlight()).toBe(1)
    expect(result.sent).toBe(300)
    expect(result.failed).toBe(0)
  })

  it("EMAIL_DISPATCH_CHUNK_CONCURRENCY=3: até 3 chunks em voo simultaneamente, sem duplicar nem perder envios", async () => {
    process.env.EMAIL_DISPATCH_CHUNK_CONCURRENCY = "3"
    const getMaxInFlight = mockBatchSendWithConcurrencyTracking(15)

    const result = await service.dispatchBatch(makeBaseParams(makeRecipients(500)))

    expect(batchSendMock).toHaveBeenCalledTimes(5)
    expect(getMaxInFlight()).toBeGreaterThan(1)
    expect(getMaxInFlight()).toBeLessThanOrEqual(3)
    expect(result.sent).toBe(500)
    expect(result.failed).toBe(0)
  })

  it("concorrência maior que o número de chunks não gera chamadas extras", async () => {
    process.env.EMAIL_DISPATCH_CHUNK_CONCURRENCY = "10"
    batchSendMock.mockImplementation(async (...args: unknown[]) => {
      const payload = args[0] as Array<{ to: string }>
      return { data: payload.map((_, i) => ({ id: `re_${i}` })), error: null }
    })

    const result = await service.dispatchBatch(makeBaseParams(makeRecipients(150)))

    expect(batchSendMock).toHaveBeenCalledTimes(2)
    expect(result.sent).toBe(150)
    expect(result.failed).toBe(0)
  })

  it("valores inválidos (0, negativo, não numérico) fazem fallback seguro para concorrência 1", async () => {
    for (const invalid of ["0", "-2", "abc"]) {
      process.env.EMAIL_DISPATCH_CHUNK_CONCURRENCY = invalid
      batchSendMock.mockClear()
      const getMaxInFlight = mockBatchSendWithConcurrencyTracking(5)

      const result = await service.dispatchBatch(makeBaseParams(makeRecipients(200)))

      expect(getMaxInFlight()).toBe(1)
      expect(result.sent).toBe(200)
    }
  })

  it("bisect (422 Invalid to) permanece correto com concorrência > 1", async () => {
    process.env.EMAIL_DISPATCH_CHUNK_CONCURRENCY = "2"
    const resendMessage =
      "Invalid `to` field. The email address needs to follow the `email@example.com` or `Name <email@example.com>` format."
    const recipients = [
      {
        email: "ok1@test.com",
        name: "A",
        contactId: null as string | null,
        customFields: null as Record<string, unknown> | null,
      },
      {
        email: "bad@test.com",
        name: "B",
        contactId: null as string | null,
        customFields: null as Record<string, unknown> | null,
      },
      {
        email: "ok2@test.com",
        name: "C",
        contactId: null as string | null,
        customFields: null as Record<string, unknown> | null,
      },
    ]

    batchSendMock.mockImplementation(async (...args: unknown[]) => {
      const payload = args[0] as Array<{ to: string }>
      const emails = payload.map((entry) => entry.to)
      if (emails.includes("bad@test.com")) {
        return {
          data: null as unknown as Array<{ id?: string }>,
          error: { name: "validation_error", message: resendMessage, statusCode: 422 },
        }
      }
      return { data: emails.map((_, i) => ({ id: `re_${i}` })), error: null }
    })

    const result = await service.dispatchBatch(makeBaseParams(recipients))

    expect(result.sent).toBe(2)
    expect(result.failed).toBe(1)
    expect(result.dispatched.map((entry) => entry.email).sort()).toEqual([
      "ok1@test.com",
      "ok2@test.com",
    ])
  })
})
