import { prisma } from "@/app/api/infra/data/prisma"
import { teamRadarSegmentRepository } from "@/app/api/infra/data/repositories/radar/TeamRadarSegmentRepository"
import { isRadarSegmentSlug } from "@/lib/radar/segment-config"

export const CUSTOM_RADAR_SEGMENT_PREFIX = "custom:"
export const CAMPAIGN_RADAR_SEGMENT_PREFIX = "campaign:"

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

export function parseCampaignRadarSegmentSlug(value: string): string | null {
  if (!value.startsWith(CAMPAIGN_RADAR_SEGMENT_PREFIX)) return null
  const campaignId = value.slice(CAMPAIGN_RADAR_SEGMENT_PREFIX.length).trim()
  return campaignId.length > 0 ? campaignId : null
}

export function buildCampaignRadarSegmentSlug(campaignId: string): string {
  return `${CAMPAIGN_RADAR_SEGMENT_PREFIX}${campaignId}`
}

/**
 * Um `radarSegmentSlug` de campanha é válido quando é um slug fixo de sistema,
 * um `TeamRadarSegment` ativo do time (C4), ou um slug `campaign:{id}` cuja
 * campanha pertence ao time.
 */
export async function isValidRadarSegmentAudience(teamId: string, value: string): Promise<boolean> {
  if (isRadarSegmentSlug(value)) return true

  if (value.startsWith(CUSTOM_RADAR_SEGMENT_PREFIX)) {
    const segmentId = value.slice(CUSTOM_RADAR_SEGMENT_PREFIX.length)
    const segment = await teamRadarSegmentRepository.findById(teamId, segmentId)
    return Boolean(segment?.isActive)
  }

  const campaignId = parseCampaignRadarSegmentSlug(value)
  if (campaignId) {
    const campaign = await prisma.emailCampaign.findFirst({
      where: { id: campaignId, teamId },
      select: { id: true },
    })
    return campaign !== null
  }

  return false
}
