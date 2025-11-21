"use client"

import Link from "next/link"  
import { LayoutDashboard, KanbanSquare, ChartBarBig, Users } from "lucide-react"

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
import { useUserContext } from "@/app/context/UserContext"

export function AppSidebar({ supabaseId, ...sidebarProps }: React.ComponentProps<typeof Sidebar> & { supabaseId?: string }) {
  const { user } = useUserContext();
  const isManager = user?.role === 'manager';
  const isMaster = user?.isMaster === true;

  const items = [
    { title: "Dashboard", url: `/${supabaseId}/dashboard`, icon: LayoutDashboard },
    { title: "Board", url: `/${supabaseId}/board`, icon: KanbanSquare },
    { title: "Pipeline", url: `/${supabaseId}/pipeline`, icon: ChartBarBig },
    { 
      title: "Manager Users", 
      url: `/${supabaseId}/manager-users`, 
      icon: Users,
      masterOnly: true // Apenas masters podem gerenciar usuários
    },
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
                        <span className="text-base font-semibold">Corretor Studio</span>
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
                        {items.map((item) => {
                          // Se o item é apenas para masters e o usuário não é master, não renderizar
                          if (item.masterOnly && !isMaster) {
                            return null;
                          }

                          return (
                            <SidebarMenuItem key={item.title}>
                              <SidebarMenuButton asChild>
                                <Link href={item.url}>
                                  <item.icon />
                                  <span>{item.title}</span>
                                </Link>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          );
                        })}
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
