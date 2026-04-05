"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"  
import Image from "next/image"
import {
  LayoutDashboard,
  KanbanSquare,
  Users,
  CalendarDays,
  Users2,
  Activity,
  LifeBuoy,
  Plug,
  ChevronDown,
  ChevronRight,
} from "lucide-react"

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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { NavUser } from "./nav-user"
import { useUserContext } from "@/app/context/UserContext"
import { useTeamContext } from "@/app/context/TeamContext"
import { TeamSwitcher } from "@/components/team-switcher"
import { isManagerLikeRole } from "@/lib/roles"
import { SupportRequestDialog } from "@/components/support-request-dialog"
import { isTeamAllowedForIntegrations } from "@/lib/integrationsAccess"
import { useTeamPresence } from "@/hooks/useTeamPresence"

type SidebarItem = {
  title: string
  url: string
  icon: React.ComponentType<{ className?: string }>
  managerOnly?: boolean
  masterOnly?: boolean
  requiresIntegrationsAccess?: boolean
}

export function AppSidebar({ supabaseId, ...sidebarProps }: React.ComponentProps<typeof Sidebar> & { supabaseId?: string }) {
  const { user } = useUserContext();
  const { teams, activeTeamId, activeTeam, setActiveTeamId, isTeamMaster } = useTeamContext();
  const isMaster = user?.isMaster === true;
  const isManager = isManagerLikeRole(user?.role);
  const canAccessIntegrations = isTeamAllowedForIntegrations(activeTeam?.id);
  const teamActivityStorageKey = useMemo(
    () => `sidebar-team-activity-collapsed:${supabaseId ?? "anonymous"}:${activeTeamId ?? "no-team"}`,
    [supabaseId, activeTeamId]
  );
  const [isTeamActivityCollapsed, setIsTeamActivityCollapsed] = useState(false);

  const navigationItems: SidebarItem[] = [
    { title: "Dashboard", url: `/${supabaseId}/dashboard`, icon: LayoutDashboard },
    { title: "CRM", url: `/${supabaseId}/crm`, icon: KanbanSquare },
    { title: "Calendario", url: `/${supabaseId}/calendar`, icon: CalendarDays },
    {
      title: "Integrações",
      url: `/${supabaseId}/integrations`,
      icon: Plug,
      managerOnly: true,
      requiresIntegrationsAccess: true
    },
  ];

  const teamItems: SidebarItem[] = [
    {
      title: "Gerenciar Usuários",
      url: `/${supabaseId}/manager-users`,
      icon: Users,
      managerOnly: true,
    },
    {
      title: "Gerenciar Times",
      url: `/${supabaseId}/teams`,
      icon: Users2,
      masterOnly: true,
    },
  ];

  const { members: teamMembersWithPresence, isLoadingMembers } = useTeamPresence({
    activeTeamId,
    masterId: activeTeam?.masterId ?? user?.managerId ?? user?.id ?? null,
    supabaseId,
    currentProfileId: user?.id ?? null,
    enabled: Boolean(activeTeamId && supabaseId),
  });

  const presenceVisualMap = {
    online: {
      label: "Online",
      textClassName: "text-emerald-400",
      dotClassName: "bg-emerald-400",
    },
    away: {
      label: "Ausente",
      textClassName: "text-amber-400",
      dotClassName: "bg-amber-400",
    },
    offline: {
      label: "Offline",
      textClassName: "text-sidebar-foreground/60",
      dotClassName: "bg-sidebar-foreground/40",
    },
  } as const;

  const canShowItem = (item: SidebarItem) => {
    if (item.managerOnly && !isManager && !isMaster) {
      return false;
    }
    if (item.masterOnly && !isTeamMaster) {
      return false;
    }
    if (item.requiresIntegrationsAccess && !canAccessIntegrations) {
      return false;
    }
    return true;
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const persistedValue = window.localStorage.getItem(teamActivityStorageKey);
    setIsTeamActivityCollapsed(persistedValue === "true");
  }, [teamActivityStorageKey]);

  const toggleTeamActivityVisibility = () => {
    setIsTeamActivityCollapsed((previous) => {
      const next = !previous;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(teamActivityStorageKey, String(next));
      }
      return next;
    });
  };

  const formatInitials = (fullName: string) =>
    fullName
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

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
                        {navigationItems.map((item) => {
                          if (!canShowItem(item)) {
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
            <SidebarGroup>
              <SidebarGroupLabel>Time</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {teamItems.map((item) => {
                    if (!canShowItem(item)) {
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

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={toggleTeamActivityVisibility}
                      aria-label={isTeamActivityCollapsed ? "Expandir atividade do time" : "Minimizar atividade do time"}
                      title={isTeamActivityCollapsed ? "Expandir atividade do time" : "Minimizar atividade do time"}
                    >
                      <Activity />
                      <span>Atividade do Time</span>
                      {isTeamActivityCollapsed ? (
                        <ChevronRight className="ml-auto h-4 w-4" />
                      ) : (
                        <ChevronDown className="ml-auto h-4 w-4" />
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>

                {!isTeamActivityCollapsed && (
                  <div className="mt-1">
                    <div className="activity-scrollbar h-56 space-y-1 overflow-y-auto pr-1">
                      {!activeTeamId && (
                        <p className="px-2 py-2 text-xs text-sidebar-foreground/60">
                          Selecione um time para visualizar a atividade.
                        </p>
                      )}

                      {activeTeamId && isLoadingMembers && (
                        <p className="px-2 py-2 text-xs text-sidebar-foreground/60">
                          Carregando atividade do time...
                        </p>
                      )}

                      {activeTeamId && !isLoadingMembers && teamMembersWithPresence.length === 0 && (
                        <p className="px-2 py-2 text-xs text-sidebar-foreground/60">
                          Nenhum membro encontrado neste time.
                        </p>
                      )}

                      {activeTeamId &&
                        !isLoadingMembers &&
                        teamMembersWithPresence.map((member) => {
                          const presenceVisual = presenceVisualMap[member.presenceStatus];

                          return (
                            <div
                              key={member.profileId}
                              className="flex items-center gap-2 rounded-md px-2 py-2 transition-colors hover:bg-sidebar-accent/80"
                            >
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={member.profileIconUrl ?? undefined} alt={member.name} />
                                <AvatarFallback className="text-[11px]">
                                  {formatInitials(member.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-medium">
                                  {member.name}
                                  {member.profileId === user?.id ? (
                                    <span className="ml-1 text-[11px] font-normal text-sidebar-foreground/60">(eu)</span>
                                  ) : null}
                                </p>
                                <div className="flex flex-wrap items-center gap-1">
                                  <span
                                    className={`inline-flex items-center gap-1 text-[11px] ${presenceVisual.textClassName}`}
                                  >
                                    <span
                                      className={`h-1.5 w-1.5 rounded-full ${presenceVisual.dotClassName}`}
                                      aria-hidden
                                    />
                                    {presenceVisual.label}
                                  </span>
                                  {member.functions.length > 0 ? (
                                    member.functions.map((functionName) => (
                                      <span
                                        key={`${member.profileId}-${functionName}`}
                                        className="rounded bg-sidebar-accent px-1.5 py-0.5 text-[10px] font-semibold text-sidebar-accent-foreground"
                                      >
                                        {functionName}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-[10px] text-sidebar-foreground/50">Sem função</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </SidebarGroupContent>
            </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <SupportRequestDialog
                  trigger={
                    <SidebarMenuButton>
                      <LifeBuoy />
                      <span>Suporte</span>
                    </SidebarMenuButton>
                  }
                />
              </SidebarMenuItem>
            </SidebarMenu>
            <NavUser supabaseId={supabaseId} />
        </SidebarFooter>
    </Sidebar>
  )
}

export default AppSidebar
