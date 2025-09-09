"use client"

import { useState } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <Sidebar open={open} />
      <div className="flex w-full flex-col md:pl-60">
        <Topbar open={open} onToggle={() => setOpen(o => !o)} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
