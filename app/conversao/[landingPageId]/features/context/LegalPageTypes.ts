import type { LandingPageSnapshot } from "@/lib/landing-pages/types"

export type LegalDocumentKind = "privacidade" | "cookies" | "termos"
export type LegalSection = { id: string; title: string; text: string; bullets?: string[] }
export type PublicLegalDocument = {
  kind: LegalDocumentKind
  snapshot: LandingPageSnapshot
  title: string
  description: string
  sections: LegalSection[]
  links: Record<LegalDocumentKind, string>
}
