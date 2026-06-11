import { Suspense } from "react"
import { cookies } from "next/headers"
import { connection } from "next/server"
import { BackofficeUserProvider } from "@/app/backoffice/context/BackofficeUserContext"
import { BackofficeSidebarProvider } from "@/app/backoffice/components/BackofficeSidebarProvider"

interface BackofficeLayoutProps {
  children: React.ReactNode
}

export default async function BackofficeLayout({ children }: BackofficeLayoutProps) {
  await connection()

  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true"

  return (
    <BackofficeUserProvider>
      <BackofficeSidebarProvider defaultOpen={defaultOpen}>
        <Suspense fallback={null}>{children}</Suspense>
      </BackofficeSidebarProvider>
    </BackofficeUserProvider>
  )
}
