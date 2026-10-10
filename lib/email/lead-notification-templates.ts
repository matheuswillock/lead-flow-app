/**
 * Templates HTML de notificação de lead (nova oportunidade, proposta pendente,
 * transferência) — fora da agenda, mesma classe de vulnerabilidade da V4.
 *
 * SPEC 13 (Agenda na Criação de Lead), estágio A-E1b: o revisor do PR 1 (A-E1)
 * encontrou `sendLeadNotification`, `sendLeadProposalPendingUrgentEmail` e
 * `sendLeadTransferActivatedEmail` em `lib/services/EmailService.ts` ainda
 * interpolando dados de fora sem escape, e o owner decidiu que "todas as
 * vulnerabilidades encontradas entram na SPEC". Extraído como funções puras
 * pelo mesmo motivo de `meeting-schedule-templates.ts`: testável sem Resend
 * nem rede.
 */

import { getFullUrl } from "@/lib/utils/app-url"
import { escapeHtml, sanitizeEmailHref } from "./escape-html"

function buildDashboardLinkButton(): string {
  const safeHref = sanitizeEmailHref(getFullUrl("/dashboard"))
  if (!safeHref) return ""

  return `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${safeHref}"
             style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Ver Lead no Dashboard
          </a>
        </div>
        `
}

export interface LeadNotificationEmailTemplateInput {
  leadName: string
  leadEmail: string
  leadPhone?: string | null
  managerName: string
}

export interface LeadNotificationEmailTemplate {
  /** Assunto cru (não-HTML) do e-mail. */
  subject: string
  html: string
}

export function buildLeadNotificationEmailTemplate(
  input: LeadNotificationEmailTemplateInput
): LeadNotificationEmailTemplate {
  const safeLeadName = escapeHtml(input.leadName)
  const safeLeadEmail = escapeHtml(input.leadEmail)
  const safeManagerName = escapeHtml(input.managerName)
  const trimmedLeadPhone = input.leadPhone?.trim()
  const leadPhoneMarkup = trimmedLeadPhone
    ? `<p><strong>Telefone:</strong> ${escapeHtml(trimmedLeadPhone)}</p>`
    : ""

  const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Novo Lead Recebido!</h1>

        <p>Olá <strong>${safeManagerName}</strong>,</p>

        <p>Um novo lead foi registrado em sua plataforma:</p>

        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">Dados do Lead:</h3>
          <p><strong>Nome:</strong> ${safeLeadName}</p>
          <p><strong>Email:</strong> ${safeLeadEmail}</p>
          ${leadPhoneMarkup}
        </div>
        ${buildDashboardLinkButton()}
        <p>Entre na plataforma para visualizar e gerenciar este novo lead.</p>

        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px;">
          <p>Este é um e-mail automático do Corretor Studio.</p>
        </div>
      </div>
    `

  return { subject: `Novo Lead: ${input.leadName}`, html }
}

export interface LeadProposalPendingUrgentEmailTemplateInput {
  leadCode: string
  leadName: string
  leadEmail?: string | null
  leadPhone?: string | null
  sdrName?: string | null
  closerName?: string | null
  notes?: string | null
  actorName: string
}

export interface LeadProposalPendingUrgentEmailTemplate {
  /** Assunto cru (não-HTML) do e-mail. */
  subject: string
  html: string
}

export function buildLeadProposalPendingUrgentEmailTemplate(
  input: LeadProposalPendingUrgentEmailTemplateInput
): LeadProposalPendingUrgentEmailTemplate {
  const safeLeadName = escapeHtml(input.leadName || "Lead sem nome")
  const safeLeadEmail = escapeHtml(input.leadEmail || "Não informado")
  const safeLeadPhone = escapeHtml(input.leadPhone || "Não informado")
  const safeSdrName = escapeHtml(input.sdrName || "Não informado")
  const safeCloserName = escapeHtml(input.closerName || "Não informado")
  const safeNotes = escapeHtml((input.notes || "Sem observações adicionais").trim())
  const safeActorName = escapeHtml(input.actorName)
  const leadUrl = getFullUrl(`/crm?leadCode=${encodeURIComponent(input.leadCode)}`)
  const safeLeadUrl = sanitizeEmailHref(leadUrl)
  const subject = `Você tem uma proposta pendente no Corretor Studio - ID: ${input.leadCode}`
  const safeTitle = escapeHtml(subject)

  const html = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #1f2937;">
        <div style="background: #ff6900; color: #fff; padding: 16px 20px; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 22px;">${safeTitle}</h1>
          <p style="margin: 8px 0 0; font-size: 14px; opacity: 0.95;">
            ${safeActorName} moveu um lead para o status de proposta pendente.
          </p>
        </div>

        <div style="border: 1px solid #fed7aa; border-top: 0; border-radius: 0 0 10px 10px; padding: 20px; background: #fff;">
          <p style="margin: 0 0 14px;"><strong>Lead:</strong> ${safeLeadName}</p>
          <p style="margin: 0 0 8px;"><strong>E-mail:</strong> ${safeLeadEmail}</p>
          <p style="margin: 0 0 14px;"><strong>Telefone:</strong> ${safeLeadPhone}</p>

          <p style="margin: 0 0 8px;"><strong>SDR:</strong> ${safeSdrName}</p>
          <p style="margin: 0 0 14px;"><strong>Closer:</strong> ${safeCloserName}</p>

          ${
            safeLeadUrl
              ? `<div style="margin: 0 0 14px;">
            <a href="${safeLeadUrl}" style="display: inline-block; background: #ff6900; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 8px; font-weight: 600;">Acessar lead no CRM</a>
          </div>`
              : ""
          }

          <div style="background: #fff7ed; border-left: 4px solid #ff6900; padding: 12px; border-radius: 6px;">
            <p style="margin: 0 0 4px;"><strong>Observações</strong></p>
            <p style="margin: 0; white-space: pre-wrap;">${safeNotes}</p>
          </div>
        </div>
      </div>
    `

  return { subject, html }
}

