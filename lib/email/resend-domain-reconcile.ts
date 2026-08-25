import type { ResendDomainSnapshot } from "@/app/api/infra/data/repositories/emailTeamDomainEvent/EmailTeamDomainEventRepository"
import { deriveSendingDnsVerified } from "@/lib/email/resend-domain-records"

/** Returns true when persisted status matches the remote Resend API status. */
export function isResendDomainStatusInSync(
  persisted: string | null | undefined,
  remote: string | null | undefined
): boolean {
  return (persisted ?? null) === (remote ?? null)
}

/**
 * Política de tracking vigente desde o cutover de 23/08: abertura ligada,
 * clique desligado.
 *
 * Clique desligado porque o clique passou a ser first-party — a reescrita de
 * link do provedor media scanner, não pessoa. Abertura ligada porque é o único
 * sinal de engajamento que sobrou, e foi exatamente ela que estava OFF em
 * `corretorstudio.com.br` e `mail.libercorretora.com.br`, apagando as aberturas
 * desses domínios do funil sem nenhum aviso.
 *
 * Não existe override por time a respeitar: `configureDomainTracking` recusa
 * `openTracking: false` na entrada e força `clickTracking: false` na saída — o
 * produto nunca ofereceu como desligar abertura de propósito. (Resolve a open
 * question 1 da SPEC 20 por evidência no código, não por suposição.)
 */
export const RESEND_TRACKING_POLICY = {
  openTracking: true,
  clickTracking: false,
} as const

export type ResendTrackingPolicyDrift = {
  needsUpdate: boolean
  openTracking: boolean
  clickTracking: boolean
}

/** Compara o tracking remoto com a política e devolve o alvo a aplicar. */
export function resolveResendTrackingPolicyDrift(
  remote: ResendDomainSnapshot
): ResendTrackingPolicyDrift {
  const remoteOpenTracking = Boolean(remote.openTracking ?? remote.open_tracking)
  const remoteClickTracking = Boolean(remote.clickTracking ?? remote.click_tracking)

  return {
    needsUpdate:
      remoteOpenTracking !== RESEND_TRACKING_POLICY.openTracking ||
      remoteClickTracking !== RESEND_TRACKING_POLICY.clickTracking,
    openTracking: RESEND_TRACKING_POLICY.openTracking,
    clickTracking: RESEND_TRACKING_POLICY.clickTracking,
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
