import { beforeEach, describe, expect, it } from "bun:test"
import type { BackofficeAdhesionPayment } from "@prisma/client"
import {
  BackofficeAdhesionPixPaymentService,
  type AdhesionPixGateway,
  type BackofficeAdhesionPixPaymentDependencies,
} from "./BackofficeAdhesionPixPaymentService"

const NOW = new Date("2026-10-21T12:00:00.000Z")
const payer = { name: "Maria Souza", email: "maria@example.com", taxId: "12345678909", cellphone: "11999999999" }

type Row = BackofficeAdhesionPayment

function createHarness(
  options: {
    selectFails?: boolean
    createPixFails?: boolean
    outcome?: unknown
    cardOutcome?: unknown
    createCardError?: Error
    cardStatus?: { status: string; amountInCents: number | null }
  } = {},
) {
  const rows: Row[] = []
  const calls = {
    sessions: [] as unknown[],
    attempts: [] as unknown[],
    updates: [] as unknown[],
    createPix: [] as unknown[],
    createCard: [] as Array<Record<string, unknown>>,
    selects: [] as unknown[],
  }
  let seq = 0

  const payments: BackofficeAdhesionPixPaymentDependencies["payments"] = {
    async create(input) {
      seq += 1
      const row = {
        id: `pay-${seq}`,
        ...input,
        status: "pending",
        providerSessionId: null,
        providerAttemptId: null,
        providerExternalId: null,
        paymentInstructions: null,
        confirmedAt: null,
        completedAt: null,
        failureReason: null,
        createdAt: new Date(NOW.getTime() + seq),
        updatedAt: NOW,
      } as Row
      rows.push(row)
      return row
    },
    async findById(id) {
      return rows.find((row) => row.id === id) ?? null
    },
    async findByIdempotencyKey({ adhesionId, idempotencyKey }) {
      return rows.find((row) => row.adhesionId === adhesionId && row.idempotencyKey === idempotencyKey) ?? null
    },
    async findLatestByAdhesion(adhesionId) {
      return [...rows].reverse().find((row) => row.adhesionId === adhesionId) ?? null
    },
    async attachProviderAttempt(input) {
      const row = rows.find((item) => item.id === input.id)!
      Object.assign(row, {
        providerSessionId: input.providerSessionId,
        providerAttemptId: input.providerAttemptId,
        providerExternalId: input.providerExternalId ?? null,
        paymentInstructions: input.paymentInstructions ?? null,
      })
      return row
    },
    async markConfirmed() {
      return null
    },
    async markCompleted() {
      return null
    },
    async markNeedsReview() {
      return null
    },
    async supersedePending() {
      return 0
    },
    async markFailed(id, reason) {
      const row = rows.find((item) => item.id === id)!
      Object.assign(row, { status: "failed", failureReason: reason })
      return row
    },
  }

  const sessions: BackofficeAdhesionPixPaymentDependencies["sessions"] = {
    async createSession(input) {
      calls.sessions.push(input)
      return { id: "session-1" } as never
    },
    async createAttempt(input) {
      calls.attempts.push(input)
      return { id: "attempt-1" } as never
    },
    async acquireAttemptLease() {
      return { id: "attempt-1", lease: { leaseToken: "l", fenceVersion: 1 } } as never
    },
    async updateAttemptWithLease(input) {
      calls.updates.push(input)
      return {
        id: "attempt-1",
        status: input.status,
        externalId: input.externalId ?? null,
        paymentInstructions: input.paymentInstructions ?? null,
      } as never
    },
    async releaseAttemptLease() {},
  }

  const outcome = options.outcome ?? {
    status: "PENDING",
    externalId: "pix_char_1",
    method: "PIX",
    pix: { brCode: "000201", brCodeBase64: "data:image/png;base64,AAA", expiresAt: "2026-10-21T12:30:00.000Z" },
  }
  const gateway: AdhesionPixGateway = {
    async select(method) {
      calls.selects.push(method)
      if (options.selectFails) throw new Error("Nenhum provider disponível")
      return { provider: "ABACATE_PAY", environment: "PRODUCTION", externalAccountContext: "ctx" }
    },
    async createPix(input) {
      calls.createPix.push(input)
      if (options.createPixFails) throw new Error("rejeitado")
      return outcome as never
    },
    async createCard(input) {
      calls.createCard.push(input as unknown as Record<string, unknown>)
      if (options.createCardError) throw options.createCardError
      return (options.cardOutcome ?? { status: "CONFIRMED", externalId: "tx_card_1", method: "CARD" }) as never
    },
    async getCardStatus() {
      return options.cardStatus ?? { status: "PENDING", amountInCents: null }
    },
  }

  const service = new BackofficeAdhesionPixPaymentService({ payments, sessions, gateway, now: () => NOW })
  return { service, rows, calls }
}

