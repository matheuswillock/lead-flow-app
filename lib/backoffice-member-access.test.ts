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
    }) as unknown,
)

let e2eTestModeEnabled = false
let authUserLastSignInAt: string | null = null

mock.module("@/lib/e2e/is-e2e-test-mode", () => ({
  isE2eTestMode: () => e2eTestModeEnabled,
}))

mock.module("@/lib/supabase/server", () => ({
  createSupabaseAdmin: () => ({
    auth: {
      admin: {
        generateLink: generateLinkMock,
        getUserById: async () => ({
          data: { user: authUserLastSignInAt ? { last_sign_in_at: authUserLastSignInAt } : null },
          error: null,
        }),
      },
    },
  }),
}))

mock.module("@/lib/utils/app-url", () => ({
  getFullUrl: (path: string) => `https://app.local${path}`,
}))

const sendOperatorInviteEmailMock = mock(
  async (_data: unknown) =>
    ({ success: true as const, data: { data: { id: "resend-1" } } }) as unknown,
)
const sendPasswordResetEmailMock = mock(
  async (..._args: unknown[]) =>
    ({ success: true as const, data: { data: { id: "resend-2" } } }) as unknown,
)
const auditCreateFlowMock = mock(async () => ({ id: "flow-1" }))
const auditRecordLinkGeneratedMock = mock(async () => undefined)
const auditRecordEmailSentMock = mock(async () => undefined)
const auditRecordEmailFailedMock = mock(async () => undefined)
const auditRecordFailureMock = mock(async () => undefined)

mock.module("@/lib/services/EmailService", () => ({
  createEmailService: () => ({
    sendOperatorInviteEmail: sendOperatorInviteEmailMock,
    sendPasswordResetEmail: sendPasswordResetEmailMock,
  }),
}))

mock.module("@/app/api/services/passwordResetAudit/PasswordResetAuditService", () => ({
  passwordResetAuditService: {
    createFlow: auditCreateFlowMock,
    recordLinkGenerated: auditRecordLinkGeneratedMock,
    recordEmailSent: auditRecordEmailSentMock,
    recordEmailFailed: auditRecordEmailFailedMock,
    recordFailure: auditRecordFailureMock,
  },
}))

const { sendBackofficeMemberAccessEmail, generateBackofficeInviteAccessLink } =
  await import("./backoffice-member-access")

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
    auditCreateFlowMock.mockClear()
    auditRecordLinkGeneratedMock.mockClear()
    auditRecordEmailSentMock.mockClear()
    auditRecordEmailFailedMock.mockClear()
    auditRecordFailureMock.mockClear()
    authUserLastSignInAt = null
    generateLinkMock.mockImplementation(
      async () =>
        ({
          data: { properties: { action_link: "https://app.local/set-password?token=NEW" } },
          error: null,
        }) as unknown,
    )
  })

  it("envio com sucesso: retorna normalmente", async () => {
    sendOperatorInviteEmailMock.mockImplementation(async () => ({
      success: true,
      data: { data: { id: "resend-1" } },
    }))

    const result = await sendBackofficeMemberAccessEmail({
      profile: pendingProfile,
      mode: "invite",
    })

    expect(result.email).toBe("ana@example.com")
  })

  it("reset de membro cria o fluxo, registra link/envio e correlaciona o dispatch", async () => {
    authUserLastSignInAt = "2026-10-20T10:00:00.000Z"

    const result = await sendBackofficeMemberAccessEmail({
      profile: pendingProfile,
      mode: "reset_password",
    })

    expect(result.email).toBe("ana@example.com")
    expect(auditCreateFlowMock).toHaveBeenCalledWith({
      profileId: "profile-1",
      recipientEmail: "ana@example.com",
      userAgent: "backoffice",
      originScreen: "backoffice_member_access",
    })
    expect(auditRecordLinkGeneratedMock).toHaveBeenCalledWith("flow-1")
    expect(auditRecordEmailSentMock).toHaveBeenCalledWith("flow-1", {
      dispatchId: null,
      resendEmailId: "resend-2",
    })
    expect(sendPasswordResetEmailMock).toHaveBeenCalledWith(
      "ana@example.com",
      "Ana Souza",
      "https://app.local/set-password?token=NEW&flowId=flow-1",
      {
        profileId: "profile-1",
        sourceType: "password_reset",
        sourceId: "flow-1",
        recipientEmail: "ana@example.com",
      },
    )
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
    e2eTestModeEnabled = false
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

  it("em modo E2E retorna link local sem acessar o Supabase Admin", async () => {
    e2eTestModeEnabled = true

    const result = await generateBackofficeInviteAccessLink(pendingProfile)

    expect(result.actionLink).toBe(
      "https://app.local/set-password?token_hash=e2e-invite-profile-1&type=invite",
    )
    expect(result.email).toBe("ana@example.com")
    expect(generateLinkMock).not.toHaveBeenCalled()
  })
})
