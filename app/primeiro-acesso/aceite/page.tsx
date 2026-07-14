import { redirect } from "next/navigation"
import { AcceptanceProvider } from "./features/context/AcceptanceContext"
import { AcceptanceContainer } from "./features/container/AcceptanceContainer"

export default async function AcceptancePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  if (token) redirect(`/api/v1/backoffice/adhesions/acceptance/exchange?token=${encodeURIComponent(token)}`)
  return (
    <AcceptanceProvider>
      <AcceptanceContainer />
    </AcceptanceProvider>
  )
}

