import { afterEach, describe, expect, it, mock } from "bun:test"

/**
 * Bug reenvio de convite (2026-08-27), duas falhas de propagação distintas:
 *
 * 1. `sendBackofficeMemberAccessEmail` fazia `await emailService.sendOperatorInviteEmail(...)`
 *    e descartava o resultado — `EmailService` NUNCA lança em falha de envio, devolve
 *    `{ success: false, error }`. Mesmo um 409 real do Resend virava
 *    `Output(true, ["Convite reenviado com sucesso."])` para quem clicou: falha muda,
 *    dispatch gravado `failed` no banco, ninguém vê nada na tela.
 * 2. O 409 específico de idempotência precisa virar mensagem acionável, não o texto
 *    técnico do Resend.
 */

const generateLinkMock = mock(
  async (_args: { type: string; email: string; options?: unknown }) =>
    ({
      data: { properties: { action_link: "https://app.local/set-password?token=NEW" } },
      error: null as { message: string } | null,
    }) as unknown
)

mock.module("@/lib/supabase/server", () => ({
  createSupabaseAdmin: () => ({
    auth: {
      admin: {
        generateLink: generateLinkMock,
        getUserById: async () => ({ data: { user: null }, error: null }),
      },
    },
  }),
}))

mock.module("@/lib/utils/app-url", () => ({
  getFullUrl: (path: string) => `https://app.local${path}`,
}))

const sendOperatorInviteEmailMock = mock(
  async (_data: unknown) => ({ success: true as const, data: { data: { id: "resend-1" } } }) as unknown
)
const sendPasswordResetEmailMock = mock(
  async (..._args: unknown[]) => ({ success: true as const, data: { data: { id: "resend-2" } } }) as unknown
)

mock.module("@/lib/services/EmailService", () => ({
  createEmailService: () => ({
    sendOperatorInviteEmail: sendOperatorInviteEmailMock,
    sendPasswordResetEmail: sendPasswordResetEmailMock,
  }),
}))

const {
  sendBackofficeMemberAccessEmail,
  generateBackofficeInviteAccessLink,
} = await import("./backoffice-member-access")

const pendingProfile = {
  profileId: "profile-1",
  supabaseId: "supa-1",
  email: "ana@example.com",
  fullName: "Ana Souza",
  role: "operator" as const,
  managerName: "Carlos Mestre",
}

describe("sendBackofficeMemberAccessEmail — falha de envio nunca é silenciosa", () => {
  afterEach(() => {
    generateLinkMock.mockClear()
    sendOperatorInviteEmailMock.mockClear()
    sendPasswordResetEmailMock.mockClear()
    generateLinkMock.mockImplementation(
      async () =>
        ({
          data: { properties: { action_link: "https://app.local/set-password?token=NEW" } },
          error: null,
        }) as unknown
    )
  })

  it("envio com sucesso: retorna normalmente", async () => {
    sendOperatorInviteEmailMock.mockImplementation(async () => ({
      success: true,
      data: { data: { id: "resend-1" } },
    }))

    const result = await sendBackofficeMemberAccessEmail({ profile: pendingProfile, mode: "invite" })

    expect(result.email).toBe("ana@example.com")
  })

  it("EmailService devolve success:false (409 real do Resend) → a função LANÇA, não retorna sucesso silencioso", async () => {
    sendOperatorInviteEmailMock.mockImplementation(async () => ({
      success: false,
      error:
        "This idempotency key has been used with this HTTP method and endpoint within the last 24 hours, but the request body was modified and doesn't match the original request.",
    }))

    let caught: unknown = null
    try {
      await sendBackofficeMemberAccessEmail({ profile: pendingProfile, mode: "invite" })
    } catch (err) {
      caught = err
    }

    expect(caught).not.toBeNull()
  })

  it("409 de idempotência vira mensagem acionável, não o texto técnico do Resend", async () => {
    sendOperatorInviteEmailMock.mockImplementation(async () => ({
      success: false,
      error:
        "This idempotency key has been used with this HTTP method and endpoint within the last 24 hours, but the request body was modified and doesn't match the original request.",
    }))

    let caught: unknown = null
    try {
      await sendBackofficeMemberAccessEmail({ profile: pendingProfile, mode: "invite" })
    } catch (err) {
      caught = err
    }

    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).message).not.toContain("idempotency key")
    expect((caught as Error).message.toLowerCase()).toContain("reenvio")
  })

  it("falha de provedor genérica (não-409) ainda propaga a mensagem original", async () => {
    sendOperatorInviteEmailMock.mockImplementation(async () => ({
      success: false,
      error: "Resend API key inválida",
    }))

    let caught: unknown = null
    try {
      await sendBackofficeMemberAccessEmail({ profile: pendingProfile, mode: "invite" })
    } catch (err) {
      caught = err
    }

    expect((caught as Error).message).toContain("Resend API key inválida")
  })
})

describe("generateBackofficeInviteAccessLink — Entregável 3 (copiar link, sem enviar e-mail)", () => {
  afterEach(() => {
    generateLinkMock.mockClear()
    sendOperatorInviteEmailMock.mockClear()
  })

  it("gera o link novo e NÃO dispara e-mail", async () => {
    const result = await generateBackofficeInviteAccessLink(pendingProfile)

    expect(result.actionLink).toBe("https://app.local/set-password?token=NEW")
    expect(result.email).toBe("ana@example.com")
    expect(sendOperatorInviteEmailMock).not.toHaveBeenCalled()
  })

  it("propaga erro do Supabase Admin em vez de devolver link vazio", async () => {
    generateLinkMock.mockImplementation(async () => ({
      data: null,
      error: { message: "Erro ao gerar link de convite" },
    }))

    let caught: unknown = null
    try {
      await generateBackofficeInviteAccessLink(pendingProfile)
    } catch (err) {
      caught = err
    }

    expect(caught).not.toBeNull()
  })
})
