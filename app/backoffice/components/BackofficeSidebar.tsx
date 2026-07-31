"use client"

import { useEffect, useState, type ComponentType } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  CreditCard,
  UserPlus,
  Kanban,
  Mail,
  Plug,
  CalendarDays,
  Tag,
  Zap,
  Building2,
  MessageCircle,
  Bot,
  ShieldBan,
  EllipsisVertical,
  ListChecks,
  ShieldCheck,
  Database,
  LogOut,
  UserRound,
  FileText,
  Megaphone,
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useBackofficeUser } from "@/app/backoffice/context/BackofficeUserContext"
import { createSupabaseBrowser } from "@/lib/supabase/browser"
import { cn } from "@/lib/utils"

type NavChild = {
  title: string
  url: string
  icon?: ComponentType<{ className?: string }>
  match?: (pathname: string) => boolean
}

type NavItem = {
  title: string
  url: string
  icon: ComponentType<{ className?: string }>
  match?: (pathname: string) => boolean
  children?: NavChild[]
}

const navigationItems: NavItem[] = [
  { title: "Dashboard", url: "/backoffice", icon: LayoutDashboard },
  { title: "CRM", url: "/backoffice/crm", icon: Kanban },
  { title: "Calendário", url: "/backoffice/calendar", icon: CalendarDays },
  {
    title: "Clientes",
    url: "/backoffice/clients",
    icon: Users,
    match: (pathname) =>
      pathname.startsWith("/backoffice/clients") || pathname.startsWith("/backoffice/anatemas"),
    children: [
      { title: "Clientes", url: "/backoffice/clients", match: (pathname) => pathname === "/backoffice/clients" },
      {
        title: "Todos os usuários",
        url: "/backoffice/clients/all-users",
        match: (pathname) => pathname.startsWith("/backoffice/clients/all-users"),
      },
      {
        title: "Anatemas",
        url: "/backoffice/anatemas",
        icon: ShieldBan,
        match: (pathname) => pathname.startsWith("/backoffice/anatemas"),
      },
      {
        title: "Patrocinadores",
        url: "/backoffice/clients/authorized-sponsors",
        match: (pathname) => pathname.startsWith("/backoffice/clients/authorized-sponsors"),
      },
      {
        title: "Acessos operacionais",
        url: "/backoffice/clients/operational-access",
        match: (pathname) => pathname.startsWith("/backoffice/clients/operational-access"),
      },
      {
        title: "Nova adesão",
        url: "/backoffice/clients/adhesions",
        match: (pathname) => pathname.startsWith("/backoffice/clients/adhesions"),
      },
    ],
  },
  { title: "Contratos", url: "/backoffice/contracts", icon: FileText },
  { title: "Pagamentos", url: "/backoffice/payments", icon: CreditCard },
  { title: "Precificação", url: "/backoffice/pricing", icon: Tag },
  {
    title: "Funcionalidades",
    url: "/backoffice/features",
    icon: Zap,
    match: (pathname) => pathname.startsWith("/backoffice/features"),
    children: [
      { title: "Funcionalidades", url: "/backoffice/features", match: (pathname) => pathname === "/backoffice/features" },
      {
        title: "Grupo Beta",
        url: "/backoffice/features/beta",
        match: (pathname) => pathname.startsWith("/backoffice/features/beta"),
      },
    ],
  },
  { title: "Integrações", url: "/backoffice/integracoes", icon: Plug },
  { title: "WhatsApp", url: "/backoffice/whatsapp", icon: MessageCircle },
  { title: "Bethânia", url: "/backoffice/studio-bot", icon: Bot },
  { title: "Templates de E-mail", url: "/backoffice/email-templates", icon: Mail },
  {
    title: "E-mails operacionais",
    url: "/backoffice/emails/campanhas",
    icon: Megaphone,
    match: (pathname) => pathname.startsWith("/backoffice/emails"),
    children: [
      {
        title: "Campanhas CS",
        url: "/backoffice/emails/campanhas",
        match: (pathname) => pathname === "/backoffice/emails/campanhas",
      },
      {
        title: "Contatos",
        url: "/backoffice/emails/contatos",
        match: (pathname) => pathname.startsWith("/backoffice/emails/contatos"),
      },
      {
        title: "Analytics",
        url: "/backoffice/emails/analytics",
        match: (pathname) => pathname.startsWith("/backoffice/emails/analytics"),
      },
      {
        title: "Limites por time",
        url: "/backoffice/emails/limites-por-time",
        match: (pathname) => pathname.startsWith("/backoffice/emails/limites-por-time"),
      },
    ],
  },
  { title: "Usuários", url: "/backoffice/users", icon: UserPlus },
  { title: "Operadoras", url: "/backoffice/health-plans", icon: Building2 },
  { title: "Regras de transição", url: "/backoffice/regras-transicao", icon: ListChecks },
  { title: "Aprovações", url: "/backoffice/approvals", icon: ShieldCheck },
  { title: "Backups", url: "/backoffice/backups", icon: Database },
]

