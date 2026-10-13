import { describe, expect, it } from "bun:test"
import {
  resolveActiveTeamId,
  resolveTeamAccessDecision,
  type TeamAccessCandidate,
} from "./teamAccessDecision"

const availableTeam = (id: string, isAccessible: boolean): TeamAccessCandidate => ({
  id,
  isPending: false,
  isAccessible,
})

describe("resolução do contexto de acesso do time", () => {
  it("preserva o time ativo mesmo quando a assinatura está bloqueada", () => {
    expect(
      resolveActiveTeamId({
        currentTeamId: "blocked",
        teams: [availableTeam("blocked", false), availableTeam("active", true)],
      })
    ).toBe("blocked")
  })

  it("escolhe um time acessível quando não existe time ativo", () => {
    expect(
      resolveActiveTeamId({
        currentTeamId: null,
        teams: [availableTeam("blocked", false), availableTeam("active", true)],
      })
    ).toBe("active")
  })

  it("mantém um contexto bloqueado quando não há outro time acessível", () => {
    expect(
      resolveActiveTeamId({
        currentTeamId: null,
        teams: [availableTeam("blocked", false)],
      })
    ).toBe("blocked")
  })

  it("não permite que resposta antiga substitua uma decisão nova", () => {
    expect(
      resolveTeamAccessDecision({
        requestedGeneration: 4,
        responseGeneration: 3,
        response: { state: "restricted", reason: "past_due" },
      })
    ).toBeNull()

    expect(
      resolveTeamAccessDecision({
        requestedGeneration: 4,
        responseGeneration: 4,
        response: { state: "allowed" },
      })
    ).toEqual({ state: "allowed" })
  })
})
