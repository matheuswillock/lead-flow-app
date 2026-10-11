import { asaasAccountMigrationRepository } from "@/app/api/infra/data/repositories/asaasAccountMigration/AsaasAccountMigrationRepository"
import { asaasCardReauthorizationRepository } from "@/app/api/infra/data/repositories/asaasCardReauthorization/AsaasCardReauthorizationRepository"
import { createEmailService } from "@/lib/services/EmailService"
import { escapeHtml } from "@/lib/email/escape-html"
import { RequestCardReauthorizationUseCase } from "./RequestCardReauthorizationUseCase"

const notifier = {
  async send(input: { to: string; name: string; url: string; expiresAt: Date }) {
    const result = await createEmailService().sendEmailUntracked({
      from: process.env.EMAIL_FROM ?? "Corretor Studio <contato@mail.corretorstudio.com>",
      to: [input.to],
      subject: "Atualize seu cartão para continuar no Corretor Studio",
      html: `<p>Olá, ${escapeHtml(input.name)}.</p><p>Para continuar usando o Corretor Studio, atualize o cartão da sua assinatura na conta nova.</p><p><a href="${escapeHtml(input.url)}">Atualizar cartão</a></p><p>Este link expira em ${escapeHtml(input.expiresAt.toLocaleDateString("pt-BR"))}.</p>`,
    })
    if (!result.success) throw new Error(result.error ?? "Falha ao enviar e-mail de reautorização")
  },
}

export const requestCardReauthorizationUseCase = new RequestCardReauthorizationUseCase({
  ledgerRepository: asaasAccountMigrationRepository,
  tokenRepository: asaasCardReauthorizationRepository,
  notifier,
  publicAppUrl: process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "",
})
