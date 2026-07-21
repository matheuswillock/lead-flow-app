import { assertResend } from "@/lib/email";
import { getResendOwnerEmail } from "@/lib/email/resend-owner-email";
import { getAppUrl, getFullUrl } from '@/lib/utils/app-url';
import type { Attachment } from "resend";
import { DEFAULT_TZ, formatIntimezone, parseDateKeyToUtc, resolveTimezone } from "@/lib/dates";
import type { BackofficeEmailDispatchCategory, BackofficeEmailRecipientKind, EmailLogCategory } from "@prisma/client";
import { backofficeEmailDispatchService } from "@/app/api/services/backofficeEmailDispatch/BackofficeEmailDispatchService";
import { inferRecipientKind } from "@/lib/email/resolve-profile-recipient-emails";
import { sendTrackedEmailToProfileRecipients } from "@/lib/email/send-tracked-profile-email";
import { logResendDispatchesForRecipients } from "@/lib/email/log-profile-email-dispatches";
import { buildResendTrackingTags } from "@/lib/email/build-resend-tracking-tags";
import { teamEmailDispatchLogger } from "@/lib/email/team-email-dispatch-logger";
import { AUTH_SET_PASSWORD_LINK_EXPIRY_LABEL } from "@/lib/supabase/email-auth-link";

export interface EmailTrackingMeta {
  teamId: string;
  category: EmailLogCategory;
  sourceType?: string;
  sourceId?: string;
  recipientName?: string;
  campaignId?: string;
}

export interface EmailDispatchMeta {
  profileId: string;
  category: BackofficeEmailDispatchCategory;
  recipientKind?: BackofficeEmailRecipientKind;
  sourceType?: string;
  sourceId?: string;
}

export interface EmailOptions {
  to: string[];
  cc?: string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  attachments?: Attachment[];
  /** Prevents duplicate delivery on retry (Resend idempotency, 24h window). */
  idempotencyKey?: string;
}

/** Product e-mails: exige tracking com team_id para histórico e webhooks. */
export type TrackedEmailOptions = EmailOptions & {
  tracking: EmailTrackingMeta;
};

/** Backoffice: cria BackofficeEmailDispatch por destinatário. */
export type DispatchEmailOptions = EmailOptions & {
  dispatch: EmailDispatchMeta;
};

/** Envios intencionalmente sem time (auth, billing global, suporte interno). */
export type UntrackedEmailOptions = EmailOptions;

export interface LeadProposalPendingUrgentEmailData {
  to: string[];
  cc?: string[];
  attachments?: Attachment[];
  teamId: string;
  leadCode: string;
  leadName: string;
  leadEmail?: string | null;
  leadPhone?: string | null;
  sdrName?: string | null;
  closerName?: string | null;
  notes?: string | null;
  actorName: string;
}

export interface AssociateProposalCriticismEmailData {
  to: string[];
  teamId: string;
  leadCode: string;
  leadName: string;
  title: string;
  message: string;
}

export interface AssociateRequiredDocumentsPendingEmailData {
  to: string[];
  teamId: string;
  leadCode: string;
  leadName: string;
  actorName: string;
}

export interface LeadTransferActivatedEmailData {
  to: string[];
  teamId: string;
  leadCode: string;
  leadName: string;
  leadPhone?: string | null;
  leadCnpj?: string | null;
  leadCurrentHealthPlan?: string | null;
  leadCurrentValue?: number | null;
  leadNotes?: string | null;
  sdrName?: string | null;
  scheduleShareUrl?: string | null;
}

export interface WelcomeEmailData {
  userName: string;
  userEmail: string;
  loginUrl?: string;
  profileId?: string;
}

export interface LeadNotificationData {
  leadName: string;
  leadEmail: string;
  leadPhone?: string;
  managerName: string;
  managerEmail: string;
  teamId: string;
}

export interface SubscriptionConfirmationData {
  userName: string;
  userEmail: string;
  subscriptionId?: string;
  planName?: string;
  value?: number; // BRL
  nextDueDate?: string; // ISO
  manageUrl?: string; // URL para gerenciar assinatura
  timezone?: string | null;
}

export interface AdhesionCompletedEmailData {
  userName: string;
  userEmail: string;
  setPasswordUrl: string;
}

export interface OperatorInviteEmailData {
  operatorName: string;
  operatorEmail: string;
  operatorRole: string;
  managerName: string;
  inviteUrl: string;
  profileId?: string;
  sourceType?: string;
  sourceId?: string;
}

export interface PendingAccountUserPaymentEmailData {
  masterName: string;
  masterEmail: string;
  requestedUserName: string;
  requestedUserEmail: string;
  requestedRole: string;
  requesterName: string;
  requesterEmail: string;
  billingType: "PIX" | "BOLETO" | "CREDIT_CARD" | "UNDEFINED";
  amount: number;
  newRecurringTotal: number;
  paymentId: string;
  boletoUrl?: string;
  boletoDueDate?: string;
  pixPayload?: string;
}

export interface ResetPasswordEmailData {
  userName: string;
  userEmail: string;
  resetUrl: string;
}

export interface OperatorAccessRemovedEmailData {
  operatorName: string;
  operatorEmail: string;
  managerName: string;
}

export interface MeetingInviteEmailData {
  to: string[];
  leadName: string;
  meetingTitle?: string | null;
  meetingDate: Date;
  meetingLink?: string | null;
  organizerName: string;
  organizerEmail?: string | null;
  closerName?: string | null;
  notes?: string | null;
  eventUid?: string | null;
  timezone?: string | null;
  teamId?: string;
  sourceType?: string;
  sourceId?: string;
}

export interface AccountDeletionFarewellEmailData {
  userName: string;
  userEmail: string;
}

export interface CloserScheduleNotificationEmailData {
  to: string;
  teamId: string;
  closerName: string;
  leadName: string;
  leadCode?: string | null;
  meetingTitle: string;
  meetingDate: Date;
  meetingLink?: string | null;
  isReschedule: boolean;
  attendees: string[];
  notes?: string | null;
  attachments?: Attachment[];
  timezone?: string | null;
}

export interface MeetingFollowUpDigestEmailData {
  profileId?: string;
  teamId?: string;
  to: string;
  recipientName: string;
  leadCount: number;
  role: "closer" | "master";
  teamName?: string;
  crmUrl: string;
}

export interface AddOnPendingPaymentEmailData {
  masterName: string;
  masterEmail: string;
  addonType: "user" | "team";
  addonLabel: string;
  addonDetail?: string;
  totalCharge: number;
  remainingMonths: number;
  checkoutUrl: string;
  requesterName?: string;
  requesterEmail?: string;
}

export interface AddOnConfirmedEmailData {
  masterName: string;
  masterEmail: string;
  addonType: "user" | "team";
  addonLabel: string;
  addonDetail?: string;
  requesterName?: string;
  requesterEmail?: string;
}

export interface BackofficeAdhesionCheckoutEmailData {
  userName: string;
  userEmail: string;
  checkoutUrl: string;
  expiresAt: Date;
}

export class EmailService {
  private resend?: ReturnType<typeof assertResend>;

  private getResend() {
    if (!this.resend) {
      try {
        this.resend = assertResend();
      } catch {
        throw new Error("RESEND_API_KEY não configurada. Configure a variável de ambiente para enviar emails.");
      }
    }
    return this.resend;
  }

  private formatIcsDate(date: Date) {
    return date
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");
  }

  private escapeIcsText(value?: string | null) {
    if (!value) return "";
    return value
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,");
  }

