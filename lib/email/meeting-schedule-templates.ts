/**
 * Templates HTML dos e-mails de agenda (convite de reunião e aviso ao closer).
 *
 * SPEC 13 (Agenda na Criação de Lead), A-E1/DA8 — fecha a V4 (HTML sem escape):
 * todo dado vindo de fora (nome do lead, telefone, título e notas da reunião,
 * nome do closer, link) é escapado com `escapeHtml`/`escapeHtmlAttribute` antes
 * de entrar no HTML, e `href` só aceita `https:` (`sanitizeEmailHref`).
 *
 * Extraído de `lib/services/EmailService.ts` (`sendMeetingInviteEmail` e
 * `sendCloserScheduleNotificationEmail`) como funções puras para poder ser
 * testado sem Resend nem rede.
 */

import { DEFAULT_TZ, formatIntimezone, resolveTimezone } from "@/lib/dates"
import { getFullUrl } from "@/lib/utils/app-url"
import { escapeHtml, sanitizeEmailHref } from "./escape-html"

function buildLinkMarkup(rawLink: string | null | undefined, fallbackLabel: string): string {
  if (!rawLink) return fallbackLabel

  const safeText = escapeHtml(rawLink)
  const safeHref = sanitizeEmailHref(rawLink)
  if (!safeHref) return safeText

  return `<a href="${safeHref}" style="color: #ff6900; text-decoration: none;">${safeText}</a>`
}

export interface MeetingInviteEmailTemplateInput {
  leadName: string
  meetingTitle?: string | null
  meetingDate: Date
  meetingLink?: string | null
  organizerName: string
  timezone?: string | null
}

export interface MeetingInviteEmailTemplate {
  /** Título cru (não-HTML), usado também como assunto do e-mail. */
  title: string
  html: string
}

