"use client"

import type { ReactNode } from "react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { SiteHeader } from "@/components/site-header"
import { BackofficeSidebar } from "./BackofficeSidebar"
import { useBackofficeUser } from "@/app/backoffice/context/BackofficeUserContext"
import { GlobalLoading } from "@/components/global-loading"
import { PageBreadcrumbProvider } from "@/app/context/PageBreadcrumbContext"

interface BackofficeSidebarProviderProps {
  children: ReactNode
  defaultOpen: boolean
}

export function BackofficeSidebarProvider({ children, defaultOpen }: BackofficeSidebarProviderProps) {
  const { isLoading } = useBackofficeUser()

  if (isLoading) {
    return <GlobalLoading />
  }

  return (
    <PageBreadcrumbProvider>
      <SidebarProvider
        defaultOpen={defaultOpen}
        style={
          {
            "--sidebar-width": "16rem",
            "--header-height": "3rem",
          } as React.CSSProperties
        }
      >
        <a
          href="#backoffice-main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Pular para o conteúdo
        </a>
        <BackofficeSidebar />
        <SidebarInset>
          <SiteHeader />
          <div className="flex min-h-0 flex-1 flex-col h-[calc(100dvh-var(--header-height))] overflow-auto pt-3">
            <div
              id="backoffice-main-content"
              tabIndex={-1}
              className="@container/main flex min-h-0 flex-1 flex-col gap-2 outline-none"
            >
              {children}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </PageBreadcrumbProvider>
  )
}
