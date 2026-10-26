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

function createHarness(options: { selectFails?: boolean; createPixFails?: boolean; outcome?: unknown } = {}) {
  const rows: Row[] = []
  const calls = { sessions: [] as unknown[], attempts: [] as unknown[], updates: [] as unknown[], createPix: [] as unknown[] }
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
    async select() {
      if (options.selectFails) throw new Error("Nenhum provider disponível")
      return { provider: "ABACATE_PAY", environment: "PRODUCTION", externalAccountContext: "ctx" }
    },
    async createPix(input) {
      calls.createPix.push(input)
      if (options.createPixFails) throw new Error("rejeitado")
      return outcome as never
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
