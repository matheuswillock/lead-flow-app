import { teamHasProductFeature } from "@/lib/billing/team-has-product-feature"
import { FEATURE_SLUGS } from "@/lib/features/feature-slugs"

export async function teamHasRadarFeature(teamId: string): Promise<boolean> {
  return teamHasProductFeature(teamId, "radar", FEATURE_SLUGS.RADAR)
}
