export type WeightMap = Record<string, number>

export type EngagementConfig = {
  windowRecentDays: number
  windowMidDays: number
  windowOldDays: number
  recentMultiplier: number
  oldMultiplier: number
  hotThreshold: number
  warmThreshold: number
  lukewarmThreshold: number
}

export type EngagementBand = "hot" | "warm" | "lukewarm" | "cold"

export type EngagementResult = {
  score: number
  band: EngagementBand
}

export type EngagementEventInput = {
  eventType: string
  occurredAt: Date
}

export const DEFAULT_ENGAGEMENT_CONFIG: EngagementConfig = {
  windowRecentDays: 7,
  windowMidDays: 30,
  windowOldDays: 90,
  recentMultiplier: 2.0,
  oldMultiplier: 0.2,
  hotThreshold: 60,
  warmThreshold: 30,
  lukewarmThreshold: 10,
}

/**
 * Calcula score de engajamento (0–100) e banda de temperatura a partir dos
 * eventos do perfil. Função pura — sem I/O.
 */
export function computeEngagementScore(
  events: EngagementEventInput[],
  weights: WeightMap,
  config: EngagementConfig,
  now: Date = new Date()
): EngagementResult {
  let total = 0

  for (const event of events) {
    const weight = weights[event.eventType] ?? 0
    if (weight === 0) continue

    const ageMs = now.getTime() - event.occurredAt.getTime()
    const ageDays = ageMs / (1000 * 60 * 60 * 24)

    let multiplier = 0
    if (ageDays <= config.windowRecentDays) multiplier = config.recentMultiplier
    else if (ageDays <= config.windowMidDays) multiplier = 1.0
    else if (ageDays <= config.windowOldDays) multiplier = config.oldMultiplier
    // acima de windowOldDays → multiplier = 0 (ignora o evento)

    total += weight * multiplier
  }

  const score = Math.min(100, Math.max(0, Math.round(total)))

  let band: EngagementBand
  if (score >= config.hotThreshold) band = "hot"
  else if (score >= config.warmThreshold) band = "warm"
  else if (score >= config.lukewarmThreshold) band = "lukewarm"
  else band = "cold"

  return { score, band }
}
