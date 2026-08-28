export type SuppressedAudienceCopyCounts = {
  bounced: number
  unsubscribed: number
  complained: number
}

export function formatPermanentBounceAlert(count: number): string {
  return `${count.toLocaleString("pt-BR")} contatos não receberão esta campanha por já terem bounce permanente.`
}

export function formatSuppressedAudienceSummary(
  counts: SuppressedAudienceCopyCounts
): string | null {
  const parts: string[] = []
  if (counts.bounced > 0) {
    parts.push(`${counts.bounced.toLocaleString("pt-BR")} bounce permanente`)
  }
  if (counts.unsubscribed > 0) {
    parts.push(`${counts.unsubscribed.toLocaleString("pt-BR")} descadastro`)
  }
  if (counts.complained > 0) {
    parts.push(`${counts.complained.toLocaleString("pt-BR")} reclamação`)
  }
  return parts.length > 0 ? parts.join(" · ") : null
}
