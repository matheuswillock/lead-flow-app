import { describe, expect, it } from "bun:test"
import {
  mapStartedPixPaymentToPaymentData,
  resolvePixIdempotencyKey,
  rememberPixExpiry,
  type KeyValueStorage,
} from "./platformPixPayment"

function makeStorage(): KeyValueStorage {
  const data = new Map<string, string>()
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  }
}

const NOW = Date.parse("2026-10-20T12:00:00.000Z")

describe("mapStartedPixPaymentToPaymentData", () => {
  it("mapeia o contrato do backend para o formato do checkout público", () => {
    const data = mapStartedPixPaymentToPaymentData({
      amountInCents: 10000,
      pix: { brCode: "000201", brCodeBase64: "AAAA", expiresAt: "2026-10-20T12:30:00.000Z" },
    })

    expect(data).toEqual({
      amount: 100,
      invoiceUrl: null,
      pix: {
        payload: "000201",
        encodedImage: "data:image/png;base64,AAAA",
        expirationDate: "2026-10-20T12:30:00.000Z",
      },
    })
  })

  it("não duplica o prefixo quando o provider já envia data URI", () => {
    const data = mapStartedPixPaymentToPaymentData({
      amountInCents: 500,
      pix: { brCode: "x", brCodeBase64: "data:image/png;base64,BBBB", expiresAt: "2026-10-20T12:30:00.000Z" },
    })
    expect(data.pix.encodedImage).toBe("data:image/png;base64,BBBB")
  })

  it("falha quando o backend não devolve instruções PIX", () => {
    expect(() => mapStartedPixPaymentToPaymentData({ amountInCents: 500 })).toThrow(
      "O PIX ainda não está disponível. Tente novamente em instantes."
    )
  })
})

describe("resolvePixIdempotencyKey", () => {
  it("gera e reutiliza a mesma chave por compra", () => {
    const storage = makeStorage()
    const first = resolvePixIdempotencyKey(storage, "p1", NOW, () => "uuid-1")
    const second = resolvePixIdempotencyKey(storage, "p1", NOW + 1000, () => "uuid-2")
    expect(first).toBe("platform-pix:p1:uuid-1")
    expect(second).toBe(first)
  })

  it("isola chaves entre compras", () => {
    const storage = makeStorage()
    resolvePixIdempotencyKey(storage, "p1", NOW, () => "a")
    expect(resolvePixIdempotencyKey(storage, "p2", NOW, () => "b")).toBe("platform-pix:p2:b")
  })

  it("gera nova chave somente depois que o PIX expirou", () => {
    const storage = makeStorage()
    const first = resolvePixIdempotencyKey(storage, "p1", NOW, () => "uuid-1")
    rememberPixExpiry(storage, "p1", "2026-10-20T12:30:00.000Z")

    expect(resolvePixIdempotencyKey(storage, "p1", NOW + 60_000, () => "uuid-2")).toBe(first)
    expect(
      resolvePixIdempotencyKey(storage, "p1", Date.parse("2026-10-20T12:30:01.000Z"), () => "uuid-3")
    ).toBe("platform-pix:p1:uuid-3")
  })

  it("tolera storage indisponível", () => {
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error("blocked")
      },
      setItem: () => {
        throw new Error("blocked")
      },
    }
    expect(resolvePixIdempotencyKey(broken, "p1", NOW, () => "u")).toBe("platform-pix:p1:u")
  })
})
