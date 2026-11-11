"use client"

import Image from "next/image"
import Link from "next/link"
import { useTransition } from "react"
import { Briefcase, LogOut, Users } from "lucide-react"
import { usePathname } from "next/navigation"
import { signout } from "@/app/actions/auth"
import { useTeamContext } from "@/app/context/TeamContext"
import { TeamSwitcher } from "@/components/team-switcher"
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
import { getReadOnlyNavItems } from "./accountAccessReadOnly"

const ICON_BY_TITLE: Record<string, React.ComponentType<{ className?: string }>> = {
  CRM: Users,
  Carteira: Briefcase,
}

type ReadOnlySidebarProps = {
  supabaseId: string
}

/** Barra lateral do modo somente leitura: só CRM e Carteira, troca de time e sair. */
export function ReadOnlySidebar({ supabaseId }: ReadOnlySidebarProps) {
  const pathname = usePathname()
  const [isSigningOut, startSignOut] = useTransition()
  const { teams, activeTeamId, activeTeam, activeRole, isTeamMaster, setActiveTeamId } = useTeamContext()
  const canSeeWallet =
    activeRole === "manager" ||
    activeRole === "backoffice" ||
    isTeamMaster ||
    Boolean(activeTeam?.canCreateAccountUsers)
  const items = getReadOnlyNavItems(supabaseId, canSeeWallet)

  return (
    <Sidebar collapsible="offcanvas">
      <div data-testid="read-only-sidebar" className="flex h-full flex-col">
        <SidebarHeader>
          <div className="flex flex-col items-start gap-3">
            <div className="flex items-center gap-2">
              <Image
                src="/corretor-studio-icon.svg"
                alt="Corretor Studio"
                width={32}
                height={32}
                className="size-8"
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
                  isPending: team.isPending,
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
                  const Icon = ICON_BY_TITLE[item.title] ?? Users
                  const isActive = pathname === item.url || pathname.startsWith(`${item.url}/`)

                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link href={item.url}>
                          <Icon className="size-4 shrink-0" />
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
              <SidebarMenuButton
                disabled={isSigningOut}
                onClick={() => {
                  startSignOut(() => {
                    void signout()
                  })
                }}
              >
                <LogOut />
                <span>{isSigningOut ? "Saindo..." : "Sair"}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </div>
    </Sidebar>
  )
}
