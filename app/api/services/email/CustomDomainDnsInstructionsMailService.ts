import { buildDnsInstructionsEmailContent } from "@/lib/email/custom-domain-dns-instructions"
import type {
  ICustomDomainDnsInstructionsMailService,
  SendDnsInstructionsEmailInput,
  SendDnsInstructionsEmailResult,
} from "./ICustomDomainDnsInstructionsMailService"

/**
 * Porta de saída para o disparo transacional. O envio concreto
 * (`getEmailService().sendEmail`) é injetado pela camada de UseCase — Service
 * não importa outro Service (regra `serviceImportOutsideUseCaseAllowlist`).
 */
export type TrackedDnsInstructionsEmailDispatch = (options: {
  to: string[]
  subject: string
  html: string
  text: string
  tracking: {
    teamId: string
    category: "transactional"
    sourceType: string
  }
}) => Promise<{ success: boolean; error?: string }>

/**
 * Envia as instruções de cadastro DNS do domínio do time para o e-mail do
 * responsável técnico pela hospedagem. Usa o remetente padrão da plataforma
 * (o domínio do time ainda não está verificado — é exatamente por isso que as
 * instruções existem).
 */
export class CustomDomainDnsInstructionsMailService
  implements ICustomDomainDnsInstructionsMailService
{
  constructor(private readonly dispatchTrackedEmail: TrackedDnsInstructionsEmailDispatch) {}

  async sendDnsInstructionsEmail(
    input: SendDnsInstructionsEmailInput
  ): Promise<SendDnsInstructionsEmailResult> {
    const content = buildDnsInstructionsEmailContent({
      domainName: input.domainName,
      records: input.records,
      providerName: input.providerName,
    })

    const result = await this.dispatchTrackedEmail({
      to: [input.recipientEmail],
      subject: content.subject,
      html: content.html,
      text: content.text,
      tracking: {
        teamId: input.teamId,
        category: "transactional",
        sourceType: "custom-domain-dns-instructions",
      },
    })

    return result.success
      ? { success: true }
      : { success: false, error: result.error ?? "Erro desconhecido no envio" }
  }
}
