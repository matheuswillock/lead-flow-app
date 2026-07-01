import { redirect } from "next/navigation"

type PageProps = {
  params: Promise<{ supabaseId: string }>
}

export default async function EmailAnalyticsRedirectPage({ params }: PageProps) {
  const { supabaseId } = await params
  redirect(`/${supabaseId}/email/campanhas`)
}
