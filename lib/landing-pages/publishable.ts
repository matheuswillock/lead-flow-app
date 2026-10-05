import type { LandingTemplateConfig } from "./types"

type LandingTemplateSection = NonNullable<LandingTemplateConfig["sections"]>[string]
type LandingTemplateSectionItem = NonNullable<LandingTemplateSection["items"]>[number]

export function hasPublishableSection(section?: LandingTemplateSection): boolean {
  if (!section || section.enabled === false) return false

  const hasPublishableItems = section.items?.some(hasPublishableSectionItem) ?? false

  return Boolean(section.title?.trim() || section.description?.trim() || hasPublishableItems)
}

function hasPublishableSectionItem(item: LandingTemplateSectionItem): boolean {
  if (item.title.trim() || item.description?.trim() || item.imageUrl) return true

  if (typeof item.value === "number") return item.value !== 0

  return Boolean(item.value?.trim() && item.value.trim() !== "0")
}
