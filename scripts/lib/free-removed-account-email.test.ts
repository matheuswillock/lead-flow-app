import { describe, expect, it } from "bun:test"
import {
  isOrphanOperator,
  planEmailCleanup,
  runEmailCleanup,
  tombstoneEmailFor,
  type EmailCleanupDeps,
  type EmailCleanupProfile,
  type EmailCleanupSnapshot,
} from "./free-removed-account-email"

const EMAIL = "nicholas@grpbr.com"
const REMOVED_AT = new Date("2026-11-01T12:00:00Z")
const OFF = { deactivateOrphanOperators: false }
const ON = { deactivateOrphanOperators: true }

function profile(overrides: Partial<EmailCleanupProfile> & { id: string }): EmailCleanupProfile {
  return {
    email: EMAIL,
    role: "operator",
    isMaster: false,
    supabaseId: null,
    deletedAt: null,
    linkedRecords: 0,
    ...overrides,
  }
}

const removedSnapshot: EmailCleanupSnapshot = {
  profiles: [profile({ id: "profile-removed", supabaseId: "auth-1", deletedAt: REMOVED_AT })],
  authUsers: [{ id: "auth-1", email: EMAIL }],
}

const orphanSnapshot: EmailCleanupSnapshot = {
  profiles: [profile({ id: "profile-orphan", supabaseId: "auth-2" })],
  authUsers: [{ id: "auth-2", email: EMAIL }],
}

function fakeDeps(snapshot: EmailCleanupSnapshot) {
  const calls: string[] = []
  const logs: string[] = []
  const deps: EmailCleanupDeps = {
    loadSnapshot: async () => snapshot,
    tombstoneProfileEmail: async (profileId, newEmail) => {
      calls.push(`tombstone:${profileId}:${newEmail}`)
    },
    deactivateOrphanProfile: async (profileId, newEmail) => {
      calls.push(`deactivate:${profileId}:${newEmail}`)
    },
    deleteAuthUser: async (authUserId) => {
      calls.push(`delete-auth:${authUserId}`)
    },
    log: (message) => logs.push(message),
  }
  return { deps, calls, logs }
}

describe("isOrphanOperator", () => {
  it("só aceita operador, não master e sem vínculos", () => {
    expect(isOrphanOperator(profile({ id: "a" }))).toBe(true)
    expect(isOrphanOperator(profile({ id: "b", role: "manager" }))).toBe(false)
    expect(isOrphanOperator(profile({ id: "c", isMaster: true }))).toBe(false)
    expect(isOrphanOperator(profile({ id: "d", linkedRecords: 1 }))).toBe(false)
  })
})

describe("planEmailCleanup", () => {
  it("troca o e-mail do perfil removido e apaga o usuário do Auth", () => {
    const plan = planEmailCleanup(EMAIL, removedSnapshot, OFF)

    expect(plan.blockers).toEqual([])
    expect(plan.actions).toEqual([
      {
        kind: "tombstone-profile-email",
        profileId: "profile-removed",
        previousEmail: EMAIL,
        newEmail: tombstoneEmailFor("profile-removed"),
      },
      { kind: "delete-auth-user", authUserId: "auth-1", email: EMAIL },
    ])
  })

  it("compara e-mail ignorando caixa e espaços", () => {
    const plan = planEmailCleanup("  Nicholas@GRPBR.com ", removedSnapshot, OFF)
    expect(plan.email).toBe(EMAIL)
    expect(plan.actions).toHaveLength(2)
  })

  it("bloqueia operador ativo órfão sem a flag", () => {
    const plan = planEmailCleanup(EMAIL, orphanSnapshot, OFF)

    expect(plan.blockers).toEqual([
      expect.stringContaining("profile-orphan"),
      expect.stringContaining("auth-2"),
    ])
    expect(plan.actions).toEqual([])
  })

  it("desativa operador ativo órfão com a flag e apaga o Auth dele", () => {
    const plan = planEmailCleanup(EMAIL, orphanSnapshot, ON)

    expect(plan.blockers).toEqual([])
    expect(plan.actions).toEqual([
      {
        kind: "deactivate-orphan-profile",
        profileId: "profile-orphan",
        previousEmail: EMAIL,
        newEmail: tombstoneEmailFor("profile-orphan"),
      },
      { kind: "delete-auth-user", authUserId: "auth-2", email: EMAIL },
    ])
  })

  it("bloqueia conta ativa com vínculos mesmo com a flag", () => {
    const plan = planEmailCleanup(
      EMAIL,
      { profiles: [profile({ id: "p-team", linkedRecords: 2 })], authUsers: [] },
      ON
    )

    expect(plan.blockers).toEqual([expect.stringContaining("p-team")])
    expect(plan.actions).toEqual([])
  })

  it("bloqueia master ativo mesmo com a flag", () => {
    const plan = planEmailCleanup(
      EMAIL,
      { profiles: [profile({ id: "p-master", isMaster: true })], authUsers: [] },
      ON
    )

    expect(plan.blockers).toEqual([expect.stringContaining("p-master")])
  })

  it("não apaga o usuário do Auth de um perfil ativo com outro e-mail", () => {
    const plan = planEmailCleanup(
      EMAIL,
      {
        profiles: [profile({ id: "profile-renamed", email: "outro@x.com", supabaseId: "auth-3" })],
        authUsers: [{ id: "auth-3", email: EMAIL }],
      },
      ON
    )

    expect(plan.blockers).toEqual([expect.stringContaining("profile-renamed")])
    expect(plan.actions).toEqual([])
  })

  it("apaga usuário do Auth órfão (sem perfil)", () => {
    const plan = planEmailCleanup(EMAIL, { profiles: [], authUsers: [{ id: "auth-9", email: EMAIL }] }, OFF)

    expect(plan.blockers).toEqual([])
    expect(plan.actions).toEqual([{ kind: "delete-auth-user", authUserId: "auth-9", email: EMAIL }])
  })

  it("não encontra nada quando o e-mail não existe", () => {
    const plan = planEmailCleanup(EMAIL, { profiles: [], authUsers: [] }, OFF)
    expect(plan).toEqual({ email: EMAIL, blockers: [], actions: [] })
  })
})

