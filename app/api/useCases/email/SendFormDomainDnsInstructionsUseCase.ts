import { Output } from "@/lib/output"
import { isValidResendRecipientEmail } from "@/lib/email/is-valid-resend-recipient-email"
import type { ITeamFormDomainRepository } from "@/app/api/infra/data/repositories/teamFormDomain/ITeamFormDomainRepository"
import { teamFormDomainRepository } from "@/app/api/infra/data/repositories/teamFormDomain/TeamFormDomainRepository"
import type { IVercelDomainsGateway } from "@/app/api/services/vercelDomains/IVercelDomainsGateway"
import { vercelDomainsGateway } from "@/app/api/services/vercelDomains/VercelDomainsGateway"
import { CustomDomainDnsInstructionsMailService } from "@/app/api/services/email/CustomDomainDnsInstructionsMailService"
import type { ICustomDomainDnsInstructionsMailService } from "@/app/api/services/email/ICustomDomainDnsInstructionsMailService"
import { getEmailService } from "@/lib/services/EmailService"
import { DnsProviderLookupService } from "@/app/api/services/email/DnsProviderLookupService"
import type { IDnsProviderLookupService } from "@/app/api/services/email/IDnsProviderLookupService"
import { buildFormDomainDnsRecords } from "@/lib/public-forms/form-domain-dns-records"
import type { TeamAccess as TeamContext } from "@/app/api/v1/utils/teamAccess"

export type SendFormDomainDnsInstructionsDependencies = {
  repository?: ITeamFormDomainRepository
  vercelGateway?: IVercelDomainsGateway
  mailService?: ICustomDomainDnsInstructionsMailService
  dnsProviderLookupService?: IDnsProviderLookupService
}

export type SendFormDomainDnsInstructionsInput = {
  recipientEmail: string
}

function buildDefaultDnsInstructionsMailService(): ICustomDomainDnsInstructionsMailService {
  return new CustomDomainDnsInstructionsMailService(async (options) => {
    const result = await getEmailService().sendEmail(options)
    return { success: result.success, error: result.error ?? undefined }
  })
}

/**
 * Envia por e-mail as instruções de cadastro DNS do domínio de FORMULÁRIOS do
 * time — irmão do `SendCustomDomainDnsInstructionsUseCase` (domínio de envio),
 * reutilizando o mesmo serviço de e-mail de instruções. O servidor reconstrói
 * o registro CNAME a partir do domínio salvo; o cliente informa apenas o
 * destinatário.
 */
export class SendFormDomainDnsInstructionsUseCase {
  private readonly repository: ITeamFormDomainRepository
  private readonly vercelGateway: IVercelDomainsGateway
  private readonly mailService: ICustomDomainDnsInstructionsMailService
  private readonly dnsProviderLookupService: IDnsProviderLookupService

  constructor(dependencies: SendFormDomainDnsInstructionsDependencies = {}) {
    this.repository = dependencies.repository ?? teamFormDomainRepository
    this.vercelGateway = dependencies.vercelGateway ?? vercelDomainsGateway
    this.mailService = dependencies.mailService ?? buildDefaultDnsInstructionsMailService()
    this.dnsProviderLookupService =
      dependencies.dnsProviderLookupService ?? new DnsProviderLookupService()
  }

  async execute(ctx: TeamContext, input: SendFormDomainDnsInstructionsInput): Promise<Output> {
    try {
      const validation = isValidResendRecipientEmail(input.recipientEmail)
      if (!validation.ok) {
        return new Output(false, [], ["Informe um e-mail válido para receber as instruções"], null)
      }

      const domain = await this.repository.findByTeamId(ctx.teamId)
      if (!domain) {
        return new Output(false, [], ["Nenhum domínio de formulários conectado"], null)
      }

      const projectDomain = this.vercelGateway.isConfigured()
        ? await this.vercelGateway.getProjectDomain(domain.hostname)
        : null

      const records = buildFormDomainDnsRecords({
        hostname: domain.hostname,
        apexName: projectDomain?.ok ? projectDomain.data.apexName : null,
        verificationChallenges: projectDomain?.ok ? projectDomain.data.verification : null,
        verified: domain.status === "verified",
      })

      const dispatch = await this.mailService.sendDnsInstructionsEmail({
        teamId: ctx.teamId,
        recipientEmail: validation.email,
        domainName: domain.hostname,
        records,
        providerName:
          (await this.dnsProviderLookupService.lookupDnsProvider(domain.hostname))?.name ?? null,
      })

      if (!dispatch.success) {
        console.error("[SendFormDomainDnsInstructionsUseCase] erro no envio", dispatch.error)
        return new Output(false, [], ["Não foi possível enviar as instruções por e-mail"], null)
      }

      return new Output(true, [`Instruções enviadas para ${validation.email}`], [], {
        recipientEmail: validation.email,
      })
    } catch (error) {
      console.error("[SendFormDomainDnsInstructionsUseCase]", error)
      return new Output(false, [], ["Erro ao enviar instruções de DNS"], null)
    }
  }
}
