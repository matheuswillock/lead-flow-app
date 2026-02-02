"use client"

import Link from "next/link"  
import { LayoutDashboard, KanbanSquare, ChartBarBig, Users, HeartPulse, CalendarDays, Users2 } from "lucide-react"

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

export function AppSidebar({ supabaseId, ...sidebarProps }: React.ComponentProps<typeof Sidebar> & { supabaseId?: string }) {
  const { user } = useUserContext();
  const { teams, activeTeamId, setActiveTeamId, isTeamMaster } = useTeamContext();
  const isMaster = user?.isMaster === true;
  const isManager = user?.role === "manager";

  const items = [
    { title: "Dashboard", url: `/${supabaseId}/dashboard`, icon: LayoutDashboard },
    { title: "Board", url: `/${supabaseId}/board`, icon: KanbanSquare },
    { title: "Pipeline", url: `/${supabaseId}/pipeline`, icon: ChartBarBig },
    { title: "Calendario", url: `/${supabaseId}/calendar`, icon: CalendarDays },
    { 
      title: "Manager Users", 
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
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
              <HeartPulse className="h-5 w-5 text-primary-foreground" />
            </div>
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
