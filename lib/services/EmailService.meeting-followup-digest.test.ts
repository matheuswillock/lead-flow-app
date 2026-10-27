import { afterEach, describe, expect, it, mock } from "bun:test"

/**
 * SPEC 13 (Agenda na Criação de Lead), A-E1c — `sendMeetingFollowUpDigestEmail`
 * usava `data.crmUrl` direto num `href`, sem passar por `sanitizeEmailHref`
 * (DA8: `href` só aceita `https:`). T-13.1c cobre o controle negativo: tirar o
 * `sanitizeEmailHref` do `crmUrl` faz este teste falhar (o `javascript:`/`http:`
 * voltaria a virar `<a href>` clicável).
 */

const sendTrackedMock = mock(async (input: { html?: string }) => ({
  success: true as const,
  data: { data: { id: "resend-id-1" } },
  html: input.html,
}))

mock.module("@/lib/email/send-tracked-profile-email", () => ({
  sendTrackedEmailToProfileRecipients: sendTrackedMock,
}))

describe("EmailService.sendMeetingFollowUpDigestEmail — T-13.1c", () => {
  afterEach(() => {
    sendTrackedMock.mockClear()
  })

  it("crmUrl javascript: não vira href clicável (fica sem o botão)", async () => {
    const { createEmailService } = await import("./EmailService")
    const emailService = createEmailService()

    await emailService.sendMeetingFollowUpDigestEmail({
      profileId: "profile-1",
      to: "closer@example.com",
      recipientName: "Ana",
      leadCount: 2,
      role: "closer",
      crmUrl: "javascript:evilJs(document.cookie)",
    })

    const call = sendTrackedMock.mock.calls[0] as unknown as [{ html: string }]
    const html = call[0].html

    // Não vira link clicável — pode aparecer como texto inerte (R13-6), nunca
    // dentro de um atributo `href`.
    expect(html).not.toContain('<a href="javascript')
    expect(html).not.toContain('href="javascript')
  })

  it("crmUrl http: (sem TLS) não vira href clicável (aparece como texto)", async () => {
    const { createEmailService } = await import("./EmailService")
    const emailService = createEmailService()

    await emailService.sendMeetingFollowUpDigestEmail({
      profileId: "profile-1",
      to: "closer@example.com",
      recipientName: "Ana",
      leadCount: 1,
      role: "closer",
      crmUrl: "http://app.corretor.studio/board",
    })

    const call = sendTrackedMock.mock.calls[0] as unknown as [{ html: string }]
    const html = call[0].html

    expect(html).not.toContain('href="http://')
    expect(html).toContain("http://app.corretor.studio/board")
  })

  it("crmUrl https: válido vira o botão 'Abrir board no CRM'", async () => {
    const { createEmailService } = await import("./EmailService")
    const emailService = createEmailService()

    await emailService.sendMeetingFollowUpDigestEmail({
      profileId: "profile-1",
      to: "closer@example.com",
      recipientName: "Ana",
      leadCount: 3,
      role: "closer",
      crmUrl: "https://app.corretor.studio/board",
    })

    const call = sendTrackedMock.mock.calls[0] as unknown as [{ html: string }]
    const html = call[0].html

    expect(html).toContain('href="https://app.corretor.studio/board"')
    expect(html).toContain("Abrir board no CRM")
  })

  it("nome do destinatário e do time com HTML injetado saem escapados (DA8)", async () => {
    const { createEmailService } = await import("./EmailService")
    const emailService = createEmailService()

    await emailService.sendMeetingFollowUpDigestEmail({
      profileId: "profile-1",
      to: "master@example.com",
      recipientName: `Ana & "Zé" <teste>`,
      teamName: `<img src=x onerror=evilJs(1)>`,
      leadCount: 1,
      role: "master",
      crmUrl: "https://app.corretor.studio/board",
    })

    const call = sendTrackedMock.mock.calls[0] as unknown as [{ html: string }]
    const html = call[0].html

    expect(html).not.toContain("<img src=x")
    expect(html).not.toContain("<teste>")
    // R13-4: confirma que o texto foi escapado (não só que a tag sumiu por
    // outro motivo) — o nome aparece como entidade HTML.
    expect(html).toContain("&lt;teste&gt;")
    expect(html).toContain("&lt;img src=x onerror=evilJs(1)&gt;")
  })
})
