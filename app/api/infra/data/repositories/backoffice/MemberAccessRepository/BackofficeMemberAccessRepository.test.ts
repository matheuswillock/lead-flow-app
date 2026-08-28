import { beforeEach, describe, expect, it, mock } from "bun:test"

/**
 * Bug reenvio de convite (2026-08-27) — efeito colateral confirmado: o assunto do
 * e-mail mudou de "por <nome real>" para "por Equipe Corretor Studio" entre o convite
 * original e o reenvio. Causa: `findProfileAccessRecord` resolvia `managerName` via
 * `profile.manager` (relação `managerId`, o reporte direto operador→manager dentro do
 * time) — null para quem foi convidado direto pelo master (o caso mais comum) — em vez
 * do MASTER do time, que é a semântica real de "managerName" no backoffice (mesma
 * resolução usada em `BackofficePlatformUsersUseCase.getMasterUserDetails`, via
 * `team.master`). Sem essa correção, o reenvio caía sempre no fallback genérico.
 */

const findUniqueMock = mock(
  async () =>
    ({
      id: "profile-1",
      supabaseId: "supa-1",
      email: "ana@example.com",
      fullName: "Ana Souza",
      role: "operator" as const,
      isMaster: false,
    }) as unknown
)

const findFirstTeamMemberMock = mock(async () => null as unknown)

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    profile: { findUnique: findUniqueMock },
    teamMember: { findFirst: findFirstTeamMemberMock },
  },
}))

// Mesmo padrão de EmailCampaignUseCase.test.ts: `pg` real exige conexão de
// sessão dedicada (DIRECT_URL) — mock do módulo inteiro, não do método.
const pgConnectMock = mock(async () => {})
const pgEndMock = mock(async () => {})
const pgQueryMock = mock(async (sql: string) => {
  if (String(sql).includes("pg_try_advisory_lock")) {
    return { rows: [{ acquired: true }] }
  }
  return { rows: [] }
})
mock.module("pg", () => ({
  Client: class {
    connect = pgConnectMock
    end = pgEndMock
    query = pgQueryMock
  },
}))
process.env.DIRECT_URL = process.env.DIRECT_URL || "postgresql://postgres:postgres@127.0.0.1:55322/postgres"

const { BackofficeMemberAccessRepository } = await import("./BackofficeMemberAccessRepository")

describe("BackofficeMemberAccessRepository.findProfileAccessRecord — managerName é o master do time", () => {
  beforeEach(() => {
    findUniqueMock.mockClear()
    findFirstTeamMemberMock.mockClear()
  })

  it("resolve managerName a partir do master do time (team.master), não de profile.managerId", async () => {
    findFirstTeamMemberMock.mockImplementation(async () => ({
      team: { master: { fullName: "Carlos Mestre", email: "carlos@example.com" } },
    }))

    const repo = new BackofficeMemberAccessRepository()
    const record = await repo.findProfileAccessRecord("profile-1")

    expect(record?.managerName).toBe("Carlos Mestre")
  })

  it("cai para o e-mail do master quando ele não tem fullName", async () => {
    findFirstTeamMemberMock.mockImplementation(async () => ({
      team: { master: { fullName: null, email: "carlos@example.com" } },
    }))

    const repo = new BackofficeMemberAccessRepository()
    const record = await repo.findProfileAccessRecord("profile-1")

    expect(record?.managerName).toBe("carlos@example.com")
  })

  it("sem nenhuma associação de time, managerName é null (fallback genérico do e-mail assume daqui)", async () => {
    findFirstTeamMemberMock.mockImplementation(async () => null)

    const repo = new BackofficeMemberAccessRepository()
    const record = await repo.findProfileAccessRecord("profile-1")

    expect(record?.managerName).toBeNull()
  })

  it("perfil inexistente retorna null sem consultar team.master", async () => {
    findUniqueMock.mockImplementation(async () => null)

    const repo = new BackofficeMemberAccessRepository()
    const record = await repo.findProfileAccessRecord("profile-inexistente")

    expect(record).toBeNull()
    expect(findFirstTeamMemberMock).not.toHaveBeenCalled()
  })
})

/**
 * Achado de review (PR #1090): duas requisições concorrentes para o mesmo
 * profileId (duplo-clique sem lock no cliente, retry de proxy) geravam tokens
 * Supabase distintos cada uma — o segundo `generateLink` invalida o primeiro
 * token mesmo que o e-mail do primeiro chegue DEPOIS na caixa de entrada
 * (ordem de entrega do provedor não é garantida). O lock serializa por
 * profileId: a segunda tentativa nunca gera um segundo token enquanto a
 * primeira está em voo.
 */
describe("BackofficeMemberAccessRepository.runWithInviteLock — serializa gerações concorrentes", () => {
  beforeEach(() => {
    pgConnectMock.mockClear()
    pgEndMock.mockClear()
    pgQueryMock.mockClear()
    pgQueryMock.mockImplementation(async (sql: string) => {
      if (String(sql).includes("pg_try_advisory_lock")) {
        return { rows: [{ acquired: true }] }
      }
      return { rows: [] }
    })
  })

  it("lock adquirido: roda work() e devolve o resultado", async () => {
    const repo = new BackofficeMemberAccessRepository()
    const work = mock(async () => "resultado")

    const outcome = await repo.runWithInviteLock("profile-1", work)

    expect(outcome.acquired).toBe(true)
    expect(outcome.acquired && outcome.result).toBe("resultado")
    expect(work).toHaveBeenCalledTimes(1)
  })

  it("lock ocupado: work() NUNCA é chamado — sem isso, dois generateLink concorrentes se invalidam", async () => {
    pgQueryMock.mockImplementation(async (sql: string) => {
      if (String(sql).includes("pg_try_advisory_lock")) {
        return { rows: [{ acquired: false }] }
      }
      return { rows: [] }
    })
    const repo = new BackofficeMemberAccessRepository()
    const work = mock(async () => "resultado")

    const outcome = await repo.runWithInviteLock("profile-1", work)

    expect(outcome.acquired).toBe(false)
    expect(work).not.toHaveBeenCalled()
  })

  it("sempre libera o lock e fecha a conexão, mesmo quando work() lança", async () => {
    const repo = new BackofficeMemberAccessRepository()
    const work = mock(async () => {
      throw new Error("boom")
    })

    await expect(repo.runWithInviteLock("profile-1", work)).rejects.toThrow("boom")

    const unlockCall = pgQueryMock.mock.calls.find((call) =>
      String((call as unknown as [string])[0]).includes("pg_advisory_unlock")
    )
    expect(unlockCall).toBeTruthy()
    expect(pgEndMock).toHaveBeenCalledTimes(1)
  })
})