describe("BackofficeAdhesionPixPaymentService.createPixPayment", () => {
  let harness: ReturnType<typeof createHarness>
  beforeEach(() => {
    harness = createHarness()
  })

  it("cria sessão e tentativa com tenant da adesão e chave derivada do pagamento", async () => {
    const payment = await harness.service.createPixPayment({
      adhesionId: "adh-1",
      amountCents: 29900,
      payer,
      idempotencyKey: "client-key",
    })

    expect(payment.providerAttemptId).toBe("attempt-1")
    expect(payment.providerExternalId).toBe("pix_char_1")
    expect(harness.calls.sessions[0]).toMatchObject({
      tenantId: "adh-1",
      ownerType: "BACKOFFICE_ADHESION",
      ownerId: payment.id,
      idempotencyKey: `backoffice-adhesion:${payment.id}`,
    })
    expect(harness.calls.attempts[0]).toMatchObject({
      idempotencyKey: `backoffice-adhesion:${payment.id}`,
      attemptNumber: 1,
    })
    expect(harness.calls.createPix[0]).toMatchObject({
      amountInCents: 29900,
      externalReference: `${payment.id}:attempt-1`,
      metadata: { adhesionPaymentId: payment.id, attemptId: "attempt-1" },
      customer: payer,
    })
  })

  it("não grava linha quando nenhum provider está disponível", async () => {
    const failing = createHarness({ selectFails: true })
    await expect(
      failing.service.createPixPayment({ adhesionId: "adh-1", amountCents: 29900, payer, idempotencyKey: "k" }),
    ).rejects.toThrow()
    expect(failing.rows).toHaveLength(0)
  })

  it("é idempotente por adesão e isola a chave entre adesões", async () => {
    const first = await harness.service.createPixPayment({ adhesionId: "adh-1", amountCents: 29900, payer, idempotencyKey: "same" })
    const replay = await harness.service.createPixPayment({ adhesionId: "adh-1", amountCents: 29900, payer, idempotencyKey: "same" })
    const other = await harness.service.createPixPayment({ adhesionId: "adh-2", amountCents: 29900, payer, idempotencyKey: "same" })

    expect(replay.id).toBe(first.id)
    expect(other.id).not.toBe(first.id)
    expect(harness.calls.createPix).toHaveLength(2)
  })

  it("reaproveita o PIX pendente ainda válido em vez de gerar outro", async () => {
    const first = await harness.service.createPixPayment({ adhesionId: "adh-1", amountCents: 29900, payer, idempotencyKey: "a" })
    const second = await harness.service.createPixPayment({ adhesionId: "adh-1", amountCents: 29900, payer, idempotencyKey: "b" })

    expect(second.id).toBe(first.id)
    expect(harness.calls.createPix).toHaveLength(1)
  })

  it("gera novo PIX quando o anterior expirou", async () => {
    const first = await harness.service.createPixPayment({ adhesionId: "adh-1", amountCents: 29900, payer, idempotencyKey: "a" })
    harness.rows[0].paymentInstructions = { brCode: "x", brCodeBase64: "y", expiresAt: "2026-10-21T11:00:00.000Z" }

    const second = await harness.service.createPixPayment({ adhesionId: "adh-1", amountCents: 29900, payer, idempotencyKey: "b" })

    expect(second.id).not.toBe(first.id)
    expect(harness.calls.createPix).toHaveLength(2)
  })

  it.each([
    ["nome", { ...payer, name: " " }],
    ["e-mail", { ...payer, email: "" }],
    ["CPF/CNPJ", { ...payer, taxId: "" }],
    ["telefone", { ...payer, cellphone: "" }],
  ])("recusa pagador sem %s antes de qualquer escrita", async (_label, invalidPayer) => {
    await expect(
      harness.service.createPixPayment({ adhesionId: "adh-1", amountCents: 29900, payer: invalidPayer, idempotencyKey: "k" }),
    ).rejects.toThrow("Dados do pagador incompletos")
    expect(harness.rows).toHaveLength(0)
  })

  it("recusa valor abaixo de 100 centavos", async () => {
    await expect(
      harness.service.createPixPayment({ adhesionId: "adh-1", amountCents: 99, payer, idempotencyKey: "k" }),
    ).rejects.toThrow("Valor da adesão inválido para PIX")
    expect(harness.rows).toHaveLength(0)
  })

  it("resultado UNKNOWN mantém a linha vinculada à tentativa para reconciliação e avisa o cliente", async () => {
    const unknown = createHarness({
      outcome: { status: "UNKNOWN", externalId: null, reconciliationReference: "ref-1", reason: "REMOTE_TIMEOUT", requiresReconciliation: true },
    })

    await expect(
      unknown.service.createPixPayment({ adhesionId: "adh-1", amountCents: 29900, payer, idempotencyKey: "k" }),
    ).rejects.toThrow("Não foi possível gerar o PIX agora")

    expect(unknown.rows).toHaveLength(1)
    expect(unknown.rows[0].providerAttemptId).toBe("attempt-1")
    expect(unknown.calls.updates[0]).toMatchObject({
      status: "UNKNOWN",
      reconciliationReference: "ref-1",
      unknownReason: "REMOTE_TIMEOUT",
    })
  })

  it("falha definitiva do provider marca a linha como failed", async () => {
    const failing = createHarness({ createPixFails: true })
    await expect(
      failing.service.createPixPayment({ adhesionId: "adh-1", amountCents: 29900, payer, idempotencyKey: "k" }),
    ).rejects.toThrow("rejeitado")
    expect(failing.rows[0].status).toBe("failed")
  })

  it("congela o pagador na linha do pagamento", async () => {
    const payment = await harness.service.createPixPayment({ adhesionId: "adh-1", amountCents: 29900, payer, idempotencyKey: "k" })

    expect(payment).toMatchObject({
      payerName: payer.name,
      payerEmail: payer.email,
      payerTaxId: payer.taxId,
      payerCellphone: payer.cellphone,
    })
  })

  it("recusa outro pagador enquanto há PIX vivo em vez de sobrescrever", async () => {
    await harness.service.createPixPayment({ adhesionId: "adh-1", amountCents: 29900, payer, idempotencyKey: "a" })

    await expect(
      harness.service.createPixPayment({
        adhesionId: "adh-1",
        amountCents: 29900,
        payer: { ...payer, email: "outra@example.com", taxId: "98765432100" },
        idempotencyKey: "b",
      }),
    ).rejects.toThrow("outro pagador")
    expect(harness.calls.createPix).toHaveLength(1)
  })

  it("devolve o pagamento já confirmado em vez de abrir nova cobrança", async () => {
    const first = await harness.service.createPixPayment({ adhesionId: "adh-1", amountCents: 29900, payer, idempotencyKey: "a" })
    harness.rows[0].status = "confirmed"

    const again = await harness.service.createPixPayment({
      adhesionId: "adh-1",
      amountCents: 29900,
      payer: { ...payer, taxId: "98765432100" },
      idempotencyKey: "b",
    })

    expect(again.id).toBe(first.id)
    expect(harness.calls.createPix).toHaveLength(1)
  })
})

