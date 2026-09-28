import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { landingPageUseCase } from "@/app/api/useCases/landingPages/LandingPageUseCase"
import { isLandingPageServableOnHost } from "@/lib/landing-pages/landing-page-host-tenancy"
import { resolveLegacyPublicHostRedirect } from "@/lib/public-studio/team-studio-domain-tenancy"
import { serializePublicRedirectSearchParams, type PublicRedirectSearchParams } from "@/lib/public-studio/redirect-search-params"
import type { LandingPageSnapshot } from "@/lib/landing-pages/types"
import { LandingPageViewContext } from "./features/context/LandingPageViewContext"
import { LandingPageViewContainer } from "./features/container/LandingPageViewContainer"
import { PublicTrackingHead, type PublicTrackingScriptsValue } from "@/components/public-tracking/PublicTrackingScripts"

export const metadata = {
  robots: { index: false, follow: false },
}

export default async function ConversionLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ landingPageId: string }>
  searchParams: Promise<PublicRedirectSearchParams>
}) {
  const { landingPageId } = await params
  const resolvedSearchParams = await searchParams
  const headerList = await headers()
  const redirectBase = await resolveLegacyPublicHostRedirect({
    resource: "landing",
    publicId: landingPageId,
    hostHeader: headerList.get("host"),
  })
  if (redirectBase) redirect(`${redirectBase}/conversao/${landingPageId}${serializePublicRedirectSearchParams(resolvedSearchParams)}`)
  const isAllowed = await isLandingPageServableOnHost({
    landingPageId,
    hostHeader: headerList.get("host"),
  })
  if (!isAllowed) notFound()

  const output = await landingPageUseCase.getPublic(landingPageId)
  if (!output.isValid || !output.result) notFound()

  const result = output.result as { snapshot: LandingPageSnapshot; tracking?: PublicTrackingScriptsValue | null }
  return (
    <><head><PublicTrackingHead tracking={result.tracking ?? null} /></head><LandingPageViewContext><LandingPageViewContainer snapshot={result.snapshot} tracking={result.tracking} /></LandingPageViewContext></>
  )
}
