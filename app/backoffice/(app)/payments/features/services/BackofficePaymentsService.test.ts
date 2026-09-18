import { afterEach, describe, expect, it, mock } from "bun:test"

describe("BackofficePaymentsService (T-51.3)", () => {
  afterEach(() => {
    mock.restore()
  })

  it("500 com corpo HTML vira erro tipado com mensagem genérica, sem quebrar em cascata", async () => {
    const fetchMock = mock(
      async () =>
        new Response("<html><body>Internal Server Error</body></html>", {
          status: 500,
          headers: { "content-type": "text/html" },
        })
    )
    ;(globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch

    const { BackofficePaymentsService, BackofficePaymentsRequestError } = await import(
      "./BackofficePaymentsService"
    )
    const service = new BackofficePaymentsService()

    await expect(service.list()).rejects.toBeInstanceOf(BackofficePaymentsRequestError)
    await expect(service.list()).rejects.toMatchObject({
      status: 500,
      isValidationError: false,
    })
  })

  it("resposta com isValid=false vira erro tipado com a mensagem de negócio", async () => {
    const fetchMock = mock(async () =>
      Response.json(
        { isValid: false, errorMessages: ["Cliente não possui integração Asaas."] },
        { status: 400 }
      )
    )
    ;(globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch

    const { BackofficePaymentsService, BackofficePaymentsRequestError } = await import(
      "./BackofficePaymentsService"
    )
    const service = new BackofficePaymentsService()

    let caught: unknown
    try {
      await service.create({ clientId: "client-1", amount: 100 })
    } catch (err) {
      caught = err
    }

    expect(caught).toBeInstanceOf(BackofficePaymentsRequestError)
    expect((caught as InstanceType<typeof BackofficePaymentsRequestError>).message).toBe(
      "Cliente não possui integração Asaas."
    )
    expect((caught as InstanceType<typeof BackofficePaymentsRequestError>).isValidationError).toBe(
      true
    )
  })

  it("sucesso preserva o result intacto (create resolve com o item criado)", async () => {
    const createdPayment = {
      id: "payment-1",
      clientId: "client-1",
      billingType: "PIX",
      status: "PENDING",
      amount: 100,
      dueDate: "2026-10-01",
      description: null,
      invoiceUrl: "https://asaas.example/invoice/1",
      pixQrCode: "base64qr",
      pixPayload: "pix-copia-e-cola",
      asaasPaymentId: "pay_123",
      createdAt: "2026-09-17T00:00:00.000Z",
    }
    const fetchMock = mock(async () =>
      Response.json(
        { isValid: true, successMessages: [], errorMessages: [], result: createdPayment },
        { status: 201 }
      )
    )
    ;(globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch

    const { BackofficePaymentsService } = await import("./BackofficePaymentsService")
    const service = new BackofficePaymentsService()

    const result = await service.create({ clientId: "client-1", amount: 100 })
    expect(result).toEqual(createdPayment)
    expect(fetchMock).toHaveBeenCalled()
  })
})
