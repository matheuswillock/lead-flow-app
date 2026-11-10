import { describe, expect, it, mock } from "bun:test"
import type { TeamDeletionJobRecord } from "@/app/api/shared/teamDeletion/teamDeletionTypes"

// O aviso importa e-mail, notificações e repositórios do projeto (que carregam server-only e Prisma).
mock.module("server-only", () => ({}))
mock.module("@/lib/email/create-email-service", () => ({ createEmailService: () => ({}) }))
mock.module("@/app/api/services/notifications/NotificationService", () => ({ notificationService: {} }))
mock.module("@/app/api/infra/data/repositories/teamDeletion/TeamDeletionSnapshotRepository", () => ({
  teamDeletionSnapshotRepository: {},
}))
const { TeamExportNotifier } = await import("./TeamExportNotifier")

const job: TeamDeletionJobRecord = {
  id: "job-1",
  teamId: "team-gone",
  teamName: 'Time <b>Saúde</b>',
  requesterProfileId: "req-1",
  requesterEmail: "req@x.com",
  requesterName: "Maria & Cia",
  billingOwnerId: "master-1",
  status: "processing",
  attempts: 1,
  filePath: null,
  expiresAt: null,
  counts: null,
}
const expiresAt = new Date("2026-11-16T15:00:00.000Z")

function build(anotherTeamId: string | null = "team-kept") {
  const email = { sendEmailUntracked: mock(async (_options: { to: string[]; subject: string; html: string; text?: string }) => ({ success: true })) }
  const notifications = {
    createSystemNotification: mock(async (_input: { teamId: string; recipientProfileId: string; type: string; message: string; metadata: unknown }) => ({})),
  }
  const teams = { findAnotherTeamId: mock(async (_profileId: string, _excludeTeamId: string) => anotherTeamId) }
  const notifier = new TeamExportNotifier(email, notifications, teams, (path) => `https://app.test${path}`)
  return { notifier, email, notifications, teams }
}

describe("TeamExportNotifier.notifyReady", () => {
  it("manda e-mail com o link de download (exige login), o prazo e o aviso de dados pessoais", async () => {
    const { notifier, email } = build()

    await notifier.notifyReady(job, { expiresAt })

    const options = email.sendEmailUntracked.mock.calls[0][0]
    expect(options.to).toEqual(["req@x.com"])
    expect(options.html).toContain("https://app.test/api/q/teams/exports/job-1/download")
    expect(options.html).toContain("16/11/2026")
    expect(options.html).toContain("dados pessoais")
    expect(options.text).toContain("https://app.test/api/q/teams/exports/job-1/download")
  })

  it("escapa o HTML do nome do time e da pessoa no e-mail", async () => {
    const { notifier, email } = build()

    await notifier.notifyReady(job, { expiresAt })

    const html = email.sendEmailUntracked.mock.calls[0][0].html
    expect(html).not.toContain("<b>Saúde</b>")
    expect(html).toContain("&lt;b&gt;Sa")
    expect(html).toContain("Maria &amp; Cia")
  })

  it("cria a notificação na plataforma ligada a OUTRO time que continua existindo, com o link de download", async () => {
    const { notifier, notifications, teams } = build("team-kept")

    await notifier.notifyReady(job, { expiresAt })

    expect(teams.findAnotherTeamId).toHaveBeenCalledWith("req-1", "team-gone")
    const input = notifications.createSystemNotification.mock.calls[0][0]
    expect(input).toMatchObject({ teamId: "team-kept", recipientProfileId: "req-1", type: "TEAM_EXPORT_READY" })
    expect(input.metadata).toMatchObject({ href: "/api/q/teams/exports/job-1/download" })
  })

  it("sem outro time, só o e-mail (a notificação ficaria presa ao time excluído)", async () => {
    const { notifier, email, notifications } = build(null)

    await notifier.notifyReady(job, { expiresAt })

    expect(email.sendEmailUntracked).toHaveBeenCalledTimes(1)
    expect(notifications.createSystemNotification).not.toHaveBeenCalled()
  })

  it("se o e-mail falhar, a notificação na plataforma ainda é criada", async () => {
    const { notifier, email, notifications } = build()
    email.sendEmailUntracked.mockRejectedValue(new Error("e-mail fora"))

    await notifier.notifyReady(job, { expiresAt })

    expect(notifications.createSystemNotification).toHaveBeenCalledTimes(1)
  })
})

describe("TeamExportNotifier.notifyFailed", () => {
  it("avisa que o time NÃO foi excluído, por e-mail e por notificação no time que continua existindo", async () => {
    const { notifier, email, notifications } = build()

    await notifier.notifyFailed({ ...job, teamId: "team-still-here" }, "falha interna")

    const options = email.sendEmailUntracked.mock.calls[0][0]
    expect(options.subject).toContain("não foi excluído")
    expect(options.html).toContain("não foi excluído")
    expect(notifications.createSystemNotification.mock.calls[0][0]).toMatchObject({ type: "TEAM_EXPORT_FAILED" })
  })

  it("o time ainda existe: a notificação de falha fica no próprio time, quando não há outro", async () => {
    const { notifier, notifications } = build(null)

    await notifier.notifyFailed({ ...job, teamId: "team-still-here" }, "falha interna")

    expect(notifications.createSystemNotification.mock.calls[0][0]).toMatchObject({ teamId: "team-still-here" })
  })
})
