import type { ResendDomainSnapshot } from "@/app/api/infra/data/repositories/emailTeamDomainEvent/EmailTeamDomainEventRepository"
import { deriveSendingDnsVerified } from "@/lib/email/resend-domain-records"
import { PLATFORM_ROOT_DOMAIN } from "@/lib/email/resolve-campaign-from"

/** Returns true when persisted status matches the remote Resend API status. */
export function isResendDomainStatusInSync(
  persisted: string | null | undefined,
  remote: string | null | undefined
): boolean {
  return (persisted ?? null) === (remote ?? null)
}

/**
 * Política de tracking (revisada em 17/09; reverte parcialmente a decisão de
 * 01/09 registrada na nota 03 da rodada CDP):
 *
 * - Abertura SEMPRE ligada — não é escolha do time. Foi a abertura desligada
 *   em `corretorstudio.com.br` e `mail.libercorretora.com.br` que apagou as
 *   aberturas desses domínios do funil sem aviso (caso C6 da auditoria).
 * - Clique passa a ser POR TIME (`EmailTeamSettings.resendClickTracking`),
 *   com default OFF em domínio recém-conectado. A alegação de 01/09 de que o
 *   rewrite "quebra o cs_el" nunca foi medida; os cliques do provedor agora
 *   passam pelo classificador de origem (scanner vira bot/scanner) e convivem
 *   com o clique first-party do formulário (`cs_el`).
 * - O domínio compartilhado da plataforma segue com clique SEMPRE OFF — o
 *   redirecionador passaria por subdomínio de `corretorstudio.com`, ver
 *   `isClickTrackingEligibleDomain`.
 */
export const RESEND_TRACKING_POLICY = {
  openTracking: true,
  /** Default para domínio recém-conectado; opt-in por time depois. */
  defaultClickTracking: false,
} as const

/**
 * Clique do provedor NUNCA pode ser ligado para o domínio compartilhado da
 * plataforma (ou qualquer subdomínio dele): o redirecionador herdaria a
 * reputação já manchada de `corretorstudio.com`. Guard explícito exigido pela
 * decisão de 17/09.
 */
export const CLICK_TRACKING_LOCKED_ROOT_DOMAIN = PLATFORM_ROOT_DOMAIN

export function isClickTrackingEligibleDomain(domainName: string | null | undefined): boolean {
  const normalized = domainName?.trim().toLowerCase() ?? ""
  if (!normalized) return false
  return (
    normalized !== CLICK_TRACKING_LOCKED_ROOT_DOMAIN &&
    !normalized.endsWith(`.${CLICK_TRACKING_LOCKED_ROOT_DOMAIN}`)
  )
}

export type ResendTrackingPolicyDrift = {
  needsUpdate: boolean
  openTracking: boolean
  clickTracking: boolean
}

/**
 * Compara o tracking remoto com a política e devolve o alvo a aplicar.
 *
 * `teamClickTracking` é o estado desejado do time
 * (`EmailTeamSettings.resendClickTracking`); a abertura continua inegociável.
 * Domínio inelegível (plataforma) tem o clique forçado a OFF aqui também —
 * defesa em profundidade caso alguém o ligue direto no painel do provedor.
 */
export function resolveResendTrackingPolicyDrift(
  remote: ResendDomainSnapshot,
  options: { teamClickTracking: boolean; domainName?: string | null }
): ResendTrackingPolicyDrift {
  const remoteOpenTracking = Boolean(remote.openTracking ?? remote.open_tracking)
  const remoteClickTracking = Boolean(remote.clickTracking ?? remote.click_tracking)

  const eligible = isClickTrackingEligibleDomain(options.domainName ?? remote.name)
  const desiredClickTracking = eligible ? options.teamClickTracking : false

  return {
    needsUpdate:
      remoteOpenTracking !== RESEND_TRACKING_POLICY.openTracking ||
      remoteClickTracking !== desiredClickTracking,
    openTracking: RESEND_TRACKING_POLICY.openTracking,
    clickTracking: desiredClickTracking,
  }
}

export type PersistedResendDomainSnapshot = {
  resendDomainStatus: string | null
  resendDomainRegion: string | null
  resendOpenTracking: boolean
  resendClickTracking: boolean
  resendSendingDnsVerified?: boolean
}

/**
 * Compares persisted domain fields against a remote Resend snapshot using the
 * same normalization rules as `syncFromResendDomain`.
 *
 * Inclui `resendSendingDnsVerified` de propósito. Sem ele, um domínio cujo
 * status/região/flags não mudam — o caso de quem está `partially_failed` só
 * porque o CNAME de tracking falhou — era considerado "em dia" e o reconciler
 * retornava cedo, sem nunca derivar o flag. A coluna ficava no default `false`
 * indefinidamente e o gate de disparo nunca convergia pelo cron; só um
 * "Verificar DNS" manual ou o webhook resolviam. O mesmo early-return também
 * escondia reparo ou quebra de DNS que acontece apenas nos registros, sem mexer
 * no status agregado.
 *
 * `remote.records` ausente devolve `undefined` na derivação, e aí este campo é
 * ignorado na comparação — a mesma regra de "não rebaixar por falta de dado"
 * que `updateDomainTracking` aplica na escrita.
 */
export function isResendDomainSnapshotInSync(
  persisted: PersistedResendDomainSnapshot,
  remote: ResendDomainSnapshot
): boolean {
  const remoteStatus = remote.status ?? null
  const remoteRegion = remote.region ?? null
  const remoteOpenTracking = Boolean(remote.openTracking ?? remote.open_tracking)
  const remoteClickTracking = Boolean(remote.clickTracking ?? remote.click_tracking)
  const remoteSendingDnsVerified = deriveSendingDnsVerified(remote.records)

  return (
    isResendDomainStatusInSync(persisted.resendDomainStatus, remoteStatus) &&
    (persisted.resendDomainRegion ?? null) === remoteRegion &&
    persisted.resendOpenTracking === remoteOpenTracking &&
    persisted.resendClickTracking === remoteClickTracking &&
    (remoteSendingDnsVerified === undefined ||
      Boolean(persisted.resendSendingDnsVerified) === remoteSendingDnsVerified)
  )
}
