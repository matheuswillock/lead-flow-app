import { describe, expect, it, mock } from "bun:test"
import {
  ERICK_TARGET,
  REPAIR_APPLY_ENV,
  REPAIR_OPERATOR_ENV,
  applyErickAccessPlan,
  assertApplyAuthorization,
  buildErickAccessPlan,
  checksumOf,
  resolveMemberProExpiry,
  type AccessRepairTransaction,
  type ErickAccessSnapshot,
} from "./erickSerafimTeamAccess"

const START = "2026-07-20T12:15:57.067Z"
const OPERATOR = "8474aaf6-e7d1-4165-9bef-bf76bc701038"

function snapshot(overrides: Partial<ErickAccessSnapshot> = {}): ErickAccessSnapshot {
  return {
    profile: {
      id: ERICK_TARGET.profileId,
      email: ERICK_TARGET.email,
      isMaster: true,
      deletedAt: null,
      subscriptionStatus: "suspended",
    },
    canonicalSubscriptionStatus: "suspended",
    assignment: { slug: "member_pro", accessStartsAt: START, accessExpiresAt: "2027-07-20T17:42:50.675Z" },
    team: { id: ERICK_TARGET.teamId, name: ERICK_TARGET.teamName, masterId: ERICK_TARGET.profileId, deletedAt: null },
    hasActiveAccountBan: false,
    reconciliationLog: {
      before: { profileStatus: "active", profileSubscriptionStatus: "active" },
      after: { profileStatus: "suspended", profileSubscriptionStatus: "suspended" },
      metadata: { planKey: "due-after-end:sub_a90xoda1kgj7kmne" },
    },
    ...overrides,
  }
}

function fakeTransaction(counts = { expiry: 1, profile: 1, canonical: 1 }) {
  const tx = {
    updateMemberProExpiry: mock(async () => counts.expiry),
    restoreSubscriptionStatus: mock(async () => ({ profile: counts.profile, canonical: counts.canonical })),
    writeChangeLog: mock(async (_entry: { changeType: string }) => undefined),
  }
  return { tx, port: tx as unknown as AccessRepairTransaction }
}

describe("erick serafim team access repair plan", () => {
  it("shortens the member PRO window to start + 100 days and reverts the reconciliation block", () => {
    const plan = buildErickAccessPlan(snapshot())

    expect(resolveMemberProExpiry(START)).toBe("2026-10-28T12:15:57.067Z")
    expect(plan.actions).toEqual([
      { kind: "shorten_member_pro", from: "2027-07-20T17:42:50.675Z", to: "2026-10-28T12:15:57.067Z" },
      { kind: "restore_subscription_status", from: "suspended", to: "active" },
    ])
  })

  it("is idempotent when the state is already correct", () => {
    const plan = buildErickAccessPlan(
      snapshot({
        profile: { ...snapshot().profile, subscriptionStatus: "active" },
        canonicalSubscriptionStatus: "active",
        assignment: { slug: "member_pro", accessStartsAt: START, accessExpiresAt: "2026-10-28T12:15:57.067Z" },
      }),
    )
    expect(plan.actions).toEqual([])
  })

  it("never extends a window that is already shorter", () => {
    expect(() =>
      buildErickAccessPlan(snapshot({ assignment: { slug: "member_pro", accessStartsAt: START, accessExpiresAt: "2026-09-01T00:00:00.000Z" } })),
    ).toThrow("já é menor")
  })

  it("refuses to revert a suspension that the reconciliation did not cause", () => {
    expect(() => buildErickAccessPlan(snapshot({ reconciliationLog: null }))).toThrow("reconciliação")
    expect(() =>
      buildErickAccessPlan(
        snapshot({
          reconciliationLog: {
            before: { profileStatus: "past_due", profileSubscriptionStatus: "past_due" },
            after: { profileStatus: "suspended", profileSubscriptionStatus: "suspended" },
            metadata: {},
          },
        }),
      ),
    ).toThrow("reconciliação")
  })

  it("rejects unexpected billing states instead of guessing", () => {
    expect(() => buildErickAccessPlan(snapshot({ canonicalSubscriptionStatus: "past_due" }))).toThrow("fora do esperado")
    expect(() => buildErickAccessPlan(snapshot({ profile: { ...snapshot().profile, subscriptionStatus: "canceled" } }))).toThrow("fora do esperado")
  })

  it("aborts for a banned master, a wrong team or a wrong master", () => {
    expect(() => buildErickAccessPlan(snapshot({ hasActiveAccountBan: true }))).toThrow("ban")
    expect(() => buildErickAccessPlan(snapshot({ team: null }))).toThrow("Time")
    expect(() => buildErickAccessPlan(snapshot({ profile: { ...snapshot().profile, email: "outro@example.com" } }))).toThrow("Master")
  })

  it("requires an incomplete member PRO window to be resolved manually", () => {
    expect(() => buildErickAccessPlan(snapshot({ assignment: null }))).toThrow("Member PRO")
    expect(() => buildErickAccessPlan(snapshot({ assignment: { slug: "member_pro", accessStartsAt: null, accessExpiresAt: START } }))).toThrow("Member PRO")
  })
})

