import { describe, expect, it } from "bun:test"
import { parsePageParam, parsePageSizeParam } from "./parse-pagination"

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
