"use client"

import Link from "next/link"  
import { LayoutDashboard, KanbanSquare, ChartBarBig, Users } from "lucide-react"
import { Suspense } from "react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { NavUser } from "./nav-user"
import { useUserRole } from "@/hooks/useUserRole"
import { Skeleton } from "@/components/ui/skeleton"

function ManagerUserItem({ supabaseId }: { supabaseId?: string }) {
  const { isManager } = useUserRole();
  
  if (!isManager) return null;
  
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild>
        <Link href={`/${supabaseId}/manager-users`}>
          <Users />
          <span>Manager users</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function ManagerUserItemSkeleton() {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton disabled>
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-24" />
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar({ supabaseId, ...sidebarProps }: React.ComponentProps<typeof Sidebar> & { supabaseId?: string }) {
  const baseItems = [
    { title: "Dashboard", url: `/${supabaseId}/dashboard`, icon: LayoutDashboard },
    { title: "Board", url: `/${supabaseId}/board`, icon: KanbanSquare },
    { title: "Pipeline", url: `/${supabaseId}/pipeline`, icon: ChartBarBig },
  ];

  return (
    <Sidebar collapsible="offcanvas" {...sidebarProps}>
      <SidebarHeader>
        <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton
                    asChild
                    className="data-[slot=sidebar-menu-button]:!p-1.5"
                >
                    <a href="#">
                        <span
                            className="inline-block h-6 w-6 rounded-md"
                            style={{ background: "var(--primary)" }}
                            aria-hidden
                        />
                        <span className="text-base font-semibold">Lead flow</span>
                    </a>
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
  </SidebarHeader>
        <SidebarContent>
            <SidebarGroup>
                <SidebarGroupLabel>Navegação</SidebarGroupLabel>
                <SidebarGroupContent>
                    <SidebarMenu>
                        {baseItems.map((item) => (
                          <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton asChild>
                              <Link href={item.url}>
                                <item.icon />
                                <span>{item.title}</span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                        
                        <Suspense fallback={<ManagerUserItemSkeleton />}>
                          <ManagerUserItem supabaseId={supabaseId} />
                        </Suspense>
                    </SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
            <NavUser supabaseId={supabaseId} />
        </SidebarFooter>
    </Sidebar>
  )
}

export default AppSidebar
