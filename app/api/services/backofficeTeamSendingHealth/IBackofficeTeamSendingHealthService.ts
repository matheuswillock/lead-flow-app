export type BackofficeTeamSendingHealthRow = {
  teamId: string
  teamName: string
  masterName: string | null
  status: string
  reason: string | null
  changedAt: string | null
}

export type BackofficeSendingHealthAction = "release" | "pause"

export interface IBackofficeTeamSendingHealthService {
  /**
   * Saúde de envio por time: com `teamIds`, devolve só os pedidos (coluna da
   * tela de limites); sem, devolve todos os times fora de `healthy`
   * (visibilidade de qualquer time travado).
   */
  list(teamIds?: string[]): Promise<BackofficeTeamSendingHealthRow[]>

  /**
   * `release`: paused/suspended → warned (backoffice pode liberar qualquer um).
   * `pause`: healthy/warned → paused, registrando no histórico de pausas
   * (2ª pausa em 30 dias escala para suspended).
   */
  applyAction(params: {
    teamId: string
    action: BackofficeSendingHealthAction
  }): Promise<{ ok: true; status: string } | { ok: false; message: string }>
}
