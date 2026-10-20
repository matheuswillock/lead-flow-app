import { describe, expect, it, mock } from "bun:test"
import {
  REVERT_APPLY_ENV,
  REVERT_OPERATOR_ENV,
  applyRevertPlan,
  assertRevertApplyAuthorization,
  buildRevertPlan,
  checksumOf,
  classifyBlockedProfile,
  type BlockedProfileSnapshot,
  type RevertTransaction,
} from "./reconciliationBlockRevert"

const NOW = new Date("2026-10-20T16:30:00.000Z")
const OPERATOR = "f88f2b3b-3f45-4170-83e1-4e7999d2c012"

function snapshot(overrides: Partial<BlockedProfileSnapshot> = {}): BlockedProfileSnapshot {
  return {
    profileId: "p-1",
    email: "a@example.com",
    profileStatus: "suspended",
    canonicalStatus: "suspended",
    hasActiveAccountBan: false,
    reconciliationLog: {
      before: { profileStatus: "active", profileSubscriptionStatus: "active" },
      after: { profileStatus: "suspended", profileSubscriptionStatus: "suspended" },
    },
    laterChangeTypes: ["member_pro_access_window_normalized"],
    memberPro: { accessStartsAt: "2026-07-20T12:00:00.000Z", accessExpiresAt: "2026-11-20T12:00:00.000Z" },
    ...overrides,
  }
}

function fakeTransaction(counts = { profile: 1, canonical: 1 }) {
  const tx = {
    restoreSubscriptionStatus: mock(async (_input: { profileId: string }) => counts),
    writeChangeLog: mock(async (_entry: { changeType: string }) => undefined),
  }
  return { tx, port: tx as unknown as RevertTransaction }
}

describe("classifyBlockedProfile", () => {
  it("accepts a profile suspended only by the reconciliation with a live Member PRO", () => {
    expect(classifyBlockedProfile(snapshot(), NOW).eligible).toBe(true)
  })

  it("tolerates benign later changes such as an indefinite grace", () => {
    const decision = classifyBlockedProfile(snapshot({ laterChangeTypes: ["member_pro_access_window_normalized", "indefinite_billing_access_granted"] }), NOW)
    expect(decision.eligible).toBe(true)
  })

  it("never releases a banned profile", () => {
    expect(classifyBlockedProfile(snapshot({ hasActiveAccountBan: true }), NOW)).toMatchObject({ eligible: false, reason: "ban ativo" })
  })

  it("skips profiles whose status already moved on (past_due, active)", () => {
    for (const status of ["past_due", "active", "canceled"]) {
      expect(classifyBlockedProfile(snapshot({ profileStatus: status, canonicalStatus: status }), NOW).eligible).toBe(false)
    }
    expect(classifyBlockedProfile(snapshot({ canonicalStatus: "past_due" }), NOW).eligible).toBe(false)
  })

  it("skips when the block did not start from active/active", () => {
    const decision = classifyBlockedProfile(
      snapshot({ reconciliationLog: { before: { profileStatus: "past_due", profileSubscriptionStatus: "past_due" }, after: { profileStatus: "suspended", profileSubscriptionStatus: "suspended" } } }),
      NOW,
    )
    expect(decision.eligible).toBe(false)
    expect(classifyBlockedProfile(snapshot({ reconciliationLog: null }), NOW).eligible).toBe(false)
  })

  it("skips when something else changed the billing state after the block", () => {
    expect(classifyBlockedProfile(snapshot({ laterChangeTypes: ["asaas_status_sync"] }), NOW)).toMatchObject({
      eligible: false,
      reason: expect.stringContaining("asaas_status_sync"),
    })
  })

  it("requires a Member PRO window that is live right now", () => {
    for (const memberPro of [
      null,
      { accessStartsAt: "2026-07-20T12:00:00.000Z", accessExpiresAt: "2026-09-17T12:00:00.000Z" },
      { accessStartsAt: "2026-07-20T12:00:00.000Z", accessExpiresAt: null },
      { accessStartsAt: "2026-12-01T12:00:00.000Z", accessExpiresAt: "2027-03-01T12:00:00.000Z" },
    ]) {
      expect(classifyBlockedProfile(snapshot({ memberPro }), NOW).eligible).toBe(false)
    }
  })
})

describe("buildRevertPlan", () => {
  it("splits eligible and skipped profiles in a stable order", () => {
    const plan = buildRevertPlan(
      [
        snapshot({ profileId: "p-2", email: "z@example.com" }),
        snapshot({ profileId: "p-3", email: "m@example.com", hasActiveAccountBan: true }),
        snapshot({ profileId: "p-1", email: "a@example.com" }),
      ],
      NOW,
    )
    expect(plan.eligible.map((item) => item.email)).toEqual(["a@example.com", "z@example.com"])
    expect(plan.skipped).toEqual([{ profileId: "p-3", email: "m@example.com", reason: "ban ativo" }])
    expect(checksumOf(plan)).toBe(checksumOf(buildRevertPlan([snapshot({ profileId: "p-1" }), snapshot({ profileId: "p-3", email: "m@example.com", hasActiveAccountBan: true }), snapshot({ profileId: "p-2", email: "z@example.com" })], NOW)))
  })
})

describe("apply authorization", () => {
  const base = { apply: true, reportPath: "/tmp/r.json", checksum: "abc" }

  it("does nothing for a dry-run and enforces every guard for apply", () => {
    expect(assertRevertApplyAuthorization({ apply: false, env: {} })).toBeNull()
    expect(() => assertRevertApplyAuthorization({ ...base, env: {} })).toThrow(REVERT_APPLY_ENV)
    expect(() => assertRevertApplyAuthorization({ ...base, reportPath: undefined, env: { [REVERT_APPLY_ENV]: "1" } })).toThrow("--input")
    expect(() => assertRevertApplyAuthorization({ ...base, env: { [REVERT_APPLY_ENV]: "1", [REVERT_OPERATOR_ENV]: "x" } })).toThrow("UUID")
    expect(assertRevertApplyAuthorization({ ...base, env: { [REVERT_APPLY_ENV]: "1", [REVERT_OPERATOR_ENV]: OPERATOR } })).toBe(OPERATOR)
  })
})

describe("applyRevertPlan", () => {
  const plan = buildRevertPlan([snapshot({ profileId: "p-1", email: "a@example.com" }), snapshot({ profileId: "p-2", email: "b@example.com" })], NOW)

  it("restores each eligible profile and audits it", async () => {
    const { tx, port } = fakeTransaction()

    expect(await applyRevertPlan(port, plan, OPERATOR)).toBe(2)
    expect(tx.restoreSubscriptionStatus).toHaveBeenCalledTimes(2)
    expect(tx.writeChangeLog.mock.calls.map(([entry]) => entry.changeType)).toEqual(["reconciliation_block_reverted", "reconciliation_block_reverted"])
  })

  it("aborts the whole batch when a row changed after the dry-run", async () => {
    const { tx, port } = fakeTransaction({ profile: 0, canonical: 1 })

    await expect(applyRevertPlan(port, plan, OPERATOR)).rejects.toThrow("nada foi aplicado")
    expect(tx.writeChangeLog).not.toHaveBeenCalled()
  })

  it("does nothing for a plan without eligible profiles", async () => {
    const { tx, port } = fakeTransaction()
    expect(await applyRevertPlan(port, { ...plan, eligible: [] }, OPERATOR)).toBe(0)
    expect(tx.restoreSubscriptionStatus).not.toHaveBeenCalled()
  })
})
