import type { TeamFormDomainStatus } from "@prisma/client"
import type { IVercelDomainsGateway } from "@/app/api/services/vercelDomains/IVercelDomainsGateway"

export type FormDomainVerificationOutcome = {
  status: TeamFormDomainStatus
  reason: string
}

/**
 * Regra única de verificação do domínio de formulários, compartilhada entre o
 * verify manual ("Verificar agora") e o cron de reconciliação:
 *
 * - `verified`: propriedade confirmada E DNS apontando (config sem
 *   misconfigured).
 * - `failed`: o domínio sumiu do projeto na infraestrutura (404) — remoção
 *   externa.
 * - `pending`: qualquer outro estado, inclusive falha transitória de API —
 *   nunca rebaixa para `failed` por instabilidade de consulta.
 */
export async function checkFormDomainVerification(
  gateway: IVercelDomainsGateway,
  hostname: string,
): Promise<FormDomainVerificationOutcome> {
  const projectDomain = await gateway.getProjectDomain(hostname)

  if (!projectDomain.ok) {
    if (projectDomain.status === 404) {
      return {
        status: "failed",
        reason: "O domínio não está mais registrado na infraestrutura de hospedagem",
      }
    }
    return { status: "pending", reason: "Falha temporária ao consultar o status do domínio" }
  }

  if (!projectDomain.data.verified) {
    return { status: "pending", reason: "Aguardando confirmação de propriedade do domínio" }
  }

  const config = await gateway.getDomainConfig(hostname)
  if (!config.ok) {
    return { status: "pending", reason: "Falha temporária ao consultar a configuração DNS" }
  }

  if (config.data.misconfigured) {
    return { status: "pending", reason: "O registro DNS ainda não aponta para os formulários" }
  }

  return { status: "verified", reason: "Domínio verificado" }
}
