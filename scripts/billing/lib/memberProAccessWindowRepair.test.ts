import { describe, expect, it } from "bun:test"
import { resolveMemberProAccessWindowRepair } from "./memberProAccessWindowRepair"

describe("resolveMemberProAccessWindowRepair", () => {
  const start = new Date("2026-08-01T12:00:00.000Z")

  it("corrige a janela de 90 para 100 dias", () => {
    const result = resolveMemberProAccessWindowRepair({
      sourceStart: start,
      currentAccessStartsAt: null,
      currentAccessExpiresAt: new Date("2026-10-30T12:00:00.000Z"),
    })

    expect(result.changed).toBe(true)
    expect(result.accessStartsAt).toEqual(start)
    expect(result.accessExpiresAt).toEqual(new Date("2026-11-09T12:00:00.000Z"))
  })

  it("não reduz janelas maiores que 100 dias", () => {
    const result = resolveMemberProAccessWindowRepair({
      sourceStart: start,
      currentAccessStartsAt: null,
      currentAccessExpiresAt: new Date("2027-02-01T12:00:00.000Z"),
    })

    expect(result.changed).toBe(true)
    expect(result.preservesLongerWindow).toBe(true)
    expect(result.accessExpiresAt).toEqual(new Date("2027-02-01T12:00:00.000Z"))
  })

  it("é idempotente depois da correção", () => {
    const result = resolveMemberProAccessWindowRepair({
      sourceStart: start,
      currentAccessStartsAt: start,
      currentAccessExpiresAt: new Date("2026-11-09T12:00:00.000Z"),
    })

    expect(result.changed).toBe(false)
  })
})
