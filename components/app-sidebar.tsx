"use client"

import Link from "next/link"  
import Image from "next/image"
import { LayoutDashboard, KanbanSquare, Users, CalendarDays, Users2 } from "lucide-react"

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
import { useTeamContext } from "@/app/context/TeamContext"
import { TeamSwitcher } from "@/components/team-switcher"
import { isManagerLikeRole } from "@/lib/roles"

export function AppSidebar({ supabaseId, ...sidebarProps }: React.ComponentProps<typeof Sidebar> & { supabaseId?: string }) {
  const { user } = useUserContext();
  const { teams, activeTeamId, setActiveTeamId, isTeamMaster } = useTeamContext();
  const isMaster = user?.isMaster === true;
  const isManager = isManagerLikeRole(user?.role);

  const items = [
    { title: "Dashboard", url: `/${supabaseId}/dashboard`, icon: LayoutDashboard },
    { title: "CRM", url: `/${supabaseId}/crm`, icon: KanbanSquare },
    { title: "Calendario", url: `/${supabaseId}/calendar`, icon: CalendarDays },
    { 
      title: "Gerenciar Usuários", 
      url: `/${supabaseId}/manager-users`, 
      icon: Users,
      managerOnly: true
    },
    {
      title: "Gerenciar Times",
      url: `/${supabaseId}/teams`,
      icon: Users2,
      masterOnly: true
    },
  ];

  return (
    <Sidebar collapsible="offcanvas" {...sidebarProps}>
      <SidebarHeader>
        <div className="flex items-start justify-between flex-col gap-3">
          <div className="flex items-center gap-2">
            <Image
              src="/corretor-studio-icon.svg"
              alt="Corretor Studio"
              width={32}
              height={32}
              className="h-8 w-8"
              priority
            />
            <span className="text-base font-semibold">Corretor Studio</span>
          </div>
          {teams.length > 0 ? (
            <TeamSwitcher
              teams={teams.map((team) => ({
                id: team.id,
                name: team.name,
              }))}
              activeTeamId={activeTeamId}
              onChange={setActiveTeamId}
              variant="compact"
              inline
            />
          ) : null}
        </div>
      </SidebarHeader>
        <SidebarContent>
            <SidebarGroup>
                <SidebarGroupLabel>Navegação</SidebarGroupLabel>
                <SidebarGroupContent>
                    <SidebarMenu>
                        {items.map((item) => {
                          if (item.managerOnly && !isManager && !isMaster) {
                            return null;
                          }
                          if (item.masterOnly && !isTeamMaster) {
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
