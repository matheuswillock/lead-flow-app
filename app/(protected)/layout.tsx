"use client"

import * as React from 'react'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider style={{ ['--sidebar-width' as any]: '18rem' }}>
            <AppSidebar />
            <SidebarInset>
                <main className="flex flex-1 flex-col p-4 md:p-6">{children}</main>
            </SidebarInset>
        </SidebarProvider>
    )
}