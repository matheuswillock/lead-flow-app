import { cookies } from "next/headers"
import { BackofficeUserProvider } from "@/app/backoffice/context/BackofficeUserContext"
import { BackofficeSidebarProvider } from "@/app/backoffice/components/BackofficeSidebarProvider"

interface BackofficeLayoutProps {
  children: React.ReactNode
}

export default async function BackofficeLayout({ children }: BackofficeLayoutProps) {
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true"

  return (
    <BackofficeUserProvider>
      <BackofficeSidebarProvider defaultOpen={defaultOpen}>
        {children}
      </BackofficeSidebarProvider>
    </BackofficeUserProvider>
  )
}
