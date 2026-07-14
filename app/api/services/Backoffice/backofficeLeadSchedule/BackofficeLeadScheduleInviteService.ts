import { randomUUID } from "node:crypto"
import type { Attachment, CreateEmailOptions } from "resend"
import { assertResend, buildResendIdempotencyKey } from "@/lib/email"
import { buildBackofficeResendTags } from "@/lib/email/build-backoffice-resend-tags"
import { getResendOwnerEmail } from "@/lib/email/resend-owner-email"
import { DEFAULT_TZ, formatIntimezone } from "@/lib/dates"
import { Output } from "@/lib/output"
import type {
  IBackofficeLeadScheduleInviteService,
  SendBackofficeLeadScheduleInviteInput,
  SendCloserNewLeadNotificationInput,
} from "./IBackofficeLeadScheduleInviteService"

const CALENDAR_DURATION_MINUTES = 30

interface BackofficeScheduleEmailOptions {
  to: string[]
  subject: string
  html: string
  attachments?: Attachment[]
  idempotencyKey?: string
  sourceType?: string
  sourceId?: string
  category?: "schedule_invite"
}

function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  return normalized ? normalized : null
}

function buildUniqueEmails(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const emails: string[] = []

  values.forEach((value) => {
    const normalized = normalizeEmail(value)
    if (!normalized || seen.has(normalized)) return
    seen.add(normalized)
    emails.push(normalized)
  })

  return emails
}

function formatIcsDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")
}

function escapeIcsText(value?: string | null): string {
  if (!value) return ""
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
}

function escapeHtml(value?: string | null): string {
  if (!value) return ""
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function escapeHtmlAttribute(value?: string | null): string {
  return escapeHtml(value)
}

function buildInviteIcs(input: SendBackofficeLeadScheduleInviteInput, attendees: string[]) {
  const start = input.meetingDate
  const end = new Date(start.getTime() + CALENDAR_DURATION_MINUTES * 60 * 1000)
  const uid = escapeIcsText(
    input.eventUid.includes("@")
      ? input.eventUid
      : `${input.eventUid || randomUUID()}@corretorstudio.com`
  )
  const descriptionLines = [
    "Demonstração agendada pelo Corretor Studio.",
    `Lead: ${input.leadName}`,
    `Link: ${input.meetingLink}`,
  ]

  if (input.meetingNotes?.trim()) {
    descriptionLines.push(`Observações: ${input.meetingNotes.trim()}`)
  }

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Corretor Studio//Backoffice CRM//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(start)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:${escapeIcsText(input.meetingTitle)}`,
    `DESCRIPTION:${escapeIcsText(descriptionLines.join("\n"))}`,
    `LOCATION:${escapeIcsText(input.meetingLink)}`,
    `ORGANIZER;CN=${escapeIcsText(input.closerName)}:mailto:${input.closerEmail}`,
  ]

  attendees.forEach((email) => {
    lines.push(`ATTENDEE;ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:${email}`)
  })

  lines.push("END:VEVENT", "END:VCALENDAR")
  return lines.join("\r\n")
}

function buildInviteAttachment(
  input: SendBackofficeLeadScheduleInviteInput,
  attendees: string[]
): Attachment {
  return {
    filename: "invite.ics",
    content: Buffer.from(buildInviteIcs(input, attendees), "utf8"),
    contentType: "text/calendar; charset=utf-8; method=REQUEST",
  }
}

function buildScheduleDetailsHtml(input: SendBackofficeLeadScheduleInviteInput) {
  const timezone = input.timezone || DEFAULT_TZ
  const formattedDate = formatIntimezone(input.meetingDate, "dd 'de' MMMM 'de' yyyy", timezone)
  const formattedTime = formatIntimezone(input.meetingDate, "HH:mm", timezone)
  const safeMeetingLink = escapeHtml(input.meetingLink)
  const linkMarkup = `<a href="${escapeHtmlAttribute(input.meetingLink)}" style="color: #ff6900; text-decoration: none;">${safeMeetingLink}</a>`

  return `
    <div style="background-color: #fff7ed; border: 1px solid #fed7aa; padding: 16px; border-radius: 12px; margin: 20px 0;">
      <p style="margin: 0 0 8px 0; color: #7c2d12; font-size: 14px;"><strong>Data:</strong> ${formattedDate}</p>
      <p style="margin: 0 0 8px 0; color: #7c2d12; font-size: 14px;"><strong>Horário:</strong> ${formattedTime}</p>
      <p style="margin: 0; color: #7c2d12; font-size: 14px;"><strong>Link:</strong> ${linkMarkup}</p>
    </div>
  `
}

