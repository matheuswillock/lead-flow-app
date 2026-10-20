import { describe, expect, it, mock } from "bun:test"
import {
  MEMBER_PRO_EXPIRY_APPLY_ENV,
  MEMBER_PRO_EXPIRY_OPERATOR_ENV,
  applyMemberProExpiryPlan,
  assertExpiryApplyAuthorization,
  buildMemberProExpiryPlan,
  checksumOf,
  type MemberProExpiryRequest,
  type MemberProExpirySnapshot,
  type MemberProExpiryTransaction,
} from "./memberProExpiryOverride"

const NOW = new Date("2026-10-20T16:30:00.000Z")
const OPERATOR = "f88f2b3b-3f45-4170-83e1-4e7999d2c012"
const request: MemberProExpiryRequest = {
  profileId: "f94a3014-2ada-4aea-958e-49294fe7dc16",
  email: "erickserafimm@gmail.com",
  expiresAt: "2026-11-27T12:15:57.067Z",
  reason: "extensão solicitada",
}

function snapshot(overrides: Partial<MemberProExpirySnapshot> = {}): MemberProExpirySnapshot {
  return {
    profileId: request.profileId,
    email: request.email,
    deletedAt: null,
    hasActiveAccountBan: false,
    assignment: { slug: "member_pro", accessStartsAt: "2026-07-20T12:15:57.067Z", accessExpiresAt: "2026-10-28T12:15:57.067Z" },
    ...overrides,
  }
}

function fakeTransaction(updated = 1) {
  const tx = {
    updateMemberProExpiry: mock(async () => updated),
    writeChangeLog: mock(async (_entry: { changeType: string }) => undefined),
  }
  return { tx, port: tx as unknown as MemberProExpiryTransaction }
}

describe("member PRO expiry plan", () => {
  it("allows extending the window to the requested date", () => {
    expect(buildMemberProExpiryPlan(snapshot(), request, NOW)).toMatchObject({
      action: "set_member_pro_expiry",
      from: "2026-10-28T12:15:57.067Z",
      to: "2026-11-27T12:15:57.067Z",
    })
  })

  it("is idempotent when the window already ends at the requested date", () => {
    const plan = buildMemberProExpiryPlan(
      snapshot({ assignment: { slug: "member_pro", accessStartsAt: "2026-07-20T12:15:57.067Z", accessExpiresAt: request.expiresAt } }),
      request,
      NOW,
    )
    expect(plan.action).toBe("already-correct")
  })

  it("rejects dates that are not strict future ISO UTC values", () => {
    for (const expiresAt of ["", "27/11/2026", "2026-11-27", "2026-11-27T12:15:57-03:00", "2026-10-01T00:00:00.000Z"]) {
      expect(() => buildMemberProExpiryPlan(snapshot(), { ...request, expiresAt }, NOW)).toThrow()
    }
  })

  it("rejects an expiry before the window start", () => {
    expect(() =>
      buildMemberProExpiryPlan(snapshot({ assignment: { slug: "member_pro", accessStartsAt: "2027-01-01T00:00:00.000Z", accessExpiresAt: "2027-02-01T00:00:00.000Z" } }), request, NOW),
    ).toThrow("posterior ao início")
  })

  it("aborts for a mismatched profile, banned profile or missing member PRO", () => {
    expect(() => buildMemberProExpiryPlan(snapshot({ email: "outro@example.com" }), request, NOW)).toThrow("não corresponde")
    expect(() => buildMemberProExpiryPlan(snapshot({ deletedAt: NOW.toISOString() }), request, NOW)).toThrow("não corresponde")
    expect(() => buildMemberProExpiryPlan(snapshot({ hasActiveAccountBan: true }), request, NOW)).toThrow("ban")
    expect(() => buildMemberProExpiryPlan(snapshot({ assignment: null }), request, NOW)).toThrow("Member PRO")
    expect(() => buildMemberProExpiryPlan(snapshot({ assignment: { slug: "associate", accessStartsAt: "2026-07-20T00:00:00.000Z", accessExpiresAt: "2026-12-01T00:00:00.000Z" } }), request, NOW)).toThrow("Member PRO")
  })
})

describe("apply authorization", () => {
  const base = { apply: true, reportPath: "/tmp/r.json", checksum: "abc" }

  it("does nothing for a dry-run", () => {
    expect(assertExpiryApplyAuthorization({ apply: false, env: {} })).toBeNull()
  })

  it("requires the apply flag, the reviewed report and a real operator UUID", () => {
    expect(() => assertExpiryApplyAuthorization({ ...base, env: {} })).toThrow(MEMBER_PRO_EXPIRY_APPLY_ENV)
    expect(() => assertExpiryApplyAuthorization({ ...base, checksum: undefined, env: { [MEMBER_PRO_EXPIRY_APPLY_ENV]: "1" } })).toThrow("--input")
    expect(() => assertExpiryApplyAuthorization({ ...base, env: { [MEMBER_PRO_EXPIRY_APPLY_ENV]: "1", [MEMBER_PRO_EXPIRY_OPERATOR_ENV]: "nope" } })).toThrow("UUID")
    expect(assertExpiryApplyAuthorization({ ...base, env: { [MEMBER_PRO_EXPIRY_APPLY_ENV]: "1", [MEMBER_PRO_EXPIRY_OPERATOR_ENV]: OPERATOR } })).toBe(OPERATOR)
  })
})

describe("applyMemberProExpiryPlan", () => {
  it("updates the window and writes one audit entry", async () => {
    const { tx, port } = fakeTransaction()

    const changed = await applyMemberProExpiryPlan(port, buildMemberProExpiryPlan(snapshot(), request, NOW), OPERATOR)

    expect(changed).toBe(true)
    expect(tx.updateMemberProExpiry).toHaveBeenCalledWith({
      profileId: request.profileId,
      from: new Date("2026-10-28T12:15:57.067Z"),
      to: new Date("2026-11-27T12:15:57.067Z"),
    })
    expect(tx.writeChangeLog.mock.calls.map(([entry]) => entry.changeType)).toEqual(["member_pro_access_window_set"])
  })

  it("aborts without auditing when the row changed after the dry-run", async () => {
    const { tx, port } = fakeTransaction(0)
    await expect(applyMemberProExpiryPlan(port, buildMemberProExpiryPlan(snapshot(), request, NOW), OPERATOR)).rejects.toThrow("mudou desde o dry-run")
    expect(tx.writeChangeLog).not.toHaveBeenCalled()
  })

  it("does nothing for an already-correct plan", async () => {
    const { tx, port } = fakeTransaction()
    const plan = { ...buildMemberProExpiryPlan(snapshot(), request, NOW), action: "already-correct" as const }
    expect(await applyMemberProExpiryPlan(port, plan, OPERATOR)).toBe(false)
    expect(tx.updateMemberProExpiry).not.toHaveBeenCalled()
  })

  it("produces a stable checksum", () => {
    expect(checksumOf(buildMemberProExpiryPlan(snapshot(), request, NOW))).toBe(checksumOf(buildMemberProExpiryPlan(snapshot(), request, NOW)))
  })
})
