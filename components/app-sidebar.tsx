"use client"
import * as React from 'react'
import {
  IconChartBar,
  IconDashboard,
  IconFileAi,
  IconFolder,
  IconHelp,
  IconListDetails,
  IconReport,
  IconSearch,
  IconSettings,
  IconUsers,
  IconDatabase,
  IconInnerShadowTop,
} from '@tabler/icons-react'
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar'
import { NavMain } from './nav-main'
import { NavDocuments } from './nav-documents'
import { NavSecondary } from './nav-secondary'
import { NavUser } from './nav-user'
import Link from 'next/link'
import { useAuth } from '@/app/context/AuthContext'
import { useTheme } from 'next-themes'
import { useSidebar, SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Sun, Moon } from 'lucide-react'
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
const data = {
  navMain: [
    { title: 'Dashboard', url: '/dashboard', icon: IconDashboard },
    { title: 'Board', url: '/board', icon: IconListDetails },
    { title: 'Analytics', url: '/analytics', icon: IconChartBar },
    { title: 'Projects', url: '/projects', icon: IconFolder },
    { title: 'Team', url: '/team', icon: IconUsers },
  ],
  navSecondary: [
    { title: 'Settings', url: '/settings', icon: IconSettings },
    { title: 'Get Help', url: '/help', icon: IconHelp },
    { title: 'Search', url: '/search', icon: IconSearch },
  ],
  documents: [
    { name: 'Data Library', url: '/data-library', icon: IconDatabase },
    { name: 'Reports', url: '/reports', icon: IconReport },
    { name: 'Word Assistant', url: '/word-assistant', icon: IconFileAi },
  ],
}

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { user, loading } = useAuth()
  const { theme, setTheme } = useTheme()
  const { open, toggle } = useSidebar()
  const displayUser = user ? {
    name: user.email?.split('@')[0] || 'user',
    email: user.email || '',
    avatar: `https://avatar.vercel.sh/${encodeURIComponent(user.email || 'user')}.png`,
  } : {
    name: 'guest', email: 'guest@example.com', avatar: 'https://avatar.vercel.sh/guest.png'
  }
  return (
    <Sidebar collapsible="icon" className="transition-[width] duration-300 ease-in-out" {...props}>
      <SidebarHeader className="relative">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="data-[slot=sidebar-menu-button]:!p-1.5">
              <Link href="/dashboard" className="flex items-center gap-2">
                <IconInnerShadowTop className="size-5 transition-transform duration-300 group-data-[state=closed]/sidebar-wrapper:rotate-90" />
                <span className="text-base font-semibold">Lead Flow</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="absolute right-2 top-2 flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="size-7" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                  {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Tema</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarTrigger className="size-7" onClick={toggle} />
              </TooltipTrigger>
              <TooltipContent side="bottom">{open ? 'Colapsar' : 'Expandir'}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavDocuments items={data.documents} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={displayUser} loading={loading} />
      </SidebarFooter>
    </Sidebar>
  )
}
