import { beforeEach, describe, expect, it, mock } from "bun:test"

// Fase B: cobrança avulsa do backoffice nasce no AbacatePay (PIX e cartão), sem Asaas.
const asaasFetchMock = mock(async () => {
  throw new Error("asaasFetch não deveria ser chamado numa cobrança avulsa AbacatePay")
})
mock.module("@/lib/asaas", () => ({ asaasFetch: asaasFetchMock, asaasApi: { payments: "/payments" } }))

const { BackofficePaymentUseCase } = await import("./BackofficePaymentUseCase")

const client = {
  id: "client-1",
  fullName: "Cliente Teste",
  email: "cliente@example.com",
  phone: "(11) 99999-9999",
  cpfCnpj: "52998224725",
  asaasCustomerId: null,
}

const pixOutcome = {
  status: "PENDING",
  externalId: "pix_char_1",
  pix: { brCode: "copia-cola", brCodeBase64: "data:image/png;base64,AAA", expiresAt: "2026-11-20T12:00:00.000Z" },
}

function makeUseCase(overrides: { client?: unknown; outcome?: unknown } = {}) {
  const findById = mock(async (_id: string) => ("client" in overrides ? overrides.client : client) as never)
  const updateCpfCnpj = mock(async (_id: string, _cpf: string) => ({}) as never)
  const created: unknown[] = []
  const create = mock(async (data: unknown) => {
    created.push(data)
    return { id: "bp-1", ...(data as object) } as never
  })
  const charge = mock(async (_input: unknown) => ({
    selected: { provider: "ABACATE_PAY" },
    session: { id: "session-1" },
    attempt: { id: "attempt-1", externalId: "pix_char_1" },
    outcome: "outcome" in overrides ? overrides.outcome : pixOutcome,
  }) as never)
  const cardGuard = mock(async (_billingType: string) => undefined)
  const useCase = new BackofficePaymentUseCase(
    { create, findMany: mock(async () => []), findById: mock(async () => null), findByAsaasPaymentId: mock(async () => null), updateStatus: mock(async () => ({})) } as never,
    { findById, updateCpfCnpj, updateAsaasCustomerId: mock(async () => ({})) } as never,
    charge as never,
    cardGuard,
  )
  return { useCase, charge, create, updateCpfCnpj, created }
}

const pixInput = { clientId: "client-1", amount: 10, billingType: "PIX", description: "Cobrança teste" }

describe("BackofficePaymentUseCase.createPayment — AbacatePay", () => {
  beforeEach(() => {
    asaasFetchMock.mockClear()
  })

  it("cria a cobrança PIX pelo provedor, sem Asaas, e grava provider ABACATE_PAY com o QR", async () => {
    const { useCase, charge, created } = makeUseCase()

    const result = await useCase.createPayment(pixInput, "profile-1")

    expect(result.isValid).toBe(true)
    expect(charge).toHaveBeenCalledTimes(1)
    expect(charge.mock.calls[0]?.[0]).toMatchObject({
      ownerType: "BACKOFFICE_PAYMENT",
      tenantId: "client-1",
      billingType: "PIX",
      amountInCents: 1000,
      customer: { taxId: "52998224725", email: "cliente@example.com" },
    })
    expect(created[0]).toMatchObject({
      provider: "ABACATE_PAY",
      status: "PENDING",
      billingType: "PIX",
      pixPayload: "copia-cola",
      pixQrCode: "AAA",
      createdByProfileId: "profile-1",
    })
    expect(asaasFetchMock).not.toHaveBeenCalled()
  })

  it("recusa boleto, que não existe mais para novas cobranças", async () => {
    const { useCase, charge } = makeUseCase()

    const result = await useCase.createPayment({ ...pixInput, billingType: "BOLETO" }, "profile-1")

    expect(result.isValid).toBe(false)
    expect(result.errorMessages).toEqual(["Boleto não está disponível para novas cobranças"])
    expect(charge).not.toHaveBeenCalled()
  })

  it("exige o token do cartão para cobrança em cartão", async () => {
    const { useCase, charge } = makeUseCase()

    const result = await useCase.createPayment({ ...pixInput, billingType: "CREDIT_CARD" }, "profile-1")

    expect(result.isValid).toBe(false)
    expect(result.errorMessages).toEqual(["Confirme os dados do cartão antes de cobrar"])
    expect(charge).not.toHaveBeenCalled()
  })

  it("cobra em cartão quando o token existe e o cartão está liberado", async () => {
    const { useCase, charge, created } = makeUseCase({
      outcome: { status: "CONFIRMED", externalId: "card_1" },
    })

    const result = await useCase.createPayment(
      { ...pixInput, billingType: "CREDIT_CARD", cardToken: "ctok_1" },
      "profile-1",
    )

    expect(result.isValid).toBe(true)
    expect(charge.mock.calls[0]?.[0]).toMatchObject({ billingType: "CREDIT_CARD", cardToken: "ctok_1", installments: 1 })
    expect(created[0]).toMatchObject({ provider: "ABACATE_PAY", status: "RECEIVED", billingType: "CREDIT_CARD" })
  })

  it("registra a cobrança recusada no cartão e informa a recusa", async () => {
    const { useCase, created } = makeUseCase({ outcome: { status: "FAILED", externalId: "card_2" } })

    const result = await useCase.createPayment(
      { ...pixInput, billingType: "CREDIT_CARD", cardToken: "ctok_2" },
      "profile-1",
    )

    expect(result.isValid).toBe(false)
    expect(result.errorMessages).toEqual(["Cartão recusado pelo provedor"])
    expect(created[0]).toMatchObject({ status: "FAILED" })
  })

  it("pede CPF ou CNPJ quando o cliente não tem documento e nenhum foi informado", async () => {
    const { useCase, charge } = makeUseCase({ client: { ...client, cpfCnpj: null } })

    const result = await useCase.createPayment(pixInput, "profile-1")

    expect(result.isValid).toBe(false)
    expect(result.errorMessages).toEqual(["Informe um CPF ou CNPJ válido para o cliente"])
    expect(charge).not.toHaveBeenCalled()
  })

  it("salva o CPF informado no cadastro quando o cliente não tinha documento", async () => {
    const { useCase, updateCpfCnpj, charge } = makeUseCase({ client: { ...client, cpfCnpj: null } })

    const result = await useCase.createPayment({ ...pixInput, cpfCnpj: "529.982.247-25" }, "profile-1")

    expect(result.isValid).toBe(true)
    expect(updateCpfCnpj).toHaveBeenCalledWith("client-1", "52998224725")
    expect(charge.mock.calls[0]?.[0]).toMatchObject({ customer: { taxId: "52998224725" } })
  })

  it("exige e-mail no cadastro do cliente antes de cobrar", async () => {
    const { useCase, charge } = makeUseCase({ client: { ...client, email: null } })

    const result = await useCase.createPayment(pixInput, "profile-1")

    expect(result.isValid).toBe(false)
    expect(result.errorMessages).toEqual(["Cadastre o e-mail do cliente antes de cobrar"])
    expect(charge).not.toHaveBeenCalled()
  })

  it("exige telefone no cadastro do cliente: a AbacatePay rejeita o cliente sem celular", async () => {
    const { useCase, charge } = makeUseCase({ client: { ...client, phone: null } })

    const result = await useCase.createPayment(pixInput, "profile-1")

    expect(result.isValid).toBe(false)
    expect(result.errorMessages).toEqual(["Cadastre o telefone do cliente antes de cobrar"])
    expect(charge).not.toHaveBeenCalled()
  })
})
