import { describe, expect, it } from "bun:test"
import { shouldRenderLeadRadarTemperatureCard } from "./lead-radar-temperature-card-visibility"

describe("shouldRenderLeadRadarTemperatureCard", () => {
  it("oculta o card quando o time não tem acesso à feature radar, mesmo com lead carregado", () => {
    expect(
      shouldRenderLeadRadarTemperatureCard({ hasRadarAccess: false, hasLeadContext: true }),
    ).toBe(false)
  })

  it("renderiza quando há acesso à feature radar e o lead/time já estão resolvidos", () => {
    expect(
      shouldRenderLeadRadarTemperatureCard({ hasRadarAccess: true, hasLeadContext: true }),
    ).toBe(true)
  })

  it("não renderiza sem lead/time resolvidos, mesmo com acesso à feature", () => {
    expect(
      shouldRenderLeadRadarTemperatureCard({ hasRadarAccess: true, hasLeadContext: false }),
    ).toBe(false)
  })

  it("nunca renderiza sem acesso, independente do contexto do lead", () => {
    expect(
      shouldRenderLeadRadarTemperatureCard({ hasRadarAccess: false, hasLeadContext: false }),
    ).toBe(false)
  })
})
