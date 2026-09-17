import { describe, expect, it } from "bun:test"
import { parsePageParam, parsePageSizeParam, resolvePageOffset } from "./parse-pagination"

describe("parsePageParam", () => {
  it("aceita inteiro positivo", () => {
    expect(parsePageParam("3")).toBe(3)
  })

  it("cai no fallback para ausente ou vazio", () => {
    expect(parsePageParam(null)).toBe(1)
    expect(parsePageParam("")).toBe(1)
    expect(parsePageParam("   ")).toBe(1)
  })

  // O clamp com Math.max/min não filtra NaN: Math.max(1, NaN) === NaN. Com
  // LIMIT/OFFSET no banco, isso vira 500 a partir de query string malformada.
  it("cai no fallback para valor que não é inteiro positivo", () => {
    expect(parsePageParam("abc")).toBe(1)
    expect(parsePageParam("12abc")).toBe(1)
    expect(parsePageParam("Infinity")).toBe(1)
    expect(parsePageParam("-1")).toBe(1)
    expect(parsePageParam("0")).toBe(1)
    expect(parsePageParam("1.5")).toBe(1)
    expect(parsePageParam("1e999")).toBe(1)
    expect(parsePageParam("9007199254740993")).toBe(1)
  })
})

describe("parsePageSizeParam", () => {
  it("aceita e limita ao máximo", () => {
    expect(parsePageSizeParam("25")).toBe(25)
    expect(parsePageSizeParam("5000")).toBe(100)
    expect(parsePageSizeParam("5000", { max: 500 })).toBe(500)
  })

  it("cai no fallback para lixo", () => {
    expect(parsePageSizeParam("abc")).toBe(20)
    expect(parsePageSizeParam("1.5")).toBe(20)
    expect(parsePageSizeParam(null, { fallback: 50 })).toBe(50)
  })

  it("nunca devolve NaN nem fracionário", () => {
    for (const raw of ["abc", "", "NaN", "Infinity", "-Infinity", "1.5", "0", "-3"]) {
      const parsed = parsePageSizeParam(raw)
      expect(Number.isSafeInteger(parsed)).toBe(true)
      expect(parsed).toBeGreaterThan(0)
    }
  })
})

describe("resolvePageOffset", () => {
  it("calcula o offset normal", () => {
    expect(resolvePageOffset(1, 20)).toBe(0)
    expect(resolvePageOffset(3, 20)).toBe(40)
  })

  // `page` e `pageSize` podem ser inteiros válidos e o PRODUTO estourar.
  // Sanitizar o offset depois (trocando por 0) devolveria a PRIMEIRA página
  // anunciando o número pedido — o chamador acha que está no fim e vê o começo.
  it("recusa quando a multiplicação estoura o inteiro seguro", () => {
    expect(resolvePageOffset(Number.MAX_SAFE_INTEGER, 100)).toBeNull()
    expect(resolvePageOffset(Number.MAX_SAFE_INTEGER, 2)).toBeNull()
  })

  it("recusa entradas que não são inteiro positivo", () => {
    expect(resolvePageOffset(0, 20)).toBeNull()
    expect(resolvePageOffset(-1, 20)).toBeNull()
    expect(resolvePageOffset(1.5, 20)).toBeNull()
    expect(resolvePageOffset(1, 0)).toBeNull()
    expect(resolvePageOffset(Number.NaN, 20)).toBeNull()
    expect(resolvePageOffset(Number.POSITIVE_INFINITY, 20)).toBeNull()
  })

  it("o maior offset seguro ainda passa", () => {
    const page = Math.floor(Number.MAX_SAFE_INTEGER / 100)
    expect(resolvePageOffset(page, 100)).not.toBeNull()
  })
})