function isItemActive(item: NavItem, pathname: string) {
  if (item.match) return item.match(pathname)
  if (item.url === "/backoffice") return pathname === "/backoffice"
  return pathname.startsWith(item.url)
}

function isChildActive(child: NavChild, pathname: string) {
  if (child.match) return child.match(pathname)
  return pathname === child.url || pathname.startsWith(`${child.url}/`)
}

function CollapsibleNavItem({ item, pathname }: { item: NavItem; pathname: string }) {
  const sectionActive = isItemActive(item, pathname)
  const [open, setOpen] = useState(sectionActive)

  useEffect(() => {
    if (sectionActive) setOpen(true)
  }, [sectionActive])

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton isActive={sectionActive}>
            <item.icon className="size-4" />
            <span>{item.title}</span>
            <ChevronRight
              className={cn(
                "ml-auto size-4 transition-transform",
                open && "rotate-90"
              )}
            />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {(item.children ?? []).map((child) => {
              const Icon = child.icon
              return (
                <SidebarMenuSubItem key={child.url}>
                  <SidebarMenuSubButton asChild isActive={isChildActive(child, pathname)}>
                    <Link href={child.url}>
                      {Icon ? <Icon className="size-4" /> : null}
                      <span>{child.title}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              )
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

export function BackofficeSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useBackofficeUser()
  const { isMobile } = useSidebar()

  const initials = user?.fullName
    ? user.fullName
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "BO"

  async function handleSignOut() {
    const supabase = createSupabaseBrowser()
    await supabase?.auth.signOut()
    router.push("/sign-in")
  }

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/backoffice">
                <div className="flex items-center gap-2">
                  <Image
                    src="/corretor-studio-icon.svg"
                    alt="Corretor Studio"
                    width={28}
                    height={28}
                    className="rounded"
                    onError={(e) => {
                      e.currentTarget.style.display = "none"
                    }}
                  />
                  <span className="font-semibold text-sm">Backoffice</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => {
                if (item.children?.length) {
                  return <CollapsibleNavItem key={item.title} item={item} pathname={pathname} />
                }

                const active = isItemActive(item, pathname)
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link href={item.url}>
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="size-8 rounded-lg">
                    <AvatarImage src={user?.profileIconUrl ?? undefined} alt={user?.fullName ?? "Backoffice"} />
                    <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user?.fullName ?? "Backoffice"}</span>
                    <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
                  </div>
                  <EllipsisVertical className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                side={isMobile ? "bottom" : "right"}
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="size-8 rounded-lg">
                      <AvatarImage src={user?.profileIconUrl ?? undefined} alt={user?.fullName ?? "Backoffice"} />
                      <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">{user?.fullName ?? "Backoffice"}</span>
                      <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/backoffice/account" className="cursor-pointer">
                    <UserRound className="size-4" />
                    Minha conta
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" onClick={handleSignOut}>
                  <LogOut className="size-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
