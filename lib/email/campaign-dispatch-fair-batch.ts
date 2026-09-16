/**
 * Seleção justa do lote do cron de campanhas agendadas (achado codex/cursor
 * no PR #1178): com `take: N` global e o adiamento por teto mantendo
 * `scheduledAt`, as N partes mais antigas de UM time no teto monopolizavam
 * todos os ticks — times com capacidade livre ficavam represados até a
 * meia-noite.
 *
 * Round-robin por time preservando a ordem global (scheduledAt asc, id asc)
 * DENTRO de cada time: a rodada 1 leva a parte mais antiga de cada time na
 * ordem em que os times aparecem na fila; a rodada 2, a segunda de cada um; e
 * assim por diante até encher o lote. Um time no teto ocupa no máximo 1 slot
 * por rodada, e `queuedAheadCount` (campaign-dispatch-availability) continua
 * verdadeiro porque a ordem intra-time não muda.
 */

export type FairBatchCandidate = {
  id: string
  teamId: string
}

export function selectFairDispatchBatch<T extends FairBatchCandidate>(
  candidates: T[],
  maxCampaigns: number
): T[] {
  if (maxCampaigns <= 0 || candidates.length === 0) return []

  const byTeam = new Map<string, T[]>()
  const teamOrder: string[] = []
  for (const candidate of candidates) {
    const bucket = byTeam.get(candidate.teamId)
    if (bucket) {
      bucket.push(candidate)
    } else {
      byTeam.set(candidate.teamId, [candidate])
      teamOrder.push(candidate.teamId)
    }
  }

  const selected: T[] = []
  for (let round = 0; selected.length < maxCampaigns; round++) {
    let tookAny = false
    for (const teamId of teamOrder) {
      const bucket = byTeam.get(teamId)
      if (!bucket || round >= bucket.length) continue
      selected.push(bucket[round])
      tookAny = true
      if (selected.length >= maxCampaigns) break
    }
    if (!tookAny) break
  }

  return selected
}
