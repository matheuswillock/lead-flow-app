import { randomUUID } from "node:crypto"
import { BackofficeLeadOrigin, BackofficeLeadStatus } from "@prisma/client"
import { Output } from "@/lib/output"
import { BackofficeLeadRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeLead/BackofficeLeadRepository"
import type { IBackofficeLeadRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeLead/IBackofficeLeadRepository"
import { getEmailService } from "@/lib/services/EmailService"
import type { CreateDemoLeadInput, IBackofficeDemoLeadUseCase } from "./IBackofficeDemoLeadUseCase"

const demoRequestRecipients = [
  "matheuswillock@gmail.com",
  "nathielewillock@gmail.com",
  "bruno@onsidemarketing.com.br",
]

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

export class BackofficeDemoLeadUseCase implements IBackofficeDemoLeadUseCase {
  constructor(private readonly leadRepository: IBackofficeLeadRepository) {}

  async create(input: CreateDemoLeadInput): Promise<Output> {
    try {
      const sourceExternalId = `demo:${input.email.trim().toLowerCase()}`
      const existing = await this.leadRepository.findBySourceExternalId(sourceExternalId)
      if (existing) {
        const notification = await this.sendDemoRequestEmail(input, existing.id, true)
        if (!notification.success) {
          return new Output(false, [], [notification.error || "Erro ao enviar notificação de demonstração"], { id: existing.id })
        }

        return new Output(true, ["Lead já existente para esta demonstração"], [], { id: existing.id })
      }

      const lead = await this.leadRepository.create({
        id: randomUUID(),
        name: input.name,
        email: input.email,
        phone: input.phone,
        status: BackofficeLeadStatus.new_opportunity,
        origin: BackofficeLeadOrigin.landing_page,
        sourceExternalId,
        createdByProfileId: null,
      })

      console.info("[BackofficeDemoLeadUseCase][create] Lead criado com sucesso", { id: lead.id })

      const notification = await this.sendDemoRequestEmail(input, lead.id, false)
      if (!notification.success) {
        return new Output(false, [], [notification.error || "Erro ao enviar notificação de demonstração"], { id: lead.id })
      }

      return new Output(true, ["Lead criado com sucesso"], [], { id: lead.id })
    } catch (error) {
      console.error("[BackofficeDemoLeadUseCase][create] Erro ao criar lead", error)
      return new Output(false, [], ["Erro ao registrar lead"], null)
    }
  }

  private async sendDemoRequestEmail(input: CreateDemoLeadInput, leadId: string, isDuplicate: boolean) {
    const safeName = escapeHtml(input.name)
    const safeEmail = escapeHtml(input.email)
    const safePhone = escapeHtml(input.phone)
    const safeLeadId = escapeHtml(leadId)
    const submittedAt = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo",
    }).format(new Date())
    const duplicateLabel = isDuplicate ? "Lead já existente" : "Novo lead criado"

    const subject = `Novo pedido de demonstração: ${input.name}`
    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        </head>
        <body style="margin:0;padding:0;background:#f5f5f5;font-family:Segoe UI,Arial,sans-serif;">
          <table role="presentation" style="width:100%;border-collapse:collapse;">
            <tr>
              <td align="center" style="padding:24px;">
                <table role="presentation" style="max-width:640px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
                  <tr>
                    <td style="background:#141118;padding:22px 24px;">
                      <h1 style="margin:0;color:#ffffff;font-size:22px;line-height:1.3;">Novo pedido de demonstração</h1>
                      <p style="margin:8px 0 0;color:#d1d5db;font-size:13px;">Landing page · ${submittedAt}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:24px;">
                      <table role="presentation" style="width:100%;border-collapse:collapse;">
                        <tr>
                          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;">Nome</td>
                          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;font-weight:600;text-align:right;">${safeName}</td>
                        </tr>
                        <tr>
                          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;">E-mail</td>
                          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;font-weight:600;text-align:right;">${safeEmail}</td>
                        </tr>
                        <tr>
                          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;">WhatsApp</td>
                          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;font-weight:600;text-align:right;">${safePhone}</td>
                        </tr>
                        <tr>
                          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;">Status</td>
                          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;font-weight:600;text-align:right;">${duplicateLabel}</td>
                        </tr>
                        <tr>
                          <td style="padding:10px 0;color:#6b7280;font-size:13px;">Lead no backoffice</td>
                          <td style="padding:10px 0;color:#111827;font-size:14px;font-weight:600;text-align:right;">${safeLeadId}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `

    const text = [
      "Novo pedido de demonstração",
      `Data: ${submittedAt}`,
      `Nome: ${input.name}`,
      `E-mail: ${input.email}`,
      `WhatsApp: ${input.phone}`,
      `Status: ${duplicateLabel}`,
      `Lead no backoffice: ${leadId}`,
    ].join("\n")

    return getEmailService().sendEmailUntracked({
      to: demoRequestRecipients,
      subject,
      html,
      text,
    })
  }
}

export const backofficeDemoLeadUseCase = new BackofficeDemoLeadUseCase(
  new BackofficeLeadRepository()
)
