import type { EmailLogCategory } from "@prisma/client"

export function buildResendTrackingTags(input: {
  teamId: string
  category: EmailLogCategory
  sourceType?: string | null
  sourceId?: string | null
}): Array<{ name: string; value: string }> {
  const tags: Array<{ name: string; value: string }> = [
    { name: "team_id", value: input.teamId },
    { name: "category", value: input.category },
  ]

  if (input.sourceType?.trim()) {
    tags.push({ name: "source_type", value: input.sourceType.trim() })
  }
  if (input.sourceId?.trim()) {
    tags.push({ name: "source_id", value: input.sourceId.trim() })
  }

  return tags
}

export type ResendTrackingTagsInput =
  | Array<{ name: string; value: string }>
  | Record<string, string>
  | null
  | undefined

function toResendTagMap(tags: ResendTrackingTagsInput): Map<string, string> {
  if (!tags) return new Map()
  if (Array.isArray(tags)) {
    return new Map(tags.map((tag) => [tag.name, tag.value]))
  }
  return new Map(Object.entries(tags))
}

export function parseResendTrackingTags(tags: ResendTrackingTagsInput): {
  teamId: string | null
  category: EmailLogCategory | null
  sourceType: string | null
  sourceId: string | null
} {
  const map = toResendTagMap(tags)
  const category = map.get("category")

  const validCategories = new Set([
    "campaign",
    "meeting_invite",
    "schedule_notification",
    "transactional",
    "other",
  ])

  const teamId = map.get("team_id") ?? map.get("teamId") ?? null
  const legacyCampaignId = map.get("campaignId") ?? null
  const sourceType =
    map.get("source_type") ?? map.get("sourceType") ?? (legacyCampaignId ? "campaign" : null)
  const sourceId = map.get("source_id") ?? map.get("sourceId") ?? legacyCampaignId ?? null
  const resolvedCategory =
    category && validCategories.has(category)
      ? (category as EmailLogCategory)
      : legacyCampaignId || sourceType === "campaign"
        ? "campaign"
        : null

  return {
    teamId,
    category: resolvedCategory,
    sourceType,
    sourceId,
  }
}

export function mergeResendTrackingTags(
  ...sources: ResendTrackingTagsInput[]
): Array<{ name: string; value: string }> {
  const map = new Map<string, string>()

  for (const source of sources) {
    for (const [name, value] of toResendTagMap(source)) {
      map.set(name, value)
    }
  }

  return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
}
