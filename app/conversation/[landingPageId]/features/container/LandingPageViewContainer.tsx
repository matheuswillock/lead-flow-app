"use client"

import type { LandingPageSnapshot } from "@/lib/landing-pages/types"
import { LandingPageRenderer } from "@/components/landing-pages/LandingPageRenderer"

export function LandingPageViewContainer({ snapshot }: { snapshot: LandingPageSnapshot }) {
  return <LandingPageRenderer snapshot={snapshot} />
}
