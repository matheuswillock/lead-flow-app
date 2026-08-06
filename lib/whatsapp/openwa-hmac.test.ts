import { describe, expect, it } from "bun:test"
import { createHmac } from "node:crypto"
import { verifyOpenWaHmac } from "./openwa-hmac"

const SECRET = "my-test-secret"

function makeSignature(secret: string, body: Buffer): string {
  const hex = createHmac("sha256", secret).update(body).digest("hex")
  return `sha256=${hex}`
}

describe("verifyOpenWaHmac", () => {
  const body = Buffer.from('{"event":"test"}')

  it("retorna true para assinatura sha256= válida", () => {
    const sig = makeSignature(SECRET, body)
    expect(verifyOpenWaHmac(SECRET, body, sig)).toBe(true)
  })

  it("retorna false quando o secret está errado", () => {
    const sig = makeSignature("wrong-secret", body)
    expect(verifyOpenWaHmac(SECRET, body, sig)).toBe(false)
  })

  it("retorna false quando o header é null", () => {
    expect(verifyOpenWaHmac(SECRET, body, null)).toBe(false)
  })

  it("retorna false quando o header está ausente (string vazia)", () => {
    expect(verifyOpenWaHmac(SECRET, body, "")).toBe(false)
  })

  it("não lança para hex malformado", () => {
    expect(() => verifyOpenWaHmac(SECRET, body, "sha256=ZZZZ")).not.toThrow()
    expect(verifyOpenWaHmac(SECRET, body, "sha256=ZZZZ")).toBe(false)
  })

  it("não lança quando os tamanhos são diferentes (hex curto)", () => {
    expect(() => verifyOpenWaHmac(SECRET, body, "sha256=abc123")).not.toThrow()
    expect(verifyOpenWaHmac(SECRET, body, "sha256=abc123")).toBe(false)
  })
})
