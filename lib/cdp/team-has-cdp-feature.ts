import { teamHasProductFeature } from "@/lib/billing/team-has-product-feature"
import { FEATURE_SLUGS } from "@/lib/features/feature-slugs"

export async function teamHasCdpFeature(teamId: string): Promise<boolean> {
  return teamHasProductFeature(teamId, "cdp", FEATURE_SLUGS.CDP)
}
