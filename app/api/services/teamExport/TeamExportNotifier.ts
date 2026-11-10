import { NotificationType, type Prisma } from "@prisma/client"
import { teamDeletionSnapshotRepository } from "@/app/api/infra/data/repositories/teamDeletion/TeamDeletionSnapshotRepository"
import { notificationService } from "../notifications/NotificationService"
import type { ITeamExportNotifier, TeamDeletionJobRecord } from "@/app/api/shared/teamDeletion/teamDeletionTypes"
import { escapeHtml } from "@/lib/email/escape-html"
import { API_CLIENT_BASE } from "@/lib/route-map"
import { createEmailService } from "@/lib/email/create-email-service"
import { getFullUrl } from "@/lib/utils/app-url"

export interface IExportEmailSender {
  sendEmailUntracked(options: { to: string[]; subject: string; html: string; text?: string }): Promise<unknown>
}

export interface IExportNotificationWriter {
  createSystemNotification(input: {
    teamId: string
    recipientProfileId: string
    type: NotificationType
    message: string
    metadata: Prisma.InputJsonValue
  }): Promise<unknown>
}

export interface IAnotherTeamFinder {
  findAnotherTeamId(profileId: string, excludeTeamId: string): Promise<string | null>
}

const DOWNLOAD_PATH = (jobId: string) => `${API_CLIENT_BASE}/teams/exports/${jobId}/download`

function formatDateBr(date: Date): string {
  return date.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function wrap(bodyHtml: string): string {
  return `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1C1B22;line-height:1.6">${bodyHtml}</div>`
}

/** Avisa quem pediu a exportação, por e-mail e por notificação na plataforma. */
export class TeamExportNotifier implements ITeamExportNotifier {
  constructor(
    private readonly email: IExportEmailSender = { sendEmailUntracked: (options) => createEmailService().sendEmailUntracked(options) },
    private readonly notifications: IExportNotificationWriter = notificationService,
    private readonly teams: IAnotherTeamFinder = teamDeletionSnapshotRepository,
    private readonly buildUrl: (path: string) => string = getFullUrl,
  ) {}

  async notifyReady(job: TeamDeletionJobRecord, input: { expiresAt: Date }): Promise<void> {
    const link = this.buildUrl(DOWNLOAD_PATH(job.id))
    const until = formatDateBr(input.expiresAt)
    const teamName = escapeHtml(job.teamName)

    await this.safely("e-mail", () =>
      this.email.sendEmailUntracked({
        to: [job.requesterEmail],
        subject: `A exportação do time ${job.teamName} está pronta`,
        html: wrap(`
          <p>Olá, ${escapeHtml(job.requesterName)}.</p>
          <p>O time <strong>${teamName}</strong> foi excluído e o arquivo com as informações dele está pronto.</p>
          <p><a href="${escapeHtml(link)}" style="display:inline-block;background:#ff6900;color:#fff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:600">Baixar exportação</a></p>
          <p>O arquivo fica disponível até <strong>${until}</strong>. Para baixar, entre na sua conta do Corretor Studio neste mesmo navegador.</p>
          <p style="font-size:13px;color:#6E6D7A">O arquivo contém dados pessoais de terceiros, como leads e clientes, e pode incluir dados sensíveis. Pela LGPD, o cliente é o Controlador desses dados e responde pela guarda e pelo uso do arquivo. Guarde em local seguro e apague quando não precisar mais.</p>
        `),
        text: `Olá, ${job.requesterName}. O time ${job.teamName} foi excluído e o arquivo com as informações dele está pronto. Baixe em ${link} até ${until}, com sua conta do Corretor Studio aberta. O arquivo contém dados pessoais de terceiros: guarde em local seguro.`,
      }),
    )

    // O time foi excluído e leva as notificações dele junto: a do arquivo fica em outro time do usuário.
    await this.safely("notificação", async () => {
      const keptTeamId = await this.teams.findAnotherTeamId(job.requesterProfileId, job.teamId)
      if (!keptTeamId) return
      await this.notifications.createSystemNotification({
        teamId: keptTeamId,
        recipientProfileId: job.requesterProfileId,
        type: NotificationType.TEAM_EXPORT_READY,
        message: `A exportação do time ${job.teamName} está pronta. Baixe até ${until}.`,
        metadata: { event: "TEAM_EXPORT_READY", href: DOWNLOAD_PATH(job.id), teamName: job.teamName },
      })
    })
  }

  async notifyFailed(job: TeamDeletionJobRecord, reason: string): Promise<void> {
    const teamName = escapeHtml(job.teamName)

    await this.safely("e-mail", () =>
      this.email.sendEmailUntracked({
        to: [job.requesterEmail],
        subject: `Não foi possível exportar o time ${job.teamName}: o time não foi excluído`,
        html: wrap(`
          <p>Olá, ${escapeHtml(job.requesterName)}.</p>
          <p>Não conseguimos concluir a exportação do time <strong>${teamName}</strong>, por isso <strong>o time não foi excluído</strong> e continua com todos os dados.</p>
          <p>Você pode tentar excluir novamente. Se o problema persistir, fale com o suporte.</p>
        `),
        text: `Olá, ${job.requesterName}. Não conseguimos concluir a exportação do time ${job.teamName}, por isso o time não foi excluído e continua com todos os dados. Tente novamente; se persistir, fale com o suporte.`,
      }),
    )

    // Aqui o time ainda existe: a notificação fica nele mesmo.
    await this.safely("notificação", () =>
      this.notifications.createSystemNotification({
        teamId: job.teamId,
        recipientProfileId: job.requesterProfileId,
        type: NotificationType.TEAM_EXPORT_FAILED,
        message: `A exportação do time ${job.teamName} falhou e o time não foi excluído. Tente novamente.`,
        metadata: { event: "TEAM_EXPORT_FAILED", reason: reason.slice(0, 300) },
      }),
    )
  }

  private async safely(step: string, run: () => Promise<unknown>): Promise<void> {
    try {
      await run()
    } catch (error) {
      console.error(`[TeamExportNotifier] falha ao enviar ${step}`, {
        message: error instanceof Error ? error.message : "unknown",
      })
    }
  }
}

export const teamExportNotifier = new TeamExportNotifier()
