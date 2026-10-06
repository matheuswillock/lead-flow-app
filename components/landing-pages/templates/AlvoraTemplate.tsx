"use client"

import "./alvora.css"
import { normalizeBrazilPhoneE164 } from "@/lib/masks"
import type { LandingPageSnapshot } from "@/lib/landing-pages/types"
import { PublicTrackingBody, type PublicTrackingScriptsValue } from "@/components/public-tracking/PublicTrackingScripts"
import AlvoraLanding from "../imported-sources/alvora-app/page"
import { LandingPageRenderer } from "../LandingPageRenderer"

export function AlvoraTemplate({ snapshot, tracking }: { snapshot: LandingPageSnapshot; tracking: PublicTrackingScriptsValue | null }) {
  const config = snapshot.content.templateConfig
  const brandName = config?.identity.tradeName ?? snapshot.content.brandName ?? "Corretora"
  const whatsappPhone = config?.contact.whatsappE164 ? normalizeBrazilPhoneE164(config.contact.whatsappE164) : ""
  const whatsappMessage = config?.contact.whatsappMessage?.trim() || "Olá, quero falar sobre o meu plano de saúde."
  const whatsappUrl = whatsappPhone
    ? `https://api.whatsapp.com/send/?phone=${whatsappPhone}&text=${encodeURIComponent(whatsappMessage)}&type=phone_number&app_absent=0`
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
