import type { TeamFormDomainStatus } from "@prisma/client"
import type { IVercelDomainsGateway } from "@/app/api/services/vercelDomains/IVercelDomainsGateway"

/**
 * `inconclusive` é distinto de `pending`: representa uma falha de TRANSPORTE
 * (429/500/timeout consultando a Vercel), não um veredito sobre o domínio.
 * Quem chama NUNCA deve persistir `inconclusive` como status do domínio nem
 * apagar `verifiedAt` por causa dele — ver nota abaixo (achado P1 do codex no
 * PR #1204).
 */
export type FormDomainVerificationStatus = TeamFormDomainStatus | "inconclusive"

export type FormDomainVerificationOutcome = {
  status: FormDomainVerificationStatus
  reason: string
}

/**
 * Regra única de verificação do domínio de formulários, compartilhada entre o
 * verify manual ("Verificar agora") e o cron de reconciliação:
 *
 * - `verified`: propriedade confirmada E DNS apontando (config sem
 *   misconfigured).
 * - `failed`: o domínio sumiu do projeto na infraestrutura (404) — remoção
 *   externa confirmada pela própria Vercel.
 * - `pending`: veredito NEGATIVO real e autoritativo — Vercel respondeu e
 *   disse "ainda não": propriedade não confirmada, ou DNS misconfigurado.
 * - `inconclusive`: a consulta em si falhou (erro de transporte/instabilidade
 *   da API) — não sabemos o estado real do domínio. Antes, isso virava
 *   `pending` e tanto o verify manual quanto o cron persistiam esse estado e
 *   zeravam `verifiedAt`, rebaixando um domínio `verified` por uma
 *   indisponibilidade passageira da Vercel — o que tirava do ar TODOS os
 *   formulários públicos daquele domínio. Quem chama esta função MUST
 *   preservar o status anterior quando o outcome for `inconclusive`.
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
    return {
      status: "inconclusive",
      reason: "Falha temporária ao consultar o status do domínio",
    }
  }

  if (!projectDomain.data.verified) {
    return { status: "pending", reason: "Aguardando confirmação de propriedade do domínio" }
  }

  const config = await gateway.getDomainConfig(hostname)
  if (!config.ok) {
    return {
      status: "inconclusive",
      reason: "Falha temporária ao consultar a configuração DNS",
    }
  }

  if (config.data.misconfigured) {
    return { status: "pending", reason: "O registro DNS ainda não aponta para os formulários" }
  }

  return { status: "verified", reason: "Domínio verificado" }
}
