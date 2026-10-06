"use client"

import "./black-and-white.css"
import type { LandingPageSnapshot } from "@/lib/landing-pages/types"
import { PublicTrackingBody, type PublicTrackingScriptsValue } from "@/components/public-tracking/PublicTrackingScripts"
import AnalysisLanding from "../imported-sources/black-and-white-components/analysis-landing"
import { LandingPageRenderer } from "../LandingPageRenderer"

export function BlackAndWhiteTemplate({ snapshot, tracking }: { snapshot: LandingPageSnapshot; tracking: PublicTrackingScriptsValue | null }) {
  const brandName = snapshot.content.templateConfig?.identity.tradeName ?? snapshot.content.brandName ?? "Sua marca"
  return (
    <>
      <PublicTrackingBody tracking={tracking} position="start" />
      <AnalysisLanding
        brandName={brandName} templateConfig={snapshot.content.templateConfig}
        renderForm={(compact) => (
          <LandingPageRenderer
            snapshot={{ ...snapshot, templateSlug: "cotacao-corretor-studio" }}
            formOnly
            formPresentation={compact ? "black-and-white-compact" : "black-and-white"}
          />
        )}
      />
      <PublicTrackingBody tracking={tracking} position="end" />
    </>
  )
}
