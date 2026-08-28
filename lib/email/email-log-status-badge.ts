/**
 * Rótulo e classe do badge de status de `EmailLog`, num lugar só.
 *
 * O mapa vivia duplicado em `CampaignLogsTab` e em `LogsTable` (Histórico),
 * ambos tipados como `Record<UniãoFechada, …>`. Isso é inseguro: o status vem
 * do banco, não do tipo. Quando a pré-validação de audiência passou a gravar
 * `suppressed`, o lookup devolveu `undefined` nos dois e o acesso a
 * `.className` derrubou a aba de Logs e a página de Histórico inteiras — não só
 * a linha do log recusado.
 *
 * Por isso o acesso é por função com fallback: status desconhecido degrada para
 * um badge neutro em vez de quebrar a tela.
 */
export type EmailLogStatusBadge = {
  label: string
  className: string
}

const NEUTRAL_BADGE_CLASS = "border bg-transparent text-muted-foreground"
const INFO_BADGE_CLASS =
  "border-semantic-info-border bg-semantic-info-surface text-semantic-info"
const NEW_BADGE_CLASS =
  "border-semantic-new-border bg-semantic-new-surface text-semantic-new"
const SUCCESS_BADGE_CLASS =
  "border-semantic-success-border bg-semantic-success-surface text-semantic-success"
const DANGER_BADGE_CLASS =
  "border-semantic-danger-border bg-semantic-danger-surface text-semantic-danger"
const WARNING_BADGE_CLASS =
  "border-semantic-warning-border bg-semantic-warning-surface text-semantic-warning"

const BADGE_BY_STATUS: Record<string, EmailLogStatusBadge> = {
  queued: { label: "Na fila", className: NEUTRAL_BADGE_CLASS },
  sent: { label: "Enviado", className: INFO_BADGE_CLASS },
  delivered: { label: "Entregue", className: INFO_BADGE_CLASS },
  opened: { label: "Aberto", className: NEW_BADGE_CLASS },
  clicked: { label: "Clicado", className: SUCCESS_BADGE_CLASS },
  bounced: { label: "Bounce", className: DANGER_BADGE_CLASS },
  complained: { label: "Reclamação", className: WARNING_BADGE_CLASS },
  failed: { label: "Falhou", className: DANGER_BADGE_CLASS },
  // Recusado pela nossa pré-validação, antes de tocar o provedor. Não é falha
  // de envio e não é retentável — reenviar submete o mesmo endereço à mesma
  // regra determinística. Warning, não danger: não houve erro, houve recusa.
  suppressed: { label: "Recusado", className: WARNING_BADGE_CLASS },
}

/** Status vem do banco; um valor fora do mapa degrada em vez de derrubar a tela. */
export function resolveEmailLogStatusBadge(status: string): EmailLogStatusBadge {
  return BADGE_BY_STATUS[status] ?? { label: "Desconhecido", className: NEUTRAL_BADGE_CLASS }
}

/** Opções do filtro de status — mesma fonte dos rótulos, para não divergirem. */
export const EMAIL_LOG_STATUS_FILTER_OPTIONS: Array<{ value: string; label: string }> =
  Object.entries(BADGE_BY_STATUS).map(([value, badge]) => ({ value, label: badge.label }))
