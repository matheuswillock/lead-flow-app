"use client"

import Link from "next/link"
import { useState } from "react"
import { CalendarRange, CircleCheckBig, CircleX, Crown, ExternalLink, KeyRound, Mail, Send } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useTimezone } from "@/app/context/TimezoneContext"
import { formatIntimezone } from "@/lib/dates/formatters"
import { maskPhone } from "@/lib/masks"
import { toast } from "sonner"
import { useBackofficeAllUsers } from "../context/BackofficeAllUsersContext"

function getInitials(name: string | null, email: string) {
  const source = (name || email).trim()
  const parts = source.split(" ").filter(Boolean)
  if (parts.length === 0) return "U"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function RoleBadge({ role, isMaster }: { role: string; isMaster: boolean }) {
  if (isMaster) {
    return (
      <Badge
        variant="outline"
        className="border-semantic-warning-border bg-semantic-warning-surface text-semantic-warning"
      >
        <Crown className="size-3" />
        Master
      </Badge>
    )
  }
  if (role === "manager") {
    return (
      <Badge
        variant="outline"
        className="border-semantic-info-border bg-semantic-info-surface text-semantic-info"
      >
        Manager
      </Badge>
    )
  }
  return <Badge variant="secondary">Operador</Badge>
}

export function BackofficeAllUsersDetailSheet() {
  const { tz } = useTimezone()
  const {
    service,
    sheetOpen,
    isDetailLoading,
    detailError,
    selectedDetail,
    openUserSheet,
    closeUserSheet,
    openSchedulesDialog,
    openEmailDispatchesDialog,
  } = useBackofficeAllUsers()
  const [accessAction, setAccessAction] = useState<"invite" | "reset_password" | null>(null)

  async function handleSendAccessEmail(mode: "invite" | "reset_password") {
    if (!selectedDetail || accessAction) return

    setAccessAction(mode)
    try {
      const result = await service.sendAccessEmail(selectedDetail.id, mode)
      toast.success(
        mode === "invite"
          ? `Convite reenviado para ${result.email}.`
          : `Reset de senha enviado para ${result.email}.`
      )
      await openUserSheet(selectedDetail.id)
    } catch (error) {
      console.error("[BackofficeAllUsersDetailSheet][handleSendAccessEmail]", error)
      toast.error(error instanceof Error ? error.message : "Erro ao enviar e-mail de acesso.")
    } finally {
      setAccessAction(null)
    }
  }

  return (
    <Sheet open={sheetOpen} onOpenChange={(next) => (next ? null : closeUserSheet())}>
      <SheetContent className="w-[420px] sm:w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Detalhes do usuário</SheetTitle>
        </SheetHeader>

        {isDetailLoading ? (
          <div className="flex flex-col gap-4 py-4">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : detailError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {detailError}
          </div>
        ) : !selectedDetail ? null : (
          <div className="flex flex-col gap-6 py-4">
            <div className="flex items-center gap-4">
              <Avatar className="size-14 rounded-full shrink-0">
                <AvatarFallback className="text-base">
                  {getInitials(selectedDetail.fullName, selectedDetail.email)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 space-y-1">
                <p className="font-semibold text-base leading-tight truncate">
                  {selectedDetail.fullName || "Sem nome"}
                </p>
                <p className="text-sm text-muted-foreground truncate">{selectedDetail.email}</p>
                <RoleBadge role={selectedDetail.role} isMaster={selectedDetail.isMaster} />
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Informações
              </p>
              <div className="grid grid-cols-[140px_1fr] gap-y-2 text-sm">
                <span className="text-muted-foreground">Telefone</span>
                <span>{maskPhone(selectedDetail.phone ?? "") || "—"}</span>

                <span className="text-muted-foreground">Criado em</span>
                <span>{formatIntimezone(new Date(selectedDetail.createdAt), "dd/MM/yyyy", tz)}</span>

                <span className="text-muted-foreground">Master vinculado</span>
                <span>
                  {selectedDetail.isMaster ? (
                    "Este usuário é master"
                  ) : selectedDetail.master ? (
                    <Button asChild variant="link" className="h-auto p-0">
                      <Link
                        href={`/backoffice/clients/${selectedDetail.master.id}?name=${encodeURIComponent(selectedDetail.master.fullName || "Master")}&tab=teams`}
                      >
                        {selectedDetail.master.fullName || selectedDetail.master.id}
                        <ExternalLink className="size-3 ml-1" />
                      </Link>
                    </Button>
                  ) : (
                    "—"
                  )}
                </span>

                <span className="text-muted-foreground">Plano do master</span>
                <span>{selectedDetail.master ? selectedDetail.master.plan.label : "—"}</span>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Acesso à plataforma
              </p>
              <div className="grid grid-cols-[140px_1fr] gap-y-2 text-sm">
                <span className="text-muted-foreground">Primeiro acesso</span>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      selectedDetail.hasCompletedFirstAccess
                        ? "border-semantic-success-border bg-semantic-success-surface text-semantic-success"
                        : "border-semantic-warning-border bg-semantic-warning-surface text-semantic-warning"
                    }
                  >
                    {selectedDetail.hasCompletedFirstAccess
                      ? "Primeiro acesso concluído"
                      : "Convite pendente"}
                  </Badge>
                </div>

                <span className="text-muted-foreground">Último acesso</span>
                <span>
                  {selectedDetail.lastSignInAt
                    ? formatIntimezone(new Date(selectedDetail.lastSignInAt), "dd/MM/yyyy HH:mm", tz)
                    : "—"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    openSchedulesDialog({
                      id: selectedDetail.id,
                      fullName: selectedDetail.fullName,
                      email: selectedDetail.email,
                    })
                  }
                >
                  <CalendarRange data-icon="inline-start" />
                  Ver agendamentos
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    openEmailDispatchesDialog({
                      id: selectedDetail.id,
                      fullName: selectedDetail.fullName,
                      email: selectedDetail.email,
                    })
                  }
                >
                  <Send data-icon="inline-start" />
                  Ver e-mails disparados
                </Button>
                {selectedDetail.accessStatus === "pending_first_access" ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleSendAccessEmail("invite")}
                    disabled={accessAction !== null}
                  >
                    <Mail data-icon="inline-start" />
                    Reenviar convite
                  </Button>
                ) : null}
                {selectedDetail.accessStatus === "active" ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleSendAccessEmail("reset_password")}
                    disabled={accessAction !== null}
                  >
                    <KeyRound data-icon="inline-start" />
                    Enviar reset de senha
                  </Button>
                ) : null}
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Conta Google
              </p>
              {selectedDetail.googleCalendarConnected ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CircleCheckBig className="size-4 text-green-500" />
                    <span className="text-sm font-medium">Conectada</span>
                  </div>
                  {selectedDetail.googleEmail && (
                    <p className="text-sm text-muted-foreground pl-6">
                      {selectedDetail.googleEmail}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <CircleX className="size-4 text-destructive" />
                  <span className="text-sm text-muted-foreground">Não conectada</span>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Times ({selectedDetail.teams.length})
              </p>
              {selectedDetail.teams.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Este usuário não participa de nenhum time.
                </p>
              ) : (
                <ul className="space-y-2">
                  {selectedDetail.teams.map((team) => (
                    <li key={team.id} className="rounded-md border px-3 py-2">
                      <p className="text-sm font-medium">{team.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {team.membersCount} membro{team.membersCount === 1 ? "" : "s"} ·{" "}
                        Master: {team.masterFullName || "—"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
