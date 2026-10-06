import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { landingPageUseCase } from "@/app/api/useCases/landingPages/LandingPageUseCase"
import type { LandingPageSnapshot } from "@/lib/landing-pages/types"
import { PublicLegalDocument } from "@/components/landing-pages/PublicLegalDocument"

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function LegalPage({ params }: { params: Promise<{ landingPageId: string }> }) {
  const { landingPageId } = await params
  const output = await landingPageUseCase.getPublic(landingPageId)
  const snapshot = (output.result as { snapshot?: LandingPageSnapshot } | null)?.snapshot
  if (!output.isValid || !snapshot) notFound()
  return <PublicLegalDocument kind="privacidade" landingPageId={landingPageId} snapshot={snapshot} />
}
