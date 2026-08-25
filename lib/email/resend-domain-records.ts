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

/**
 * Allowlist, não denylist.
 *
 * A primeira versão listava o que NÃO é envio (`Tracking`, `TrackingCAA`) e
 * tratava todo o resto como envio. Isso reproduz o próprio incidente que este
 * módulo corrige: qualquer rótulo fora da lista vira pré-requisito de entrega.
 * Já valia para `Receiving` — recebimento de e-mail, opt-in, que nada tem a ver
 * com assinar o que sai — e valeria para qualquer rótulo que o Resend viesse a
 * adicionar. Um registro de inbound pendente derrubaria o disparo de um domínio
 * com DKIM e SPF verificados.
 *
 * Enumerar o que entrega e ignorar o resto erra para o lado seguro: rótulo
 * desconhecido não bloqueia ninguém, e nenhum rótulo desconhecido pode
 * *liberar* — a liberação exige DKIM/SPF explicitamente verificados.
 */
const SENDING_RECORD_PURPOSES = new Set(["DKIM", "SPF"])

export type ResendDomainRecordLike = {
  status?: string | null
  record?: string | null
}

/** O registro é pré-requisito para ENTREGAR (assinatura e autorização de envio). */
export function isSendingDnsRecord(record: string | null | undefined): boolean {
  return SENDING_RECORD_PURPOSES.has(record?.trim() ?? "")
}

/**
 * O DNS necessário para ENVIAR está verificado?
 *
 * Três respostas, não duas:
 * - `true`  — todo DKIM/SPF presente está verificado.
 * - `false` — existe DKIM ou SPF e algum não está verificado. Bloqueia.
 * - `undefined` — **não dá para saber**: a lista veio vazia, ou nenhum registro
 *   traz rótulo de envio reconhecível.
 *
 * O `undefined` não é preciosismo. O payload do webhook `domain.updated` do
 * Resend nem sempre traz `record` em cada item, e sem o rótulo é impossível
 * distinguir DKIM de CNAME de tracking. Colapsar esse caso em `false`
 * significaria gravar "DNS de envio quebrado" toda vez que o provedor manda um
 * evento enxuto — re-bloqueando, pela porta dos fundos, exatamente o time que
 * este código destrava. Quem chama trata `undefined` como "preserva o valor
 * atual", a mesma regra que `updateDomainTracking` já aplica na escrita.
 */
export function deriveSendingDnsVerified(
  records: ResendDomainRecordLike[] | null | undefined
): boolean | undefined {
  const sendingRecords = (records ?? []).filter((record) =>
    isSendingDnsRecord(record.record)
  )
  if (sendingRecords.length === 0) return undefined
  return sendingRecords.every((record) => record.status === "verified")
}