export interface LeadTransferActivatedEmailTemplateInput {
  leadCode: string
  leadName: string
  leadPhone?: string | null
  leadCnpj?: string | null
  leadCurrentHealthPlan?: string | null
  leadCurrentValue?: number | null
  leadNotes?: string | null
  sdrName?: string | null
  scheduleShareUrl?: string | null
}

export interface LeadTransferActivatedEmailTemplate {
  /** Assunto cru (não-HTML) do e-mail. */
  subject: string
  html: string
}

export function buildLeadTransferActivatedEmailTemplate(
  input: LeadTransferActivatedEmailTemplateInput
): LeadTransferActivatedEmailTemplate {
  const rawLeadName = input.leadName || "Lead sem nome"
  const safeLeadName = escapeHtml(rawLeadName)
  const safeLeadPhone = escapeHtml(input.leadPhone || "Não informado")
  const safeLeadCnpj = escapeHtml(input.leadCnpj || "Não informado")
  const safeLeadCurrentHealthPlan = escapeHtml(input.leadCurrentHealthPlan || "Não informado")
  const leadCurrentValue =
    input.leadCurrentValue != null
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(input.leadCurrentValue)
      : "Não informado"
  const safeSdrName = escapeHtml(input.sdrName || "Não informado")
  const leadUrl = getFullUrl(`/crm?leadCode=${encodeURIComponent(input.leadCode)}`)
  const safeLeadUrl = sanitizeEmailHref(leadUrl)
  const safeLeadNotes = escapeHtml((input.leadNotes || "Sem observações").trim())
  const safeScheduleShareHref = sanitizeEmailHref(input.scheduleShareUrl?.trim())
  const scheduleShareBlock = safeScheduleShareHref
    ? `
          <div style="margin-top: 16px; background: #fff7ed; border: 1px solid #fed7aa; padding: 12px; border-radius: 6px;">
            <p style="margin: 0 0 8px;"><strong>Link do formulário da reunião</strong></p>
            <p style="margin: 0;">
              <a href="${safeScheduleShareHref}" style="color: #ff6900; text-decoration: none;">Abrir agendamento</a>
            </p>
          </div>
        `
    : ""

  const html = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #1f2937;">
        <div style="background: #ff6900; color: #fff; padding: 16px 20px; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 22px;">Lead para transferência adicionado</h1>
          <p style="margin: 8px 0 0; font-size: 14px; opacity: 0.95;">
            Um novo lead foi marcado para transferência no Corretor Studio.
          </p>
        </div>

        <div style="border: 1px solid #fed7aa; border-top: 0; border-radius: 0 0 10px 10px; padding: 20px; background: #fff;">
          <p style="margin: 0 0 8px;"><strong>Lead:</strong> ${safeLeadName}</p>
          <p style="margin: 0 0 8px;"><strong>Telefone:</strong> ${safeLeadPhone}</p>
          <p style="margin: 0 0 8px;"><strong>CNPJ:</strong> ${safeLeadCnpj}</p>
          <p style="margin: 0 0 8px;"><strong>Plano atual:</strong> ${safeLeadCurrentHealthPlan}</p>
          <p style="margin: 0 0 8px;"><strong>Valor atual:</strong> ${leadCurrentValue}</p>
          <p style="margin: 0 0 14px;"><strong>SDR:</strong> ${safeSdrName}</p>

          ${
            safeLeadUrl
              ? `<div style="margin: 0 0 14px;">
            <a href="${safeLeadUrl}" style="display: inline-block; background: #ff6900; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 8px; font-weight: 600;">Acessar lead no CRM</a>
          </div>`
              : ""
          }

          <div style="background: #fff7ed; border-left: 4px solid #ff6900; padding: 12px; border-radius: 6px;">
            <p style="margin: 0 0 4px;"><strong>Observações</strong></p>
            <p style="margin: 0; white-space: pre-wrap;">${safeLeadNotes}</p>
          </div>
          ${scheduleShareBlock}
        </div>
      </div>
    `

  return { subject: `Novo lead para transferência: ${rawLeadName}`, html }
}
