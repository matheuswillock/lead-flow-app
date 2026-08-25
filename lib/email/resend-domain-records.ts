/**
 * Classificação dos registros DNS que o Resend devolve para um domínio.
 *
 * Existe porque `resendDomainStatus` colapsa tudo num rótulo só: um domínio com
 * DKIM e SPF perfeitos, mas com o CNAME de tracking pendente, vira
 * `partially_failed` — indistinguível de um domínio com o DKIM quebrado.
 *
 * A diferença importa porque as consequências são opostas. Sem DKIM/SPF o
 * e-mail não sai, ou sai sem assinatura. Sem o CNAME de tracking o e-mail sai
 * normalmente; o que se perde é a métrica de abertura.
 */

/** Valores de `record.record` na resposta do Resend. */
const TRACKING_RECORD_PURPOSES = new Set(["Tracking", "TrackingCAA"])

export type ResendDomainRecordLike = {
  status?: string | null
  record?: string | null
}

/** O registro alimenta métricas (pixel de abertura), não a entrega. */
export function isTrackingDnsRecord(
  record: string | null | undefined
): boolean {
  return TRACKING_RECORD_PURPOSES.has(record?.trim() ?? "")
}

/**
 * O DNS necessário para ENVIAR está verificado — DKIM e SPF, ignorando tracking.
 *
 * Lista vazia devolve `false` de propósito: ausência de registro não é prova de
 * verificação. O Resend só omite `records` quando ainda não processou o domínio,
 * e tratar isso como "ok" liberaria disparo de domínio recém-criado.
 */
export function hasVerifiedSendingDns(
  records: ResendDomainRecordLike[] | null | undefined
): boolean {
  const sendingRecords = (records ?? []).filter(
    (record) => !isTrackingDnsRecord(record.record)
  )
  if (sendingRecords.length === 0) return false
  return sendingRecords.every((record) => record.status === "verified")
}