function buildEmailShell(title: string, subtitle: string, body: string) {
  const safeTitle = escapeHtml(title)
  const safeSubtitle = escapeHtml(subtitle)

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
            <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
              <tr>
                <td style="background: linear-gradient(135deg, #ff6900 0%, #e65f00 100%); padding: 40px 32px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Corretor Studio</h1>
                  <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">${safeSubtitle}</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 32px;">
                  <h2 style="margin: 0 0 16px 0; color: #171717; font-size: 22px; font-weight: 600;">${safeTitle}</h2>
                  ${body}
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
}

function buildTestBannerSnippet(originalRecipients: string[]) {
  return `
    <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 10px; padding: 12px; margin: 0 16px 20px;">
      <p style="margin: 0; color: #92400e; font-weight: 600;">
        MODO TESTE
      </p>
      <p style="margin: 4px 0 0 0; color: #92400e; font-size: 14px;">
        Este e-mail seria enviado para: <strong>${originalRecipients.join(", ")}</strong>
      </p>
    </div>
  `
}

function injectHtmlAfterBodyOpen(html: string, snippet: string) {
  const bodyOpenTagRegex = /<body[^>]*>/i
  if (bodyOpenTagRegex.test(html)) {
    return html.replace(bodyOpenTagRegex, (match) => `${match}${snippet}`)
  }

  return `${snippet}${html}`
}

async function sendBackofficeScheduleEmail(options: BackofficeScheduleEmailOptions) {
  try {
    const resend = assertResend()
    const isTestMode = process.env.EMAIL_TEST_MODE === "true"
    const resendOwnerEmail = getResendOwnerEmail()
    const effectiveTestMode = isTestMode && Boolean(resendOwnerEmail)
    const { logResendDispatchesForRecipients } = await import("@/lib/email/log-profile-email-dispatches")
    const recipients = options.to.filter(Boolean)

    if (recipients.length === 0) {
      return { success: false, data: null, error: "Nenhum destinatário informado" }
    }

    let lastResult: { success: boolean; data: unknown; error: string | null } = {
      success: true,
      data: null,
      error: null,
    }

    for (const [index, recipient] of recipients.entries()) {
      const deliveryRecipients = effectiveTestMode ? [resendOwnerEmail!] : [recipient]
      const html = effectiveTestMode
        ? injectHtmlAfterBodyOpen(options.html, buildTestBannerSnippet([recipient]))
        : options.html

      const payload: CreateEmailOptions = {
        from: "Corretor Studio <no-reply@corretorstudio.com>",
        to: deliveryRecipients,
        subject: effectiveTestMode
          ? `[TESTE - Para: ${recipient}] ${options.subject}`
          : options.subject,
        html,
        attachments: options.attachments,
        tags: buildBackofficeResendTags({
          category: options.category ?? "schedule_invite",
          sourceType: options.sourceType,
          sourceId: options.sourceId,
        }),
        headers: {
          Importance: "high",
          Priority: "urgent",
          "X-Priority": "1",
          "X-MSMail-Priority": "High",
        },
      }

      const idempotencyKey =
        options.idempotencyKey && recipients.length > 1
          ? `${options.idempotencyKey}/${index}`
          : options.idempotencyKey

      const result = await resend.emails.send(
        payload,
        idempotencyKey ? { idempotencyKey } : undefined
      )

      if (result.error) {
        console.error("[BackofficeLeadScheduleInviteService][sendEmail]", result.error)
        await logResendDispatchesForRecipients({
          recipients: [recipient],
          subject: options.subject,
          category: "schedule_invite",
          sourceType: options.sourceType,
          sourceId: options.sourceId,
          errorMessage: result.error.message || "Erro ao enviar e-mail",
        })
        return {
          success: false,
          data: null,
          error: result.error.message || "Erro ao enviar e-mail",
        }
      }

      const resendEmailId = result.data?.id ?? null
      await logResendDispatchesForRecipients({
        recipients: [recipient],
        subject: options.subject,
        category: "schedule_invite",
        sourceType: options.sourceType,
        sourceId: options.sourceId,
        resendEmailId,
      })

      lastResult = { success: true, data: result, error: null }
    }

    return lastResult
  } catch (error) {
    console.error("[BackofficeLeadScheduleInviteService][sendEmail]", error)
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : "Erro ao enviar e-mail",
    }
  }
}

