import { describe, expect, it } from "bun:test"
import {
  isPgAdvisoryLockAcquired,
  toDispatchAdvisoryLockKeys,
} from "./dispatch-advisory-lock"

describe("toDispatchAdvisoryLockKeys", () => {
  it("deriva dois int32 estáveis do UUID", () => {
    const dispatchId = "2608daaa-45a1-4813-bd89-23c40ff54d7f"
    const [classid, objid] = toDispatchAdvisoryLockKeys(dispatchId)
    expect(classid).toBe(Number.parseInt("2608daaa", 16) | 0)
    expect(objid).toBe(Number.parseInt("45a14813", 16) | 0)
    expect(toDispatchAdvisoryLockKeys(dispatchId)).toEqual([classid, objid])
  })
})

describe("isPgAdvisoryLockAcquired", () => {
  it("aceita boolean e literais Postgres", () => {
    expect(isPgAdvisoryLockAcquired(true)).toBe(true)
    expect(isPgAdvisoryLockAcquired("t")).toBe(true)
    expect(isPgAdvisoryLockAcquired("true")).toBe(true)
    expect(isPgAdvisoryLockAcquired(false)).toBe(false)
    expect(isPgAdvisoryLockAcquired("f")).toBe(false)
    expect(isPgAdvisoryLockAcquired(undefined)).toBe(false)
  })
})
