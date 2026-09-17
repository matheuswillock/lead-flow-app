import { beforeEach, describe, expect, it, mock } from "bun:test"

const asaasFetchMock = mock(
  async (_endpoint: string, _options?: RequestInit): Promise<{ id?: string }> => ({
    id: "cus_generated",
  })
)

const asaasApiMock = { customers: "https://sandbox.asaas.com/api/v3/customers" }

mock.module("@/lib/asaas", () => ({
  asaasFetch: asaasFetchMock,
  asaasApi: asaasApiMock,
  // mock.module parcial contamina outros arquivos no mesmo processo (bun run
  // check:mock-module) — createAsaasClient precisa existir mesmo que este
  // arquivo não o chame diretamente.
  createAsaasClient: () => ({ endpoints: asaasApiMock, request: asaasFetchMock }),
}))

const { AsaasCustomerGateway } = await import("./AsaasCustomerGateway")

describe("AsaasCustomerGateway (E5 — DA5, T-10.13)", () => {
  beforeEach(() => {
    asaasFetchMock.mockClear()
    asaasFetchMock.mockImplementation(async () => ({ id: "cus_generated" }))
  })

  it("todo payload emitido contém notificationDisabled: true", async () => {
    const gateway = new AsaasCustomerGateway()

    await gateway.createCustomer({ profileId: "prof-1", name: "Fulano de Tal" })

    expect(asaasFetchMock).toHaveBeenCalledTimes(1)
    const [, options] = asaasFetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const body = JSON.parse(options.body as string)
    expect(body.notificationDisabled).toBe(true)
  })

  it("externalReference é igual ao profileId recebido", async () => {
    const gateway = new AsaasCustomerGateway()

    await gateway.createCustomer({ profileId: "prof-42", name: "Fulano" })

    const [, options] = asaasFetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const body = JSON.parse(options.body as string)
    expect(body.externalReference).toBe("prof-42")
  })

  it("mesmo quando o chamador tenta sobrescrever (bypass de tipo em runtime), notificationDisabled e externalReference vencem", async () => {
    const gateway = new AsaasCustomerGateway()

    await gateway.createCustomer({
      profileId: "prof-real",
      name: "Fulano",
      // @ts-expect-error — CreateAsaasCustomerInput não expõe estes campos;
      // o teste simula um chamador que tenta forjar via cast/JS puro.
      notificationDisabled: false,
      externalReference: "algo-forjado",
    })

    const [, options] = asaasFetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const body = JSON.parse(options.body as string)
    expect(body.notificationDisabled).toBe(true)
    expect(body.externalReference).toBe("prof-real")
  })

  it("adhesionId (sem profile ainda) vira externalReference backoffice-adhesion-<id> — pré-existente antes do profile", async () => {
    const gateway = new AsaasCustomerGateway()

    await gateway.createCustomer({ adhesionId: "adh-1", name: "Fulano" })

    const [, options] = asaasFetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const body = JSON.parse(options.body as string)
    expect(body.externalReference).toBe("backoffice-adhesion-adh-1")
    expect(body.notificationDisabled).toBe(true)
  })

  it("sem profileId nem adhesionId → lança (gateway exige uma âncora de reconciliação)", async () => {
    const gateway = new AsaasCustomerGateway()

    await expect(
      // @ts-expect-error — input inválido de propósito
      gateway.createCustomer({ name: "Sem âncora" })
    ).rejects.toThrow()
  })

  it("resposta do Asaas sem id → lança erro claro", async () => {
    asaasFetchMock.mockImplementation(async () => ({}))
    const gateway = new AsaasCustomerGateway()

    await expect(gateway.createCustomer({ profileId: "prof-1", name: "X" })).rejects.toThrow()
  })

  it("devolve o id do customer criado", async () => {
    asaasFetchMock.mockImplementation(async () => ({ id: "cus_abc123" }))
    const gateway = new AsaasCustomerGateway()

    const result = await gateway.createCustomer({ profileId: "prof-1", name: "X" })

    expect(result).toEqual({ id: "cus_abc123" })
  })
})
