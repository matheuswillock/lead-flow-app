import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { landingPageUseCase } from "@/app/api/useCases/landingPages/LandingPageUseCase"
import { isLandingPageServableOnHost } from "@/lib/landing-pages/landing-page-host-tenancy"
import type { LandingPageSnapshot } from "@/lib/landing-pages/types"
import { LandingPageViewContext } from "./features/context/LandingPageViewContext"
import { LandingPageViewContainer } from "./features/container/LandingPageViewContainer"

export const metadata = {
  robots: { index: false, follow: false },
}

export default async function LandingPage({
  params,
}: {
  params: Promise<{ landingPageId: string }>
}) {
  const { landingPageId } = await params
  const headerList = await headers()
  const isAllowed = await isLandingPageServableOnHost({
    landingPageId,
    hostHeader: headerList.get("host"),
  })
  if (!isAllowed) notFound()

  const output = await landingPageUseCase.getPublic(landingPageId)
  if (!output.isValid || !output.result) notFound()

  const result = output.result as { snapshot: LandingPageSnapshot }
  return <LandingPageViewContext><LandingPageViewContainer snapshot={result.snapshot} /></LandingPageViewContext>
}
