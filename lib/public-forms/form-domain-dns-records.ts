import type { VercelDomainVerificationChallenge } from "@/app/api/services/vercelDomains/IVercelDomainsGateway"
import type { CustomDomainDnsRecord } from "@/lib/email/custom-domain-dns-instructions"

/** Alvo padrão do CNAME de formulários na Vercel. */
export const FORM_DOMAIN_CNAME_TARGET = "cname.vercel-dns.com"

export type BuildFormDomainDnsRecordsInput = {
  hostname: string
  /** Apex retornado pela infraestrutura (ex.: imobiliariax.com.br). */
  apexName?: string | null
  /** Desafios extras de verificação (ex.: TXT `_vercel`). */
  verificationChallenges?: VercelDomainVerificationChallenge[] | null
  verified?: boolean
}

/**
 * Nome relativo do registro na zona DNS: forms.imobiliariax.com.br com apex
 * imobiliariax.com.br vira "forms". Sem apex conhecido, usa o primeiro label.
 */
export function resolveDnsRecordName(hostname: string, apexName?: string | null): string {
  if (apexName && hostname !== apexName && hostname.endsWith(`.${apexName}`)) {
    return hostname.slice(0, -(apexName.length + 1))
  }
  return hostname.split(".")[0] ?? hostname
}

/**
 * Registros DNS que o time precisa criar para ativar o domínio de
 * formulários. Shape compatível com `CustomDomainDnsRecord` para reaproveitar
 * as instruções DNS dinâmicas (copiar/prompt/enviar por e-mail) do domínio de
 * envio.
 */
export function buildFormDomainDnsRecords(
  input: BuildFormDomainDnsRecordsInput,
): CustomDomainDnsRecord[] {
  const status = input.verified ? "verified" : "pending"

  const records: CustomDomainDnsRecord[] = [
    {
      record: "CNAME",
      type: "CNAME",
      name: resolveDnsRecordName(input.hostname, input.apexName),
      value: FORM_DOMAIN_CNAME_TARGET,
      ttl: "Auto",
      status,
    },
  ]

  for (const challenge of input.verificationChallenges ?? []) {
    records.push({
      record: challenge.type,
      type: challenge.type,
      name: challenge.domain,
      value: challenge.value,
      ttl: "Auto",
      status: "pending",
    })
  }

  return records
}