describe("BackofficeAdhesionPixPaymentService.createCardPayment", () => {
  const cardInput = {
    adhesionId: "adh-1",
    amountCents: 90000,
    installments: 12,
    cardToken: "ctok_abc",
    payer,
    idempotencyKey: "card-key",
  }

  it("aprovado na hora: cobra pelo cartão do Abacate com token, parcelas e pagador; guarda método CARD sem dados de cartão", async () => {
    const harness = createHarness()

    const result = await harness.service.createCardPayment(cardInput)

    expect(result.providerStatus).toBe("CONFIRMED")
    expect(result.payment.providerExternalId).toBe("tx_card_1")
    expect(result.payment.paymentInstructions).toEqual({ method: "CARD", installments: 12 })
    expect(harness.calls.selects).toEqual(["CARD"])
    expect(harness.calls.createCard[0]).toMatchObject({
      amountInCents: 90000,
      token: "ctok_abc",
      installments: 12,
      customer: payer,
      tokenIssuedAt: NOW,
    })
    expect(JSON.stringify(harness.rows)).not.toContain("ctok_abc")
  })

  it("PENDING: devolve pendente para o webhook transparent.completed concluir", async () => {
    const harness = createHarness({ cardOutcome: { status: "PENDING", externalId: "tx_card_2", method: "CARD" } })

    const result = await harness.service.createCardPayment(cardInput)

    expect(result.providerStatus).toBe("PENDING")
    expect(result.payment.status).toBe("pending")
  })

  it("recusa do provider: mensagem genérica, linha marcada como falha e nada do detalhe vaza", async () => {
    const harness = createHarness({ createCardError: new Error("Cartão 4111 recusado pelo emissor") })

    const failure = await harness.service.createCardPayment(cardInput).catch((error) => error)

    expect(failure.message).toBe("Não foi possível processar o pagamento com este cartão.")
    expect(harness.rows[0]).toMatchObject({ status: "failed" })
  })

  it("status FAILED na resposta também é recusa", async () => {
    const harness = createHarness({ cardOutcome: { status: "FAILED", externalId: "tx_card_3", method: "CARD" } })

    await expect(harness.service.createCardPayment(cardInput)).rejects.toThrow("Não foi possível processar o pagamento com este cartão.")
    expect(harness.rows[0]).toMatchObject({ status: "failed" })
  })

  it("idempotência: a mesma chave não cobra de novo e devolve o pagamento já registrado", async () => {
    const harness = createHarness()

    const first = await harness.service.createCardPayment(cardInput)
    const second = await harness.service.createCardPayment(cardInput)

    expect(harness.calls.createCard).toHaveLength(1)
    expect(second.payment.id).toBe(first.payment.id)
    expect(harness.rows).toHaveLength(1)
  })

  it("repetir a chave de uma tentativa recusada continua recusando, sem nova cobrança", async () => {
    const harness = createHarness({ createCardError: new Error("recusado") })
    await harness.service.createCardPayment(cardInput).catch(() => undefined)

    await expect(harness.service.createCardPayment(cardInput)).rejects.toThrow("Não foi possível processar o pagamento com este cartão.")
    expect(harness.calls.createCard).toHaveLength(1)
  })

  it("cartão ainda em processamento bloqueia outra cobrança (chave nova) e também o PIX", async () => {
    const harness = createHarness({ cardOutcome: { status: "PENDING", externalId: "tx_card_4", method: "CARD" } })
    await harness.service.createCardPayment(cardInput)

    await expect(harness.service.createCardPayment({ ...cardInput, idempotencyKey: "other-key" })).rejects.toThrow("em processamento")
    await expect(
      harness.service.createPixPayment({ adhesionId: "adh-1", amountCents: 90000, payer, idempotencyKey: "pix-key" }),
    ).rejects.toThrow("em processamento")
    expect(harness.calls.createCard).toHaveLength(1)
    expect(harness.calls.createPix).toHaveLength(0)
  })

  it("valida token, parcelas e mínimo de R$ 10 por parcela antes de qualquer cobrança", async () => {
    const harness = createHarness()

    await expect(harness.service.createCardPayment({ ...cardInput, cardToken: "tok_x" })).rejects.toThrow()
    await expect(harness.service.createCardPayment({ ...cardInput, installments: 0 })).rejects.toThrow("Parcelamento inválido")
    await expect(harness.service.createCardPayment({ ...cardInput, installments: 13 })).rejects.toThrow("Parcelamento inválido")
    await expect(
      harness.service.createCardPayment({ ...cardInput, amountCents: 5000, installments: 6 }),
    ).rejects.toThrow("Parcelamento inválido")
    expect(harness.calls.createCard).toHaveLength(0)
    expect(harness.rows).toHaveLength(0)
  })

  it("resposta indeterminada: não confirma, mantém a linha para conciliação e pede para aguardar", async () => {
    const harness = createHarness({ cardOutcome: { status: "UNKNOWN", externalId: null, reason: "REMOTE_TIMEOUT" } })

    await expect(harness.service.createCardPayment(cardInput)).rejects.toThrow("Aguarde alguns minutos")
    expect(harness.rows[0]?.status).toBe("pending")
  })

  it("getCardProviderStatus consulta o provider pelo id externo", async () => {
    const harness = createHarness({ cardStatus: { status: "CONFIRMED", amountInCents: 90000 } })
    const { payment } = await harness.service.createCardPayment(cardInput)

    expect(await harness.service.getCardProviderStatus(payment)).toEqual({ status: "CONFIRMED", amountInCents: 90000 })
  })
})
