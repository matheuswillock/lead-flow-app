import { describe, expect, it } from "bun:test"
import { ABACATE_JS_URL, describeAbacateError } from "./abacate-js"

describe("abacate-js", () => {
  it("carrega sempre do endereço oficial do Abacate Pay", () => {
    expect(ABACATE_JS_URL).toBe("https://abacatepay.com/abacatepay.js")
  })

  it("traduz os códigos de erro do abacatepay.js para mensagens ao cliente", () => {
    expect(describeAbacateError({ code: "CARD_INCOMPLETE" })).toBe("Preencha todos os dados do cartão.")
    expect(describeAbacateError({ code: "THREE_DS_FAILED" })).toContain("autenticação")
    expect(describeAbacateError({ code: "PROVIDER_LOAD" })).toContain("bloqueadores")
  })

  it("erro desconhecido ou da API vira mensagem genérica, sem detalhe técnico", () => {
    const generic = "Não foi possível validar o cartão. Confira os dados ou use outro cartão."
    expect(describeAbacateError({ code: "API", message: "Invalid or revoked public key" })).toBe(generic)
    expect(describeAbacateError(new Error("boom"))).toBe(generic)
    expect(describeAbacateError(null)).toBe(generic)
  })
})
