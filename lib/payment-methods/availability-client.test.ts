import { describe, expect, it } from "bun:test"

import {
  coerceBillingType,
  fetchAvailableBillingTypes,
  loadAvailableBillingTypes,
  normalizeAvailableBillingTypes,
  resetAvailableBillingTypesCache,
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

describe("loadAvailableBillingTypes", () => {
  function okFetcher(types: string[]) {
    let calls = 0
    const fetcher = (async () => {
      calls += 1
      return new Response(JSON.stringify({ result: { availableBillingTypes: types } }), { status: 200 })
    }) as unknown as typeof fetch
    return { fetcher, calls: () => calls }
  }

  it("compartilha a requisição em andamento e reaproveita o cache dentro do TTL", async () => {
    resetAvailableBillingTypesCache()
    const { fetcher, calls } = okFetcher(["PIX", "CREDIT_CARD"])
    let clock = 1_000
    const [a, b] = await Promise.all([
      loadAvailableBillingTypes(fetcher, () => clock),
      loadAvailableBillingTypes(fetcher, () => clock),
    ])
    expect(a).toEqual(["PIX", "CREDIT_CARD"])
    expect(b).toEqual(["PIX", "CREDIT_CARD"])
    clock += 10_000
    await loadAvailableBillingTypes(fetcher, () => clock)
    expect(calls()).toBe(1)
  })

  it("rebusca depois do TTL", async () => {
    resetAvailableBillingTypesCache()
    const { fetcher, calls } = okFetcher(["PIX"])
    await loadAvailableBillingTypes(fetcher, () => 0)
    await loadAvailableBillingTypes(fetcher, () => 61_000)
    expect(calls()).toBe(2)
  })
})

describe("coerceBillingType", () => {
  it("força PIX quando o cartão atual deixa de ser oferecido", () => {
    expect(coerceBillingType("CREDIT_CARD", ["PIX"])).toBe("PIX")
    expect(coerceBillingType("CREDIT_CARD", ["PIX", "CREDIT_CARD"])).toBe("CREDIT_CARD")
    expect(coerceBillingType("PIX", ["PIX"])).toBe("PIX")
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
