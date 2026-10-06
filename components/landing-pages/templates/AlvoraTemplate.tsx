"use client"

import "./alvora.css"
import type { LandingPageSnapshot } from "@/lib/landing-pages/types"
import { PublicTrackingBody, type PublicTrackingScriptsValue } from "@/components/public-tracking/PublicTrackingScripts"
import AlvoraLanding from "../imported-sources/alvora-app/page"
import { LandingPageRenderer } from "../LandingPageRenderer"

export function AlvoraTemplate({ snapshot, tracking }: { snapshot: LandingPageSnapshot; tracking: PublicTrackingScriptsValue | null }) {
  const config = snapshot.content.templateConfig
  const brandName = config?.identity.tradeName ?? snapshot.content.brandName ?? "Corretora"
  const whatsappUrl = config?.contact.whatsappE164
    ? `https://wa.me/${config.contact.whatsappE164}${config.contact.whatsappMessage ? `?text=${encodeURIComponent(config.contact.whatsappMessage)}` : ""}`
    : "#contato"

  return (
    <>
      <PublicTrackingBody tracking={tracking} position="start" />
      <AlvoraLanding
        brandName={brandName}
        phoneDisplay={config?.contact.phoneDisplay}
        phoneE164={config?.contact.phoneE164}
        whatsappUrl={whatsappUrl}
        renderForm={() => (
          <LandingPageRenderer
            snapshot={{ ...snapshot, templateSlug: "cotacao-corretor-studio" }}
            formOnly
            formPresentation="alvora"
          />
        )}
      />
      <PublicTrackingBody tracking={tracking} position="end" />
    </>
  )
}
