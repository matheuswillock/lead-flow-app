"use client"
import * as React from 'react'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { Topbar } from '@/components/layout/Topbar'

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
  <SidebarProvider style={{ ['--sidebar-width' as any]: '18rem' }}>
      <AppSidebar />
      <SidebarInset>
        <Topbar open={false} onToggle={() => {}} />
        <main className="flex flex-1 flex-col p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
