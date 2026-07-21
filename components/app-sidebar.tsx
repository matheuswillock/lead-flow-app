"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"  
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Users2,
  Activity,
  LifeBuoy,
  Plug,
  ChevronDown,
  ChevronRight,
  Briefcase,
  FileText,
  BookUser,
  Send,
  ArrowRightLeft,
  Handshake,
  BarChart3,
  Calculator,
  PhoneCall,
  Settings,
  MessageCircle,
  Bot,
  Database,
  Zap,
  Mail,
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
import { useFeatureAccess } from "@/app/context/FeatureAccessContext"
import { useOperationalAccess } from "@/app/context/OperationalAccessContext"
import { TeamSwitcher } from "@/components/team-switcher"
import { SupportRequestDialog } from "@/components/support-request-dialog"
import { isTeamAllowedForIntegrations } from "@/lib/integrationsAccess"
import { useTeamPresence } from "@/hooks/useTeamPresence"
import { FEATURE_SLUGS } from "@/lib/features/feature-slugs"
import { useWhatsAppUnreadCount } from "@/hooks/useWhatsAppUnreadCount"

type SidebarItem = {
  title: string
  url: string
  icon: React.ComponentType<{ className?: string }>
  managerOnly?: boolean
  masterOnly?: boolean
  closerOrManager?: boolean
  sdrCloserOrManager?: boolean
  requiresIntegrationsAccess?: boolean
  requiresTransferRoutes?: boolean
  requiresAssociadosQueue?: boolean
  featureSlug?: string
  status?: "beta" | "comingSoon"
  unreadCount?: number
}

function getSidebarStatusBadge(status?: SidebarItem["status"]) {
  switch (status) {
    case "beta":
      return {
        label: "Beta",
        className: "bg-orange-500/15 text-orange-500",
      }
    case "comingSoon":
      return {
        label: "Em breve",
        className: "bg-orange-500/10 text-orange-500",
      }
    default:
      return null
  }
}

