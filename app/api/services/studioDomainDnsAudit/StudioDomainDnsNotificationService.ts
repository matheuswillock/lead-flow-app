import { notificationRepository } from "@/app/api/infra/data/repositories/notification/NotificationRepository"
import type { INotificationRepository } from "@/app/api/infra/data/repositories/notification/INotificationRepository"
import { teamMembersRepository } from "@/app/api/infra/data/repositories/teamMembers/TeamMembersRepository"
import type { ITeamMembersRepository, TeamMemberNotificationRecipient } from "@/app/api/infra/data/repositories/teamMembers/ITeamMembersRepository"
import type { IStudioDomainDnsNotificationService, StudioDomainDnsNotificationInput } from "./IStudioDomainDnsNotificationService"
import type { StudioDomainDnsAuditResult } from "./StudioDomainDnsAuditTypes"
import { resend } from "@/lib/email"
import { assertResend } from "@/lib/email"
import { getResendOwnerEmail } from "@/lib/email/resend-owner-email"

export class StudioDomainDnsNotificationService implements IStudioDomainDnsNotificationService {
  constructor(
    private readonly members: Pick<ITeamMembersRepository, "findNotificationRecipients"> = teamMembersRepository,
    private readonly notifications: INotificationRepository = notificationRepository,
  ) {}

  async notify(input: StudioDomainDnsNotificationInput): Promise<void> {
    if (input.result.status === "inconclusive") return

    const recipients = (await this.members.findNotificationRecipients({
      teamId: input.teamId,
      roles: ["manager"],
      onlyActive: true,
    })) as TeamMemberNotificationRecipient[]

    const uniqueRecipients = new Map(
      recipients
        .filter((recipient) => recipient.profile?.supabaseId)
        .map((recipient) => [recipient.profileId, recipient]),
    )

    await Promise.all(
      [...uniqueRecipients.values()].map((recipient) =>
        this.notifications.createSystemNotification({
          teamId: input.teamId,
          recipientProfileId: recipient.profileId,
          type: input.result.status === "verified"
            ? "STUDIO_DOMAIN_DNS_RECOVERED"
            : "STUDIO_DOMAIN_DNS_ACTION_REQUIRED",
          message: this.createMessage(input.result.hostname, input.result.status),
          metadata: {
            hostname: input.result.hostname,
            status: input.result.status,
            misconfigured: input.result.misconfigured,
            recommendedCNAME: input.result.recommendedCNAME,
            reasonCode: input.result.reasonCode,
            lastCheckedAt: input.lastCheckedAt.toISOString(),
            href: `/${recipient.profile!.supabaseId}/email/configuracoes`,
          },
        }),
      ),
    )

    // E-mail para master + owner quando DNS falhar ou precisa de ação.
    // Status "pending" e "failed" disparam e-mail; "verified" e "inconclusive" não.
    // Sem RESEND_API_KEY a notificação in-app continua sendo criada — o e-mail é secundário.
    if ((input.result.status === "pending" || input.result.status === "failed") && resend) {
      try {
        await this.sendDnsFailureEmail(input.teamId, input.result, recipients)
      } catch (error) {
        console.error("[StudioDomainDnsNotificationService] Falha ao enviar e-mail de alerta DNS", error)
      }
    }
  }

  /**
   * Envia e-mail de alerta para master/owner quando o DNS está com problema.
   * Usa o cliente Resend configurado (assinado por `assertResend()`).
   * Em modo de teste (EMAIL_TEST_MODE=true), apenas o e-mail do owner recebe a mensagem.
   */
  protected async sendDnsFailureEmail(
    teamId: string,
    result: StudioDomainDnsAuditResult,
    recipients: TeamMemberNotificationRecipient[],
  ): Promise<void> {
    const resend = assertResend()
    const ownerEmail = getResendOwnerEmail()
    const isTestMode = Boolean(process.env.EMAIL_TEST_MODE)

    // Em modo de teste, apenas o owner recebe o e-mail
    const deliveryRecipients = isTestMode && ownerEmail ? [ownerEmail] : []

    // Filtra destinatários dos emails dos managers encontrados
    const managerEmails = recipients
      .filter((recipient) => recipient.profile?.email !== null)
      .map((recipient) => recipient.profile!.email!)

    const allRecipients = [...deliveryRecipients, ...managerEmails].filter(
      (email): email is string => email !== null && email !== undefined,
    )

    if (allRecipients.length === 0) {
      console.warn("[StudioDomainDnsNotificationService] Nenhum destinatário de e-mail para alerta DNS")
      return
    }

    const cname = result.recommendedCNAME ?? "não definido"

    await resend.emails.send({
      from: "DNS Audit <noreply@leadflow.studio>",
      to: allRecipients,
      subject: `⚠️ Ação necessária: DNS do domínio ${result.hostname} precisa de atenção`,
      text: this.createDnsAlertText(result, cname),
    })

    console.info("[StudioDomainDnsNotificationService] Alerta DNS por e-mail enviado", {
      teamId,
      hostname: result.hostname,
      recipients: allRecipients.length,
      status: result.status,
      reasonCode: result.reasonCode,
    })
  }

  private createDnsAlertText(result: StudioDomainDnsAuditResult, cname: string): string {
    return `Domínio: ${result.hostname}\nStatus: ${result.status}\nMotivo: ${result.reason}\nCNAME recomendado: ${cname}\nReason Code: ${result.reasonCode}\n\nPor favor, corrija os registros DNS do domínio ${result.hostname} para apontá-lo para a Vercel.`
  }

  private createMessage(hostname: string, status: StudioDomainDnsNotificationInput["result"]["status"]): string {
    return status === "verified"
      ? `DNS recuperado: o domínio ${hostname} voltou a apontar corretamente para a Vercel.`
      : `Ação necessária: corrija o DNS do domínio ${hostname} para apontá-lo para a Vercel.`
  }
}

const studioDomainDnsNotificationService = new StudioDomainDnsNotificationService()

export default studioDomainDnsNotificationService
export { studioDomainDnsNotificationService }