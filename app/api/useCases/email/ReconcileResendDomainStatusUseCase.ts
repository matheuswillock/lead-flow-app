import { Output } from "@/lib/output"
import { assertResend } from "@/lib/email"
import { isResendDomainStatusInSync } from "@/lib/email/resend-domain-reconcile"
import {
  emailTeamDomainEventRepository,
  type ConnectedResendDomainRow,
  type IEmailTeamDomainEventRepository,
  type ResendDomainSnapshot,
} from "@/app/api/infra/data/repositories/emailTeamDomainEvent/EmailTeamDomainEventRepository"

export type ResendDomainFetcherResult = {
  data: ResendDomainSnapshot | null
  error: string | null
}

export type ResendDomainFetcher = (domainId: string) => Promise<ResendDomainFetcherResult>

async function defaultFetchResendDomain(domainId: string): Promise<ResendDomainFetcherResult> {
  const resend = assertResend()
  const { data, error } = await resend.domains.get(domainId)
  if (error || !data) {
    return {
      data: null,
      error: error?.message ?? "Domínio não encontrado no Resend",
    }
  }
  return { data: data as ResendDomainSnapshot, error: null }
}

export class ReconcileResendDomainStatusUseCase {
  constructor(
    private readonly domainEvents: IEmailTeamDomainEventRepository = emailTeamDomainEventRepository,
    private readonly fetchDomain: ResendDomainFetcher = defaultFetchResendDomain
  ) {}

  async execute(): Promise<Output> {
    const teams = await this.domainEvents.listConnectedDomains()

    let scanned = 0
    let synced = 0
    let inSync = 0
    let errors = 0

    for (const team of teams) {
      scanned += 1
      const outcome = await this.reconcileTeam(team)
      if (outcome === "synced") synced += 1
      else if (outcome === "in_sync") inSync += 1
      else errors += 1
    }

    console.info("[ReconcileResendDomainStatusUseCase] Execução concluída", {
      scanned,
      synced,
      inSync,
      errors,
    })

    return new Output(
      true,
      [`${synced} domínio(s) reconciliado(s) de ${scanned} verificado(s)`],
      [],
      { scanned, synced, inSync, errors }
    )
  }

  private async reconcileTeam(
    team: ConnectedResendDomainRow
  ): Promise<"synced" | "in_sync" | "error"> {
    try {
      const { data, error } = await this.fetchDomain(team.resendDomainId)
      if (error || !data) {
        console.error("[ReconcileResendDomainStatusUseCase] Falha ao buscar domínio", {
          teamId: team.teamId,
          resendDomainId: team.resendDomainId,
          domainName: team.resendDomainName,
          error,
        })
        return "error"
      }

      const remoteStatus = data.status ?? null
      if (isResendDomainStatusInSync(team.resendDomainStatus, remoteStatus)) {
        return "in_sync"
      }

      await this.domainEvents.syncFromResendDomain(team.teamId, data, new Date())
      console.info("[ReconcileResendDomainStatusUseCase] Status reconciliado", {
        teamId: team.teamId,
        resendDomainId: team.resendDomainId,
        domainName: team.resendDomainName,
        previousStatus: team.resendDomainStatus,
        remoteStatus,
      })
      return "synced"
    } catch (error) {
      console.error("[ReconcileResendDomainStatusUseCase] Erro ao reconciliar time", {
        teamId: team.teamId,
        resendDomainId: team.resendDomainId,
        domainName: team.resendDomainName,
        error,
      })
      return "error"
    }
  }
}

export const reconcileResendDomainStatusUseCase = new ReconcileResendDomainStatusUseCase()