export function AppSidebar({ supabaseId, ...sidebarProps }: React.ComponentProps<typeof Sidebar> & { supabaseId?: string }) {
  const pathname = usePathname();
  const { user } = useUserContext();
  const { teams, activeTeamId, activeTeam, setActiveTeamId, isTeamMaster, activeRole, activeFunctions } = useTeamContext();
  const { hasAccess, showsBetaLabel } = useFeatureAccess();
  const { access: operationalAccess } = useOperationalAccess();
  const isManager = activeRole === "manager" || activeRole === "backoffice";
  const isCloser = activeFunctions.includes("CLOSER");
  const isSdr = activeFunctions.includes("SDR");
  const canAccessIntegrations = isTeamAllowedForIntegrations(activeTeam?.id);
  const teamActivityStorageKey = useMemo(
    () => `sidebar-team-activity-collapsed:${supabaseId ?? "anonymous"}:${activeTeamId ?? "no-team"}`,
    [supabaseId, activeTeamId]
  );
  const navStorageKey = useMemo(
    () => `sidebar-nav-collapsed:${supabaseId ?? "anonymous"}:${activeTeamId ?? "no-team"}`,
    [supabaseId, activeTeamId]
  );
  const emailStorageKey = useMemo(
    () => `sidebar-email-collapsed:${supabaseId ?? "anonymous"}:${activeTeamId ?? "no-team"}`,
    [supabaseId, activeTeamId]
  );
  const whatsAppStorageKey = useMemo(
    () => `sidebar-whatsapp-collapsed:${supabaseId ?? "anonymous"}:${activeTeamId ?? "no-team"}`,
    [supabaseId, activeTeamId]
  );
  const backofficeStorageKey = useMemo(
    () => `sidebar-backoffice-collapsed:${supabaseId ?? "anonymous"}:${activeTeamId ?? "no-team"}`,
    [supabaseId, activeTeamId]
  );
  const [isTeamActivityCollapsed, setIsTeamActivityCollapsed] = useState(false);
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [isEmailCollapsed, setIsEmailCollapsed] = useState(false);
  const [isWhatsAppCollapsed, setIsWhatsAppCollapsed] = useState(false);
  const [isBackofficeCollapsed, setIsBackofficeCollapsed] = useState(false);
  const { unreadMessages } = useWhatsAppUnreadCount({ enabled: hasAccess(FEATURE_SLUGS.WHATSAPP) });
  const docsUrl = `/${supabaseId}/docs`;

  const navigationItems: SidebarItem[] = [
    { title: "Dashboard", url: `/${supabaseId}/dashboard`, icon: LayoutDashboard, featureSlug: FEATURE_SLUGS.CRM_DASHBOARD },
    { title: "CRM", url: `/${supabaseId}/crm`, icon: Users, featureSlug: FEATURE_SLUGS.CRM },
    { title: "Transferências", url: `/${supabaseId}/lead-transfers`, icon: ArrowRightLeft, managerOnly: true, featureSlug: FEATURE_SLUGS.CRM_LEAD_TRANSFERS, requiresTransferRoutes: true },
    { title: "Calendario", url: `/${supabaseId}/calendar`, icon: CalendarDays, featureSlug: FEATURE_SLUGS.CRM_CALENDAR },
    { title: "Performance", url: `/${supabaseId}/performance`, icon: BarChart3, sdrCloserOrManager: true, featureSlug: FEATURE_SLUGS.CRM_PERFORMANCE },
    { title: "Simulador de Planos", url: `/${supabaseId}/pme-simulador`, icon: Calculator, sdrCloserOrManager: true, featureSlug: FEATURE_SLUGS.CRM_SIMULATOR },
    { title: "Formulários", url: `/${supabaseId}/forms`, icon: FileText, featureSlug: FEATURE_SLUGS.PUBLIC_FORMS },
    { title: "Carteira", url: `/${supabaseId}/carteira`, icon: Briefcase, managerOnly: true, featureSlug: FEATURE_SLUGS.CRM_WALLET },
    { title: "Discadora", url: `/${supabaseId}/dialer`, icon: PhoneCall, sdrCloserOrManager: true, featureSlug: FEATURE_SLUGS.VOICE },
    { title: "Automações", url: `/${supabaseId}/automations`, icon: Zap, managerOnly: true, featureSlug: FEATURE_SLUGS.CRM_AUTOMATIONS },
    { title: "Radar", url: `/${supabaseId}/radar`, icon: Database, managerOnly: true, featureSlug: FEATURE_SLUGS.RADAR },
  ];

  const emailItems: SidebarItem[] = [
    { title: "Templates", url: `/${supabaseId}/email/templates`, icon: FileText, managerOnly: true, featureSlug: FEATURE_SLUGS.EMAIL_TEMPLATES },
    { title: "Contatos", url: `/${supabaseId}/email/contatos`, icon: BookUser, managerOnly: true, featureSlug: FEATURE_SLUGS.EMAIL_CONTACTS },
    { title: "Campanhas", url: `/${supabaseId}/email/campanhas`, icon: Send, managerOnly: true, featureSlug: FEATURE_SLUGS.EMAIL_CAMPAIGNS },
    { title: "Descadastro", url: `/${supabaseId}/email/descadastro`, icon: Mail, managerOnly: true, featureSlug: FEATURE_SLUGS.EMAIL_UNSUBSCRIBE },
    { title: "Configurações", url: `/${supabaseId}/email/configuracoes`, icon: Settings, managerOnly: true, featureSlug: FEATURE_SLUGS.EMAIL_SETTINGS },
  ];

  const whatsAppItems: SidebarItem[] = [
    { title: "Inbox", url: `/${supabaseId}/whatsapp`, icon: MessageCircle, featureSlug: FEATURE_SLUGS.WHATSAPP, unreadCount: unreadMessages },
    { title: "Auto-respostas", url: `/${supabaseId}/whatsapp/auto-respostas`, icon: Bot, managerOnly: true, featureSlug: FEATURE_SLUGS.WHATSAPP_AUTO_RESPONSES },
    { title: "Configurações", url: `/${supabaseId}/whatsapp/configuracoes`, icon: Settings, managerOnly: true, featureSlug: FEATURE_SLUGS.WHATSAPP_SETTINGS },
  ];

  const backofficeItems: SidebarItem[] = [
    {
      title: "Associados",
      url: `/${supabaseId}/associados`,
      icon: Handshake,
      requiresAssociadosQueue: true,
    },
  ];

  const teamItems: SidebarItem[] = [
    {
      title: "Gerenciar Usuários",
      url: `/${supabaseId}/manager-users`,
      icon: Users,
      masterOnly: true,
      featureSlug: FEATURE_SLUGS.CRM_TIME_MANAGE_USERS,
    },
    {
      title: "Gerenciar Times",
      url: `/${supabaseId}/teams`,
      icon: Users2,
      masterOnly: true,
      featureSlug: FEATURE_SLUGS.CRM_TIME_MANAGE_TEAMS,
    },
  ];

  const { members: teamMembersWithPresence, isLoadingMembers } = useTeamPresence({
    activeTeamId,
    masterId: activeTeam?.masterId ?? user?.managerId ?? user?.id ?? null,
    supabaseId,
    currentProfileId: user?.id ?? null,
    enabled: Boolean(activeTeamId && supabaseId),
    isAssociateAccount: Boolean(activeTeam?.isAssociateAccount && activeTeam?.isOwnAccount),
    sponsorMasterId: activeTeam?.sponsorMasterId ?? null,
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
    if (item.managerOnly && !isManager && !isTeamMaster && !activeTeam?.canCreateAccountUsers) {
      return false;
    }
    if (item.masterOnly && !isTeamMaster && !activeTeam?.canManageAccountTeams) {
      return false;
    }
    if (item.closerOrManager && !isManager && !isTeamMaster && !isCloser) {
      return false;
    }
    if (item.sdrCloserOrManager && !isManager && !isTeamMaster && !isCloser && !isSdr) {
      return false;
    }
    if (item.requiresIntegrationsAccess && !canAccessIntegrations) {
      return false;
    }
    if (item.requiresTransferRoutes && !activeTeam?.hasTransferRoutes && !activeTeam?.canTransferAccountLeads) {
      return false;
    }
    if (item.requiresAssociadosQueue && !operationalAccess.associadosQueue) {
      return false;
    }
    if (item.featureSlug && !hasAccess(item.featureSlug)) {
      return false;
    }
    return true;
  };

  const isItemActive = (url: string) => pathname === url || pathname.startsWith(`${url}/`);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsTeamActivityCollapsed(window.localStorage.getItem(teamActivityStorageKey) === "true");
    setIsNavCollapsed(window.localStorage.getItem(navStorageKey) === "true");
    setIsEmailCollapsed(window.localStorage.getItem(emailStorageKey) === "true");
    setIsWhatsAppCollapsed(window.localStorage.getItem(whatsAppStorageKey) === "true");
    setIsBackofficeCollapsed(window.localStorage.getItem(backofficeStorageKey) === "true");
  }, [teamActivityStorageKey, navStorageKey, emailStorageKey, whatsAppStorageKey, backofficeStorageKey]);

  const toggleTeamActivityVisibility = () => {
    setIsTeamActivityCollapsed((previous) => {
      const next = !previous;
      if (typeof window !== "undefined") window.localStorage.setItem(teamActivityStorageKey, String(next));
      return next;
    });
  };

  const toggleNavVisibility = () => {
    setIsNavCollapsed((previous) => {
      const next = !previous;
      if (typeof window !== "undefined") window.localStorage.setItem(navStorageKey, String(next));
      return next;
    });
  };

  const toggleEmailVisibility = () => {
    setIsEmailCollapsed((previous) => {
      const next = !previous;
      if (typeof window !== "undefined") window.localStorage.setItem(emailStorageKey, String(next));
      return next;
    });
  };

  const toggleWhatsAppVisibility = () => {
    setIsWhatsAppCollapsed((previous) => {
      const next = !previous;
      if (typeof window !== "undefined") window.localStorage.setItem(whatsAppStorageKey, String(next));
      return next;
    });
  };

  const toggleBackofficeVisibility = () => {
    setIsBackofficeCollapsed((previous) => {
      const next = !previous;
      if (typeof window !== "undefined") window.localStorage.setItem(backofficeStorageKey, String(next));
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

  const getItemBadge = (item: SidebarItem) => {
    if (item.featureSlug && showsBetaLabel(item.featureSlug)) return getSidebarStatusBadge("beta")
    return getSidebarStatusBadge(item.status)
  }

  const visibleNavigationItems = navigationItems.filter(canShowItem)
  const visibleBackofficeItems = backofficeItems.filter(canShowItem)
  const visibleEmailItems = emailItems.filter(canShowItem)
  const visibleWhatsAppItems = whatsAppItems.filter(canShowItem)
  const visibleTeamItems = teamItems.filter(canShowItem)

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
                accountName: team.accountName,
                isOwnAccount: team.isOwnAccount,
                isAccessible: team.isAccessible,
                isAssociateAccount: team.isAssociateAccount,
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
            {visibleNavigationItems.length > 0 && (
            <SidebarGroup>
                <SidebarGroupLabel
                  className="cursor-pointer select-none hover:text-sidebar-foreground transition-colors"
                  onClick={toggleNavVisibility}
                >
                  <span className="flex items-center justify-between w-full">
                    Navegação
                    {isNavCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </span>
                </SidebarGroupLabel>
                {!isNavCollapsed && (
                  <SidebarGroupContent>
                      <SidebarMenu>
                          {visibleNavigationItems.map((item) => {
                            const statusBadge = getItemBadge(item);

                            return (
                              <SidebarMenuItem key={item.title}>
                                <SidebarMenuButton asChild isActive={isItemActive(item.url)}>
                                  <Link href={item.url} className="flex items-center justify-between gap-2">
                                    <span className="flex items-center gap-2">
                                      <item.icon className="size-4 shrink-0" />
                                      <span>{item.title}</span>
                                    </span>
                                    {statusBadge && (
                                      <span className={`shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-medium leading-none ${statusBadge.className}`}>
                                        {statusBadge.label}
                                      </span>
                                    )}
                                  </Link>
                                </SidebarMenuButton>
                              </SidebarMenuItem>
                            );
                          })}
                      </SidebarMenu>
                  </SidebarGroupContent>
                )}
            </SidebarGroup>
            )}
            {visibleBackofficeItems.length > 0 &&
              !(activeTeam?.isAssociateAccount && activeTeam?.isOwnAccount) && (
              <SidebarGroup>
                <SidebarGroupLabel
                  className="cursor-pointer select-none hover:text-sidebar-foreground transition-colors"
                  onClick={toggleBackofficeVisibility}
                >
                  <span className="flex items-center justify-between w-full">
                    Backoffice
                    {isBackofficeCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </span>
                </SidebarGroupLabel>
                {!isBackofficeCollapsed && (
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {visibleBackofficeItems.map((item) => {
                        const statusBadge = getItemBadge(item);

                        return (
                          <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton asChild isActive={isItemActive(item.url)}>
                              <Link href={item.url} className="flex items-center justify-between gap-2">
                                <span className="flex items-center gap-2">
                                  <item.icon className="size-4 shrink-0" />
                                  <span>{item.title}</span>
                                </span>
                                {statusBadge && (
                                  <span className={`shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-medium leading-none ${statusBadge.className}`}>
                                    {statusBadge.label}
                                  </span>
                                )}
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                )}
              </SidebarGroup>
            )}
            {(isManager || isTeamMaster || isCloser) &&
              hasAccess(FEATURE_SLUGS.EMAIL) &&
              visibleEmailItems.length > 0 && (
              <SidebarGroup>
                <SidebarGroupLabel
                  className="cursor-pointer select-none hover:text-sidebar-foreground transition-colors"
                  onClick={toggleEmailVisibility}
                >
                  <span className="flex items-center justify-between w-full">
                    Email
                    {isEmailCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </span>
                </SidebarGroupLabel>
                {!isEmailCollapsed && (
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {visibleEmailItems.map((item) => {
                        const statusBadge = getItemBadge(item)
                        return (
                          <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton asChild isActive={isItemActive(item.url)}>
                              <Link href={item.url} className="flex items-center justify-between gap-2">
                                <span className="flex items-center gap-2">
                                  <item.icon className="size-4 shrink-0" />
                                  <span>{item.title}</span>
                                </span>
                                {statusBadge && (
                                  <span className={`shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-medium leading-none ${statusBadge.className}`}>
                                    {statusBadge.label}
                                  </span>
                                )}
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                )}
              </SidebarGroup>
            )}
            {hasAccess(FEATURE_SLUGS.WHATSAPP) && visibleWhatsAppItems.length > 0 && (
              <SidebarGroup>
                <SidebarGroupLabel
                  className="cursor-pointer select-none hover:text-sidebar-foreground transition-colors"
                  onClick={toggleWhatsAppVisibility}
                >
                  <span className="flex items-center justify-between w-full">
                    <span className="flex items-center gap-2">
                      WhatsApp
                      {isWhatsAppCollapsed && unreadMessages > 0 && (
                        <span className="flex min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 h-4 text-[10px] font-semibold leading-none text-destructive-foreground">
                          {unreadMessages > 99 ? "99+" : unreadMessages}
                        </span>
                      )}
                    </span>
                    {isWhatsAppCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </span>
                </SidebarGroupLabel>
                {!isWhatsAppCollapsed && (
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {visibleWhatsAppItems.map((item) => {
                        const statusBadge = getItemBadge(item)
                        const hasUnread = (item.unreadCount ?? 0) > 0
                        return (
                          <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton asChild isActive={isItemActive(item.url)}>
                              <Link href={item.url} className="flex items-center justify-between gap-2">
                                <span className="flex items-center gap-2">
                                  <item.icon className="size-4 shrink-0" />
                                  <span>{item.title}</span>
                                </span>
                                {hasUnread ? (
                                  <span className="flex min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 h-4 text-[10px] font-semibold leading-none text-destructive-foreground">
                                    {(item.unreadCount ?? 0) > 99 ? "99+" : item.unreadCount}
                                  </span>
                                ) : statusBadge ? (
                                  <span className={`shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-medium leading-none ${statusBadge.className}`}>
                                    {statusBadge.label}
                                  </span>
                                ) : null}
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        )
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                )}
              </SidebarGroup>
            )}
            {hasAccess(FEATURE_SLUGS.CONFIGURATION) && (
              <SidebarGroup>
                <SidebarGroupLabel>Integrações</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={isItemActive(`/${supabaseId}/integrations`)}>
                        <Link href={`/${supabaseId}/integrations`} className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2">
                            <Plug className="size-4 shrink-0" />
                            <span>Webhooks</span>
                          </span>
                          {showsBetaLabel(FEATURE_SLUGS.CONFIGURATION) && (() => {
                            const badge = getSidebarStatusBadge("beta")
                            return badge ? (
                              <span className={`shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-medium leading-none ${badge.className}`}>
                                {badge.label}
                              </span>
                            ) : null
                          })()}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
            <SidebarGroup>
              {visibleTeamItems.length > 0 && <SidebarGroupLabel>Time</SidebarGroupLabel>}
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleTeamItems.map((item) => {
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild isActive={isItemActive(item.url)}>
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
                <SidebarMenuButton asChild isActive={isItemActive(docsUrl)}>
                  <Link href={docsUrl}>
                    <FileText />
                    <span>Docs</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
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
