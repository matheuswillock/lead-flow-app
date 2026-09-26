import type { PublicFormSnapshot } from "@/lib/public-forms/types"

export type LandingPageContent = {
  brandName?: string
  logoUrl?: string | null
  heroEyebrow?: string
  heroTitle?: string
  heroDescription?: string
  processTitle?: string
  processDescription?: string
  processSteps?: Array<{ id: string; title: string; description: string }>
  testimonialsEnabled?: boolean
  footerText?: string
}

export type LandingPageOffer = {
  enabled: boolean
  badge: string
  percentage: number | null
  title: string
  items: string[]
  disclaimer: string
}

export type LandingPageSnapshot = {
  landingPageId: string
  publicId: string
  version: number
  publishedAt: string
  name: string
  templateSlug: string
  content: LandingPageContent
  offer: LandingPageOffer
  form: PublicFormSnapshot
}

export type LandingPageDraftInput = {
  name: string
  publicFormId: string
  templateSlug: string
  content: LandingPageContent
  offer: LandingPageOffer
}
