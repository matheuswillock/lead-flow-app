import type { LeadStatus } from "@prisma/client"
import { RADAR_SEGMENT_SLUGS, RECENT_CAMPAIGN_WINDOW_DAYS, type RadarSegmentSlug } from "./segment-config"
import { profileMatchesRadarSegment } from "./segment-rules"

/**
 * Oráculo de paridade dos segmentos de sistema — varredura em memória.
 *
 * NÃO é caminho de produção. Existe só para `scripts/validate-radar-segment-counts.ts`
 * conferir a contagem SQL contra uma segunda implementação independente.
 *
 * Vivia em `RadarService.countSegmentsLegacy`, onde carregava a base inteira do
 * time (330k perfis em produção) a cada chamada. Manter isso na superfície de
 * um service de produção é convite a alguém chamar por engano — e era metade da
 * divergência card-vs-lista que a auditoria CDP §4 R6 documentou. Aqui, o único
 * consumidor possível é o script (travado por teste).
 */

type SegmentationProfile = Parameters<typeof profileMatchesRadarSegment>[0]

export type LegacySegmentationSource = {
  listProfilesForSegmentation(teamId: string): Promise<SegmentationProfile[]>
  findLeadStatuses(teamId: string, values: string[]): Promise<Map<string, LeadStatus | null>>
}

export async function countSegmentsLegacyInMemory(
  source: LegacySegmentationSource,
  teamId: string
): Promise<Map<RadarSegmentSlug, number>> {
  const profiles = await source.listProfilesForSegmentation(teamId)

  const rawLeadStatuses = await source.findLeadStatuses(
    teamId,
    profiles.flatMap((profile) => profile.identities.map((identity) => identity.normalizedValue))
  )
  const leadStatuses = new Map(
    [...rawLeadStatuses.entries()].flatMap(([key, status]) =>
      status ? [[key, status] as const] : []
    )
  )

  const counts = new Map<RadarSegmentSlug, number>(
    RADAR_SEGMENT_SLUGS.map((slug) => [slug, 0])
  )

  const now = Date.now()
  const recentMs = RECENT_CAMPAIGN_WINDOW_DAYS * 24 * 60 * 60 * 1000

  for (const profile of profiles) {
    for (const slug of RADAR_SEGMENT_SLUGS) {
      if (profileMatchesRadarSegment(profile, slug, leadStatuses, now, recentMs)) {
        counts.set(slug, (counts.get(slug) ?? 0) + 1)
      }
    }
  }

  return counts
}
