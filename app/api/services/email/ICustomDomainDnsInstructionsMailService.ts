import type { CustomDomainDnsRecord } from "@/lib/email/custom-domain-dns-instructions"

export type SendDnsInstructionsEmailInput = {
  teamId: string
  recipientEmail: string
  domainName: string
  records: CustomDomainDnsRecord[]
}

export type SendDnsInstructionsEmailResult = {
  success: boolean
  error?: string
}

export interface ICustomDomainDnsInstructionsMailService {
  sendDnsInstructionsEmail(
    input: SendDnsInstructionsEmailInput
  ): Promise<SendDnsInstructionsEmailResult>
}