export function buildMeetingInviteEmailTemplate(
  input: MeetingInviteEmailTemplateInput
): MeetingInviteEmailTemplate {
  const timezone = resolveTimezone(input.timezone ?? DEFAULT_TZ)
  const formattedDate = formatIntimezone(input.meetingDate, "dd 'de' MMMM 'de' yyyy", timezone)
  const formattedTime = formatIntimezone(input.meetingDate, "HH:mm", timezone)
  const title = input.meetingTitle || `Estudo Plano de Saúde: ${input.leadName}`

  const safeTitle = escapeHtml(title)
  const safeLeadName = escapeHtml(input.leadName)
  const safeOrganizerName = escapeHtml(input.organizerName)
  const linkMarkup = buildLinkMarkup(input.meetingLink, "Link não informado")

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
                    <h2 style="margin: 0 0 16px 0; color: #171717; font-size: 22px; font-weight: 600;">${safeTitle}</h2>
                    <p style="margin: 0 0 20px 0; color: #525252; font-size: 15px; line-height: 1.6;">
                      Você foi convidado para uma reunião com <strong>${safeLeadName}</strong>.
                    </p>
                    <div style="background-color: #fff7ed; border: 1px solid #fed7aa; padding: 16px; border-radius: 12px; margin: 20px 0;">
                      <p style="margin: 0 0 8px 0; color: #7c2d12; font-size: 14px;"><strong>Data:</strong> ${formattedDate}</p>
                      <p style="margin: 0 0 8px 0; color: #7c2d12; font-size: 14px;"><strong>Horário:</strong> ${formattedTime}</p>
                      <p style="margin: 0 0 8px 0; color: #7c2d12; font-size: 14px;"><strong>Organizador:</strong> ${safeOrganizerName}</p>
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
    `

  return { title, html }
}

export interface CloserScheduleNotificationEmailTemplateInput {
  closerName: string
  leadName: string
  leadCode?: string | null
  leadPhone?: string | null
  meetingTitle: string
  meetingDate: Date
  meetingLink?: string | null
  meetingType?: "online" | "call" | "whatsapp" | null
  isReschedule: boolean
  attendees: string[]
  notes?: string | null
  timezone?: string | null
}

/**
 * Linha "Link" (reunião online, com `buildLinkMarkup`) ou "Formato" (telefone/
 * WhatsApp, texto fixo — não vem de fora, não precisa de escape) do aviso ao
 * closer. `meetingType` ausente ou `"online"` mantém o comportamento anterior
 * a essa distinção.
 */
function buildMeetingFormatRow(input: {
  meetingType?: "online" | "call" | "whatsapp" | null
  meetingLink?: string | null
}): { label: string; valueMarkup: string } {
  const isOnlineMeeting = (input.meetingType ?? "online") === "online"
  if (isOnlineMeeting) {
    return { label: "Link", valueMarkup: buildLinkMarkup(input.meetingLink, "Link não informado") }
  }
  return {
    label: "Formato",
    valueMarkup: input.meetingType === "call" ? "Ligação por telefone" : "Contato via WhatsApp",
  }
}

export interface CloserScheduleNotificationEmailTemplate {
  /** Assunto cru (não-HTML) do e-mail. */
  subject: string
  html: string
}

export function buildCloserScheduleNotificationEmailTemplate(
  input: CloserScheduleNotificationEmailTemplateInput
): CloserScheduleNotificationEmailTemplate {
  const timezone = resolveTimezone(input.timezone ?? DEFAULT_TZ)
  const formattedDate = formatIntimezone(input.meetingDate, "dd 'de' MMMM 'de' yyyy", timezone)
  const formattedTime = formatIntimezone(input.meetingDate, "HH:mm", timezone)
  const subjectPrefix = input.isReschedule ? "Reunião reagendada" : "Reunião agendada"
  const subject = `${subjectPrefix}: ${input.meetingTitle}`

  const safeMeetingTitle = escapeHtml(input.meetingTitle)
  const safeCloserName = escapeHtml(input.closerName)
  const safeLeadName = escapeHtml(input.leadName)
  const scheduleIntroText = input.isReschedule
    ? `Olá <strong>${safeCloserName}</strong>, você tem um novo reagendamento com o lead <strong>${safeLeadName}</strong>.`
    : `Olá <strong>${safeCloserName}</strong>, você tem um novo agendamento com o lead <strong>${safeLeadName}</strong>.`

  const leadCrmUrl = input.leadCode ? getFullUrl(`/crm?leadCode=${encodeURIComponent(input.leadCode)}`) : null
  const safeLeadCrmHref = sanitizeEmailHref(leadCrmUrl)
  const leadCrmMarkup = safeLeadCrmHref
    ? `<p style="margin: 0 0 8px 0; color: #7c2d12; font-size: 14px;"><strong>Lead no Corretor Studio:</strong> <a href="${safeLeadCrmHref}" style="color: #ff6900; text-decoration: none;">Abrir lead no CRM</a></p>`
    : ""

  const trimmedLeadPhone = input.leadPhone?.trim()
  const leadPhoneMarkup = trimmedLeadPhone
    ? `<p style="margin: 0 0 8px 0; color: #7c2d12; font-size: 14px;"><strong>Telefone:</strong> ${escapeHtml(trimmedLeadPhone)}</p>`
    : ""

  const { label: linkRowLabel, valueMarkup: linkRowValue } = buildMeetingFormatRow({
    meetingType: input.meetingType,
    meetingLink: input.meetingLink,
  })

  const attendeesMarkup =
    input.attendees.length > 0
      ? `<ul style="margin: 8px 0 0 20px; padding: 0; color: #7c2d12; font-size: 14px;">${input.attendees
          .map((attendee) => `<li style="margin-bottom: 4px;">${escapeHtml(attendee)}</li>`)
          .join("")}</ul>`
      : `<p style="margin: 8px 0 0 0; color: #7c2d12; font-size: 14px;">Nenhum participante informado.</p>`

  const safeNotes = input.notes ? escapeHtml(input.notes) : null

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
                    <h2 style="margin: 0 0 16px 0; color: #171717; font-size: 22px; font-weight: 600;">${safeMeetingTitle}</h2>
                    <p style="margin: 0 0 20px 0; color: #525252; font-size: 15px; line-height: 1.6;">
                      ${scheduleIntroText}
                    </p>
                    <div style="background-color: #fff7ed; border: 1px solid #fed7aa; padding: 16px; border-radius: 12px; margin: 20px 0;">
                      <p style="margin: 0 0 8px 0; color: #7c2d12; font-size: 14px; font-weight: 600;">Infos do agendamento</p>
                      <p style="margin: 0 0 8px 0; color: #7c2d12; font-size: 14px;"><strong>Data:</strong> ${formattedDate}</p>
                      <p style="margin: 0 0 8px 0; color: #7c2d12; font-size: 14px;"><strong>Horário:</strong> ${formattedTime}</p>
                      <p style="margin: 0 0 8px 0; color: #7c2d12; font-size: 14px;"><strong>Lead:</strong> ${safeLeadName}</p>
                      ${leadPhoneMarkup}
                      ${leadCrmMarkup}
                      <p style="margin: 0 0 8px 0; color: #7c2d12; font-size: 14px;"><strong>${linkRowLabel}:</strong> ${linkRowValue}</p>
                      <div style="margin: 0; color: #7c2d12; font-size: 14px;">
                        <strong>Participantes:</strong>
                        ${attendeesMarkup}
                      </div>
                    </div>
                    ${
                      safeNotes
                        ? `
                    <div style="background-color: #fafafa; border: 1px solid #e5e5e5; padding: 16px; border-radius: 12px; margin-top: 16px;">
                      <p style="margin: 0 0 8px 0; color: #171717; font-size: 14px; font-weight: 600;">Notas</p>
                      <p style="margin: 0; color: #525252; font-size: 14px; white-space: pre-wrap;">${safeNotes}</p>
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
    `

  return { subject, html }
}

export interface MeetingContactNotificationEmailTemplateInput {
  leadName: string
  meetingDate: Date
  meetingType: "call" | "whatsapp"
  closerName: string
  closerPhone?: string | null
  timezone?: string | null
}

export interface MeetingContactNotificationEmailTemplate {
  /** Título cru (não-HTML), usado também como assunto do e-mail. */
  title: string
  html: string
}

/**
 * Aviso ao lead de reunião por telefone/WhatsApp (`sendMeetingContactNotificationEmail`
 * em `EmailService.ts`). Chegou via `origin/develop` depois deste PR ter sido
 * aberto (mesma classe de template de agenda da DA8) — extraído e escapado
 * junto para não reintroduzir a V4 no merge.
 */
export function buildMeetingContactNotificationEmailTemplate(
  input: MeetingContactNotificationEmailTemplateInput
): MeetingContactNotificationEmailTemplate {
  const timezone = resolveTimezone(input.timezone ?? DEFAULT_TZ)
  const formattedDate = formatIntimezone(input.meetingDate, "dd 'de' MMMM 'de' yyyy", timezone)
  const formattedTime = formatIntimezone(input.meetingDate, "HH:mm", timezone)
  const formatLabel = input.meetingType === "call" ? "Ligação" : "WhatsApp"
  const title = `Reunião por ${formatLabel} com ${input.closerName}`

  const safeTitle = escapeHtml(title)
  const safeLeadName = escapeHtml(input.leadName)
  const safeCloserName = escapeHtml(input.closerName)
  const trimmedCloserPhone = input.closerPhone?.trim()
  const closerPhoneMarkup = trimmedCloserPhone
    ? `<p style="margin: 0; color: #7c2d12; font-size: 14px;"><strong>Telefone:</strong> ${escapeHtml(trimmedCloserPhone)}</p>`
    : ""

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
                    <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">Agendamento confirmado</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 32px;">
                    <h2 style="margin: 0 0 16px 0; color: #171717; font-size: 22px; font-weight: 600;">${safeTitle}</h2>
                    <p style="margin: 0 0 20px 0; color: #525252; font-size: 15px; line-height: 1.6;">
                      Olá <strong>${safeLeadName}</strong>, você tem uma reunião marcada com <strong>${safeCloserName}</strong> por <strong>${formatLabel}</strong>.
                    </p>
                    <div style="background-color: #fff7ed; border: 1px solid #fed7aa; padding: 16px; border-radius: 12px; margin: 20px 0;">
                      <p style="margin: 0 0 8px 0; color: #7c2d12; font-size: 14px;"><strong>Data:</strong> ${formattedDate}</p>
                      <p style="margin: 0 0 8px 0; color: #7c2d12; font-size: 14px;"><strong>Horário:</strong> ${formattedTime}</p>
                      <p style="margin: 0 0 8px 0; color: #7c2d12; font-size: 14px;"><strong>Contato:</strong> ${safeCloserName}</p>
                      ${closerPhoneMarkup}
                    </div>
                    <p style="margin: 20px 0 0 0; color: #737373; font-size: 13px; line-height: 1.6;">
                      Fique atento ao horário combinado.
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
    `

  return { title, html }
}
