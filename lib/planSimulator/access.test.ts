import { describe, expect, it } from "bun:test"
import { hasPlanSimulatorAccess } from "./access"

describe("hasPlanSimulatorAccess", () => {
  it("libera SDR e Closer", () => {
    expect(hasPlanSimulatorAccess("MEMBER", ["SDR"])).toBe(true)
    expect(hasPlanSimulatorAccess("MEMBER", ["CLOSER"])).toBe(true)
  })

  it("nega quem não tem função comercial", () => {
    expect(hasPlanSimulatorAccess("MEMBER", ["ADMINISTRATOR"])).toBe(false)
    expect(hasPlanSimulatorAccess("MEMBER", [])).toBe(false)
  })
})
