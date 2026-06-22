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

export function parseResendTrackingTags(
  tags: Array<{ name: string; value: string }> | null | undefined
): {
  teamId: string | null
  category: EmailLogCategory | null
  sourceType: string | null
  sourceId: string | null
} {
  const map = new Map((tags ?? []).map((tag) => [tag.name, tag.value]))
  const category = map.get("category")

  const validCategories = new Set([
    "campaign",
    "meeting_invite",
    "schedule_notification",
    "transactional",
    "other",
  ])

  return {
    teamId: map.get("team_id") ?? null,
    category:
      category && validCategories.has(category) ? (category as EmailLogCategory) : null,
    sourceType: map.get("source_type") ?? null,
    sourceId: map.get("source_id") ?? null,
  }
}
