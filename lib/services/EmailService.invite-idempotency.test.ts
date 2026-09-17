import { afterEach, describe, expect, it, mock } from "bun:test"

/**
 * Bug reenvio de convite (2026-08-27): `sendOperatorInviteEmail`/`sendPasswordResetEmail`
 * usavam `idempotencyKey: "operator-invite/" + sourceId` — estável para sempre pela
 * pessoa, enquanto o corpo do e-mail muda a cada tentativa (link de convite/reset novo
 * gerado pelo Supabase a cada clique em "Reenviar"). Chave igual + corpo diferente
 * dentro de 24h é o 409 do Resend ("idempotency key has been used... but the request
 * body was modified"). A chave precisa variar com o conteúdo: mesmo corpo → mesma
 * chave (deduplica retry real); corpo novo → chave nova (reenvio legítimo passa).
 */

const sendTrackedMock = mock(async (input: { idempotencyKey?: string }) => ({
  success: true as const,
  data: { data: { id: "resend-id-1" } },
  idempotencyKeySeen: input.idempotencyKey,
}))

mock.module("@/lib/email/send-tracked-profile-email", () => ({
  sendTrackedEmailToProfileRecipients: sendTrackedMock,
}))

describe("EmailService — chave de idempotência por conteúdo (não por pessoa)", () => {
  afterEach(() => {
    sendTrackedMock.mockClear()
  })

  it("sendOperatorInviteEmail: mesmo inviteUrl duas vezes → mesma idempotencyKey", async () => {
    const { createEmailService } = await import("./EmailService")
    const emailService = createEmailService()

    await emailService.sendOperatorInviteEmail({
      operatorName: "Ana",
      operatorEmail: "ana@example.com",
      operatorRole: "operator",
      managerName: "Time X",
      inviteUrl: "https://app.local/set-password?token=AAA",
      profileId: "profile-1",
      sourceType: "member_access",
      sourceId: "profile-1",
    })
    const firstCall = sendTrackedMock.mock.calls[0] as unknown as [{ idempotencyKey?: string }]
    const firstKey = firstCall[0].idempotencyKey

    await emailService.sendOperatorInviteEmail({
      operatorName: "Ana",
      operatorEmail: "ana@example.com",
      operatorRole: "operator",
      managerName: "Time X",
      inviteUrl: "https://app.local/set-password?token=AAA",
      profileId: "profile-1",
      sourceType: "member_access",
      sourceId: "profile-1",
    })
    const secondCall = sendTrackedMock.mock.calls[1] as unknown as [{ idempotencyKey?: string }]
    const secondKey = secondCall[0].idempotencyKey

    expect(firstKey).toBeTruthy()
    expect(firstKey).toBe(secondKey)
  })

  it("sendOperatorInviteEmail: inviteUrl novo (reenvio real) → idempotencyKey NOVA (regressão do 409)", async () => {
    const { createEmailService } = await import("./EmailService")
    const emailService = createEmailService()

    await emailService.sendOperatorInviteEmail({
      operatorName: "Ana",
      operatorEmail: "ana@example.com",
      operatorRole: "operator",
      managerName: "Time X",
      inviteUrl: "https://app.local/set-password?token=AAA",
      profileId: "profile-1",
      sourceType: "member_access",
      sourceId: "profile-1",
    })
    const firstKey = (sendTrackedMock.mock.calls[0] as unknown as [{ idempotencyKey?: string }])[0]
      .idempotencyKey

    await emailService.sendOperatorInviteEmail({
      operatorName: "Ana",
      operatorEmail: "ana@example.com",
      operatorRole: "operator",
      managerName: "Time X",
      inviteUrl: "https://app.local/set-password?token=BBB-reenvio",
      profileId: "profile-1",
      sourceType: "member_access",
      sourceId: "profile-1",
    })
    const secondKey = (sendTrackedMock.mock.calls[1] as unknown as [{ idempotencyKey?: string }])[0]
      .idempotencyKey

    expect(firstKey).not.toBe(secondKey)
  })

  it("sendOperatorInviteEmail: duas pessoas diferentes nunca colidem na mesma chave", async () => {
    const { createEmailService } = await import("./EmailService")
    const emailService = createEmailService()

    await emailService.sendOperatorInviteEmail({
      operatorName: "Ana",
      operatorEmail: "ana@example.com",
      operatorRole: "operator",
      managerName: "Time X",
      inviteUrl: "https://app.local/set-password?token=SAME",
      profileId: "profile-1",
      sourceType: "member_access",
      sourceId: "profile-1",
    })
    const firstKey = (sendTrackedMock.mock.calls[0] as unknown as [{ idempotencyKey?: string }])[0]
      .idempotencyKey

    await emailService.sendOperatorInviteEmail({
      operatorName: "Bia",
      operatorEmail: "bia@example.com",
      operatorRole: "operator",
      managerName: "Time X",
      inviteUrl: "https://app.local/set-password?token=SAME",
      profileId: "profile-2",
      sourceType: "member_access",
      sourceId: "profile-2",
    })
    const secondKey = (sendTrackedMock.mock.calls[1] as unknown as [{ idempotencyKey?: string }])[0]
      .idempotencyKey

    expect(firstKey).not.toBe(secondKey)
  })

  it("sendPasswordResetEmail: mesmo resetUrl duas vezes → mesma idempotencyKey", async () => {
    const { createEmailService } = await import("./EmailService")
    const emailService = createEmailService()

    await emailService.sendPasswordResetEmail(
      "ana@example.com",
      "Ana",
      "https://app.local/set-password?token=RESET-AAA",
      { profileId: "profile-1", sourceType: "member_access", sourceId: "profile-1" }
    )
    const firstKey = (sendTrackedMock.mock.calls[0] as unknown as [{ idempotencyKey?: string }])[0]
      .idempotencyKey

    await emailService.sendPasswordResetEmail(
      "ana@example.com",
      "Ana",
      "https://app.local/set-password?token=RESET-AAA",
      { profileId: "profile-1", sourceType: "member_access", sourceId: "profile-1" }
    )
    const secondKey = (sendTrackedMock.mock.calls[1] as unknown as [{ idempotencyKey?: string }])[0]
      .idempotencyKey

    expect(firstKey).toBeTruthy()
    expect(firstKey).toBe(secondKey)
  })

  it("sendPasswordResetEmail: resetUrl novo (reenvio real) → idempotencyKey NOVA", async () => {
    const { createEmailService } = await import("./EmailService")
    const emailService = createEmailService()

    await emailService.sendPasswordResetEmail(
      "ana@example.com",
      "Ana",
      "https://app.local/set-password?token=RESET-AAA",
      { profileId: "profile-1", sourceType: "member_access", sourceId: "profile-1" }
    )
    const firstKey = (sendTrackedMock.mock.calls[0] as unknown as [{ idempotencyKey?: string }])[0]
      .idempotencyKey

    await emailService.sendPasswordResetEmail(
      "ana@example.com",
      "Ana",
      "https://app.local/set-password?token=RESET-BBB",
      { profileId: "profile-1", sourceType: "member_access", sourceId: "profile-1" }
    )
    const secondKey = (sendTrackedMock.mock.calls[1] as unknown as [{ idempotencyKey?: string }])[0]
      .idempotencyKey

    expect(firstKey).not.toBe(secondKey)
  })
})
