import { describe, expect, it } from "bun:test"
import { resolveTeamAccountAccessDecisions } from "./resolveTeamAccountAccessDecisions"

describe("resolveTeamAccountAccessDecisions", () => {
  it("preserva a decisão individual de cada time do mesmo master", async () => {
    const decisions = await resolveTeamAccountAccessDecisions({
      profileId: "member-1",
      teamIds: ["team-granted", "team-blocked", "team-granted"],
      resolveDecision: async ({ teamId }) => ({
        isValid: true,
        result: teamId === "team-granted"
          ? { state: "allowed" as const }
          : { state: "restricted" as const, reason: "past_due" as const },
      }),
    })

    expect(decisions.get("team-granted")).toEqual({ state: "allowed" })
    expect(decisions.get("team-blocked")).toEqual({ state: "restricted", reason: "past_due" })
    expect(decisions.size).toBe(2)
  })

  it("falha fechado quando a resolução do time falha", async () => {
    const decisions = await resolveTeamAccountAccessDecisions({
      profileId: "member-1",
      teamIds: ["team-error"],
      resolveDecision: async () => ({ isValid: false, result: null }),
    })

    expect(decisions.get("team-error")).toEqual({
      state: "restricted",
      reason: "subscription_unavailable",
    })
  })

  it("falha fechado quando a resolução lança erro", async () => {
    const decisions = await resolveTeamAccountAccessDecisions({
      profileId: "member-1",
      teamIds: ["team-error"],
      resolveDecision: async () => {
        throw new Error("timeout")
      },
    })

    expect(decisions.get("team-error")).toEqual({
      state: "restricted",
      reason: "subscription_unavailable",
    })
  })
})
