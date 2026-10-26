import { redirect } from "next/navigation"
import { serializePublicRedirectSearchParams, type PublicRedirectSearchParams } from "@/lib/public-studio/redirect-search-params"

export const metadata = {
  robots: { index: false, follow: false },
}

export default async function LandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ landingPageId: string }>
  searchParams: Promise<PublicRedirectSearchParams>
}) {
  const { landingPageId } = await params
  const resolvedSearchParams = await searchParams
  redirect(`/conversao/${landingPageId}${serializePublicRedirectSearchParams(resolvedSearchParams)}`)
}
