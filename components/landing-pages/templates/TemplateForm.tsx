"use client"

import { LandingPageRenderer } from "../LandingPageRenderer"
import type { LandingPageSnapshot } from "@/lib/landing-pages/types"

/** The legacy renderer owns the proven submission contract; templates reuse it for forms. */
export function TemplateForm({ snapshot }: { snapshot: LandingPageSnapshot }) {
  return <LandingPageRenderer snapshot={{ ...snapshot, templateSlug: "cotacao-corretor-studio" }} />
}
