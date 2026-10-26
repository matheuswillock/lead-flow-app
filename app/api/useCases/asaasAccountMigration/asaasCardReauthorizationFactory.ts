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
      subject: "Seu acesso ao Corretor Studio está pausado",
      html: `<p>Olá, ${escapeHtml(input.name)}.</p><p>Sua assinatura está com um pagamento pendente e o acesso ao Corretor Studio foi pausado.</p><p>Entre na sua conta para conferir a situação e regularizar o pagamento.</p><p><a href="${escapeHtml(input.url)}">Ver minha conta</a></p><p>Se precisar de ajuda, fale com o time de assinaturas pelo WhatsApp.</p><p>Equipe Corretor Studio</p>`,
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
