import { describe, expect, it } from "bun:test"
import { isValidAsaasWebhookToken } from "./isValidAsaasWebhookToken"

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
})
