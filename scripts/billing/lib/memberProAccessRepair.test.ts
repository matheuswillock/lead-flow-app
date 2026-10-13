import { describe, expect, it } from "bun:test"
import { shouldRepairMemberProAccess } from "./memberProAccessRepair"

describe("shouldRepairMemberProAccess", () => {
  it("seleciona Member PRO vigente bloqueado", () => {
    expect(
      shouldRepairMemberProAccess({
        userTypeSlug: "member_pro",
        accessStartsAt: null,
        accessExpiresAt: new Date("2027-08-26T00:00:00.000Z"),
        profileStatus: "suspended",
        profileSubscriptionStatus: "suspended",
        now: new Date("2026-10-13T00:00:00.000Z"),
      })
    ).toBe(true)
  })

  it("não seleciona Member PRO expirado", () => {
    expect(
      shouldRepairMemberProAccess({
        userTypeSlug: "member_pro",
        accessStartsAt: null,
        accessExpiresAt: new Date("2026-10-12T00:00:00.000Z"),
        profileStatus: "suspended",
        profileSubscriptionStatus: "suspended",
        now: new Date("2026-10-13T00:00:00.000Z"),
      })
    ).toBe(false)
  })

  it("não seleciona conta banida", () => {
    expect(
      shouldRepairMemberProAccess({
        userTypeSlug: "member_pro",
        accessStartsAt: null,
        accessExpiresAt: new Date("2027-08-26T00:00:00.000Z"),
        profileStatus: "suspended",
        profileSubscriptionStatus: "suspended",
        isBanned: true,
        now: new Date("2026-10-13T00:00:00.000Z"),
      })
    ).toBe(false)
  })
})
