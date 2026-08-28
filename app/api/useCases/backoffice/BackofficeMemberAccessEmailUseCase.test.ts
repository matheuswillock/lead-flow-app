import { beforeEach, describe, expect, it, mock } from "bun:test"
import type {
  BackofficeInviteLockOutcome,
  BackofficeMemberAccessProfileRecord,
  IBackofficeMemberAccessRepository,
} from "@/app/api/infra/data/repositories/backoffice/MemberAccessRepository/IBackofficeMemberAccessRepository"

/**
 * Entregável 3 (botão "Copiar link do convite") + Entregável 4 (falha nunca silenciosa):
 * `sendAccessEmail` já mapeia exceção -> Output(false, [msg]) no catch existente — a
 * correção real está em `sendBackofficeMemberAccessEmail` (lib/backoffice-member-access.ts,
 * testado à parte) agora de fato lançar quando o envio falha. Aqui cobrimos o novo
 * método `generateInviteLink`, que expõe `generateBackofficeInviteAccessLink` como Output.
 */

const findProfileAccessRecordMock = mock(
  async (_input: {
    profileId: string
    accountMasterId: string
  }): Promise<BackofficeMemberAccessProfileRecord | null> => ({
    profileId: "profile-1",
    supabaseId: "supa-1",
    email: "ana@example.com",
    fullName: "Ana Souza",
    role: "operator" as const,
    isMaster: false,
    managerName: "Carlos Mestre",
  })
)

const generateBackofficeInviteAccessLinkMock = mock(
  async (_profile: unknown) =>
    ({ actionLink: "https://app.local/set-password?token=NEW", email: "ana@example.com" }) as unknown
)
const sendBackofficeMemberAccessEmailMock = mock(
  async (_input: unknown) =>
    ({
      email: "ana@example.com",
      access: { accessStatus: "pending_first_access", hasCompletedFirstAccess: false, lastSignInAt: null },
    }) as unknown
)

mock.module("@/lib/backoffice-member-access", () => ({
  sendBackofficeMemberAccessEmail: sendBackofficeMemberAccessEmailMock,
  generateBackofficeInviteAccessLink: generateBackofficeInviteAccessLinkMock,
}))

// Default: lock sempre disponível (roda `work()` normalmente) — os testes de
// "lock ocupado" abaixo sobrescrevem isso pontualmente.
const runWithInviteLockMock = mock(
  async (
    _profileId: string,
    work: () => Promise<unknown>
  ): Promise<BackofficeInviteLockOutcome<unknown>> => ({
    acquired: true,
    result: await work(),
  })
)

const { BackofficeMemberAccessEmailUseCase } = await import("./BackofficeMemberAccessEmailUseCase")

function createMemberAccessInput(mode: "invite" | "reset_password") {
  return { profileId: "profile-1", accountMasterId: "master-1", mode }
}

