"use client"

import type { LandingPageSnapshot } from "@/lib/landing-pages/types"
import { LandingPageRenderer } from "@/components/landing-pages/LandingPageRenderer"
import type { PublicTrackingScriptsValue } from "@/components/public-tracking/PublicTrackingScripts"

export function LandingPageViewContainer({ snapshot, tracking = null }: { snapshot: LandingPageSnapshot; tracking?: PublicTrackingScriptsValue | null }) {
  return <LandingPageRenderer snapshot={snapshot} tracking={tracking} />
}
