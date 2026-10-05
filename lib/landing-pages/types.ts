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
  templateConfig?: LandingTemplateConfig
}

export type LandingTemplateSlug = "cotacao-corretor-studio" | "black-and-white" | "alvora"

export type LandingTemplateConfig = {
  templateSlug: Exclude<LandingTemplateSlug, "cotacao-corretor-studio">
  identity: {
    tradeName: string
    legalName?: string
    cnpj?: string
    logoUrl?: string | null
    copyright?: string
  }
  contact: {
    phoneDisplay?: string
    phoneE164?: string
    whatsappE164?: string
    whatsappMessage?: string
    email?: string
  }
  seo?: { title?: string; description?: string; canonical?: string; socialImageUrl?: string | null }
  hero?: {
    eyebrow?: string
    title?: string
    description?: string
    primaryCta?: string
    secondaryCta?: string
  }
  sections?: Record<
    string,
    {
      enabled?: boolean
      title?: string
      description?: string
      items?: Array<{
        title: string
        description?: string
        value?: string | number
        imageUrl?: string | null
      }>
    }
  >
  media?: Record<string, { url?: string | null; alt?: string }>
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
  formPublicationId?: string
  form: PublicFormSnapshot
}

export type LandingPageDraftInput = {
  name: string
  publicFormId: string
  templateSlug: string
  content: LandingPageContent
  offer: LandingPageOffer
}
