const ANONYMOUS_RADAR_DISPLAY_NAME = "Visitante Anônimo"

/**
 * `true` quando o nome pode ser tratado como identidade real de uma pessoa —
 * não vazio, não o placeholder de anônimo, e não um e-mail usado como
 * `displayName` (padrão de perfis criados só por e-mail antes de se conhecer
 * o nome real).
 *
 * Consolida o predicado que estava duplicado inline em três pontos de
 * `RadarRepository.ts` (merge de perfis — vencedor/perdedor — e a herança de
 * nome do destinatário em `resolveProfileForEmail`, Adenda E6b/PR #1148).
 * Também usado pela guarda de e-mail compartilhado (bug 2026-09-03, caso
 * PIMENTAS/KKJ) e pelo backfill de herança retroativa de anônimos com rastro
 * de campanha.
 */
export function isUsableRadarDisplayName(name: string | null | undefined): boolean {
  const trimmed = name?.trim() ?? ""
  if (!trimmed) return false
  if (trimmed === ANONYMOUS_RADAR_DISPLAY_NAME) return false
  if (trimmed.includes("@")) return false
  return true
}