  private buildCheckoutLinkEmailHtml(input: {
    title: string;
    subtitle: string;
    recipientName: string;
    checkoutUrl: string;
    expiresAtLabel: string;
    expiresAtValue: string;
    details?: Array<{ label: string; value: string }>;
  }) {
    const detailsRows = (input.details ?? [])
      .filter((row) => row.label && row.value)
      .map(
        (row) => `
          <tr>
            <td style="padding: 10px 0; border-top: 1px solid #e5e7eb; color: #111827; font-size: 14px; font-weight: 600;">
              ${row.label}
            </td>
            <td style="padding: 10px 0; border-top: 1px solid #e5e7eb; color: #111827; font-size: 14px; text-align: right;">
              ${row.value}
            </td>
          </tr>
        `
      )
      .join("");

    const detailsBlock = detailsRows
      ? `
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 14px; padding: 20px; margin: 24px 0;">
          <p style="margin: 0 0 12px 0; color: #111827; font-size: 14px; font-weight: 700;">Resumo</p>
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 0 0 10px 0; color: #111827; font-size: 14px; font-weight: 600;">
                ${input.expiresAtLabel}
              </td>
              <td style="padding: 0 0 10px 0; color: #111827; font-size: 14px; text-align: right;">
                ${input.expiresAtValue}
              </td>
            </tr>
            ${detailsRows}
          </table>
        </div>
      `
      : `
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 14px; padding: 20px; margin: 24px 0;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 0; color: #111827; font-size: 14px; font-weight: 600;">
                ${input.expiresAtLabel}
              </td>
              <td style="padding: 0; color: #111827; font-size: 14px; text-align: right;">
                ${input.expiresAtValue}
              </td>
            </tr>
          </table>
        </div>
      `;

    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);">
                <tr>
                  <td style="background: linear-gradient(135deg, #ff6900 0%, #e65f00 100%); padding: 32px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Corretor Studio</h1>
                    <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.92); font-size: 15px;">${input.subtitle}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 36px 32px;">
                    <h2 style="margin: 0 0 14px 0; color: #171717; font-size: 24px; font-weight: 600;">Olá, ${input.recipientName}</h2>
                    <p style="margin: 0 0 18px 0; color: #525252; font-size: 16px; line-height: 1.7;">
                      ${input.title}
                    </p>

                    <div style="text-align: center; margin: 24px 0;">
                      <a href="${input.checkoutUrl}" target="_blank" rel="noreferrer" style="display: inline-block; background: #ff6900; color: #ffffff; text-decoration: none; padding: 12px 22px; border-radius: 12px; font-weight: 700;">
                        Abrir checkout
                      </a>
                    </div>

                    ${detailsBlock}

                    <p style="margin: 0; color: #737373; font-size: 13px; line-height: 1.6;">
                      Se você não solicitou isso, pode ignorar este e-mail.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: #f9fafb; padding: 20px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; color: #737373; font-size: 12px;">
                      Este é um e-mail automático do Corretor Studio
                    </p>
                    <p style="margin: 8px 0 0 0; color: #a3a3a3; font-size: 11px;">
                      © ${new Date().getFullYear()} Corretor Studio. Todos os direitos reservados.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  private formatDateOnlyString(value?: string | null, timezone?: string | null) {
    if (!value) return undefined;

    const tz = resolveTimezone(timezone ?? DEFAULT_TZ);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return formatIntimezone(parseDateKeyToUtc(value, tz), "dd/MM/yyyy", tz);
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return undefined;
    return formatIntimezone(parsed, "dd/MM/yyyy", tz);
  }

  private buildMeetingInviteIcs(data: MeetingInviteEmailData) {
    const title = data.meetingTitle || `Estudo Plano de Saúde: ${data.leadName}`;
    const start = data.meetingDate;
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const dtStamp = this.formatIcsDate(new Date());
    const dtStart = this.formatIcsDate(start);
    const dtEnd = this.formatIcsDate(end);
    const rawUid =
      data.eventUid && data.eventUid.includes("@")
        ? data.eventUid
        : `${data.eventUid || `meeting-${start.getTime()}`}@corretorstudio.com`;
    const uid = this.escapeIcsText(rawUid);

    const descriptionLines = [
      "Reunião agendada pelo Corretor Studio.",
      `Lead: ${data.leadName}`,
    ];
    if (data.organizerName) {
      descriptionLines.push(`Organizador: ${data.organizerName}`);
    }
    if (data.notes) {
      descriptionLines.push(`Observações: ${data.notes}`);
    }
    if (data.meetingLink) {
      descriptionLines.push(`Link: ${data.meetingLink}`);
    }

    const description = this.escapeIcsText(descriptionLines.join("\n"));
    const summary = this.escapeIcsText(title);
    const location = data.meetingLink ? this.escapeIcsText(data.meetingLink) : "";
    const organizerName = this.escapeIcsText(data.organizerName || "Corretor Studio");
    const organizerEmail = data.organizerEmail?.trim();
    const attendees = Array.from(
      new Set(
        (data.to || [])
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean)
      )
    );

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Corretor Studio//Lead Flow//PT-BR",
      "CALSCALE:GREGORIAN",
      "METHOD:REQUEST",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
    ];

    if (location) {
      lines.push(`LOCATION:${location}`);
    }

    if (organizerEmail) {
      lines.push(`ORGANIZER;CN=${organizerName}:mailto:${organizerEmail}`);
    }

    for (const attendee of attendees) {
      lines.push(`ATTENDEE;ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:${attendee}`);
    }

    lines.push("END:VEVENT", "END:VCALENDAR");
    return lines.join("\r\n");
  }

  private injectHtmlAfterBodyOpen(html: string, snippet: string) {
    const bodyOpenTagRegex = /<body[^>]*>/i;
    if (bodyOpenTagRegex.test(html)) {
      return html.replace(bodyOpenTagRegex, (match) => `${match}${snippet}`);
    }

    return `${snippet}${html}`;
  }

  private buildTestBannerSnippet(originalRecipients: string[]) {
    return `
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 0 16px 20px;">
        <p style="margin: 0; color: #92400e; font-weight: 600;">
          MODO TESTE
        </p>
        <p style="margin: 4px 0 0 0; color: #92400e; font-size: 14px;">
          Este e-mail seria enviado para: <strong>${originalRecipients.join(', ')}</strong>
        </p>
      </div>
    `;
  }

  /** Envio de produto com tracking obrigatório ou dispatch backoffice. */
  async sendEmail(options: TrackedEmailOptions | DispatchEmailOptions) {
    if ("dispatch" in options && options.dispatch) {
      return this.sendEmailWithDispatchTracking(options);
    }

    const tracked = options as TrackedEmailOptions;
    if (tracked.to.filter(Boolean).length > 1) {
      return this.sendEmailWithTeamTrackingPerRecipient(tracked);
    }

    return this.sendEmailDirect(tracked);
  }

  /**
   * Envios intencionalmente sem team_id (auth, billing global, suporte interno).
   * Não cria EmailLog nem tags de rastreio.
   */
  async sendEmailUntracked(options: UntrackedEmailOptions) {
    return this.sendEmailDirect(options);
  }

  private async sendEmailWithTeamTrackingPerRecipient(options: TrackedEmailOptions) {
    const recipients = options.to.filter(Boolean);
    const tracking = options.tracking;

    // Caminho quente: cria todos os logs "queued" em um único createMany e
    // marca os enviados em lote no final, em vez de 2 queries por destinatário.
    const logIds = await teamEmailDispatchLogger.createManyQueuedTeamEmailLogs(
      recipients.map((recipient) => ({
        teamId: tracking.teamId,
        recipientEmail: recipient,
        recipientName: tracking.recipientName ?? null,
        subject: options.subject,
        category: tracking.category,
        sourceType: tracking.sourceType,
        sourceId: tracking.sourceId,
        campaignId: tracking.campaignId,
      }))
    );

    let lastResult: Awaited<ReturnType<EmailService["sendEmailDirect"]>> | undefined;
    let successCount = 0;
    let lastError: string | undefined;
    const sentEntries: Array<{ logId: string; resendEmailId: string }> = [];

    for (const [index, recipient] of recipients.entries()) {
      const idempotencyKey =
        options.idempotencyKey && recipients.length > 1
          ? `${options.idempotencyKey}/${index}`
          : options.idempotencyKey;

      const teamLogId = logIds[index];
      const result = await this.sendEmailDirect(
        {
          ...options,
          to: [recipient],
          tracking: {
            ...tracking,
            recipientName: tracking.recipientName,
          },
          idempotencyKey,
        },
        { teamLogId, deferSentMark: true }
      );

      lastResult = result;
      if (result.success) {
        successCount += 1;
        const resendEmailId = result.data?.data?.id;
        if (resendEmailId) {
          sentEntries.push({ logId: teamLogId, resendEmailId });
        }
      } else {
        lastError = result.error;
      }
    }

    if (sentEntries.length > 0) {
      try {
        await teamEmailDispatchLogger.markManyTeamEmailLogsSent(sentEntries);
      } catch (error) {
        console.error("[EmailService] Falha ao marcar logs enviados em lote:", error);
      }
    }

    if (successCount === 0) {
      return { success: false, error: lastError || "Erro ao enviar email" };
    }

    if (successCount < recipients.length) {
      return {
        success: false,
        error: lastError || "Falha ao enviar para um ou mais destinatários",
        data: lastResult?.data,
      };
    }

    return lastResult ?? { success: false, error: "Erro ao enviar email" };
  }

  private async sendEmailDirect(
    options: UntrackedEmailOptions & { tracking?: EmailTrackingMeta },
    precreated?: { teamLogId: string; deferSentMark?: boolean }
  ) {
    const tracking = options.tracking;
    const recipientEmail = options.to.filter(Boolean)[0];
    let teamLogId: string | undefined = precreated?.teamLogId;

    if (!teamLogId && tracking && recipientEmail) {
      teamLogId = await teamEmailDispatchLogger.createQueuedTeamEmailLog({
        teamId: tracking.teamId,
        recipientEmail,
        recipientName: tracking.recipientName ?? null,
        subject: options.subject,
        category: tracking.category,
        sourceType: tracking.sourceType,
        sourceId: tracking.sourceId,
        campaignId: tracking.campaignId,
      });
    }

    try {
      const resend = this.getResend();
      
      // NOTA: Resend sem domínio verificado só envia para o e-mail do owner da conta
      // Para produção, verificar domínio em: https://resend.com/domains
      // 
      // MODO TESTE: Enviar todos os e-mails para o owner em vez do destinatário real
      // Use EMAIL_TEST_MODE=true para ativar modo de teste (útil para testes em produção)
      const isTestMode = process.env.EMAIL_TEST_MODE === 'true';
      const resendOwnerEmail = getResendOwnerEmail();
      const effectiveTestMode = isTestMode && Boolean(resendOwnerEmail);
      
      const emailData: {
        from: string
        to: string[]
        subject: string
        headers: Record<string, string>
        cc?: string[]
        html?: string
        text?: string
        attachments?: Attachment[]
        tags?: Array<{ name: string; value: string }>
      } = {
        from: options.from || "Corretor Studio <no-reply@corretorstudio.com>",
        to: effectiveTestMode ? [resendOwnerEmail!] : options.to,
        subject: effectiveTestMode 
          ? `[TESTE - Para: ${options.to.join(', ')}] ${options.subject}`
          : options.subject,
        headers: {
          Importance: "high",
          Priority: "urgent",
          "X-Priority": "1",
          "X-MSMail-Priority": "High",
        },
      };

      if (tracking) {
        emailData.tags = buildResendTrackingTags({
          teamId: tracking.teamId,
          category: tracking.category,
          sourceType: tracking.sourceType,
          sourceId: tracking.sourceId,
        });
      }

      if (!isTestMode && options.cc?.length) {
        emailData.cc = options.cc;
      }

      if (options.html) {
        emailData.html = isTestMode
          ? this.injectHtmlAfterBodyOpen(options.html, this.buildTestBannerSnippet(options.to))
          : options.html;
      }
      if (options.text) {
        emailData.text = options.text;
      }
      if (options.attachments?.length) {
        emailData.attachments = options.attachments;
      }

      const result = await resend.emails.send(
        emailData as Parameters<typeof resend.emails.send>[0],
        options.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : undefined
      );

      if (result.error) {
        console.error("Erro ao enviar email:", result.error);
        if (teamLogId) {
          await teamEmailDispatchLogger.markTeamEmailLogFailed(
            teamLogId,
            result.error.message || "Erro ao enviar email"
          );
        }
        return {
          success: false,
          error: result.error.message || "Erro ao enviar email",
          errorObject: result.error,
        };
      }

      const resendEmailId = result.data?.id;
      if (teamLogId && resendEmailId) {
        // Com deferSentMark, o caller marca "sent" em lote após o loop.
        if (!precreated?.deferSentMark) {
          await teamEmailDispatchLogger.markTeamEmailLogSent(teamLogId, resendEmailId);
        }
      } else if (teamLogId) {
        await teamEmailDispatchLogger.markTeamEmailLogFailed(
          teamLogId,
          "Resend não retornou identificador do e-mail"
        );
      }

      return { success: true, data: result };
    } catch (error: unknown) {
      console.error("Erro ao enviar email:", error);
      const message = error instanceof Error ? error.message : "Erro ao enviar email";
      if (teamLogId) {
        await teamEmailDispatchLogger.markTeamEmailLogFailed(teamLogId, message);
      }
      return {
        success: false,
        error: message,
        errorObject: error,
      };
    }
  }

  private async sendEmailWithDispatchTracking(options: DispatchEmailOptions) {
    const dispatch = options.dispatch;

    const profileRecipients = await backofficeEmailDispatchService.resolveProfileRecipients(
      dispatch.profileId
    );
    const recipients = options.to.filter(Boolean);
    const dispatchIds: string[] = [];
    let lastError: string | undefined;
    let lastData: unknown;
    let successCount = 0;

    for (const [index, recipient] of recipients.entries()) {
      const recipientKind =
        dispatch.recipientKind ??
        inferRecipientKind(recipient, profileRecipients);

      const dispatchId = await backofficeEmailDispatchService.createQueuedDispatch({
        profileId: dispatch.profileId,
        recipientEmail: recipient,
        recipientKind,
        provider: "resend",
        category: dispatch.category,
        subject: options.subject,
        sourceType: dispatch.sourceType,
        sourceId: dispatch.sourceId,
      });
      dispatchIds.push(dispatchId);

      const idempotencyKey =
        options.idempotencyKey && recipients.length > 1
          ? `${options.idempotencyKey}/${index}`
          : options.idempotencyKey;

      const result = await this.sendEmailDirect({
        ...options,
        to: [recipient],
        idempotencyKey,
      });

      if (!result.success) {
        await backofficeEmailDispatchService.markFailed(
          dispatchId,
          result.error || "Erro ao enviar email"
        );
        lastError = result.error;
        continue;
      }

      const resendEmailId = (result.data as { data?: { id?: string } } | undefined)?.data?.id;
      if (resendEmailId) {
        await backofficeEmailDispatchService.markSent(dispatchId, resendEmailId);
      } else {
        await backofficeEmailDispatchService.markFailed(
          dispatchId,
          "Resend não retornou identificador do e-mail"
        );
        lastError = "Resend não retornou identificador do e-mail";
        continue;
      }

      lastData = result.data;
      successCount += 1;
    }

    if (dispatchIds.length === 0) {
      return { success: false, error: "Nenhum destinatário informado" };
    }

    if (successCount === 0) {
      return { success: false, error: lastError || "Erro ao enviar email", dispatchIds };
    }

    if (successCount < recipients.length) {
      return {
        success: false,
        error: lastError || "Falha ao enviar para um ou mais destinatários",
        data: lastData,
        dispatchIds,
      };
    }

    return { success: true, data: lastData, dispatchIds };
  }

  // Email de boas-vindas para novos usuários
  async sendWelcomeEmail(data: WelcomeEmailData) {
    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <!-- Container Principal -->
              <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
                
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #ff6900 0%, #e65f00 100%); padding: 40px 32px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Corretor Studio</h1>
                    <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">Gestão Inteligente de Leads</p>
                  </td>
                </tr>
                
                <!-- Conteúdo -->
                <tr>
                  <td style="padding: 48px 32px;">
                    <h2 style="margin: 0 0 24px 0; color: #171717; font-size: 24px; font-weight: 600;">Bem-vindo, ${data.userName}! 🎉</h2>
                    
                    <p style="margin: 0 0 16px 0; color: #525252; font-size: 16px; line-height: 1.6;">
                      Sua conta foi criada com <strong>sucesso</strong>! Agora você tem acesso a uma plataforma completa para gerenciar seus leads de forma eficiente e profissional.
                    </p>
                    
                    <!-- Cards de Recursos -->
                    <div style="background-color: #f9fafb; border-radius: 12px; padding: 24px; margin: 24px 0;">
                      <h3 style="margin: 0 0 16px 0; color: #171717; font-size: 18px; font-weight: 600;">O que você pode fazer:</h3>
                      <ul style="margin: 0; padding: 0; list-style: none;">
                        <li style="margin-bottom: 12px; color: #525252; font-size: 15px; display: flex; align-items: start;">
                          <span style="color: #10b981; margin-right: 8px; font-size: 18px;">✓</span>
                          <span>Gerenciar leads com interface Kanban visual</span>
                        </li>
                        <li style="margin-bottom: 12px; color: #525252; font-size: 15px; display: flex; align-items: start;">
                          <span style="color: #10b981; margin-right: 8px; font-size: 18px;">✓</span>
                          <span>Acompanhar métricas e performance em tempo real</span>
                        </li>
                        <li style="margin-bottom: 12px; color: #525252; font-size: 15px; display: flex; align-items: start;">
                          <span style="color: #10b981; margin-right: 8px; font-size: 18px;">✓</span>
                          <span>Colaborar com sua equipe de operadores</span>
                        </li>
                        <li style="margin-bottom: 0; color: #525252; font-size: 15px; display: flex; align-items: start;">
                          <span style="color: #10b981; margin-right: 8px; font-size: 18px;">✓</span>
                          <span>Otimizar seu processo comercial</span>
                        </li>
                      </ul>
                    </div>
                    
                    ${data.loginUrl ? `
                    <!-- Botão CTA -->
                    <div style="text-align: center; margin: 32px 0;">
                      <a href="${data.loginUrl}" 
                         style="display: inline-block; background: linear-gradient(135deg, #ff6900 0%, #e65f00 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(255, 105, 0, 0.3);">
                        🚀 Acessar Plataforma
                      </a>
                    </div>
                    ` : ''}
                    
                    <p style="margin: 24px 0 0 0; color: #737373; font-size: 14px; line-height: 1.6;">
                      Precisa de ajuda? Estamos aqui para você! Entre em contato conosco a qualquer momento.
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #fafafa; padding: 24px 32px; border-top: 1px solid #e5e5e5;">
                    <p style="margin: 0 0 8px 0; color: #a3a3a3; font-size: 12px; text-align: center;">
                      Este é um e-mail automático do Corretor Studio
                    </p>
                    <p style="margin: 0; color: #a3a3a3; font-size: 12px; text-align: center;">
                      © ${new Date().getFullYear()} Corretor Studio. Todos os direitos reservados.
                    </p>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    if (data.profileId) {
      return this.sendEmail({
        to: [data.userEmail],
        subject: "Bem-vindo ao Corretor Studio - Sua conta foi criada!",
        html,
        dispatch: {
          profileId: data.profileId,
          category: "welcome",
          sourceType: "welcome",
        },
      });
    }

    return this.sendEmailUntracked({
      to: [data.userEmail],
      subject: "Bem-vindo ao Corretor Studio - Sua conta foi criada!",
      html,
    });
  }

  // Confirmação de assinatura
  async sendSubscriptionConfirmationEmail(data: SubscriptionConfirmationData) {
    const fmtCurrency = (v?: number) =>
      typeof v === 'number'
        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
        : undefined;

    const price = fmtCurrency(data.value);
    const nextDue = this.formatDateOnlyString(data.nextDueDate, data.timezone);
    const appUrl = getAppUrl({ removeTrailingSlash: true });
    const manageUrl = data.manageUrl || `${appUrl}/sign-in`;

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
                
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #ff6900 0%, #e65f00 100%); padding: 40px 32px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Corretor Studio</h1>
                  </td>
                </tr>
                
                <!-- Conteúdo -->
                <tr>
                  <td style="padding: 48px 32px;">
                    <div style="text-align: center; margin-bottom: 24px;">
                      <div style="display: inline-block; width: 72px; height: 72px; background: linear-gradient(135deg, #ff6900 0%, #e65f00 100%); border-radius: 50%; margin-bottom: 16px;">
                        <span style="font-size: 40px; line-height: 72px; display: block;">🎉</span>
                      </div>
                    </div>
                    
                    <h2 style="margin: 0 0 16px 0; color: #171717; font-size: 24px; font-weight: 600; text-align: center;">Assinatura Confirmada!</h2>
                    
                    <p style="margin: 0 0 24px 0; color: #525252; font-size: 16px; line-height: 1.6; text-align: center;">
                      Olá <strong>${data.userName}</strong>, sua assinatura no Corretor Studio foi confirmada com sucesso.
                    </p>
                    
                    <!-- Detalhes da Assinatura -->
                    <div style="background: linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%); border: 2px solid #ff6900; border-radius: 12px; padding: 24px; margin: 24px 0;">
                      <h3 style="margin: 0 0 16px 0; color: #7c2d12; font-size: 16px; font-weight: 600; text-align: center;">📋 Detalhes da Assinatura</h3>
                      ${data.subscriptionId ? `
                      <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #fdba74;">
                        <p style="margin: 0; color: #7c2d12; font-size: 13px; font-weight: 500;">ID da Assinatura</p>
                        <p style="margin: 4px 0 0 0; color: #9a3412; font-size: 15px; font-family: monospace;">${data.subscriptionId}</p>
                      </div>
                      ` : ''}
                      ${data.planName ? `
                      <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #fdba74;">
                        <p style="margin: 0; color: #7c2d12; font-size: 13px; font-weight: 500;">Plano</p>
                        <p style="margin: 4px 0 0 0; color: #9a3412; font-size: 16px; font-weight: 600;">${data.planName}</p>
                      </div>
                      ` : ''}
                      ${price ? `
                      <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #fdba74;">
                        <p style="margin: 0; color: #7c2d12; font-size: 13px; font-weight: 500;">Valor Mensal</p>
                        <p style="margin: 4px 0 0 0; color: #9a3412; font-size: 20px; font-weight: 700;">${price}</p>
                      </div>
                      ` : ''}
                      ${nextDue ? `
                      <div style="margin-bottom: 0;">
                        <p style="margin: 0; color: #7c2d12; font-size: 13px; font-weight: 500;">Próximo Vencimento</p>
                        <p style="margin: 4px 0 0 0; color: #9a3412; font-size: 16px; font-weight: 600;">${nextDue}</p>
                      </div>
                      ` : ''}
                    </div>
                    
                    <!-- Botão CTA -->
                    <div style="text-align: center; margin: 32px 0;">
                      <a href="${manageUrl}"
                         style="display: inline-block; background: linear-gradient(135deg, #ff6900 0%, #e65f00 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(255, 105, 0, 0.3);">
                        🚀 Acessar Plataforma
                      </a>
                    </div>
                    
                    <p style="margin: 24px 0 0 0; color: #525252; font-size: 15px; line-height: 1.6; text-align: center;">
                      Obrigado por escolher o <strong>Corretor Studio</strong>!<br>
                      Estamos prontos para impulsionar seu processo comercial.
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #fafafa; padding: 24px 32px; border-top: 1px solid #e5e5e5;">
                    <p style="margin: 0 0 8px 0; color: #a3a3a3; font-size: 12px; text-align: center;">
                      Este é um e-mail automático do Corretor Studio
                    </p>
                    <p style="margin: 0; color: #a3a3a3; font-size: 12px; text-align: center;">
                      © ${new Date().getFullYear()} Corretor Studio. Todos os direitos reservados.
                    </p>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    return this.sendEmailUntracked({
      to: [data.userEmail],
      subject: 'Corretor Studio — Assinatura confirmada',
      html,
    });
  }

  async sendAdhesionCompletedEmail(data: AdhesionCompletedEmailData) {
    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
                <tr>
                  <td style="background: linear-gradient(135deg, #ff6900 0%, #e65f00 100%); padding: 40px 32px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Corretor Studio</h1>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 48px 32px;">
                    <div style="text-align: center; margin-bottom: 24px;">
                      <div style="display: inline-block; width: 72px; height: 72px; background: linear-gradient(135deg, #ff6900 0%, #e65f00 100%); border-radius: 50%; margin-bottom: 16px;">
                        <span style="font-size: 40px; line-height: 72px; display: block;">🎉</span>
                      </div>
                    </div>

                    <h2 style="margin: 0 0 16px 0; color: #171717; font-size: 24px; font-weight: 600; text-align: center;">Adesão concluída com sucesso</h2>

                    <p style="margin: 0 0 24px 0; color: #525252; font-size: 16px; line-height: 1.6; text-align: center;">
                      Olá <strong>${data.userName}</strong>, sua adesão foi concluída. Defina sua senha para acessar a plataforma.
                    </p>

                    <div style="background: linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%); border: 2px solid #ff6900; border-radius: 12px; padding: 24px; margin: 24px 0;">
                      <h3 style="margin: 0 0 12px 0; color: #7c2d12; font-size: 16px; font-weight: 600; text-align: center;">Próximo passo</h3>
                      <p style="margin: 0; color: #9a3412; font-size: 15px; line-height: 1.6; text-align: center;">
                        Crie sua senha para concluir o primeiro acesso e seguir com a configuração da conta.
                      </p>
                    </div>

                    <div style="text-align: center; margin: 32px 0;">
                      <a href="${data.setPasswordUrl}"
                         style="display: inline-block; background: linear-gradient(135deg, #ff6900 0%, #e65f00 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(255, 105, 0, 0.3);">
                        Definir senha
                      </a>
                    </div>

                    <p style="margin: 24px 0 0 0; color: #737373; font-size: 14px; line-height: 1.6; text-align: center;">
                      Se o botão não abrir, use o link direto recebido neste e-mail.
                    </p>

                    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin: 24px 0 0 0;">
                      <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6; text-align: center;">
                        <strong>⚠️ Importante:</strong> Este link expira em ${AUTH_SET_PASSWORD_LINK_EXPIRY_LABEL}.
                      </p>
                    </div>
                  </td>
                </tr>

                <tr>
                  <td style="background-color: #fafafa; padding: 24px 32px; border-top: 1px solid #e5e5e5;">
                    <p style="margin: 0 0 8px 0; color: #a3a3a3; font-size: 12px; text-align: center;">
                      Este é um e-mail automático do Corretor Studio
                    </p>
                    <p style="margin: 0; color: #a3a3a3; font-size: 12px; text-align: center;">
                      © ${new Date().getFullYear()} Corretor Studio. Todos os direitos reservados.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `

    return this.sendEmailUntracked({
      to: [data.userEmail],
      subject: "Corretor Studio — Adesão concluída com sucesso",
      html,
    })
  }

  // Notificação de novo lead para managers
  async sendLeadNotification(data: LeadNotificationData) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Novo Lead Recebido!</h1>
        
        <p>Olá <strong>${data.managerName}</strong>,</p>
        
        <p>Um novo lead foi registrado em sua plataforma:</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">Dados do Lead:</h3>
          <p><strong>Nome:</strong> ${data.leadName}</p>
          <p><strong>Email:</strong> ${data.leadEmail}</p>
          ${data.leadPhone ? `<p><strong>Telefone:</strong> ${data.leadPhone}</p>` : ''}
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${getFullUrl('/dashboard')}" 
             style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Ver Lead no Dashboard
          </a>
        </div>
        
        <p>Entre na plataforma para visualizar e gerenciar este novo lead.</p>
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px;">
          <p>Este é um e-mail automático do Corretor Studio.</p>
        </div>
      </div>
    `;

    return this.sendEmail({
      to: [data.managerEmail],
      subject: `Novo Lead: ${data.leadName}`,
      html,
      tracking: {
        teamId: data.teamId,
        category: "transactional",
        sourceType: "lead_notification",
      },
    });
  }

  async sendLeadProposalPendingUrgentEmail(data: LeadProposalPendingUrgentEmailData) {
    const leadName = data.leadName || "Lead sem nome";
    const leadEmail = data.leadEmail || "Não informado";
    const leadPhone = data.leadPhone || "Não informado";
    const sdrName = data.sdrName || "Não informado";
    const closerName = data.closerName || "Não informado";
    const notes = (data.notes || "Sem observações adicionais").trim();
    const leadUrl = getFullUrl(`/crm?leadCode=${encodeURIComponent(data.leadCode)}`);
    const proposalPendingTitle = `Você tem uma proposta pendente no Corretor Studio - ID: ${data.leadCode}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #1f2937;">
        <div style="background: #ff6900; color: #fff; padding: 16px 20px; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 22px;">${proposalPendingTitle}</h1>
          <p style="margin: 8px 0 0; font-size: 14px; opacity: 0.95;">
            ${data.actorName} moveu um lead para o status de proposta pendente.
          </p>
        </div>

        <div style="border: 1px solid #fed7aa; border-top: 0; border-radius: 0 0 10px 10px; padding: 20px; background: #fff;">
          <p style="margin: 0 0 14px;"><strong>Lead:</strong> ${leadName}</p>
          <p style="margin: 0 0 8px;"><strong>E-mail:</strong> ${leadEmail}</p>
          <p style="margin: 0 0 14px;"><strong>Telefone:</strong> ${leadPhone}</p>

          <p style="margin: 0 0 8px;"><strong>SDR:</strong> ${sdrName}</p>
          <p style="margin: 0 0 14px;"><strong>Closer:</strong> ${closerName}</p>

          <div style="margin: 0 0 14px;">
            <a href="${leadUrl}" style="display: inline-block; background: #ff6900; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 8px; font-weight: 600;">Acessar lead no CRM</a>
          </div>

          <div style="background: #fff7ed; border-left: 4px solid #ff6900; padding: 12px; border-radius: 6px;">
            <p style="margin: 0 0 4px;"><strong>Observações</strong></p>
            <p style="margin: 0; white-space: pre-wrap;">${notes}</p>
          </div>
        </div>
      </div>
    `;

    return this.sendEmail({
      to: data.to,
      cc: data.cc,
      subject: proposalPendingTitle,
      html,
      attachments: data.attachments,
      tracking: {
        teamId: data.teamId,
        category: "transactional",
        sourceType: "lead_proposal_pending",
        sourceId: data.leadCode,
      },
    });
  }

  async sendAssociateProposalCriticismEmail(data: AssociateProposalCriticismEmailData) {
    const leadUrl = getFullUrl(`/crm?leadCode=${encodeURIComponent(data.leadCode)}`);
    const subject = `Proposta criticada — ${data.leadName} (${data.leadCode})`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #1f2937;">
        <div style="background: #dc2626; color: #fff; padding: 16px 20px; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 22px;">Proposta criticada</h1>
          <p style="margin: 8px 0 0; font-size: 14px; opacity: 0.95;">Corretor Studio</p>
        </div>
        <div style="border: 1px solid #fecaca; border-top: 0; border-radius: 0 0 10px 10px; padding: 20px; background: #fff;">
          <p style="margin: 0 0 14px;"><strong>Lead:</strong> ${data.leadName} (${data.leadCode})</p>
          <p style="margin: 0 0 8px;"><strong>Título:</strong> ${data.title}</p>
          <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 12px; border-radius: 6px; margin: 0 0 14px;">
            <p style="margin: 0; white-space: pre-wrap;">${data.message}</p>
          </div>
          <a href="${leadUrl}" style="display: inline-block; background: #dc2626; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 8px; font-weight: 600;">Abrir lead no CRM</a>
        </div>
      </div>
    `;

    return this.sendEmail({
      to: data.to,
      subject,
      html,
      tracking: {
        teamId: data.teamId,
        category: "transactional",
        sourceType: "associate_proposal_criticism",
        sourceId: data.leadCode,
      },
    });
  }

  async sendAssociateRequiredDocumentsPendingEmail(data: AssociateRequiredDocumentsPendingEmailData) {
    const leadUrl = getFullUrl(`/associados`);
    const subject = `Documentos pendentes — ${data.leadName} (${data.leadCode})`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #1f2937;">
        <div style="background: #ff6900; color: #fff; padding: 16px 20px; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 22px;">Documentos obrigatórios pendentes</h1>
          <p style="margin: 8px 0 0; font-size: 14px; opacity: 0.95;">${data.actorName} enviou proposta de conta associada</p>
        </div>
        <div style="border: 1px solid #fed7aa; border-top: 0; border-radius: 0 0 10px 10px; padding: 20px; background: #fff;">
          <p style="margin: 0 0 14px;"><strong>Lead:</strong> ${data.leadName} (${data.leadCode})</p>
          <p style="margin: 0 0 14px;">Revise e aprove RG, Comprovante de Endereço e Contrato Social na fila Associados.</p>
          <a href="${leadUrl}" style="display: inline-block; background: #ff6900; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 8px; font-weight: 600;">Abrir fila Associados</a>
        </div>
      </div>
    `;

    return this.sendEmail({
      to: data.to,
      subject,
      html,
      tracking: {
        teamId: data.teamId,
        category: "transactional",
        sourceType: "associate_required_documents",
        sourceId: data.leadCode,
      },
    });
  }

  // Email de convite para novo operador
  async sendOperatorInviteEmail(data: OperatorInviteEmailData) {
    const roleDescription: Record<string, string> = {
      'operator': 'Operador',
      'manager': 'Gerente',
    };

    const roleCapabilities: Record<string, string> = {
      'operator': `
        <h3 style="color: #333; margin-top: 20px;">Como Operador, você poderá:</h3>
        <ul style="color: #555; line-height: 1.8;">
          <li>✅ Gerenciar seus próprios leads</li>
          <li>✅ Acompanhar o funil de vendas</li>
          <li>✅ Visualizar métricas e estatísticas</li>
          <li>✅ Atualizar status de leads</li>
          <li>✅ Adicionar anotações e acompanhamentos</li>
          <li>✅ Fazer upload de documentos</li>
        </ul>
      `,
      'manager': `
        <h3 style="color: #333; margin-top: 20px;">Como Gerente, você poderá:</h3>
        <ul style="color: #555; line-height: 1.8;">
          <li>✅ Gerenciar todos os leads da equipe</li>
          <li>✅ Adicionar e gerenciar operadores e managers</li>
          <li>✅ Acompanhar métricas da equipe</li>
          <li>✅ Distribuir leads entre operadores</li>
          <li>✅ Visualizar dashboards completos</li>
          <li>✅ Controlar assinaturas e pagamentos</li>
        </ul>
      `,
    };

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
                
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #ff6900 0%, #e65f00 100%); padding: 40px 32px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Corretor Studio</h1>
                    <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">Gestão Inteligente de Leads</p>
                  </td>
                </tr>
                
                <!-- Conteúdo -->
                <tr>
                  <td style="padding: 48px 32px;">
                    <div style="text-align: center; margin-bottom: 32px;">
                      <div style="display: inline-block; width: 72px; height: 72px; background: linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%); border-radius: 50%; border: 2px solid #ff6900; text-align: center; line-height: 72px; margin-bottom: 16px;">
                        <span style="font-size: 32px;">🎉</span>
                      </div>
                    </div>

                    <h2 style="margin: 0 0 24px 0; color: #171717; font-size: 24px; font-weight: 600; text-align: center;">Bem-vindo ao Corretor Studio!</h2>
                    
                    <p style="margin: 0 0 16px 0; color: #525252; font-size: 16px; line-height: 1.6; text-align: center;">
                      Olá <strong>${data.operatorName}</strong>,
                    </p>

                    <p style="margin: 0 0 24px 0; color: #525252; font-size: 16px; line-height: 1.6; text-align: center;">
                      Você foi convidado por <strong>${data.managerName}</strong> para fazer parte da equipe no <strong>Corretor Studio</strong>.
                    </p>

                    <div style="background-color: #fff7ed; border-left: 4px solid #ff6900; padding: 16px; border-radius: 8px; margin: 20px 0;">
                      <p style="margin: 0; color: #ea580c; font-weight: 600;">Sua função: ${roleDescription[data.operatorRole] || data.operatorRole}</p>
                    </div>

                    ${roleCapabilities[data.operatorRole] || ''}

                    <div style="background-color: #f9fafb; border-radius: 12px; padding: 24px; margin: 24px 0;">
                      <h3 style="margin: 0 0 16px 0; color: #171717; font-size: 18px; font-weight: 600;">🚀 Por que usar o Corretor Studio?</h3>
                      <ul style="margin: 0; padding: 0; list-style: none;">
                        <li style="margin-bottom: 12px; color: #525252; font-size: 15px; display: flex; align-items: start;">
                          <span style="color: #10b981; margin-right: 8px; font-size: 18px;">✓</span>
                          <span>Dashboard com métricas em tempo real</span>
                        </li>
                        <li style="margin-bottom: 12px; color: #525252; font-size: 15px; display: flex; align-items: start;">
                          <span style="color: #10b981; margin-right: 8px; font-size: 18px;">✓</span>
                          <span>Funil de vendas visual e intuitivo</span>
                        </li>
                        <li style="margin-bottom: 12px; color: #525252; font-size: 15px; display: flex; align-items: start;">
                          <span style="color: #10b981; margin-right: 8px; font-size: 18px;">✓</span>
                          <span>Interface responsiva para qualquer dispositivo</span>
                        </li>
                        <li style="margin-bottom: 12px; color: #525252; font-size: 15px; display: flex; align-items: start;">
                          <span style="color: #10b981; margin-right: 8px; font-size: 18px;">✓</span>
                          <span>Notificações automáticas de leads</span>
                        </li>
                        <li style="margin-bottom: 12px; color: #525252; font-size: 15px; display: flex; align-items: start;">
                          <span style="color: #10b981; margin-right: 8px; font-size: 18px;">✓</span>
                          <span>Gestão de documentos anexados</span>
                        </li>
                        <li style="margin-bottom: 0; color: #525252; font-size: 15px; display: flex; align-items: start;">
                          <span style="color: #10b981; margin-right: 8px; font-size: 18px;">✓</span>
                          <span>Atualizações instantâneas</span>
                        </li>
                      </ul>
                    </div>

                    <!-- Botão CTA -->
                    <div style="text-align: center; margin: 32px 0;">
                      <a href="${data.inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #ff6900 0%, #e65f00 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(255, 105, 0, 0.3);">
                        🔐 Acessar Plataforma e Definir Senha
                      </a>
                    </div>

                    <!-- Aviso de Segurança -->
                    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin: 24px 0;">
                      <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
                        <strong>⚠️ Importante:</strong> Este link expira em ${AUTH_SET_PASSWORD_LINK_EXPIRY_LABEL}. Clique no botão acima para definir sua senha e começar a usar a plataforma.
                      </p>
                    </div>

                    <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 32px 0;" />

                    <p style="margin: 0; color: #737373; font-size: 14px; line-height: 1.6; text-align: center;">
                      Se você tiver alguma dúvida, entre em contato com <strong>${data.managerName}</strong> ou com o suporte do Corretor Studio.
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f9fafb; padding: 24px 32px; text-align: center; border-top: 1px solid #e5e5e5;">
                    <p style="margin: 0; color: #737373; font-size: 12px;">
                      Este é um e-mail automático do Corretor Studio
                    </p>
                    <p style="margin: 8px 0 0 0; color: #a3a3a3; font-size: 11px;">
                      © 2026 Corretor Studio. Todos os direitos reservados.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    if (data.profileId) {
      return sendTrackedEmailToProfileRecipients({
        profileId: data.profileId,
        category: "operator_invite",
        subject: `Convite: Você foi adicionado ao Corretor Studio por ${data.managerName}`,
        html,
        sourceType: data.sourceType ?? "member_access",
        sourceId: data.sourceId,
        idempotencyKey: data.sourceId ? `operator-invite/${data.sourceId}` : undefined,
      });
    }

    return this.sendEmailUntracked({
      to: [data.operatorEmail],
      subject: `Convite: Você foi adicionado ao Corretor Studio por ${data.managerName}`,
      html,
    });
  }

  async sendPendingAccountUserPaymentEmail(data: PendingAccountUserPaymentEmailData) {
    const manageUrl = getFullUrl("/subscription");
    const billingTypeLabel =
      data.billingType === "PIX"
        ? "PIX"
        : data.billingType === "BOLETO"
          ? "boleto"
          : data.billingType === "CREDIT_CARD"
            ? "cartão de crédito"
            : "assinatura atual";

    const paymentInstructions =
      data.billingType === "PIX"
        ? `
          <p style="margin: 0 0 12px 0; color: #525252; font-size: 15px; line-height: 1.6;">
            Copie o código PIX abaixo para concluir a cobrança adicional:
          </p>
          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; word-break: break-all; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; color: #171717;">
            ${data.pixPayload || "Código PIX indisponível"}
          </div>
        `
        : data.billingType === "BOLETO"
          ? `
            <p style="margin: 0 0 12px 0; color: #525252; font-size: 15px; line-height: 1.6;">
              A cobrança foi gerada em boleto. Use o link abaixo para visualizar e pagar:
            </p>
            <div style="margin-bottom: 16px;">
              <a href="${data.boletoUrl || manageUrl}" style="display: inline-block; background: #ff6900; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 10px; font-weight: 600;">
                Abrir boleto
              </a>
            </div>
            <p style="margin: 0; color: #737373; font-size: 14px;">
              Vencimento: ${data.boletoDueDate || "consulte no portal"}
            </p>
          `
          : `
            <p style="margin: 0 0 12px 0; color: #525252; font-size: 15px; line-height: 1.6;">
              A cobrança incremental foi enviada ao ${billingTypeLabel}. Assim que o pagamento for confirmado, o novo usuário será criado automaticamente.
            </p>
          `;

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);">
                <tr>
                  <td style="background: linear-gradient(135deg, #ff6900 0%, #e65f00 100%); padding: 32px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Corretor Studio</h1>
                    <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.92); font-size: 15px;">Cobrança incremental pendente</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 36px 32px;">
                    <h2 style="margin: 0 0 16px 0; color: #171717; font-size: 24px; font-weight: 600;">Olá, ${data.masterName}</h2>
                    <p style="margin: 0 0 20px 0; color: #525252; font-size: 16px; line-height: 1.7;">
                      ${data.requesterName} solicitou a criação de um novo usuário na sua conta. A conta ficará pendente até a confirmação da cobrança adicional.
                    </p>

                    <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 14px; padding: 20px; margin-bottom: 20px;">
                      <p style="margin: 0 0 8px 0; color: #171717; font-size: 15px;"><strong>Usuário solicitado:</strong> ${data.requestedUserName}</p>
                      <p style="margin: 0 0 8px 0; color: #171717; font-size: 15px;"><strong>E-mail:</strong> ${data.requestedUserEmail}</p>
                      <p style="margin: 0 0 8px 0; color: #171717; font-size: 15px;"><strong>Nível:</strong> ${data.requestedRole}</p>
                      <p style="margin: 0 0 8px 0; color: #171717; font-size: 15px;"><strong>Solicitado por:</strong> ${data.requesterName} (${data.requesterEmail})</p>
                      <p style="margin: 0 0 8px 0; color: #171717; font-size: 15px;"><strong>Valor adicional:</strong> ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(data.amount)}</p>
                      <p style="margin: 0; color: #171717; font-size: 15px;"><strong>Novo valor recorrente:</strong> ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(data.newRecurringTotal)}</p>
                    </div>

                    <div style="background: #fff7ed; border: 1px solid #fdba74; border-radius: 14px; padding: 20px; margin-bottom: 24px;">
                      <p style="margin: 0 0 8px 0; color: #9a3412; font-size: 15px;"><strong>ID da cobrança:</strong> ${data.paymentId}</p>
                      <p style="margin: 0 0 16px 0; color: #9a3412; font-size: 15px;"><strong>Forma de cobrança:</strong> ${billingTypeLabel}</p>
                      ${paymentInstructions}
                    </div>

                    <div style="text-align: center;">
                      <a href="${manageUrl}" style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 10px; font-weight: 600;">
                        Abrir assinatura
                      </a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    return this.sendEmailUntracked({
      to: [data.masterEmail],
      subject: `Pagamento pendente para adicionar ${data.requestedUserName} à conta`,
      html,
    });
  }

  // Email de recuperação de senha
  async sendPasswordResetEmail(
    userEmail: string,
    userName: string,
    resetUrl: string,
    options?: { profileId?: string; sourceType?: string; sourceId?: string }
  ) {
    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
                
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #ff6900 0%, #e65f00 100%); padding: 40px 32px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Corretor Studio</h1>
                    <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">Gestão Inteligente de Leads</p>
                  </td>
                </tr>
                
                <!-- Conteúdo -->
                <tr>
                  <td style="padding: 48px 32px;">
                    <div style="text-align: center; margin-bottom: 32px;">
                      <div style="display: inline-block; width: 72px; height: 72px; background: linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%); border-radius: 50%; border: 2px solid #ff6900; text-align: center; line-height: 72px; margin-bottom: 16px;">
                        <span style="font-size: 32px;">🔑</span>
                      </div>
                    </div>

                    <h2 style="margin: 0 0 24px 0; color: #171717; font-size: 24px; font-weight: 600; text-align: center;">Redefina sua Senha</h2>
                    
                    <p style="margin: 0 0 16px 0; color: #525252; font-size: 16px; line-height: 1.6; text-align: center;">
                      Olá <strong>${userName}</strong>,
                    </p>

                    <p style="margin: 0 0 24px 0; color: #525252; font-size: 16px; line-height: 1.6; text-align: center;">
                      Recebemos uma solicitação para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha:
                    </p>
                    
                    <!-- Botão CTA -->
                    <div style="text-align: center; margin: 32px 0;">
                      <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #ff6900 0%, #e65f00 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(255, 105, 0, 0.3);">
                        🔐 Redefinir Senha
                      </a>
                    </div>

                    <!-- Aviso de Segurança -->
                    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin: 24px 0;">
                      <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
                        <strong>⚠️ Atenção:</strong> Se você não solicitou esta alteração, ignore este e-mail. Sua senha permanecerá inalterada.
                      </p>
                    </div>

                    <p style="margin: 16px 0 0 0; color: #737373; font-size: 14px; line-height: 1.6; text-align: center;">
                      Este link é válido por <strong>${AUTH_SET_PASSWORD_LINK_EXPIRY_LABEL}</strong>.
                    </p>
                    
                    <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 32px 0;" />
                    
                    <p style="margin: 0; color: #737373; font-size: 14px; line-height: 1.6; text-align: center;">
                      Precisa de ajuda? Estamos aqui para você! Entre em contato conosco a qualquer momento.
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f9fafb; padding: 24px 32px; text-align: center; border-top: 1px solid #e5e5e5;">
                    <p style="margin: 0; color: #737373; font-size: 12px;">
                      Este é um e-mail automático do Corretor Studio
                    </p>
                    <p style="margin: 8px 0 0 0; color: #a3a3a3; font-size: 11px;">
                      © 2026 Corretor Studio. Todos os direitos reservados.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    if (options?.profileId) {
      return sendTrackedEmailToProfileRecipients({
        profileId: options.profileId,
        category: "access_reset",
        subject: "Redefinição de Senha - Corretor Studio",
        html,
        sourceType: options.sourceType ?? "member_access",
        sourceId: options.sourceId,
        idempotencyKey: options.sourceId ? `password-reset/${options.sourceId}` : undefined,
      });
    }

    return this.sendEmailUntracked({
      to: [userEmail],
      subject: "Redefinição de Senha - Corretor Studio",
      html,
    });
  }

  // Email de notificação de remoção de acesso
  async sendOperatorAccessRemovedEmail(data: OperatorAccessRemovedEmailData) {
    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
                
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 40px 32px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Corretor Studio</h1>
                    <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">Notificação de Acesso</p>
                  </td>
                </tr>
                
                <!-- Conteúdo -->
                <tr>
                  <td style="padding: 48px 32px;">
                    <div style="text-align: center; margin-bottom: 32px;">
                      <div style="display: inline-block; width: 72px; height: 72px; background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); border-radius: 50%; border: 2px solid #dc2626; text-align: center; line-height: 72px; margin-bottom: 16px;">
                        <span style="font-size: 32px;">⚠️</span>
                      </div>
                    </div>

                    <h2 style="margin: 0 0 24px 0; color: #171717; font-size: 24px; font-weight: 600; text-align: center;">Acesso Removido</h2>
                    
                    <p style="margin: 0 0 16px 0; color: #525252; font-size: 16px; line-height: 1.6; text-align: center;">
                      Olá <strong>${data.operatorName}</strong>,
                    </p>

                    <p style="margin: 0 0 24px 0; color: #525252; font-size: 16px; line-height: 1.6; text-align: center;">
                      Informamos que seu acesso à plataforma <strong>Corretor Studio</strong> foi removido por <strong>${data.managerName}</strong>.
                    </p>

                    <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; border-radius: 8px; margin: 24px 0;">
                      <p style="margin: 0; color: #991b1b; font-size: 15px; line-height: 1.6;">
                        <strong>O que isso significa?</strong><br>
                        • Seu acesso à plataforma foi desativado<br>
                        • Seus leads foram transferidos para o gestor<br>
                        • Você não poderá mais fazer login no sistema
                      </p>
                    </div>

                    <p style="margin: 24px 0 0 0; color: #737373; font-size: 14px; line-height: 1.6; text-align: center;">
                      Se você tiver alguma dúvida sobre esta alteração, entre em contato com <strong>${data.managerName}</strong>.
                    </p>

                    <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 32px 0;" />

                    <p style="margin: 0; color: #737373; font-size: 14px; line-height: 1.6; text-align: center;">
                      Agradecemos por ter utilizado o Corretor Studio.
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f9fafb; padding: 24px 32px; text-align: center; border-top: 1px solid #e5e5e5;">
                    <p style="margin: 0; color: #737373; font-size: 12px;">
                      Este é um e-mail automático do Corretor Studio
                    </p>
                    <p style="margin: 8px 0 0 0; color: #a3a3a3; font-size: 11px;">
                      © 2026 Corretor Studio. Todos os direitos reservados.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    return this.sendEmailUntracked({
      to: [data.operatorEmail],
      subject: "Acesso Removido - Corretor Studio",
      html,
    });
  }

  async sendMeetingInviteEmail(data: MeetingInviteEmailData) {
    const timezone = resolveTimezone(data.timezone ?? DEFAULT_TZ);
    const formattedDate = formatIntimezone(data.meetingDate, "dd 'de' MMMM 'de' yyyy", timezone);
    const formattedTime = formatIntimezone(data.meetingDate, "HH:mm", timezone);
    const title = data.meetingTitle || `Estudo Plano de Saúde: ${data.leadName}`;
    const linkMarkup = data.meetingLink
      ? `<a href="${data.meetingLink}" style="color: #ff6900; text-decoration: none;">${data.meetingLink}</a>`
      : "Link não informado";

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
                <tr>
                  <td style="background: linear-gradient(135deg, #ff6900 0%, #e65f00 100%); padding: 40px 32px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Corretor Studio</h1>
                    <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">Convite de reunião</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 32px;">
                    <h2 style="margin: 0 0 16px 0; color: #171717; font-size: 22px; font-weight: 600;">${title}</h2>
                    <p style="margin: 0 0 20px 0; color: #525252; font-size: 15px; line-height: 1.6;">
                      Você foi convidado para uma reunião com <strong>${data.leadName}</strong>.
                    </p>
                    <div style="background-color: #fff7ed; border: 1px solid #fed7aa; padding: 16px; border-radius: 12px; margin: 20px 0;">
                      <p style="margin: 0 0 8px 0; color: #7c2d12; font-size: 14px;"><strong>Data:</strong> ${formattedDate}</p>
                      <p style="margin: 0 0 8px 0; color: #7c2d12; font-size: 14px;"><strong>Horário:</strong> ${formattedTime}</p>
                      <p style="margin: 0 0 8px 0; color: #7c2d12; font-size: 14px;"><strong>Organizador:</strong> ${data.organizerName}</p>
                      <p style="margin: 0; color: #7c2d12; font-size: 14px;"><strong>Link:</strong> ${linkMarkup}</p>
                    </div>
                    <p style="margin: 20px 0 0 0; color: #737373; font-size: 13px; line-height: 1.6;">
                      Este convite foi reenviado pelo Corretor Studio.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: #fafafa; padding: 20px 32px; border-top: 1px solid #e5e5e5;">
                    <p style="margin: 0; color: #a3a3a3; font-size: 12px; text-align: center;">
                      Este é um e-mail automático do Corretor Studio
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const recipients = data.to.filter(Boolean);
    if (recipients.length === 0) {
      return { success: false, error: "Nenhum destinatário informado" };
    }

    let lastResult: Awaited<ReturnType<EmailService["sendEmail"]>> | undefined;

    for (const [index, recipient] of recipients.entries()) {
      const baseOptions = {
        to: [recipient] as string[],
        subject: title,
        html,
        attachments: [
          {
            filename: "invite.ics",
            content: Buffer.from(this.buildMeetingInviteIcs({ ...data, to: [recipient] }), "utf8"),
            contentType: "text/calendar; charset=utf-8; method=REQUEST" as const,
          },
        ],
        idempotencyKey: data.eventUid ? `meeting-invite/${data.eventUid}/${index}` : undefined,
      };

      const result = data.teamId
        ? await this.sendEmail({
            ...baseOptions,
            tracking: {
              teamId: data.teamId,
              category: "meeting_invite" as const,
              sourceType: data.sourceType,
              sourceId: data.sourceId,
            },
          })
        : await this.sendEmailUntracked(baseOptions);

      const resendEmailId =
        result.success && result.data && typeof result.data === "object"
          ? ((result.data as { data?: { id?: string } }).data?.id ?? null)
          : null;

      if (data.sourceType || data.sourceId) {
        await logResendDispatchesForRecipients({
          recipients: [recipient],
          subject: title,
          category: "meeting_invite",
          sourceType: data.sourceType,
          sourceId: data.sourceId,
          resendEmailId,
          errorMessage: result.success ? null : result.error,
        });
      }

      lastResult = result;
      if (!result.success) {
        return result;
      }
    }

    return lastResult ?? { success: false, error: "Falha ao enviar convite de reunião" };
  }

  async sendCloserScheduleNotificationEmail(data: CloserScheduleNotificationEmailData) {
    const timezone = resolveTimezone(data.timezone ?? DEFAULT_TZ);
    const formattedDate = formatIntimezone(data.meetingDate, "dd 'de' MMMM 'de' yyyy", timezone);
    const formattedTime = formatIntimezone(data.meetingDate, "HH:mm", timezone);
    const subjectPrefix = data.isReschedule ? "Reunião reagendada" : "Reunião agendada";
    const subject = `${subjectPrefix}: ${data.meetingTitle}`;
    const scheduleIntroText = data.isReschedule
      ? `Olá <strong>${data.closerName}</strong>, você tem um novo reagendamento com o lead <strong>${data.leadName}</strong>.`
      : `Olá <strong>${data.closerName}</strong>, você tem um novo agendamento com o lead <strong>${data.leadName}</strong>.`;
    const leadCrmUrl = data.leadCode
      ? getFullUrl(`/crm?leadCode=${encodeURIComponent(data.leadCode)}`)
      : null;
    const leadCrmMarkup = leadCrmUrl
      ? `<p style="margin: 0 0 8px 0; color: #7c2d12; font-size: 14px;"><strong>Lead no Corretor Studio:</strong> <a href="${leadCrmUrl}" style="color: #ff6900; text-decoration: none;">Abrir lead no CRM</a></p>`
      : "";
    const linkMarkup = data.meetingLink
      ? `<a href="${data.meetingLink}" style="color: #ff6900; text-decoration: none;">${data.meetingLink}</a>`
      : "Link não informado";
    const attendeesMarkup =
      data.attendees.length > 0
        ? `<ul style="margin: 8px 0 0 20px; padding: 0; color: #7c2d12; font-size: 14px;">${data.attendees
            .map((attendee) => `<li style="margin-bottom: 4px;">${attendee}</li>`)
            .join("")}</ul>`
        : `<p style="margin: 8px 0 0 0; color: #7c2d12; font-size: 14px;">Nenhum participante informado.</p>`;

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
                <tr>
                  <td style="background: linear-gradient(135deg, #ff6900 0%, #e65f00 100%); padding: 40px 32px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Corretor Studio</h1>
                    <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">Confirmação de agendamento</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 32px;">
                    <h2 style="margin: 0 0 16px 0; color: #171717; font-size: 22px; font-weight: 600;">${data.meetingTitle}</h2>
                    <p style="margin: 0 0 20px 0; color: #525252; font-size: 15px; line-height: 1.6;">
                      ${scheduleIntroText}
                    </p>
                    <div style="background-color: #fff7ed; border: 1px solid #fed7aa; padding: 16px; border-radius: 12px; margin: 20px 0;">
                      <p style="margin: 0 0 8px 0; color: #7c2d12; font-size: 14px; font-weight: 600;">Infos do agendamento</p>
                      <p style="margin: 0 0 8px 0; color: #7c2d12; font-size: 14px;"><strong>Data:</strong> ${formattedDate}</p>
                      <p style="margin: 0 0 8px 0; color: #7c2d12; font-size: 14px;"><strong>Horário:</strong> ${formattedTime}</p>
                      <p style="margin: 0 0 8px 0; color: #7c2d12; font-size: 14px;"><strong>Lead:</strong> ${data.leadName}</p>
                      ${leadCrmMarkup}
                      <p style="margin: 0 0 8px 0; color: #7c2d12; font-size: 14px;"><strong>Link:</strong> ${linkMarkup}</p>
                      <div style="margin: 0; color: #7c2d12; font-size: 14px;">
                        <strong>Participantes:</strong>
                        ${attendeesMarkup}
                      </div>
                    </div>
                    ${
                      data.notes
                        ? `
                    <div style="background-color: #fafafa; border: 1px solid #e5e5e5; padding: 16px; border-radius: 12px; margin-top: 16px;">
                      <p style="margin: 0 0 8px 0; color: #171717; font-size: 14px; font-weight: 600;">Notas</p>
                      <p style="margin: 0; color: #525252; font-size: 14px; white-space: pre-wrap;">${data.notes}</p>
                    </div>
                    `
                        : ""
                    }
                  </td>
                </tr>
                <tr>
                  <td style="background-color: #fafafa; padding: 20px 32px; border-top: 1px solid #e5e5e5;">
                    <p style="margin: 0; color: #a3a3a3; font-size: 12px; text-align: center;">
                      Este é um e-mail automático do Corretor Studio
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: [data.to],
      subject,
      html,
      attachments: data.attachments,
      tracking: {
        teamId: data.teamId,
        category: "schedule_notification",
        sourceType: "closer_schedule_notification",
        sourceId: data.leadCode ?? undefined,
      },
    });
  }

  async sendAccountDeletionFarewellEmail(data: AccountDeletionFarewellEmailData) {
    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">

                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 40px 32px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Corretor Studio</h1>
                    <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">Notificação de Conta</p>
                  </td>
                </tr>

                <!-- Conteúdo -->
                <tr>
                  <td style="padding: 48px 32px;">
                    <div style="text-align: center; margin-bottom: 32px;">
                      <div style="display: inline-block; width: 72px; height: 72px; background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); border-radius: 50%; border: 2px solid #dc2626; text-align: center; line-height: 72px; margin-bottom: 16px;">
                        <span style="font-size: 32px;">⚠️</span>
                      </div>
                    </div>

                    <h2 style="margin: 0 0 24px 0; color: #171717; font-size: 24px; font-weight: 600; text-align: center;">Sua conta foi encerrada</h2>

                    <p style="margin: 0 0 16px 0; color: #525252; font-size: 16px; line-height: 1.6; text-align: center;">
                      Olá <strong>${data.userName}</strong>,
                    </p>

                    <p style="margin: 0 0 24px 0; color: #525252; font-size: 16px; line-height: 1.6; text-align: center;">
                      Informamos que sua conta na plataforma <strong>Corretor Studio</strong> foi encerrada. Todos os seus dados, times e acessos foram removidos permanentemente.
                    </p>

                    <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; border-radius: 8px; margin: 24px 0;">
                      <p style="margin: 0; color: #991b1b; font-size: 15px; line-height: 1.6;">
                        <strong>O que isso significa?</strong><br>
                        • Seu acesso à plataforma foi encerrado<br>
                        • Todos os times e dados foram removidos<br>
                        • Os demais usuários da conta perderam o acesso
                      </p>
                    </div>

                    <p style="margin: 24px 0 0 0; color: #737373; font-size: 14px; line-height: 1.6; text-align: center;">
                      Se você acredita que isso foi um erro, entre em contato com nossa equipe de suporte.
                    </p>

                    <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 32px 0;" />

                    <p style="margin: 0; color: #737373; font-size: 14px; line-height: 1.6; text-align: center;">
                      Agradecemos por ter utilizado o Corretor Studio.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f9fafb; padding: 24px 32px; text-align: center; border-top: 1px solid #e5e5e5;">
                    <p style="margin: 0; color: #737373; font-size: 12px;">
                      Este é um e-mail automático do Corretor Studio
                    </p>
                    <p style="margin: 8px 0 0 0; color: #a3a3a3; font-size: 11px;">
                      © ${new Date().getFullYear()} Corretor Studio. Todos os direitos reservados.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    return this.sendEmailUntracked({
      to: [data.userEmail],
      subject: "Conta encerrada — Corretor Studio",
      html,
    });
  }

  async sendAddOnPendingPaymentEmail(data: AddOnPendingPaymentEmailData) {
    const requesterInfo =
      data.requesterName && data.requesterEmail && data.requesterEmail !== data.masterEmail
        ? ` por ${data.requesterName}`
        : "";

    const formatCurrency = (value: number) =>
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

    const html = this.buildCheckoutLinkEmailHtml({
      title: `Foi solicitado um novo ${data.addonLabel.toLowerCase()}${requesterInfo} para sua conta. Existe uma cobrança adicional pendente.`,
      subtitle: `Pagamento pendente para adicionar ${data.addonLabel}`,
      recipientName: data.masterName,
      checkoutUrl: data.checkoutUrl,
      expiresAtLabel: "Atenção",
      expiresAtValue: "O link é válido por 24 horas.",
      details: [
        { label: "Item", value: data.addonLabel },
        ...(data.addonDetail ? [{ label: "Detalhe", value: data.addonDetail }] : []),
        { label: "Total", value: formatCurrency(data.totalCharge) },
        {
          label: "Período",
          value: `${data.remainingMonths} mês${data.remainingMonths > 1 ? "es" : ""}`,
        },
      ],
    });

    return this.sendEmailUntracked({
      to: [data.masterEmail],
      subject: `${data.addonLabel} pendente de pagamento — Corretor Studio`,
      html,
    });
  }

  async sendAddOnConfirmedEmail(data: AddOnConfirmedEmailData) {
    const requesterInfo =
      data.requesterName && data.requesterEmail && data.requesterEmail !== data.masterEmail
        ? ` solicitado por ${data.requesterName}`
        : "";

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);">
                <tr>
                  <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 32px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Corretor Studio</h1>
                    <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.92); font-size: 15px;">✅ ${data.addonLabel} ativado com sucesso!</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 36px 32px;">
                    <h2 style="margin: 0 0 16px 0; color: #171717; font-size: 24px; font-weight: 600;">Excelente, ${data.masterName}!</h2>
                    <p style="margin: 0 0 20px 0; color: #525252; font-size: 16px; line-height: 1.7;">
                      Seu novo ${data.addonLabel.toLowerCase()}${requesterInfo} foi ativado com sucesso e está pronto para uso.
                    </p>

                    <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 14px; padding: 20px; margin-bottom: 24px;">
                      <p style="margin: 0 0 8px 0; color: #166534; font-size: 15px;">✓ <strong>${data.addonLabel}:</strong> ${data.addonDetail || "Novo add-on"}</p>
                      <p style="margin: 0 0 8px 0; color: #166534; font-size: 15px;">✓ <strong>Status:</strong> Ativo e pronto para uso</p>
                      ${
                        data.requesterName && data.requesterEmail && data.requesterEmail !== data.masterEmail
                          ? `<p style="margin: 0; color: #166534; font-size: 15px;">✓ <strong>Solicitado por:</strong> ${data.requesterName}</p>`
                          : ""
                      }
                    </div>

                    <p style="margin: 0 0 16px 0; color: #525252; font-size: 16px; line-height: 1.7;">
                      Agora você pode começar a usar os novos recursos. Acesse sua conta para visualizar todas as mudanças.
                    </p>

                    <div style="text-align: center;">
                      <a href="${getAppUrl({ removeTrailingSlash: true })}/sign-in" style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 600;">
                        Acessar minha conta
                      </a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const recipientsList = [data.masterEmail];
    if (
      data.requesterEmail &&
      data.requesterEmail !== data.masterEmail &&
      data.requesterName &&
      data.requesterEmail
    ) {
      recipientsList.push(data.requesterEmail);
    }

    return this.sendEmailUntracked({
      to: recipientsList,
      subject: `${data.addonLabel} ativado com sucesso — Corretor Studio`,
      html,
    });
  }

  async sendBackofficeAdhesionCheckoutEmail(data: BackofficeAdhesionCheckoutEmailData) {
    const timezone = DEFAULT_TZ
    const expiresAt = formatIntimezone(data.expiresAt, "dd/MM/yyyy 'às' HH:mm", timezone)

    const html = this.buildCheckoutLinkEmailHtml({
      title: "Seu link para finalizar a adesão está pronto.",
      subtitle: "Finalize sua adesão no Corretor Studio",
      recipientName: data.userName,
      checkoutUrl: data.checkoutUrl,
      expiresAtLabel: "Validade",
      expiresAtValue: expiresAt,
    })

    await this.sendEmailUntracked({
      to: [data.userEmail],
      subject: "Finalize sua adesão no Corretor Studio",
      html,
      text: `Olá, ${data.userName}.\n\nSeu link para finalizar a adesão está pronto: ${data.checkoutUrl}\n\nValidade: ${expiresAt}\n`,
      from: "Corretor Studio <no-reply@corretorstudio.com>",
    })
  }

  async sendLeadTransferActivatedEmail(data: LeadTransferActivatedEmailData) {
    const leadName = data.leadName || "Lead sem nome";
    const leadPhone = data.leadPhone || "Não informado";
    const leadCnpj = data.leadCnpj || "Não informado";
    const leadCurrentHealthPlan = data.leadCurrentHealthPlan || "Não informado";
    const leadCurrentValue =
      data.leadCurrentValue != null
        ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(data.leadCurrentValue)
        : "Não informado";
    const sdrName = data.sdrName || "Não informado";
    const leadUrl = getFullUrl(`/crm?leadCode=${encodeURIComponent(data.leadCode)}`);
    const leadNotes = (data.leadNotes || "Sem observações").trim();
    const scheduleShareUrl = data.scheduleShareUrl?.trim() || "";
    const scheduleShareBlock = scheduleShareUrl
      ? `
          <div style="margin-top: 16px; background: #fff7ed; border: 1px solid #fed7aa; padding: 12px; border-radius: 6px;">
            <p style="margin: 0 0 8px;"><strong>Link do formulário da reunião</strong></p>
            <p style="margin: 0;">
              <a href="${scheduleShareUrl}" style="color: #ff6900; text-decoration: none;">Abrir agendamento</a>
            </p>
          </div>
        `
      : "";

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #1f2937;">
        <div style="background: #ff6900; color: #fff; padding: 16px 20px; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 22px;">Lead para transferência adicionado</h1>
          <p style="margin: 8px 0 0; font-size: 14px; opacity: 0.95;">
            Um novo lead foi marcado para transferência no Corretor Studio.
          </p>
        </div>

        <div style="border: 1px solid #fed7aa; border-top: 0; border-radius: 0 0 10px 10px; padding: 20px; background: #fff;">
          <p style="margin: 0 0 8px;"><strong>Lead:</strong> ${leadName}</p>
          <p style="margin: 0 0 8px;"><strong>Telefone:</strong> ${leadPhone}</p>
          <p style="margin: 0 0 8px;"><strong>CNPJ:</strong> ${leadCnpj}</p>
          <p style="margin: 0 0 8px;"><strong>Plano atual:</strong> ${leadCurrentHealthPlan}</p>
          <p style="margin: 0 0 8px;"><strong>Valor atual:</strong> ${leadCurrentValue}</p>
          <p style="margin: 0 0 14px;"><strong>SDR:</strong> ${sdrName}</p>

          <div style="margin: 0 0 14px;">
            <a href="${leadUrl}" style="display: inline-block; background: #ff6900; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 8px; font-weight: 600;">Acessar lead no CRM</a>
          </div>

          <div style="background: #fff7ed; border-left: 4px solid #ff6900; padding: 12px; border-radius: 6px;">
            <p style="margin: 0 0 4px;"><strong>Observações</strong></p>
            <p style="margin: 0; white-space: pre-wrap;">${leadNotes}</p>
          </div>
          ${scheduleShareBlock}
        </div>
      </div>
    `;

    return this.sendEmail({
      to: data.to,
      subject: `Novo lead para transferência: ${leadName}`,
      html,
      tracking: {
        teamId: data.teamId,
        category: "transactional",
        sourceType: "lead_transfer_activated",
        sourceId: data.leadCode,
      },
    });
  }

  async sendMeetingFollowUpDigestEmail(data: MeetingFollowUpDigestEmailData) {
    const meetingLabel = data.leadCount === 1 ? "reunião" : "reuniões";
    const subject =
      data.role === "closer"
        ? `${data.leadCount} ${meetingLabel} aguardando confirmação`
        : `Time: ${data.leadCount} ${meetingLabel} pendentes há mais de 3 dias`;

    const introText =
      data.role === "closer"
        ? `Olá <strong>${data.recipientName}</strong>, você tem <strong>${data.leadCount}</strong> ${meetingLabel} aguardando confirmação. Marque como realizada ou no-show no Corretor Studio.`
        : `Olá <strong>${data.recipientName}</strong>, o time <strong>${data.teamName ?? "do time"}</strong> tem <strong>${data.leadCount}</strong> ${meetingLabel} aguardando confirmação há mais de 3 dias.`;

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
                <tr>
                  <td style="background: linear-gradient(135deg, #ff6900 0%, #e65f00 100%); padding: 40px 32px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Corretor Studio</h1>
                    <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">Reuniões aguardando confirmação</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 48px 32px;">
                    <p style="margin: 0 0 24px 0; color: #525252; font-size: 16px; line-height: 1.6;">
                      ${introText}
                    </p>
                    <div style="text-align: center; margin: 32px 0;">
                      <a href="${data.crmUrl}" style="display: inline-block; background: #ff6900; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 600; font-size: 16px;">
                        Abrir board no CRM
                      </a>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: #fafafa; padding: 20px 32px; border-top: 1px solid #e5e5e5;">
                    <p style="margin: 0; color: #a3a3a3; font-size: 12px; text-align: center;">
                      Este é um e-mail automático do Corretor Studio
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    if (data.profileId) {
      return sendTrackedEmailToProfileRecipients({
        profileId: data.profileId,
        category: "meeting_invite",
        subject,
        html,
        sourceType: "meeting_follow_up_digest",
      });
    }

    if (data.teamId) {
      return this.sendEmail({
        to: [data.to],
        subject,
        html,
        tracking: {
          teamId: data.teamId,
          category: "meeting_invite",
          sourceType: "meeting_follow_up_digest",
        },
      });
    }

    return this.sendEmailUntracked({
      to: [data.to],
      subject,
      html,
    });
  }
}

// Função para criar instância quando necessário
export function createEmailService() {
  return new EmailService();
}

// Export padrão que pode ser usado quando necessário
export const getEmailService = (() => {
  let instance: EmailService | null = null;
  return () => {
    if (!instance) {
      instance = new EmailService();
    }
    return instance;
  };
})();

// Instância singleton do EmailService (mesma que getEmailService)
export const emailService = getEmailService();
