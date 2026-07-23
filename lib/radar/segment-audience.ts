import { teamRadarSegmentRepository } from "@/app/api/infra/data/repositories/radar/TeamRadarSegmentRepository"
import { isRadarSegmentSlug } from "@/lib/radar/segment-config"

export const CUSTOM_RADAR_SEGMENT_PREFIX = "custom:"

/**
 * Chave de `pg_advisory_xact_lock` compartilhada entre exclusão de segmento
 * (TeamRadarSegmentRepository.removeWithLock) e criação de campanha por
 * segmento custom (EmailCampaignUseCase.create) — serializa as duas
 * operações para que uma campanha nunca seja criada com `custom:{id}`
 * apontando para um segmento excluído entre a validação e o insert.
 */
export function radarSegmentLockKey(teamId: string, segmentId: string): string {
  return `${teamId}:segment:${segmentId}`
}

/**
 * Um `radarSegmentSlug` de campanha é válido quando é um dos 6 slugs fixos
 * ou quando referencia um `TeamRadarSegment` ativo do próprio time (C4).
 */
export async function isValidRadarSegmentAudience(teamId: string, value: string): Promise<boolean> {
  if (isRadarSegmentSlug(value)) return true

  if (value.startsWith(CUSTOM_RADAR_SEGMENT_PREFIX)) {
    const segmentId = value.slice(CUSTOM_RADAR_SEGMENT_PREFIX.length)
    const segment = await teamRadarSegmentRepository.findById(teamId, segmentId)
    return Boolean(segment?.isActive)
  }

  return false
}
