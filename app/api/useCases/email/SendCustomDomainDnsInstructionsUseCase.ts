import { Output } from "@/lib/output"
import { assertResend } from "@/lib/email"
import { isValidResendRecipientEmail } from "@/lib/email/is-valid-resend-recipient-email"
import { emailTeamSettingsRepository } from "@/app/api/infra/data/repositories/emailTeamSettings/EmailTeamSettingsRepository"
import type { IEmailTeamSettingsRepository } from "@/app/api/infra/data/repositories/emailTeamSettings/IEmailTeamSettingsRepository"
import { CustomDomainDnsInstructionsMailService } from "@/app/api/services/email/CustomDomainDnsInstructionsMailService"
import type { ICustomDomainDnsInstructionsMailService } from "@/app/api/services/email/ICustomDomainDnsInstructionsMailService"
import { getEmailService } from "@/lib/services/EmailService"
import { resolveDomainDnsProviderSafely } from "@/lib/email/cached-domain-dns-provider"
import type { DnsProviderMatch } from "@/lib/email/dns-provider-map"
import type { TeamAccess as TeamContext } from "@/app/api/v1/utils/teamAccess"

export type SendCustomDomainDnsInstructionsDependencies = {
  settingsRepo?: IEmailTeamSettingsRepository
  resendFactory?: () => ReturnType<typeof assertResend>
  mailService?: ICustomDomainDnsInstructionsMailService
  /** Costura de teste: o default resolve os nameservers por DoH, com cache de horas. */
  dnsProviderLookup?: (domainName: string) => Promise<DnsProviderMatch | null>
}

export type SendCustomDomainDnsInstructionsInput = {
  recipientEmail: string
}

/**
 * Composição do envio real aqui (camada de UseCase): o Service recebe a porta
 * de disparo em vez de importar `lib/services/EmailService` diretamente.
 */
function buildDefaultDnsInstructionsMailService(): ICustomDomainDnsInstructionsMailService {
  return new CustomDomainDnsInstructionsMailService(async (options) => {
    const result = await getEmailService().sendEmail(options)
    return { success: result.success, error: result.error ?? undefined }
  })
}

/**
 * Envia por e-mail as instruções de cadastro DNS do domínio personalizado do
 * time. O servidor reconstrói as instruções a partir do domínio salvo e dos
 * registros reais no provedor — o cliente informa apenas o destinatário,
 * nunca o conteúdo.
 */
export class SendCustomDomainDnsInstructionsUseCase {
  private readonly settingsRepo: IEmailTeamSettingsRepository
  private readonly resendFactory: () => ReturnType<typeof assertResend>
  private readonly mailService: ICustomDomainDnsInstructionsMailService
  private readonly dnsProviderLookup: (domainName: string) => Promise<DnsProviderMatch | null>

  constructor(dependencies: SendCustomDomainDnsInstructionsDependencies = {}) {
    this.settingsRepo = dependencies.settingsRepo ?? emailTeamSettingsRepository
    this.resendFactory = dependencies.resendFactory ?? assertResend
    this.mailService = dependencies.mailService ?? buildDefaultDnsInstructionsMailService()
    this.dnsProviderLookup = dependencies.dnsProviderLookup ?? resolveDomainDnsProviderSafely
  }

  async execute(
    ctx: TeamContext,
    input: SendCustomDomainDnsInstructionsInput
  ): Promise<Output> {
    try {
      const validation = isValidResendRecipientEmail(input.recipientEmail)
      if (!validation.ok) {
        return new Output(
          false,
          [],
          ["Informe um e-mail válido para receber as instruções"],
          null
        )
      }

      const settings = await this.settingsRepo.findSettings(ctx.teamId)
      if (!settings?.resendDomainId || !settings.resendDomainName) {
        return new Output(false, [], ["Nenhum domínio conectado para enviar instruções"], null)
      }

      const resend = this.resendFactory()
      const { data, error } = await resend.domains.get(settings.resendDomainId)
      if (error || !data) {
        console.error(
          "[SendCustomDomainDnsInstructionsUseCase] erro ao buscar registros do domínio",
          error
        )
        return new Output(
          false,
          [],
          ["Não foi possível carregar os registros DNS do domínio"],
          null
        )
      }

      const dispatch = await this.mailService.sendDnsInstructionsEmail({
        teamId: ctx.teamId,
        recipientEmail: validation.email,
        domainName: settings.resendDomainName,
        records: data.records ?? [],
        providerName: (await this.dnsProviderLookup(settings.resendDomainName))?.name ?? null,
      })
      if (!dispatch.success) {
        console.error(
          "[SendCustomDomainDnsInstructionsUseCase] erro no envio",
          dispatch.error
        )
        return new Output(
          false,
          [],
          ["Não foi possível enviar as instruções por e-mail"],
          null
        )
      }

      return new Output(true, [`Instruções enviadas para ${validation.email}`], [], {
        recipientEmail: validation.email,
      })
    } catch (error) {
      console.error("[SendCustomDomainDnsInstructionsUseCase]", error)
      return new Output(false, [], ["Erro ao enviar instruções de DNS"], null)
    }
  }
}
