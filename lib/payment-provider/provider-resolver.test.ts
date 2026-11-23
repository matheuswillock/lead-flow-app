import { describe, expect, it, mock } from "bun:test"
import { createProviderResolver } from "./provider-resolver"

const capability = { createPixPayment: mock(), createCardPayment: mock() } as never

describe("createProviderResolver", () => {
  it("resolve o provedor pela chave escolhida pelo roteador", async () => {
    const abacate = mock(async () => capability)
    const outro = mock(async () => capability)
    const resolve = createProviderResolver({ ABACATE_PAY: abacate, ASAAS: outro })

    const resolved = await resolve({ provider: "ABACATE_PAY", environment: "DEV", externalAccountContext: "ctx" })

    expect(resolved).toBe(capability)
    expect(abacate).toHaveBeenCalledWith("DEV", "ctx")
    expect(outro).not.toHaveBeenCalled()
  })

  it("recusa provedor sem implementação registrada, sem cair em outro", async () => {
    const abacate = mock(async () => capability)
    const resolve = createProviderResolver({ ABACATE_PAY: abacate })

    await expect(
      resolve({ provider: "ASAAS", environment: "DEV", externalAccountContext: "ctx" }),
    ).rejects.toThrow("Provedor de pagamento não suportado: ASAAS")
    expect(abacate).not.toHaveBeenCalled()
  })
})
