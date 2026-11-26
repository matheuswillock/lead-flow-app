import { describe, expect, it } from "bun:test"
import { getCardProviderClient } from "./cardProviders"

describe("getCardProviderClient", () => {
  it("devolve campo e mensagem de erro do provedor registrado", () => {
    const client = getCardProviderClient("ABACATE_PAY")

    expect(client).toBeDefined()
    expect(client?.Field).toBeDefined()
    expect(client?.describeError({ code: "qualquer" })).toBe(
      "Não foi possível validar o cartão. Confira os dados ou use outro cartão.",
    )
  })

  it("não presume provedor: chave desconhecida ou ausente não tem cliente de cartão", () => {
    expect(getCardProviderClient("OUTRO_PSP")).toBeUndefined()
    expect(getCardProviderClient(null)).toBeUndefined()
  })
})
