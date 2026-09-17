/**
 * Mensagens persistidas em `EmailCampaign.errorMessage` quando o caminho
 * AGENDADO (`dispatchScheduledCampaigns`) adia uma parte sem falhar — teto
 * diário, janela de horário/data bloqueada, ou tracking de domínio não
 * pronto. Antes desta adenda (caso KKJ 01/09, agravado pelo caso Rafael
 * 10/09), esses três ramos só logavam `console.info` e devolviam a campanha
 * para `scheduled` sem nenhum rastro — o operador lia isso como "erro no
 * disparo" sem erro nenhum registrado.
 *
 * A campanha continua `scheduled`, nunca vira `failed`: o envio não morreu,
 * foi adiado. Na UI, porém, o adiamento é APRESENTADO como falha de disparo
 * (chip destrutivo "Adiada" + motivo na coluna Erro) — decisão do owner em
 * 15/09 (caso Kathrein): "Agendado" mudo com horário já vencido era lido como
 * erro sem explicação. A semântica interna não muda: o cron segue
 * redisparando sozinho na próxima janela.
 */

/**
 * Teto diário atingido. NÃO promete que a saída é exatamente à meia-noite —
 * caso de starvation em cascata medido em produção (time Rafael, 10/09): a
 * parte represada de ontem já consumiu o teto assim que a virada libera, e
 * partes mais novas continuam adiadas até que as mais antigas da fila sejam
 * atendidas. A copy declara a ordem, não um horário certo.
 */
export function formatDailyCapDeferMessage(used: number, limit: number): string {
  return `Adiada: limite diário de envio atingido (${used.toLocaleString("pt-BR")}/${limit.toLocaleString("pt-BR")}) — o teto libera à meia-noite, mas os envios seguem a ordem de agendamento; partes mais antigas saem primeiro.`
}

/** Janela de horário ou data bloqueada (`checkDispatchWindow`). */
export function formatDispatchWindowDeferMessage(reason: string): string {
  return `Adiada: ${reason}`
}

/** Tracking de domínio (DKIM/SPF) ainda não pronto (`assertResendDomainTrackingReady`). */
export function formatTrackingNotReadyDeferMessage(message: string): string {
  return `Adiada: ${message}`
}

/**
 * Trava de reputação (`EmailTeamSettings.sendingHealthStatus` paused ou
 * suspended). A parte continua `scheduled` e o cron retoma sozinho quando o
 * envio for liberado — mesma semântica da v0.305.0: apresentação de falha
 * ("Adiada" + motivo), status interno intacto.
 */
export function formatSendingHealthDeferMessage(params: {
  status: "paused" | "suspended"
  reason?: string | null
}): string {
  const statusLabel = params.status === "suspended" ? "suspenso" : "pausado"
  const reasonPart = params.reason?.trim() ? ` — ${params.reason.trim()}` : ""
  return `Adiada: envio ${statusLabel} pela trava de reputação${reasonPart}`
}

/**
 * Parte irmã adiada porque um disparo do MESMO grupo foi abortado por taxa de
 * bounce (≥8% com ≥100 enviados). O abort também pausa a saúde de envio do
 * time, então o gate de reputação segura estas partes até liberação manual.
 */
export function formatBounceAbortSiblingDeferMessage(dispatchLabel: string): string {
  return `Adiada: abortada por taxa de bounce no disparo ${dispatchLabel} — o envio do time foi pausado até liberação manual`
}

/**
 * Lista de contatos em quarentena pelo gate de importação (risco ALTO). A
 * parte continua `scheduled`; libere a lista no relatório de importação para
 * o cron retomar.
 */
export function formatQuarantinedListDeferMessage(listNames: string[]): string {
  const names = listNames.filter(Boolean)
  const listPart = names.length > 0 ? ` (${names.join(", ")})` : ""
  return `Adiada: lista de contatos em quarentena pelo gate de importação${listPart} — libere a lista no relatório de importação para retomar`
}