describe("BackofficeMemberAccessEmailUseCase", () => {
  beforeEach(() => {
    findProfileAccessRecordMock.mockClear()
    generateBackofficeInviteAccessLinkMock.mockClear()
    sendBackofficeMemberAccessEmailMock.mockClear()
    runWithInviteLockMock.mockClear()
    runWithInviteLockMock.mockImplementation(
      async (
        _profileId: string,
        work: () => Promise<unknown>
      ): Promise<BackofficeInviteLockOutcome<unknown>> => ({
        acquired: true,
        result: await work(),
      })
    )
    findProfileAccessRecordMock.mockImplementation(async () => ({
      profileId: "profile-1",
      supabaseId: "supa-1",
      email: "ana@example.com",
      fullName: "Ana Souza",
      role: "operator" as const,
      isMaster: false,
      managerName: "Carlos Mestre",
    }))
    generateBackofficeInviteAccessLinkMock.mockImplementation(async () => ({
      actionLink: "https://app.local/set-password?token=NEW",
      email: "ana@example.com",
    }))
    sendBackofficeMemberAccessEmailMock.mockImplementation(async () => ({
      email: "ana@example.com",
      access: {
        accessStatus: "pending_first_access",
        hasCompletedFirstAccess: false,
        lastSignInAt: null,
      },
    }))
  })

  const repository: IBackofficeMemberAccessRepository = {
    findProfileAccessRecord: findProfileAccessRecordMock,
    runWithInviteLock: <T>(profileId: string, work: () => Promise<T>) =>
      runWithInviteLockMock(profileId, work) as Promise<BackofficeInviteLockOutcome<T>>,
  }

  describe("sendAccessEmail", () => {
    it("membro não encontrado → Output inválido, nunca chama o envio", async () => {
      findProfileAccessRecordMock.mockImplementation(async () => null)
      const useCase = new BackofficeMemberAccessEmailUseCase(repository)

      const output = await useCase.sendAccessEmail({
        profileId: "profile-x",
        accountMasterId: "master-1",
        mode: "invite",
      })

      expect(output.isValid).toBe(false)
      expect(output.errorMessages[0]).toBe("Membro não encontrado")
      expect(sendBackofficeMemberAccessEmailMock).not.toHaveBeenCalled()
    })

    it("falha no envio (Error lançado por sendBackofficeMemberAccessEmail) → Output inválido com a mensagem real", async () => {
      sendBackofficeMemberAccessEmailMock.mockImplementation(async () => {
        throw new Error("Reenvio duplicado — aguarde alguns segundos e tente novamente.")
      })
      const useCase = new BackofficeMemberAccessEmailUseCase(repository)

      const output = await useCase.sendAccessEmail(createMemberAccessInput("invite"))

      expect(output.isValid).toBe(false)
      expect(output.errorMessages[0]).toBe(
        "Reenvio duplicado — aguarde alguns segundos e tente novamente."
      )
    })

    it("sucesso → Output válido com email", async () => {
      const useCase = new BackofficeMemberAccessEmailUseCase(repository)

      const output = await useCase.sendAccessEmail(createMemberAccessInput("invite"))

      expect(output.isValid).toBe(true)
      expect((output.result as { email: string }).email).toBe("ana@example.com")
    })

    it("lock ocupado (requisição concorrente pro mesmo perfil) → Output de erro específico de concorrência, não a mensagem genérica de falha", async () => {
      runWithInviteLockMock.mockImplementation(async () => ({ acquired: false as const }))
      const useCase = new BackofficeMemberAccessEmailUseCase(repository)

      const output = await useCase.sendAccessEmail(createMemberAccessInput("invite"))

      expect(output.isValid).toBe(false)
      expect(output.errorMessages[0]).toBe(
        "Já existe um envio em andamento para este membro. Aguarde alguns segundos e tente novamente."
      )
      // A chamada real a sendBackofficeMemberAccessEmail só acontece DENTRO do
      // callback `work` passado a runWithInviteLock — neste teste o mock do
      // lock nunca invoca `work`, então isto valida que o UseCase não chama
      // sendBackofficeMemberAccessEmail nenhuma outra vez fora desse caminho.
      expect(sendBackofficeMemberAccessEmailMock).not.toHaveBeenCalled()
    })
  })

  describe("generateInviteLink (Entregável 3)", () => {
    it("membro não encontrado → Output inválido", async () => {
      findProfileAccessRecordMock.mockImplementation(async () => null)
      const useCase = new BackofficeMemberAccessEmailUseCase(repository)

      const output = await useCase.generateInviteLink({
        profileId: "profile-x",
        accountMasterId: "master-1",
      })

      expect(output.isValid).toBe(false)
      expect(output.errorMessages[0]).toBe("Membro não encontrado")
    })

    it("sucesso → Output válido com actionLink no result", async () => {
      const useCase = new BackofficeMemberAccessEmailUseCase(repository)

      const output = await useCase.generateInviteLink({
        profileId: "profile-1",
        accountMasterId: "master-1",
      })

      expect(output.isValid).toBe(true)
      expect((output.result as { actionLink: string }).actionLink).toBe(
        "https://app.local/set-password?token=NEW"
      )
    })

    it("falha ao gerar link → Output inválido com a mensagem real", async () => {
      generateBackofficeInviteAccessLinkMock.mockImplementation(async () => {
        throw new Error("Erro ao gerar link de convite")
      })
      const useCase = new BackofficeMemberAccessEmailUseCase(repository)

      const output = await useCase.generateInviteLink({
        profileId: "profile-1",
        accountMasterId: "master-1",
      })

      expect(output.isValid).toBe(false)
      expect(output.errorMessages[0]).toBe("Erro ao gerar link de convite")
    })

    it("lock ocupado (requisição concorrente pro mesmo perfil) → Output de erro específico de concorrência, não a mensagem genérica de falha", async () => {
      runWithInviteLockMock.mockImplementation(async () => ({ acquired: false as const }))
      const useCase = new BackofficeMemberAccessEmailUseCase(repository)

      const output = await useCase.generateInviteLink({
        profileId: "profile-1",
        accountMasterId: "master-1",
      })

      expect(output.isValid).toBe(false)
      expect(output.errorMessages[0]).toBe(
        "Já existe uma geração de link em andamento para este membro. Aguarde alguns segundos e tente novamente."
      )
      expect(generateBackofficeInviteAccessLinkMock).not.toHaveBeenCalled()
    })
  })
})
