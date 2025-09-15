import { cookies } from "next/headers"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { UserProvider } from "@/app/context/UserContext"

interface ProtectedLayoutProps {
  children: React.ReactNode
  params: Promise<{ supabaseId: string }>
}

export default async function ProtectedLayout({ children, params }: ProtectedLayoutProps) {
  const { supabaseId } = await params
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true"
  
  return (
    <UserProvider supabaseId={supabaseId}>
        <SidebarProvider
            defaultOpen={defaultOpen}
            style={
                {
                    "--sidebar-width": "16rem",
                    "--header-height": "3rem",
                } as React.CSSProperties
            }
        >
        <AppSidebar supabaseId={supabaseId} />
        <SidebarInset>
            <SiteHeader />
            <div className="flex min-h-0 flex-1 flex-col h-[calc(100dvh-var(--header-height))] overflow-auto">
                <div className="@container/main flex min-h-0 flex-1 flex-col gap-2">
                    {children}
                </div>
            </div>
        </SidebarInset>
    </SidebarProvider>
    </UserProvider>
  )
}
