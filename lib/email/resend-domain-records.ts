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
 * É também a lista dos propósitos EXIGIDOS para liberar: os dois precisam
 * aparecer no snapshot. Ver `deriveSendingDnsVerified`.
 */
const SENDING_RECORD_PURPOSES = ["DKIM", "SPF"] as const

export type ResendDomainRecordLike = {
  status?: string | null
  record?: string | null
}

/** O registro é pré-requisito para ENTREGAR (assinatura e autorização de envio). */
export function isSendingDnsRecord(record: string | null | undefined): boolean {
  const purpose = record?.trim() ?? ""
  return SENDING_RECORD_PURPOSES.some((required) => required === purpose)
}

/**
 * O DNS necessário para ENVIAR está verificado?
 *
 * Três respostas, não duas:
 * - `true`  — DKIM **e** SPF presentes, e todos verificados.
 * - `false` — algum registro de envio presente não está verificado. Bloqueia.
 * - `undefined` — **não dá para saber**: nada quebrado à vista, mas falta algum
 *   dos dois propósitos (lista vazia, snapshot parcial, ou itens sem rótulo).
 *
 * Quem chama trata `undefined` como "preserva o valor atual", a mesma regra que
 * `updateDomainTracking` já aplica na escrita. Isso importa porque o payload do
 * webhook `domain.updated` nem sempre traz `record` em cada item, e sem o rótulo
 * é impossível distinguir DKIM de CNAME de tracking. Colapsar esse caso em
 * `false` gravaria "DNS de envio quebrado" a cada evento enxuto do provedor,
 * re-bloqueando pela porta dos fundos exatamente os times que este código
 * destrava.
 *
 * Se o Resend renomear um dos rótulos, a resposta vira `undefined` para sempre e
 * o gate passa a depender só do fallback por `status === "verified"`. É a
 * direção segura: deixa de destravar `partially_failed`, mas não libera nada
 * indevidamente nem bloqueia quem já está verificado.
 */
export function deriveSendingDnsVerified(
  records: ResendDomainRecordLike[] | null | undefined
): boolean | undefined {
  const sendingRecords = (records ?? []).filter((record) =>
    isSendingDnsRecord(record.record)
  )

  // A ORDEM dos dois blocos abaixo é a regra, não detalhe de implementação.
  //
  // Quebra vista é conclusiva: um registro de envio reprovado basta para
  // bloquear, mesmo com o snapshot incompleto. Checar completude primeiro
  // transformaria `[{record:"DKIM",status:"failed"}]` em `undefined`, e
  // `undefined` preserva o valor gravado — um DKIM que caiu deixaria de derrubar
  // um domínio já liberado.
  if (sendingRecords.some((record) => record.status !== "verified")) return false

  // Ausência não é conclusiva: para LIBERAR, os dois propósitos precisam estar
  // presentes. Sem essa exigência, `[{record:"DKIM",status:"verified"}]` liberava
  // sozinho — o SPF omitido ou sem rótulo era descartado pelo filtro e ninguém
  // via a falta. Pior, `[{record:"SPF",status:"verified"}]` liberava sem DKIM
  // nenhum, ou seja, e-mail saindo sem assinatura. Medido executando a função
  // antes da correção: os dois devolviam `true`.
  //
  // Cobre também a lista vazia, que não tem propósito nenhum.
  const purposesPresent = new Set(sendingRecords.map((record) => record.record?.trim()))
  const snapshotIsComplete = SENDING_RECORD_PURPOSES.every((required) =>
    purposesPresent.has(required)
  )
  return snapshotIsComplete ? true : undefined
}
