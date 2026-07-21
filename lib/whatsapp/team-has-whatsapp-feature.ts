import { teamHasProductFeature } from "@/lib/billing/team-has-product-feature"
import { FEATURE_SLUGS } from "@/lib/features/feature-slugs"

export async function teamHasWhatsAppFeature(teamId: string): Promise<boolean> {
  return teamHasProductFeature(teamId, "whatsapp", FEATURE_SLUGS.WHATSAPP)
}
