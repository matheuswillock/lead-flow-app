"use client"

import Image from "next/image"
import Link from "next/link"
import { useTransition } from "react"
import { LogOut, MessageCircle, RefreshCw, ShieldAlert } from "lucide-react"
import type { AccountAccessRestrictionReason } from "@/app/api/shared/accountAccessDecision/types"
import { signout } from "@/app/actions/auth"
import { useOptionalTeamContext } from "@/app/context/TeamContext"
import { TeamSwitcher } from "@/components/team-switcher"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "@/components/ui/card"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { getAccessPausedCopy } from "./accountAccessPausedCopy"
import { getAccessPausedAction } from "./accountAccessRecovery"

export const SUBSCRIPTION_SUPPORT_WHATSAPP_URL =
  `https://wa.me/5511939534668?text=${encodeURIComponent("Olá! Minha conta do Corretor Studio está com o acesso pausado e preciso de orientação sobre os próximos passos.")}`

type AccountAccessPausedScreenProps = {
  reason?: AccountAccessRestrictionReason
  isBillingOwner?: boolean
  /** Página de reativação (pagamento da renovação); só aparece para o master. */
  reactivateHref?: string
}

export function AccountAccessPausedScreen({
  isBillingOwner = false,
  reason,
  reactivateHref,
}: AccountAccessPausedScreenProps) {
  const teamContext = useOptionalTeamContext()
  const [isSigningOut, startSignOut] = useTransition()
  // Só o master reativa pagando (pendente, suspenso ou cancelado). Banido e master com assinatura
  // indisponível não têm pagamento a fazer: falam com o time de assinaturas. Os demais só leem o aviso.
  const action = getAccessPausedAction(reason, isBillingOwner)
  const canReactivate = action === "payment" && Boolean(reactivateHref)
  const showSupport = action === "support" || (action === "payment" && !reactivateHref)
  const copy = getAccessPausedCopy(reason, isBillingOwner)
  const teams = teamContext?.teams ?? []

  return (
    <SidebarProvider
      defaultOpen
      style={{ "--sidebar-width": "16rem" } as React.CSSProperties}
    >
      <Sidebar collapsible="offcanvas">
        <div data-testid="restricted-access-sidebar" className="flex h-full flex-col">
          <SidebarHeader>
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
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Trocar de time</SidebarGroupLabel>
              <SidebarGroupContent>
                {teams.length > 0 && teamContext ? (
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
                    activeTeamId={teamContext.activeTeamId}
                    onChange={(teamId) => {
                      void teamContext.setActiveTeamId(teamId)
                    }}
                  />
                ) : (
                  <p className="px-2 text-sm text-sidebar-foreground/70">
                    Nenhum outro time disponível.
                  </p>
                )}
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
      <SidebarInset>
        <main className="flex min-h-dvh flex-1 flex-col bg-muted/30">
          <div className="flex h-12 items-center gap-2 border-b px-3 md:hidden">
            <SidebarTrigger aria-label="Abrir menu de acesso" />
            <span className="text-sm font-medium">Acesso pausado</span>
          </div>
          <div className="flex flex-1 items-center justify-center p-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ShieldAlert className="size-5 text-muted-foreground" />
                  <h1 className="leading-none font-semibold">Seu acesso está pausado</h1>
                </div>
                <CardDescription>{copy.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{copy.guidance}</p>
              </CardContent>
              {canReactivate || showSupport ? (
                <CardFooter>
                  {canReactivate ? (
                    <Button asChild className="h-11 w-full">
                      <Link href={reactivateHref ?? "#"}>
                        <RefreshCw data-icon="inline-start" aria-hidden />
                        Reativar assinatura
                      </Link>
                    </Button>
                  ) : (
                    // Banimento ou assinatura indisponível não se resolve pagando: só o atendimento libera.
                    <Button asChild className="h-11 w-full">
                      <a href={SUBSCRIPTION_SUPPORT_WHATSAPP_URL} target="_blank" rel="noreferrer">
                        <MessageCircle data-icon="inline-start" />
                        Falar com o time de assinaturas
                      </a>
                    </Button>
                  )}
                </CardFooter>
              ) : null}
            </Card>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
