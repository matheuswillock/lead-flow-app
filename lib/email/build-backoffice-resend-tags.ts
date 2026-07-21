import type { BackofficeEmailDispatchCategory } from "@prisma/client"

export function buildBackofficeResendTags(input: {
  category: BackofficeEmailDispatchCategory
  sourceType?: string | null
  sourceId?: string | null
}): Array<{ name: string; value: string }> {
  const tags: Array<{ name: string; value: string }> = [
    { name: "module", value: "backoffice" },
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

export function buildBackofficeCampaignResendTags(input: {
  campaignId: string
  dispatchId: string
  contactId: string
}): Array<{ name: string; value: string }> {
  return [
    { name: "module", value: "backoffice" },
    { name: "category", value: "campaign" },
    { name: "source_type", value: "backoffice_email_campaign" },
    { name: "source_id", value: input.campaignId },
    { name: "dispatch_id", value: input.dispatchId },
    { name: "contact_id", value: input.contactId },
  ]
}

export function isBackofficeResendTags(
  tags?: Record<string, string> | Array<{ name: string; value: string }> | null
): boolean {
  if (!tags) return false
  if (Array.isArray(tags)) {
    return tags.some((tag) => tag.name === "module" && tag.value === "backoffice")
  }
  return tags.module === "backoffice"
}
