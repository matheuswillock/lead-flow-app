import type { ResendDomainSnapshot } from "@/app/api/infra/data/repositories/emailTeamDomainEvent/EmailTeamDomainEventRepository"
import { deriveSendingDnsVerified } from "@/lib/email/resend-domain-records"

/** Returns true when persisted status matches the remote Resend API status. */
export function isResendDomainStatusInSync(
  persisted: string | null | undefined,
  remote: string | null | undefined
): boolean {
  return (persisted ?? null) === (remote ?? null)
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
