import { describe, expect, it, mock } from "bun:test"
import { resolveCardCheckout } from "./card-checkout"

const available = async () => ({ card: true })
const unavailable = async () => ({ card: false })

describe("resolveCardCheckout", () => {
  it("devolve o provedor padrão e a chave pública que ele usa para tokenizar", async () => {
    const readKey = mock(async () => "pk_test")

    const result = await resolveCardCheckout({
      resolveCardAvailability: available,
      selectCardProvider: async () => "ABACATE_PAY",
      publicKeyReaders: { ABACATE_PAY: readKey },
    })

    expect(result).toEqual({ cardOffered: true, provider: "ABACATE_PAY", publicKey: "pk_test" })
  })

  it("não oferece cartão quando a disponibilidade está desligada, sem consultar chave", async () => {
    const readKey = mock(async () => "pk_test")

    const result = await resolveCardCheckout({
      resolveCardAvailability: unavailable,
      selectCardProvider: async () => "ABACATE_PAY",
      publicKeyReaders: { ABACATE_PAY: readKey },
    })

    expect(result).toEqual({ cardOffered: false, provider: null, publicKey: null })
    expect(readKey).not.toHaveBeenCalled()
  })

  it("não oferece cartão para provedor sem leitor de chave de tokenização", async () => {
    const result = await resolveCardCheckout({
      resolveCardAvailability: available,
      selectCardProvider: async () => "ASAAS",
      publicKeyReaders: { ABACATE_PAY: async () => "pk_test" },
    })

    expect(result).toEqual({ cardOffered: false, provider: null, publicKey: null })
  })

  it("não oferece cartão quando o roteador não tem provedor elegível para cartão", async () => {
    const readKey = mock(async () => "pk_test")

    const result = await resolveCardCheckout({
      resolveCardAvailability: available,
      selectCardProvider: async () => null,
      publicKeyReaders: { ABACATE_PAY: readKey },
    })

    expect(result).toEqual({ cardOffered: false, provider: null, publicKey: null })
    expect(readKey).not.toHaveBeenCalled()
  })

  it("não oferece cartão quando o provedor não tem chave pública configurada", async () => {
    const result = await resolveCardCheckout({
      resolveCardAvailability: available,
      selectCardProvider: async () => "ABACATE_PAY",
      publicKeyReaders: { ABACATE_PAY: async () => null },
    })

    expect(result).toEqual({ cardOffered: false, provider: null, publicKey: null })
  })
})