describe("runEmailCleanup", () => {
  it("dry-run não grava nada", async () => {
    const { deps, calls, logs } = fakeDeps(removedSnapshot)

    const result = await runEmailCleanup({ email: EMAIL, confirm: false }, deps)

    expect(result.status).toBe("planned")
    expect(calls).toEqual([])
    expect(logs.some((line) => line.includes("Dry-run"))).toBe(true)
  })

  it("com confirm aplica tombstone e apagamento do Auth", async () => {
    const { deps, calls } = fakeDeps(removedSnapshot)

    const result = await runEmailCleanup({ email: EMAIL, confirm: true }, deps)

    expect(result.status).toBe("applied")
    expect(calls).toEqual([
      `tombstone:profile-removed:${tombstoneEmailFor("profile-removed")}`,
      "delete-auth:auth-1",
    ])
  })

  it("operador órfão só é desativado com a flag e confirm", async () => {
    const blocked = fakeDeps(orphanSnapshot)
    expect((await runEmailCleanup({ email: EMAIL, confirm: true }, blocked.deps)).status).toBe("blocked")
    expect(blocked.calls).toEqual([])

    const applied = fakeDeps(orphanSnapshot)
    const result = await runEmailCleanup(
      { email: EMAIL, confirm: true, deactivateOrphanOperators: true },
      applied.deps
    )
    expect(result.status).toBe("applied")
    expect(applied.calls).toEqual([
      `deactivate:profile-orphan:${tombstoneEmailFor("profile-orphan")}`,
      "delete-auth:auth-2",
    ])
  })

  it("bloqueado por conta ativa não grava nada mesmo com confirm", async () => {
    const { deps, calls } = fakeDeps({
      profiles: [profile({ id: "profile-active", linkedRecords: 1 })],
      authUsers: [],
    })

    const result = await runEmailCleanup({ email: EMAIL, confirm: true }, deps)

    expect(result.status).toBe("blocked")
    expect(calls).toEqual([])
  })

  it("nada a fazer quando não há registros", async () => {
    const { deps, calls } = fakeDeps({ profiles: [], authUsers: [] })

    const result = await runEmailCleanup({ email: EMAIL, confirm: true }, deps)

    expect(result.status).toBe("nothing-to-do")
    expect(calls).toEqual([])
  })

  it("falha parcial propaga o erro; reexecução conclui o que falta", async () => {
    const { deps, calls } = fakeDeps(removedSnapshot)
    let failOnce = true
    deps.deleteAuthUser = async (authUserId) => {
      calls.push(`delete-auth:${authUserId}`)
      if (failOnce) {
        failOnce = false
        throw new Error("Falha ao apagar usuário do Auth auth-1: timeout")
      }
    }

    await expect(runEmailCleanup({ email: EMAIL, confirm: true }, deps)).rejects.toThrow("timeout")
    expect(calls).toEqual([
      `tombstone:profile-removed:${tombstoneEmailFor("profile-removed")}`,
      "delete-auth:auth-1",
    ])

    // Reexecução: o perfil já tem tombstone, então só o Auth é planejado.
    const rerunSnapshot: EmailCleanupSnapshot = {
      profiles: [
        profile({
          id: "profile-removed",
          email: tombstoneEmailFor("profile-removed"),
          supabaseId: "auth-1",
          deletedAt: REMOVED_AT,
        }),
      ],
      authUsers: [{ id: "auth-1", email: EMAIL }],
    }
    const rerun = fakeDeps(rerunSnapshot)
    const result = await runEmailCleanup({ email: EMAIL, confirm: true }, rerun.deps)

    expect(result.status).toBe("applied")
    expect(result.plan.actions).toEqual([
      { kind: "delete-auth-user", authUserId: "auth-1", email: EMAIL },
    ])
    expect(rerun.calls).toEqual(["delete-auth:auth-1"])
  })
})
