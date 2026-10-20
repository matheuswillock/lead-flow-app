import { describe, expect, it, mock } from "bun:test"
import {
  GRACE_ALIGN_APPLY_ENV,
  GRACE_ALIGN_OPERATOR_ENV,
  applyGraceAlignmentPlan,
  assertGraceAlignApplyAuthorization,
  buildGraceAlignmentPlan,
  checksumOf,
  type GraceAlignmentCandidate,
  type GraceAlignmentTransaction,
} from "./graceExpiryAlignment"

const OPERATOR = "f88f2b3b-3f45-4170-83e1-4e7999d2c012"
const MEMBER_PRO_END = "2026-11-28T02:59:59.000Z"

function candidate(overrides: Partial<GraceAlignmentCandidate> = {}): GraceAlignmentCandidate {
  return {
    graceId: "g-1",
    teamId: "t-1",
    profileId: "p-1",
    email: "a@example.com",
    reason: "bulk_subscription_billing_grace: liberação operacional em massa",
    graceExpiresAt: "2026-11-19T03:00:00.000Z",
    memberProExpiresAt: MEMBER_PRO_END,
    hasActiveAccountBan: false,
    ...overrides,
  }
}

function fakeTransaction(updated = 1) {
  const tx = {
    updateGraceExpiry: mock(async () => updated),
    writeChangeLog: mock(async (_entry: { changeType: string }) => undefined),
  }
  return { tx, port: tx as unknown as GraceAlignmentTransaction }
}

describe("buildGraceAlignmentPlan", () => {
  it("extends a shorter bulk grace to the Member PRO expiry", () => {
    expect(buildGraceAlignmentPlan([candidate()]).items).toEqual([
      { graceId: "g-1", teamId: "t-1", profileId: "p-1", email: "a@example.com", from: "2026-11-19T03:00:00.000Z", to: MEMBER_PRO_END },
    ])
  })

  it("never shortens a grace and never touches graces from other origins", () => {
    const plan = buildGraceAlignmentPlan([
      candidate({ graceId: "g-2", email: "b@example.com", graceExpiresAt: "2026-12-31T00:00:00.000Z" }),
      candidate({ graceId: "g-3", email: "c@example.com", reason: "liberação operacional da Pertto somente para CRM" }),
      candidate({ graceId: "g-4", email: "d@example.com", graceExpiresAt: null }),
      candidate({ graceId: "g-5", email: "e@example.com", hasActiveAccountBan: true }),
    ])

    expect(plan.items).toEqual([])
    expect(plan.skipped.map((item) => [item.email, item.reason])).toEqual([
      ["b@example.com", "grace já cobre o Member PRO"],
      ["c@example.com", "grace com outra origem"],
      ["d@example.com", "grace sem prazo; nada a alinhar"],
      ["e@example.com", "ban ativo"],
    ])
  })

  it("orders items by e-mail so the checksum is stable", () => {
    const a = buildGraceAlignmentPlan([candidate({ email: "z@example.com" }), candidate({ graceId: "g-9", email: "a@example.com" })])
    const b = buildGraceAlignmentPlan([candidate({ graceId: "g-9", email: "a@example.com" }), candidate({ email: "z@example.com" })])
    expect(checksumOf(a)).toBe(checksumOf(b))
  })
})

describe("apply authorization", () => {
  const base = { apply: true, reportPath: "/tmp/r.json", checksum: "abc" }

  it("does nothing for a dry-run and enforces every guard for apply", () => {
    expect(assertGraceAlignApplyAuthorization({ apply: false, env: {} })).toBeNull()
    expect(() => assertGraceAlignApplyAuthorization({ ...base, env: {} })).toThrow(GRACE_ALIGN_APPLY_ENV)
    expect(() => assertGraceAlignApplyAuthorization({ ...base, checksum: undefined, env: { [GRACE_ALIGN_APPLY_ENV]: "1" } })).toThrow("--input")
    expect(() => assertGraceAlignApplyAuthorization({ ...base, env: { [GRACE_ALIGN_APPLY_ENV]: "1", [GRACE_ALIGN_OPERATOR_ENV]: "x" } })).toThrow("UUID")
    expect(assertGraceAlignApplyAuthorization({ ...base, env: { [GRACE_ALIGN_APPLY_ENV]: "1", [GRACE_ALIGN_OPERATOR_ENV]: OPERATOR } })).toBe(OPERATOR)
  })
})

describe("applyGraceAlignmentPlan", () => {
  const plan = buildGraceAlignmentPlan([candidate(), candidate({ graceId: "g-2", teamId: "t-2", profileId: "p-2", email: "b@example.com" })])

  it("updates each grace and audits it", async () => {
    const { tx, port } = fakeTransaction()
    expect(await applyGraceAlignmentPlan(port, plan, OPERATOR)).toBe(2)
    expect(tx.writeChangeLog.mock.calls.map(([entry]) => entry.changeType)).toEqual([
      "temporary_billing_access_expiry_aligned",
      "temporary_billing_access_expiry_aligned",
    ])
  })

  it("aborts the batch without auditing when a grace changed after the dry-run", async () => {
    const { tx, port } = fakeTransaction(0)
    await expect(applyGraceAlignmentPlan(port, plan, OPERATOR)).rejects.toThrow("nada foi aplicado")
    expect(tx.writeChangeLog).not.toHaveBeenCalled()
  })
})
