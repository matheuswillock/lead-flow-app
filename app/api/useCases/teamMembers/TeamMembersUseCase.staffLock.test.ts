import { describe, expect, it, mock } from "bun:test"

// O corretor (master) não remove usuários da equipe Corretor Studio: só o backoffice.

mock.module("server-only", () => ({}))

mock.module("next/cache", () => ({
  cacheLife: () => undefined,
  cacheTag: () => undefined,
  revalidateTag: () => undefined,
  revalidatePath: () => undefined,
  updateTag: () => undefined,
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}))

const { TeamMembersUseCase } = await import("./TeamMembersUseCase")

type FakeMember = { profileId: string; profile: { email: string } }

function buildUseCase(members: FakeMember[]) {
  const deleteMember = mock(async () => undefined)
  const repository = {
    findRequesterProfile: async () => ({ id: "master-1", fullName: "Master", email: "master@cliente.com" }),
    findTeam: async () => ({ id: "team-1", name: "Time", masterId: "master-1" }),
    findMembers: async () => members,
    findMemberSnapshot: async () => null,
    deleteMember,
  }
  const useCase = new TeamMembersUseCase(repository as never)
  return { useCase, deleteMember }
}

describe("TeamMembersUseCase.removeMember e a equipe Corretor Studio", () => {
  it("recusa remover usuário @corretorstudio.com.br", async () => {
    const { useCase, deleteMember } = buildUseCase([
      { profileId: "staff-1", profile: { email: "Suporte@CorretorStudio.com.br" } },
    ])

    const output = await useCase.removeMember("sb-master", "team-1", "staff-1")

    expect(output.isValid).toBe(false)
    expect(output.errorMessages.join(" ")).toContain("Acesso negado")
    expect(deleteMember).not.toHaveBeenCalled()
  })
})
