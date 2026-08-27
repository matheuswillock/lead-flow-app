import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { BackofficeMemberAccessProfileRecord } from "@/app/api/infra/data/repositories/backoffice/MemberAccessRepository/IBackofficeMemberAccessRepository"

/**
 * Entregável 3 (botão "Copiar link do convite") + Entregável 4 (falha nunca silenciosa):
 * `sendAccessEmail` já mapeia exceção -> Output(false, [msg]) no catch existente — a
 * correção real está em `sendBackofficeMemberAccessEmail` (lib/backoffice-member-access.ts,
 * testado à parte) agora de fato lançar quando o envio falha. Aqui cobrimos o novo
 * método `generateInviteLink`, que expõe `generateBackofficeInviteAccessLink` como Output.
 */

const findProfileAccessRecordMock = mock(
  async (_profileId: string): Promise<BackofficeMemberAccessProfileRecord | null> => ({
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

const { BackofficeMemberAccessEmailUseCase } = await import("./BackofficeMemberAccessEmailUseCase")

describe("BackofficeMemberAccessEmailUseCase", () => {
  beforeEach(() => {
    findProfileAccessRecordMock.mockClear()
    generateBackofficeInviteAccessLinkMock.mockClear()
    sendBackofficeMemberAccessEmailMock.mockClear()
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

  const repository = { findProfileAccessRecord: findProfileAccessRecordMock }

  describe("sendAccessEmail", () => {
    it("membro não encontrado → Output inválido, nunca chama o envio", async () => {
      findProfileAccessRecordMock.mockImplementation(async () => null)
      const useCase = new BackofficeMemberAccessEmailUseCase(repository)

      const output = await useCase.sendAccessEmail("profile-x", "invite")

      expect(output.isValid).toBe(false)
      expect(output.errorMessages[0]).toBe("Membro não encontrado")
      expect(sendBackofficeMemberAccessEmailMock).not.toHaveBeenCalled()
    })

    it("falha no envio (Error lançado por sendBackofficeMemberAccessEmail) → Output inválido com a mensagem real", async () => {
      sendBackofficeMemberAccessEmailMock.mockImplementation(async () => {
        throw new Error("Reenvio duplicado — aguarde alguns segundos e tente novamente.")
      })
      const useCase = new BackofficeMemberAccessEmailUseCase(repository)

      const output = await useCase.sendAccessEmail("profile-1", "invite")

      expect(output.isValid).toBe(false)
      expect(output.errorMessages[0]).toBe(
        "Reenvio duplicado — aguarde alguns segundos e tente novamente."
      )
    })

    it("sucesso → Output válido com email", async () => {
      const useCase = new BackofficeMemberAccessEmailUseCase(repository)

      const output = await useCase.sendAccessEmail("profile-1", "invite")

      expect(output.isValid).toBe(true)
      expect((output.result as { email: string }).email).toBe("ana@example.com")
    })
  })

  describe("generateInviteLink (Entregável 3)", () => {
    it("membro não encontrado → Output inválido", async () => {
      findProfileAccessRecordMock.mockImplementation(async () => null)
      const useCase = new BackofficeMemberAccessEmailUseCase(repository)

      const output = await useCase.generateInviteLink("profile-x")

      expect(output.isValid).toBe(false)
      expect(output.errorMessages[0]).toBe("Membro não encontrado")
    })

    it("sucesso → Output válido com actionLink no result", async () => {
      const useCase = new BackofficeMemberAccessEmailUseCase(repository)

      const output = await useCase.generateInviteLink("profile-1")

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

      const output = await useCase.generateInviteLink("profile-1")

      expect(output.isValid).toBe(false)
      expect(output.errorMessages[0]).toBe("Erro ao gerar link de convite")
    })
  })
})
