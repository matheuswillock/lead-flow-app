import { describe, expect, it } from "bun:test"
import { isValidAnnualSubscription } from "./annualSubscriptionRules"

const now = new Date("2026-10-15T12:00:00.000Z")

describe("isValidAnnualSubscription", () => {
  it.each(["annual", "YEARLY"])("reconhece o ciclo %s", (subscriptionCycle) => {
    expect(isValidAnnualSubscription({ subscriptionCycle, subscriptionStatus: "active", subscriptionEndDate: new Date("2027-01-01T00:00:00.000Z") }, now)).toBe(true)
  })

  it("aceita trial e a próxima cobrança futura", () => {
    expect(isValidAnnualSubscription({ subscriptionCycle: "annual", subscriptionStatus: "trial", subscriptionNextDueDate: new Date("2026-12-01T00:00:00.000Z") }, now)).toBe(true)
  })

  it("rejeita status past_due e datas vencidas", () => {
    expect(isValidAnnualSubscription({ subscriptionCycle: "annual", subscriptionStatus: "past_due", subscriptionEndDate: new Date("2027-01-01T00:00:00.000Z") }, now)).toBe(false)
    expect(isValidAnnualSubscription({ subscriptionCycle: "annual", subscriptionStatus: "active", subscriptionEndDate: new Date("2026-10-15T12:00:00.000Z") }, now)).toBe(false)
  })

  it("rejeita início futuro", () => {
    expect(isValidAnnualSubscription({ subscriptionCycle: "annual", subscriptionStatus: "active", subscriptionStartDate: new Date("2026-10-16T00:00:00.000Z"), subscriptionEndDate: new Date("2027-01-01T00:00:00.000Z") }, now)).toBe(false)
  })
})
