import { describe, expect, it } from "bun:test"
import { betaBillingLabel, scopeLabel } from "./betaScopeLabel"

describe("betaScopeLabel T05", () => {
  it("mostra Todos os times para ALL_TEAMS", () => {
    expect(scopeLabel({ betaTeamScope: "ALL_TEAMS", teams: [] })).toBe("Todos os times")
  })

  it("mostra quantidade e amostra quando há vários times específicos", () => {
    expect(
      scopeLabel({
        betaTeamScope: "SPECIFIC_TEAMS",
        teams: [
          { id: "1", name: "Time A" },
          { id: "2", name: "Time B" },
          { id: "3", name: "Time C" },
        ],
      })
    ).toBe("3 times: Time A, Time B…")
  })

  it("lista até 2 times sem ellipsis", () => {
    expect(
      scopeLabel({
        betaTeamScope: "SPECIFIC_TEAMS",
        teams: [
          { id: "1", name: "Time A" },
          { id: "2", name: "Time B" },
        ],
      })
    ).toBe("Time A, Time B")
  })

  it("indica ausência de seleção em times específicos", () => {
    expect(scopeLabel({ betaTeamScope: "SPECIFIC_TEAMS", teams: [] })).toBe(
      "Times específicos (nenhum selecionado)"
    )
  })

  it("distingue beta gratuito vs cobrado", () => {
    expect(betaBillingLabel(false)).toBe("Beta gratuito")
    expect(betaBillingLabel(true)).toBe("Beta cobrado")
  })
})
