import { Output } from "@/lib/output"
import { assertResend } from "@/lib/email"
import {
  isResendDomainSnapshotInSync,
  resolveResendTrackingPolicyDrift,
} from "@/lib/email/resend-domain-reconcile"
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

export type ResendDomainTrackingUpdater = (params: {
  domainId: string
  openTracking: boolean
  clickTracking: boolean
}) => Promise<{ error: string | null }>

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

async function defaultUpdateResendDomainTracking(params: {
  domainId: string
  openTracking: boolean
  clickTracking: boolean
}): Promise<{ error: string | null }> {
  const resend = assertResend()
  const { error } = await resend.domains.update({
    id: params.domainId,
    openTracking: params.openTracking,
    clickTracking: params.clickTracking,
  })
  return { error: error?.message ?? null }
}

export type ReconcileResendDomainStatusDependencies = {
  domainEvents?: IEmailTeamDomainEventRepository
  fetchDomain?: ResendDomainFetcher
  updateTracking?: ResendDomainTrackingUpdater
}

/** Placar de uma execução. Local, nunca campo de instância — ver `execute`. */
type TrackingTally = { fixed: number; errors: number }

export class ReconcileResendDomainStatusUseCase {
  private readonly domainEvents: IEmailTeamDomainEventRepository
  private readonly fetchDomain: ResendDomainFetcher
  private readonly updateTracking: ResendDomainTrackingUpdater

  constructor(dependencies: ReconcileResendDomainStatusDependencies = {}) {
    this.domainEvents = dependencies.domainEvents ?? emailTeamDomainEventRepository
    this.fetchDomain = dependencies.fetchDomain ?? defaultFetchResendDomain
    this.updateTracking = dependencies.updateTracking ?? defaultUpdateResendDomainTracking
  }

  async execute(): Promise<Output> {
    const teams = await this.domainEvents.listConnectedDomains()

    let scanned = 0
    let synced = 0
    let inSync = 0
    let errors = 0
    // Placar por execução, não campo de instância: o singleton é compartilhado
    // e `withCronAudit` não trava sobreposição — duas execuções concorrentes
    // corromperiam o resumo uma da outra.
    const tracking: TrackingTally = { fixed: 0, errors: 0 }

    for (const team of teams) {
      scanned += 1
      const outcome = await this.reconcileTeam(team, tracking)
      if (outcome === "synced") synced += 1
      else if (outcome === "in_sync") inSync += 1
      else errors += 1
    }

    console.info("[ReconcileResendDomainStatusUseCase] Execução concluída", {
      scanned,
      synced,
      inSync,
      errors,
      trackingFixed: tracking.fixed,
      trackingErrors: tracking.errors,
    })

    const summary = {
      scanned,
      synced,
      inSync,
      errors,
      trackingFixed: tracking.fixed,
      trackingErrors: tracking.errors,
    }

    // Falha ao aplicar a política é falha do cron. Sem isso o `withCronAudit`
    // marcava sucesso e não disparava o alerta enquanto o domínio seguia com
    // abertura desligada — o monitoramento diria "tudo certo" sobre exatamente
    // a cegueira que este estágio existe para acabar.
    if (tracking.errors > 0 && errors === 0) {
      return new Output(
        false,
        synced > 0 ? [`${synced} domínio(s) reconciliado(s) de ${scanned} verificado(s)`] : [],
        [
          `${tracking.errors} domínio(s) sem a política de tracking aplicada (abertura pode seguir desligada)`,
        ],
        summary
      )
    }

    if (errors > 0) {
      return new Output(
        false,
        synced > 0
          ? [`${synced} domínio(s) reconciliado(s) de ${scanned} verificado(s)`]
          : [],
        [
          `${errors} erro(s) ao reconciliar domínio(s) Resend (${synced} reconciliado(s), ${inSync} já alinhado(s))`,
        ],
        summary
      )
    }

    return new Output(
      true,
      [`${synced} domínio(s) reconciliado(s) de ${scanned} verificado(s)`],
      [],
      summary
    )
  }

  private async reconcileTeam(
    team: ConnectedResendDomainRow,
    tracking: TrackingTally
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

      // A política de tracking é aplicada ANTES da comparação: o que o time
      // deve ter persistido é o estado corrigido, não o que o provedor
      // devolveu antes da correção.
      const effective = await this.enforceTrackingPolicy(team, data, tracking)

      if (isResendDomainSnapshotInSync(team, effective)) {
        return "in_sync"
      }

      const remoteStatus = effective.status ?? null
      await this.domainEvents.syncFromResendDomain(team.teamId, effective, new Date())
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

  /**
   * Devolve o snapshot que passa a valer. Se o provedor recusar a correção, o
   * snapshot original volta intacto: gravar `openTracking: true` sem o Resend
   * ter aceitado trocaria uma cegueira por uma mentira.
   */
  private async enforceTrackingPolicy(
    team: ConnectedResendDomainRow,
    remote: ResendDomainSnapshot,
    tracking: TrackingTally
  ): Promise<ResendDomainSnapshot> {
    const drift = resolveResendTrackingPolicyDrift(remote)
    if (!drift.needsUpdate) return remote

    const { error } = await this.updateTracking({
      domainId: team.resendDomainId,
      openTracking: drift.openTracking,
      clickTracking: drift.clickTracking,
    })

    if (error) {
      tracking.errors += 1
      console.error("[ReconcileResendDomainStatusUseCase] Falha ao aplicar política de tracking", {
        teamId: team.teamId,
        resendDomainId: team.resendDomainId,
        domainName: team.resendDomainName,
        error,
      })
      return remote
    }

    tracking.fixed += 1
    console.info("[ReconcileResendDomainStatusUseCase] Política de tracking aplicada", {
      teamId: team.teamId,
      resendDomainId: team.resendDomainId,
      domainName: team.resendDomainName,
      openTracking: drift.openTracking,
      clickTracking: drift.clickTracking,
    })

    return {
      ...remote,
      openTracking: drift.openTracking,
      clickTracking: drift.clickTracking,
      open_tracking: drift.openTracking,
      click_tracking: drift.clickTracking,
    }
  }
}

export const reconcileResendDomainStatusUseCase = new ReconcileResendDomainStatusUseCase()
