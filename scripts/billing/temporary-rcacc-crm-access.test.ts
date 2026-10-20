import { describe, expect, it } from "bun:test"
import { buildStatusChange, type AccessPlan } from "./temporary-rcacc-crm-access"

const plan: AccessPlan = {
  target: {
    profileId: "2a72272f-56f2-4104-9952-5d3d8b19ff1d",
    email: "rodrigo.c.arruda@rcacc.com.br",
    teamId: "27edf455-e61a-48a9-a846-e2c6f42999b5",
    teamName: "RCACC Seguros",
  },
  expiresAt: "2026-11-19T03:00:00.000Z",
  before: { profileStatus: "past_due", profileSubscriptionStatus: "past_due" },
  after: { profileStatus: "active", profileSubscriptionStatus: "active" },
  graceId: "grace-rcacc",
}

describe("temporary RCACC CRM access workaround", () => {
  it("applies active status only for the temporary window", () => {
    expect(buildStatusChange(plan, "apply")).toEqual(plan.after)
  })

  it("restores the exact statuses captured by the dry-run", () => {
    expect(buildStatusChange(plan, "restore")).toEqual(plan.before)
  })
})
