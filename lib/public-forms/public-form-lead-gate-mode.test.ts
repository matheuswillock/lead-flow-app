import { describe, expect, it } from "bun:test"
import { resolvePublicFormLeadGateMode } from "./public-form-lead-gate-mode"

describe("resolvePublicFormLeadGateMode", () => {
  it("usa legacy como padrão seguro", () => {
    expect(resolvePublicFormLeadGateMode("team-1", {})).toBe("legacy")
  })

  it.each(["legacy", "shadow", "radar"] as const)("aceita o modo global %s", (mode) => {
    expect(resolvePublicFormLeadGateMode("team-1", { PUBLIC_FORM_LEAD_GATE_MODE: mode })).toBe(mode)
  })

  it("promove somente times canário para radar", () => {
    const environment = {
      PUBLIC_FORM_LEAD_GATE_MODE: "shadow",
      PUBLIC_FORM_RADAR_CANARY_TEAM_IDS: "team-2, team-3",
    }

    expect(resolvePublicFormLeadGateMode("team-2", environment)).toBe("radar")
    expect(resolvePublicFormLeadGateMode("team-1", environment)).toBe("shadow")
  })

  it("modo inválido volta a legacy", () => {
    expect(resolvePublicFormLeadGateMode("team-1", { PUBLIC_FORM_LEAD_GATE_MODE: "invalid" })).toBe(
      "legacy",
    )
  })
})
