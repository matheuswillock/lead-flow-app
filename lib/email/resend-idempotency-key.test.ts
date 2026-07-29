import { describe, expect, it } from "bun:test"
import {
  buildResendIdempotencyKey,
  buildResendIdempotencyKeyWithVariant,
} from "@/lib/email"

describe("buildResendIdempotencyKeyWithVariant", () => {
  it("reutiliza a chave para o mesmo link de convite", () => {
    const url = "https://app.example.com/set-password?token=abc"
    const first = buildResendIdempotencyKeyWithVariant("adhesion-invite", "adhesion-1", url)
    const second = buildResendIdempotencyKeyWithVariant("adhesion-invite", "adhesion-1", url)
    expect(first).toBe(second)
    expect(first.startsWith("adhesion-invite/adhesion-1/")).toBe(true)
  })

  it("rotaciona a chave quando o link de convite muda", () => {
    const first = buildResendIdempotencyKeyWithVariant(
      "adhesion-invite",
      "adhesion-1",
      "https://app.example.com/set-password?token=abc"
    )
    const second = buildResendIdempotencyKeyWithVariant(
      "adhesion-invite",
      "adhesion-1",
      "https://app.example.com/set-password?token=xyz"
    )
    expect(first).not.toBe(second)
  })

  it("respeita o limite de 256 caracteres do Resend", () => {
    const key = buildResendIdempotencyKey("event", "x".repeat(300))
    expect(key.length).toBeLessThanOrEqual(256)
  })
})
