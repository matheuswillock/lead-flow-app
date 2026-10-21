import { describe, expect, it } from "bun:test"

import {
  fetchAvailableBillingTypes,
  normalizeAvailableBillingTypes,
} from "./availability-client"

describe("normalizeAvailableBillingTypes", () => {
  it("falha fechada para PIX quando o campo está ausente ou inválido", () => {
    expect(normalizeAvailableBillingTypes(undefined)).toEqual(["PIX"])
    expect(normalizeAvailableBillingTypes(null)).toEqual(["PIX"])
    expect(normalizeAvailableBillingTypes("CREDIT_CARD")).toEqual(["PIX"])
    expect(normalizeAvailableBillingTypes([])).toEqual(["PIX"])
    expect(normalizeAvailableBillingTypes(["BOLETO"])).toEqual(["PIX"])
  })

  it("mantém o cartão somente quando declarado", () => {
    expect(normalizeAvailableBillingTypes(["PIX", "CREDIT_CARD"])).toEqual(["PIX", "CREDIT_CARD"])
    expect(normalizeAvailableBillingTypes(["CREDIT_CARD"])).toEqual(["CREDIT_CARD"])
  })
})

describe("fetchAvailableBillingTypes", () => {
  it("lê availableBillingTypes do envelope Output", async () => {
    const fetcher = (async () =>
      new Response(
        JSON.stringify({ isValid: true, result: { availableBillingTypes: ["PIX", "CREDIT_CARD"], card: true } }),
        { status: 200 }
      )) as unknown as typeof fetch
    expect(await fetchAvailableBillingTypes(fetcher)).toEqual(["PIX", "CREDIT_CARD"])
  })

  it("devolve PIX quando a rede falha, a resposta não é ok ou o corpo é inválido", async () => {
    const failing = (async () => {
      throw new Error("offline")
    }) as unknown as typeof fetch
    const notOk = (async () => new Response("{}", { status: 500 })) as unknown as typeof fetch
    const garbage = (async () => new Response("nope", { status: 200 })) as unknown as typeof fetch
    expect(await fetchAvailableBillingTypes(failing)).toEqual(["PIX"])
    expect(await fetchAvailableBillingTypes(notOk)).toEqual(["PIX"])
    expect(await fetchAvailableBillingTypes(garbage)).toEqual(["PIX"])
  })
})
