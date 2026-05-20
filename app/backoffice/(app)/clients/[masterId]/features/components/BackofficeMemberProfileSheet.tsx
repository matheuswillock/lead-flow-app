"use client"

import { useEffect, useRef, useState } from "react"
import { CircleCheckBig, CircleX } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useTimezone } from "@/app/context/TimezoneContext"
import { formatIntimezone } from "@/lib/dates"
import { maskPhone } from "@/lib/masks"
import type { BackofficeClientTeamMember } from "../context/BackofficeClientDetailsTypes"
import type { IBackofficeClientDetailsService } from "../services/IBackofficeClientDetailsService"

const ALL_SCOPES = [
  {
    scope: "https://www.googleapis.com/auth/calendar.events.freebusy",
    label: "Ver a disponibilidade nas agendas do Google a que você tem acesso",
  },
  {
    scope: "https://www.googleapis.com/auth/calendar.events",
    label: "Ver e editar eventos em todas as suas agendas",
  },
  {
    scope: "https://www.googleapis.com/auth/tasks",
    label: "Criar, editar, organizar e excluir todas as suas tarefas",
  },
  {
    scope: "profile",
    label: "Ver suas informações pessoais, inclusive aquelas que você disponibilizou publicamente",
  },
  {
    scope: "email",
    label: "Ver o endereço de e-mail principal da sua Conta do Google",
  },
  {
    scope: "openid",
    label: "Associar suas informações pessoais a você no Google",
  },
] as const

function getInitials(name: string | null, email: string) {
  const source = (name || email).trim()
  const parts = source.split(" ").filter(Boolean)
  if (parts.length === 0) return "BO"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

interface BackofficeMemberProfileSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  member: BackofficeClientTeamMember | null
  service: IBackofficeClientDetailsService
}

export function BackofficeMemberProfileSheet({
  open,
  onOpenChange,
  member,
  service,
}: BackofficeMemberProfileSheetProps) {
  const { tz } = useTimezone()
  const [grantedScopes, setGrantedScopes] = useState<string[]>([])
  const [isScopesLoading, setIsScopesLoading] = useState(false)
  const [scopesError, setScopesError] = useState<string | null>(null)
  const lastFetchedMemberId = useRef<string | null>(null)

  useEffect(() => {
    if (!open || !member || !member.googleCalendarConnected) {
      setGrantedScopes([])
      setScopesError(null)
      return
    }

    if (lastFetchedMemberId.current === member.id) return

    let stale = false
    setGrantedScopes([])
    setIsScopesLoading(true)
    setScopesError(null)

    service
      .getMemberGoogleScopes(member.id)
      .then((result) => {
        if (stale) return
        setGrantedScopes(result.scopes)
        lastFetchedMemberId.current = member.id
      })
      .catch(() => {
        if (stale) return
        setScopesError("Não foi possível carregar os escopos")
      })
      .finally(() => {
        if (!stale) setIsScopesLoading(false)
      })

    return () => {
      stale = true
    }
  }, [open, member?.id, member?.googleCalendarConnected, service])

  function handleOpenChange(next: boolean) {
    if (!next) {
      lastFetchedMemberId.current = null
      setGrantedScopes([])
      setScopesError(null)
    }
    onOpenChange(next)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-[420px] sm:w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="sr-only">Perfil do membro</SheetTitle>
        </SheetHeader>

        {!member ? null : (
          <div className="flex flex-col gap-6 py-4">
            {/* Header do perfil */}
            <div className="flex items-center gap-4">
              <Avatar className="size-14 rounded-full shrink-0">
                <AvatarFallback className="text-base">
                  {getInitials(member.fullName, member.email)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 space-y-1">
                <p className="font-semibold text-base leading-tight truncate">
                  {member.fullName || "Sem nome"}
                </p>
                <p className="text-sm text-muted-foreground truncate">{member.email}</p>
                <Badge variant="secondary">{member.role}</Badge>
              </div>
            </div>

            <Separator />

            {/* Informações do membro */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Informações
              </p>

              <div className="grid grid-cols-[140px_1fr] gap-y-2 text-sm">
                <span className="text-muted-foreground">Telefone</span>
                <span>{maskPhone(member.phone ?? "") || "—"}</span>

                <span className="text-muted-foreground">Funções</span>
                <span>
                  {member.functions.length > 0 ? member.functions.join(", ") : "—"}
                </span>

                <span className="text-muted-foreground">Membro desde</span>
                <span>{formatIntimezone(new Date(member.addedAt), "dd/MM/yyyy", tz)}</span>
              </div>
            </div>

            <Separator />

            {/* Conta Google */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Conta Google
              </p>

              {!member.googleCalendarConnected ? (
                <div className="flex items-center gap-2">
                  <CircleX className="size-4 text-destructive shrink-0" />
                  <span className="text-sm text-muted-foreground">Não conectada</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <CircleCheckBig className="size-4 text-green-500 shrink-0" />
                    <span className="text-sm font-medium">Conectada</span>
                  </div>

                  {member.googleEmail && (
                    <p className="text-sm text-muted-foreground">
                      Conta:{" "}
                      <span className="text-foreground font-medium">{member.googleEmail}</span>
                    </p>
                  )}

                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Permissões concedidas</p>

                    {isScopesLoading ? (
                      <div className="space-y-2">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <Skeleton key={i} className="h-5 w-full" />
                        ))}
                      </div>
                    ) : scopesError ? (
                      <p className="text-sm text-destructive">{scopesError}</p>
                    ) : (
                      <ul className="space-y-2">
                        {ALL_SCOPES.map(({ scope, label }) => {
                          const granted = grantedScopes.includes(scope)
                          return (
                            <li key={scope} className="flex items-start gap-2 text-sm">
                              {granted ? (
                                <CircleCheckBig className="size-4 text-green-500 mt-0.5 shrink-0" />
                              ) : (
                                <CircleX className="size-4 text-destructive mt-0.5 shrink-0" />
                              )}
                              <span className={granted ? "text-foreground" : "text-muted-foreground"}>
                                {label}
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
