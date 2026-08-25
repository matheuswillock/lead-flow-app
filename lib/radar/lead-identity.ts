/**
 * Reserva provisória do slot `lead_id` de um perfil Radar.
 *
 * A promoção manual reserva a identidade ANTES de criar o Lead (auditoria CDP
 * §4 R5/H3) — criar primeiro e reservar depois obrigava, ao perder a corrida, a
 * DELETAR um Lead real. Como o `leadId` verdadeiro ainda não existe no momento
 * da reserva, a linha nasce com este prefixo, que a unique
 * `(teamId, type, normalizedValue)` aceita e nenhuma busca por `lead_id` real
 * casa (um id de Lead é sempre uuid puro).
 *
 * O prefixo mora aqui, e não solto no repositório, porque **todo consumidor de
 * `lead_id` precisa saber ignorá-lo**: uma reserva não é vínculo com o CRM.
 * Contá-la como Lead colocaria o perfil em `crm_clients` e o tiraria de
 * `engaged_no_lead` — a própria fila de promoção — durante a promoção, e
 * permanentemente se a liberação falhar.
 */
export const PENDING_LEAD_IDENTITY_PREFIX = "pending:"

/** Padrão `LIKE` do Postgres para as reservas provisórias. */
export const PENDING_LEAD_IDENTITY_SQL_PATTERN = `${PENDING_LEAD_IDENTITY_PREFIX}%`

export function isPendingLeadIdentity(normalizedValue: string | null | undefined): boolean {
  return Boolean(normalizedValue?.startsWith(PENDING_LEAD_IDENTITY_PREFIX))
}

/**
 * Após esta janela, uma reserva sem Lead é considerada órfã e pode ser tomada.
 *
 * Existe porque `releaseClaim` é best-effort: um crash entre reservar e liberar
 * deixaria o perfil bloqueado para sempre ("já promovido" sem Lead nenhum).
 * Dentro da janela a reserva ainda bloqueia — aí é promoção concorrente de
 * verdade, e a exclusão mútua é o comportamento certo.
 */
export const PENDING_LEAD_IDENTITY_STALE_MS = 5 * 60 * 1000
