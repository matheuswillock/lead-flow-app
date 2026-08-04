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

export type FormEngagementScoreRule = {
  minPercent: number
  maxPercent: number
  multiplier: number
  label: string
  isActive: boolean
}

export type EngagementEventInput = {
  eventType: string
  occurredAt: Date
  metadata?: unknown
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

export const DEFAULT_FORM_ENGAGEMENT_SCORE_RULES: FormEngagementScoreRule[] = [
  { minPercent: 80, maxPercent: 100, multiplier: 2.5, label: "Lead qualificado — alta intenção", isActive: true },
  { minPercent: 60, maxPercent: 79, multiplier: 1.8, label: "Lead acima da média", isActive: true },
  { minPercent: 40, maxPercent: 59, multiplier: 1.0, label: "Lead médio (peso base sem alteração)", isActive: true },
  { minPercent: 20, maxPercent: 39, multiplier: 0.5, label: "Lead abaixo da média", isActive: true },
  { minPercent: 0, maxPercent: 19, multiplier: 0.2, label: "Lead de baixa qualidade", isActive: true },
]

export function extractFormScorePercent(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== "object") return null
  const m = metadata as Record<string, unknown>
  const origin = m.origin
  if (origin && typeof origin === "object") {
    const v = (origin as Record<string, unknown>).submissionScorePercent
    if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100) return v
  }
  const direct = m.submissionScorePercent
  if (typeof direct === "number" && Number.isFinite(direct) && direct >= 0 && direct <= 100) {
    return direct
  }
  return null
}

export function resolveFormEngagementMultiplier(
  scorePercent: number,
  formRules: FormEngagementScoreRule[]
): number {
  const rule = formRules.find(
    (r) =>
      r.isActive &&
      scorePercent >= r.minPercent &&
      scorePercent <= r.maxPercent
  )
  return rule?.multiplier ?? 1.0
}

/** Peso efetivo do evento (D19-B-bis: form.completed escala pelo score da submissão). */
export function resolveEventWeight(
  event: EngagementEventInput,
  weights: WeightMap,
  formRules: FormEngagementScoreRule[] = []
): number {
  const baseWeight = weights[event.eventType] ?? 0
  if (baseWeight === 0) return 0

  if (event.eventType === "form.completed") {
    const scorePercent = extractFormScorePercent(event.metadata)
    if (scorePercent !== null) {
      return Math.round(baseWeight * resolveFormEngagementMultiplier(scorePercent, formRules))
    }
  }

  return baseWeight
}

function recencyMultiplier(ageDays: number, config: EngagementConfig): number {
  if (ageDays <= config.windowRecentDays) return config.recentMultiplier
  if (ageDays <= config.windowMidDays) return 1.0
  if (ageDays <= config.windowOldDays) return config.oldMultiplier
  return 0
}

/**
 * Calcula score de engajamento (0–100) e banda de temperatura a partir dos
 * eventos do perfil. Função pura — sem I/O.
 */
export function computeEngagementScore(
  events: EngagementEventInput[],
  weights: WeightMap,
  config: EngagementConfig,
  now: Date = new Date(),
  formRules: FormEngagementScoreRule[] = []
): EngagementResult {
  let total = 0

  for (const event of events) {
    const weight = resolveEventWeight(event, weights, formRules)
    if (weight === 0) continue

    const ageMs = now.getTime() - event.occurredAt.getTime()
    const ageDays = ageMs / (1000 * 60 * 60 * 24)
    const multiplier = recencyMultiplier(ageDays, config)
    if (multiplier === 0) continue

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

export type EngagementContribution = {
  eventType: string
  occurredAt: Date
  contribution: number
}

function eventContribution(
  event: EngagementEventInput,
  weights: WeightMap,
  config: EngagementConfig,
  now: Date,
  formRules: FormEngagementScoreRule[]
): number {
  const weight = resolveEventWeight(event, weights, formRules)
  if (weight === 0) return 0

  const ageMs = now.getTime() - event.occurredAt.getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)
  return weight * recencyMultiplier(ageDays, config)
}

/**
 * Top N eventos por |weight × multiplier| dentro da janela de engajamento.
 */
export function rankTopEngagementEvents(
  events: EngagementEventInput[],
  weights: WeightMap,
  config: EngagementConfig,
  limit = 3,
  now: Date = new Date(),
  formRules: FormEngagementScoreRule[] = []
): EngagementContribution[] {
  const ranked: EngagementContribution[] = []

  for (const event of events) {
    const contribution = eventContribution(event, weights, config, now, formRules)
    if (contribution === 0) continue
    ranked.push({
      eventType: event.eventType,
      occurredAt: event.occurredAt,
      contribution,
    })
  }

  ranked.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
  return ranked.slice(0, limit)
}

export function bandFromScore(score: number, config: EngagementConfig = DEFAULT_ENGAGEMENT_CONFIG): EngagementBand {
  if (score >= config.hotThreshold) return "hot"
  if (score >= config.warmThreshold) return "warm"
  if (score >= config.lukewarmThreshold) return "lukewarm"
  return "cold"
}