export class BackofficeLeadScheduleInviteService
  implements IBackofficeLeadScheduleInviteService
{
  async sendInvite(input: SendBackofficeLeadScheduleInviteInput): Promise<Output> {
    try {
      const closerRecipient = normalizeEmail(input.closerEmail)

      if (!closerRecipient) {
        return new Output(false, [], ["Closer sem e-mail válido para envio do convite"], null)
      }

      const participantRecipients = buildUniqueEmails([
        input.leadEmail,
        ...(input.extraGuests ?? []),
      ]).filter((email) => email !== closerRecipient)

      const attendees = buildUniqueEmails([
        ...participantRecipients,
        closerRecipient,
      ])
      const attachment = buildInviteAttachment(input, attendees)
      const scheduleDetailsHtml = buildScheduleDetailsHtml(input)
      const safeLeadName = escapeHtml(input.leadName)
      const safeCloserName = escapeHtml(input.closerName)

      if (participantRecipients.length > 0) {
        const participantResult = await sendBackofficeScheduleEmail({
          to: participantRecipients,
          idempotencyKey: buildResendIdempotencyKey(
            "schedule-invite-participants",
            input.eventUid
          ),
          sourceType: "backoffice_leads_schedule",
          sourceId: input.eventUid,
          subject: `Corretor Studio: ${input.leadName}`,
          html: buildEmailShell(
            "Você foi convidado para a demonstração do Corretor Studio",
            "Convite de demonstração",
            `
              <p style="margin: 0 0 20px 0; color: #525252; font-size: 15px; line-height: 1.6;">
                Olá, sua demonstração do Corretor Studio foi agendada.
              </p>
              ${scheduleDetailsHtml}
              <p style="margin: 20px 0 0 0; color: #737373; font-size: 13px; line-height: 1.6;">
                O arquivo em anexo permite adicionar este compromisso à sua agenda.
              </p>
            `
          ),
          attachments: [attachment],
        })

        if (!participantResult.success) {
          return new Output(
            false,
            [],
            [participantResult.error ?? "Erro ao enviar convite aos participantes"],
            null
          )
        }
      }

      const closerResult = await sendBackofficeScheduleEmail({
        to: [closerRecipient],
        idempotencyKey: buildResendIdempotencyKey("schedule-invite-closer", input.eventUid),
        sourceType: "backoffice_leads_schedule",
        sourceId: input.eventUid,
        subject: `Corretor Studio: ${input.leadName}`,
        html: buildEmailShell(
          `Foi agendada uma apresentação para ${input.leadName}`,
          "Confirmação de agendamento",
          `
            <p style="margin: 0 0 20px 0; color: #525252; font-size: 15px; line-height: 1.6;">
              Olá <strong>${safeCloserName}</strong>, você tem uma apresentação agendada para o lead <strong>${safeLeadName}</strong>.
            </p>
            ${scheduleDetailsHtml}
          `
        ),
        attachments: [attachment],
      })

      if (!closerResult.success) {
        return new Output(
          false,
          [],
          [closerResult.error ?? "Erro ao enviar confirmação ao closer"],
          null
        )
      }

      return new Output(true, ["Convites enviados com sucesso"], [], {
        participantRecipients,
        closerRecipient,
      })
    } catch (error) {
      console.error("[BackofficeLeadScheduleInviteService][sendInvite]", error)
      return new Output(false, [], ["Erro ao enviar convites do agendamento"], null)
    }
  }

  async sendCloserNewLeadNotification(
    input: SendCloserNewLeadNotificationInput
  ): Promise<Output> {
    try {
      const closerRecipient = normalizeEmail(input.closerEmail)
      if (!closerRecipient) {
        return new Output(false, [], ["Closer sem e-mail válido para notificação"], null)
      }

      const timezone = input.timezone || DEFAULT_TZ
      const formattedDate = formatIntimezone(input.meetingDate, "dd 'de' MMMM 'de' yyyy", timezone)
      const formattedTime = formatIntimezone(input.meetingDate, "HH:mm", timezone)
      const safeLeadName = escapeHtml(input.leadName)
      const safeLeadEmail = escapeHtml(input.leadEmail)
      const safeLeadPhone = escapeHtml(input.leadPhone)

      const leadContactRows = [
        input.leadEmail
          ? `<tr><td style="padding: 6px 0; color: #737373; font-size: 13px; width: 90px;">E-mail</td><td style="padding: 6px 0; color: #171717; font-size: 13px;">${safeLeadEmail}</td></tr>`
          : "",
        input.leadPhone
          ? `<tr><td style="padding: 6px 0; color: #737373; font-size: 13px;">Telefone</td><td style="padding: 6px 0; color: #171717; font-size: 13px;">${safeLeadPhone}</td></tr>`
          : "",
      ]
        .filter(Boolean)
        .join("")

      const meetingLinkRow = input.meetingLink
        ? `<p style="margin: 0; color: #7c2d12; font-size: 14px;"><strong>Link:</strong> <a href="${escapeHtmlAttribute(input.meetingLink)}" style="color: #ff6900; text-decoration: none;">${escapeHtml(input.meetingLink)}</a></p>`
        : ""

      const body = `
        <p style="margin: 0 0 20px 0; color: #525252; font-size: 15px; line-height: 1.6;">
          Um novo lead foi agendado e atribuído a você.
        </p>

        <div style="background-color: #f5f5f5; border: 1px solid #e5e5e5; padding: 16px; border-radius: 12px; margin: 0 0 20px 0;">
          <p style="margin: 0 0 10px 0; color: #171717; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Lead</p>
          <p style="margin: 0 0 8px 0; color: #171717; font-size: 16px; font-weight: 600;">${safeLeadName}</p>
          ${
            leadContactRows
              ? `<table style="width: 100%; border-collapse: collapse; margin-top: 4px;">${leadContactRows}</table>`
              : ""
          }
        </div>

        <div style="background-color: #fff7ed; border: 1px solid #fed7aa; padding: 16px; border-radius: 12px; margin: 0 0 20px 0;">
          <p style="margin: 0 0 10px 0; color: #7c2d12; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Agendamento</p>
          <p style="margin: 0 0 6px 0; color: #7c2d12; font-size: 14px;"><strong>Data:</strong> ${formattedDate}</p>
          <p style="margin: 0 0 6px 0; color: #7c2d12; font-size: 14px;"><strong>Horário:</strong> ${formattedTime}</p>
          <p style="margin: 0 0 6px 0; color: #7c2d12; font-size: 14px;"><strong>Título:</strong> ${escapeHtml(input.meetingTitle)}</p>
          ${meetingLinkRow}
        </div>

        <p style="margin: 0; color: #737373; font-size: 13px; line-height: 1.6;">
          Acesse o backoffice para ver os detalhes completos do lead.
        </p>
      `

      const result = await sendBackofficeScheduleEmail({
        to: [closerRecipient],
        subject: `Novo lead agendado: ${input.leadName}`,
        html: buildEmailShell(
          `Novo lead: ${input.leadName}`,
          "Notificação de agendamento",
          body
        ),
      })

      if (!result.success) {
        return new Output(
          false,
          [],
          [result.error ?? "Erro ao enviar notificação ao closer"],
          null
        )
      }

      return new Output(true, ["Notificação enviada ao closer"], [], { closerRecipient })
    } catch (error) {
      console.error("[BackofficeLeadScheduleInviteService][sendCloserNewLeadNotification]", error)
      return new Output(false, [], ["Erro ao enviar notificação de novo lead ao closer"], null)
    }
  }
}

export const backofficeLeadScheduleInviteService =
  new BackofficeLeadScheduleInviteService()
