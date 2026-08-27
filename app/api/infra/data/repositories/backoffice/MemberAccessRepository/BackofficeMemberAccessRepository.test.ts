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
