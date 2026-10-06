import type { LandingPageSnapshot } from "@/lib/landing-pages/types"
export async function resolveLegalSnapshot(landingPageId: string): Promise<LandingPageSnapshot | null> {
  const { landingPageUseCase } = await import("@/app/api/useCases/landingPages/LandingPageUseCase")
  const output = await landingPageUseCase.getPublic(landingPageId)
  return output.isValid ? (output.result as { snapshot: LandingPageSnapshot }).snapshot : null
}
