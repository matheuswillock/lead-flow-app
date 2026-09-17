import { Output } from "@/lib/output"
import type { ITeamFormDomainRepository } from "@/app/api/infra/data/repositories/teamFormDomain/ITeamFormDomainRepository"
import { teamFormDomainRepository } from "@/app/api/infra/data/repositories/teamFormDomain/TeamFormDomainRepository"
import type { IVercelDomainsGateway } from "@/app/api/services/vercelDomains/IVercelDomainsGateway"
import { vercelDomainsGateway } from "@/app/api/services/vercelDomains/VercelDomainsGateway"
import { checkFormDomainVerification } from "@/lib/public-forms/form-domain-verification"
import { invalidateTeamFormDomainCache } from "@/lib/cache/invalidation"

/** Lote por execução — tabela pequena (1 domínio por time) e cron frequente. */
const RECONCILE_BATCH_SIZE = 50

export type ReconcileTeamFormDomainDependencies = {
  repository?: ITeamFormDomainRepository
  vercelGateway?: IVercelDomainsGateway
  invalidateCache?: (input: { hostname: string }) => void
  now?: () => Date
}

/**
 * Cron de reconciliação do domínio de formulários: varre os domínios
 * `pending`/`failed` e atualiza o status a partir da infraestrutura —
 * espelho do reconcile do domínio de envio (Resend), mas para o gateway de
 * domínios da Vercel.
 */
export class ReconcileTeamFormDomainStatusUseCase {
  private readonly repository: ITeamFormDomainRepository
  private readonly vercelGateway: IVercelDomainsGateway
  private readonly invalidateCache: (input: { hostname: string }) => void
  private readonly now: () => Date

  constructor(dependencies: ReconcileTeamFormDomainDependencies = {}) {
    this.repository = dependencies.repository ?? teamFormDomainRepository
    this.vercelGateway = dependencies.vercelGateway ?? vercelDomainsGateway
    this.invalidateCache = dependencies.invalidateCache ?? invalidateTeamFormDomainCache
    this.now = dependencies.now ?? (() => new Date())
  }

  async execute(): Promise<Output> {
    try {
      if (!this.vercelGateway.isConfigured()) {
        return new Output(
          true,
          ["Integração de domínio de formulários não configurada — nada a reconciliar"],
          [],
          { scanned: 0, verified: 0, stillPending: 0, failed: 0, errors: 0 },
        )
      }

      const domains = await this.repository.listPendingOrFailed(RECONCILE_BATCH_SIZE)

      let verified = 0
      let stillPending = 0
      let failed = 0
      let errors = 0

      for (const domain of domains) {
        try {
          const outcome = await checkFormDomainVerification(this.vercelGateway, domain.hostname)
          const checkedAt = this.now()

          await this.repository.saveCheckResult(domain.id, {
            status: outcome.status,
            lastCheckedAt: checkedAt,
            verifiedAt: outcome.status === "verified" ? (domain.verifiedAt ?? checkedAt) : null,
          })

          if (outcome.status !== domain.status) {
            this.invalidateCache({ hostname: domain.hostname })
          }

          if (outcome.status === "verified") verified += 1
          else if (outcome.status === "failed") failed += 1
          else stillPending += 1
        } catch (error) {
          errors += 1
          console.error(
            `[ReconcileTeamFormDomainStatusUseCase] Erro ao reconciliar ${domain.hostname}:`,
            error,
          )
        }
      }

      const summary = {
        scanned: domains.length,
        verified,
        stillPending,
        failed,
        errors,
      }

      console.info("[ReconcileTeamFormDomainStatusUseCase] Reconciliação concluída", summary)

      return new Output(
        errors === 0,
        [
          `Reconciliação de domínios de formulários: ${domains.length} verificados, ${verified} ativados`,
        ],
        errors > 0 ? [`${errors} domínio(s) com erro de reconciliação`] : [],
        summary,
      )
    } catch (error) {
      console.error("[ReconcileTeamFormDomainStatusUseCase][execute]", error)
      return new Output(false, [], ["Erro na reconciliação de domínios de formulários"], null)
    }
  }
}

export const reconcileTeamFormDomainStatusUseCase = new ReconcileTeamFormDomainStatusUseCase()
