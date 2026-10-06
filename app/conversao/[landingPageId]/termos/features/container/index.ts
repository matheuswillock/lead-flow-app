import type { LandingPageSnapshot } from "@/lib/landing-pages/types"
import { PublicLegalDocument, type PublicLegalKind } from "@/components/landing-pages/PublicLegalDocument"
export function LegalPageContainer({ kind, landingPageId, snapshot }: { kind: PublicLegalKind; landingPageId: string; snapshot: LandingPageSnapshot }) {
  return <PublicLegalDocument kind={kind} landingPageId={landingPageId} snapshot={snapshot} />
}