describe("apply authorization", () => {
  const base = { apply: true, reportPath: "/tmp/r.json", checksum: "abc" }

  it("does nothing for a dry-run", () => {
    expect(assertApplyAuthorization({ apply: false, env: {} })).toBeNull()
  })

  it("requires the apply flag, the reviewed report and a real operator UUID", () => {
    expect(() => assertApplyAuthorization({ ...base, env: {} })).toThrow(REPAIR_APPLY_ENV)
    expect(() => assertApplyAuthorization({ ...base, reportPath: undefined, env: { [REPAIR_APPLY_ENV]: "1" } })).toThrow("--input")
    expect(() => assertApplyAuthorization({ ...base, env: { [REPAIR_APPLY_ENV]: "1", [REPAIR_OPERATOR_ENV]: "<UUID_DO_OPERADOR>" } })).toThrow("UUID")
    expect(assertApplyAuthorization({ ...base, env: { [REPAIR_APPLY_ENV]: "1", [REPAIR_OPERATOR_ENV]: OPERATOR } })).toBe(OPERATOR)
  })
})

describe("applyErickAccessPlan", () => {
  it("applies both actions and writes one audit entry per action", async () => {
    const { tx, port } = fakeTransaction()

    await applyErickAccessPlan(port, buildErickAccessPlan(snapshot()), OPERATOR)

    expect(tx.updateMemberProExpiry).toHaveBeenCalledWith({
      profileId: ERICK_TARGET.profileId,
      from: new Date("2027-07-20T17:42:50.675Z"),
      to: new Date("2026-10-28T12:15:57.067Z"),
    })
    expect(tx.restoreSubscriptionStatus).toHaveBeenCalledTimes(1)
    expect(tx.writeChangeLog.mock.calls.map(([entry]) => entry.changeType)).toEqual([
      "member_pro_access_window_shortened",
      "reconciliation_block_reverted",
    ])
  })

  it("aborts when the row changed after the dry-run, without auditing a change that did not happen", async () => {
    const stale = fakeTransaction({ expiry: 0, profile: 1, canonical: 1 })
    await expect(applyErickAccessPlan(stale.port, buildErickAccessPlan(snapshot()), OPERATOR)).rejects.toThrow("Member PRO mudou")
    expect(stale.tx.writeChangeLog).not.toHaveBeenCalled()

    const partial = fakeTransaction({ expiry: 1, profile: 1, canonical: 0 })
    await expect(applyErickAccessPlan(partial.port, buildErickAccessPlan(snapshot()), OPERATOR)).rejects.toThrow("Status de cobrança mudou")
  })

  it("does nothing for an empty plan", async () => {
    const { tx, port } = fakeTransaction()
    await applyErickAccessPlan(port, { repairId: "r", target: ERICK_TARGET, actions: [] }, OPERATOR)
    expect(tx.updateMemberProExpiry).not.toHaveBeenCalled()
    expect(tx.writeChangeLog).not.toHaveBeenCalled()
  })

  it("produces a stable checksum for the same plan", () => {
    expect(checksumOf(buildErickAccessPlan(snapshot()))).toBe(checksumOf(buildErickAccessPlan(snapshot())))
  })
})
