import { describe, expect, it, mock } from "bun:test"
import * as realNodeCrypto from "node:crypto"

// Espiona `timingSafeEqual` sem substituir seu comportamento (delega para o
// real) — factory completa (todo o resto de node:crypto passa direto), então
// nenhum outro consumidor do módulo é afetado. Isso prova que a comparação
// realmente passa por `crypto.timingSafeEqual` e não por um `===` ingênuo
// que produziria o mesmo resultado funcional em todos os testes acima
// (achado de code review no PR #1100 — um `=== ` teria deixado esta suíte
// inteira verde).
const timingSafeEqualSpy = mock(realNodeCrypto.timingSafeEqual)

mock.module("node:crypto", () => ({
  ...realNodeCrypto,
  timingSafeEqual: timingSafeEqualSpy,
}))

const { isValidAsaasWebhookToken } = await import("./isValidAsaasWebhookToken")

describe("isValidAsaasWebhookToken", () => {
  it("token correto → true", () => {
    expect(isValidAsaasWebhookToken("test-token", "test-token")).toBe(true)
  })

  it("token errado de mesmo comprimento → false", () => {
    expect(isValidAsaasWebhookToken("test-tokeX", "test-token")).toBe(false)
  })

  it("token de comprimento diferente → false, sem lançar exceção", () => {
    expect(() => isValidAsaasWebhookToken("curto", "test-token")).not.toThrow()
    expect(isValidAsaasWebhookToken("curto", "test-token")).toBe(false)
    expect(isValidAsaasWebhookToken("um-token-bem-mais-longo-que-o-esperado", "test-token")).toBe(
      false
    )
  })

  it("expected ausente/vazio → false", () => {
    expect(isValidAsaasWebhookToken("qualquer", undefined)).toBe(false)
    expect(isValidAsaasWebhookToken("qualquer", null)).toBe(false)
    expect(isValidAsaasWebhookToken("qualquer", "")).toBe(false)
  })

  it("delega a comparação para crypto.timingSafeEqual — pega regressão para === ingênuo", () => {
    timingSafeEqualSpy.mockClear()

    isValidAsaasWebhookToken("test-token", "test-token")

    expect(timingSafeEqualSpy).toHaveBeenCalledTimes(1)
    const [receivedArg, expectedArg] = timingSafeEqualSpy.mock.calls[0]!
    expect(Buffer.compare(receivedArg as Buffer, Buffer.from("test-token", "utf8"))).toBe(0)
    expect(Buffer.compare(expectedArg as Buffer, Buffer.from("test-token", "utf8"))).toBe(0)
  })

  it("comprimentos diferentes → NÃO chega a chamar timingSafeEqual (ele lançaria)", () => {
    timingSafeEqualSpy.mockClear()

    isValidAsaasWebhookToken("curto", "test-token")

    expect(timingSafeEqualSpy).not.toHaveBeenCalled()
  })
})
