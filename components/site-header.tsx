"use client"

import { usePathname } from 'next/navigation'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { ThemeToggle } from '@/components/theme-toggle'

export function SiteHeader() {
  const pathname = usePathname()
  const first = (pathname || '/').split('/').filter(Boolean)[0] || ''
  const titleMap: Record<string, string> = {
    dashboard: 'Dashboard',
    board: 'Board',
    pipeline: 'Pipeline',
    account: 'Account',
  }
  const currentTitle = titleMap[first] ?? 'Dashboard'
  return (
  <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b box-border transition-[height] ease-linear">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{currentTitle}</h1>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
