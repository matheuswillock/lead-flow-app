/**
 * Precedência de nome no Radar.
 *
 * Um `RadarProfile` é alimentado por várias fontes (CRM, WhatsApp, carteira,
 * importação de base, formulário público, contrato finalizado). Até aqui a
 * regra era "último valor não-vazio vence", sem noção de fonte — fechada no
 * achado #7 do code review de 2026-08-19 para resolver um problema real: antes
 * dela, o caminho do telefone nunca sobrescrevia, então uma correção de nome
 * digitada depois era descartada em silêncio.
 *
 * O efeito colateral é que a regra ficou cega à procedência: o push name que o
 * próprio contato escolheu no WhatsApp passou a sobrescrever o nome curado que
 * veio do CRM. Isso não fica só numa tela interna — `buildEmailRecipients`
 * (`lib/radar/list-segment-recipients.ts`) usa `displayName` como nome do
 * destinatário de campanha.
 *
 * Aqui a comparação passa a ser por rank de fonte, mantendo `>=` para que a
 * motivação original continue valendo: uma fonte reescreve a si mesma (correção
 * do CRM sobrescreve nome do CRM). Só fonte *mais fraca* é barrada.
 *
 * Espelha a política já usada para gênero em `lib/radar/gender.ts`.
 */

export type RadarNameSource =
  /** Alguém do time digitou o nome (ex.: renomear contato no inbox do WhatsApp). */
  | "manual"
  /** `Lead.name`, cadastrado no CRM. */
  | "crm"
  /** Titular/dependente de contrato finalizado. */
  | "lead_finalized"
  /** Cliente de carteira. */
  | "portfolio"
  /** Planilha de importação de base. */
  | "base_import"
  /** A própria pessoa preencheu num formulário público. */
  | "public_form_answer"
  /** Nome que acompanhou um contato ou log de e-mail. */
  | "email"
  /** Agenda do aparelho de quem conversa pelo WhatsApp. */
  | "whatsapp_phone_book"
  /** Push name — o nome que o próprio contato escolheu no WhatsApp. */
  | "whatsapp"

const RADAR_NAME_SOURCE_RANK: Record<RadarNameSource, number> = {
  manual: 40,
  crm: 30,
  lead_finalized: 30,
  portfolio: 20,
  base_import: 20,
  public_form_answer: 20,
  email: 10,
  whatsapp_phone_book: 10,
  whatsapp: 5,
}

/**
 * Perfis anteriores a esta política têm `nameSource` nulo, e fonte
 * desconhecida não protege nada — qualquer origem pode reescrever. A migration
 * que introduz a coluna faz backfill de `crm` nos perfis que já têm identidade
 * `lead_id`, que é onde o nome curado de fato mora.
 */
const UNKNOWN_SOURCE_RANK = 0

export function getRadarNameSourceRank(source: string | null | undefined): number {
  if (!source) return UNKNOWN_SOURCE_RANK
  return RADAR_NAME_SOURCE_RANK[source as RadarNameSource] ?? UNKNOWN_SOURCE_RANK
}

/**
 * Traduz a procedência que o WhatsApp já registra em
 * `WhatsAppConversation.contactNameSource` para o vocabulário do Radar.
 *
 * O inbox distingue nome digitado por um corretor, nome herdado do lead, nome
 * da agenda e push name — mas o Radar descartava essa informação e tratava
 * tudo como "whatsapp". Sem esta tradução, renomear um contato à mão no inbox
 * valeria tão pouco quanto o apelido que o contato escolheu sozinho.
 */
export function radarNameSourceFromWhatsapp(
  contactNameSource: string | null | undefined
): RadarNameSource {
  switch (contactNameSource) {
    case "MANUAL":
      return "manual"
    case "LEAD":
      return "crm"
    case "PHONE_BOOK":
      return "whatsapp_phone_book"
    // PUSH_NAME, PHONE_NUMBER e qualquer valor novo caem no piso.
    default:
      return "whatsapp"
  }
}

export type RadarNameState = {
  displayName: string | null
  normalizedName: string | null
  nameSource: string | null
}

export type RadarNameCandidate = {
  displayName: string
  normalizedName: string
  source: string
}

export type RadarNameWrite = {
  displayName: string
  normalizedName: string
  nameSource: RadarNameSource | string
}

/**
 * Decide se o nome que está chegando substitui o que já está no perfil.
 * Retorna `null` quando nada deve ser escrito.
 */
export function resolveRadarName(
  current: RadarNameState,
  candidate: RadarNameCandidate
): RadarNameWrite | null {
  const incomingName = candidate.displayName.trim()

  // Fonte sem nome não apaga o que já existe. Vale para
  // `SyncPublicFormMetricToRadarUseCase`, que passa `displayName: ""` de
  // propósito quando a resposta do formulário ainda não trouxe nome.
  if (!incomingName) return null

  const currentName = current.displayName?.trim() ?? ""

  // Perfil sem nome usável aceita qualquer origem — é o caso do perfil criado
  // por telefone/e-mail antes de alguém saber quem é a pessoa.
  if (!currentName) {
    return {
      displayName: incomingName,
      normalizedName: candidate.normalizedName,
      nameSource: candidate.source,
    }
  }

  if (getRadarNameSourceRank(candidate.source) < getRadarNameSourceRank(current.nameSource)) {
    return null
  }

  // Nada mudou — evita uma escrita que só serviria para mexer no `updatedAt`.
  if (incomingName === currentName && candidate.source === current.nameSource) {
    return null
  }

  return {
    displayName: incomingName,
    normalizedName: candidate.normalizedName,
    nameSource: candidate.source,
  }
}
