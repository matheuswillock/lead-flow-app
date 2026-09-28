import { redirect } from "next/navigation"

export const metadata = {
  robots: { index: false, follow: false },
}

export default async function LandingPage({
  params,
}: {
  params: Promise<{ landingPageId: string }>
}) {
  const { landingPageId } = await params
  redirect(`/conversao/${landingPageId}`)
}
