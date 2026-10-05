import type { Metadata } from "next"
import type { LandingPageSnapshot } from "@/lib/landing-pages/types"

export function buildLandingPageMetadata(snapshot?: LandingPageSnapshot): Metadata {
  const brandName = snapshot?.content.templateConfig?.identity.tradeName || snapshot?.content.brandName || "Página de cotação"
  const description = snapshot?.content.templateConfig?.hero?.description || snapshot?.content.heroDescription || undefined
  return {
    title: brandName,
    description,
    icons: { icon: [] },
    robots: { index: false, follow: false },
    openGraph: { title: brandName, description, siteName: brandName, images: [] },
    twitter: { title: brandName, description, images: [] },
  }
}
