"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Mail, Shield, User } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { BackofficeClientDetails, BackofficeClientTeam } from "../context/BackofficeClientDetailsTypes"
import type { IBackofficeClientDetailsService } from "../services/IBackofficeClientDetailsService"

interface AffectedUser {
  id: string
  fullName: string | null
  email: string
  role: string
  isMaster: boolean
}

function buildAffectedUsers(
  masterEmail: string,
  masterName: string | null,
  masterId: string,
  teams: BackofficeClientTeam[]
): AffectedUser[] {
  const seen = new Set<string>()
  const users: AffectedUser[] = [
    {
      id: masterId,
      fullName: masterName,
      email: masterEmail,
      role: "manager",
      isMaster: true,
    },
  ]
  seen.add(masterId)

  for (const team of teams) {
    for (const member of team.members) {
      if (!seen.has(member.id)) {
        seen.add(member.id)
        users.push({
          id: member.id,
          fullName: member.fullName,
          email: member.email,
          role: member.role,
          isMaster: false,
        })
      }
    }
  }

  return users
}

function getRoleBadge(role: string, isMaster: boolean) {
  if (isMaster) {
    return <Badge variant="outline" className="border-semantic-warning-border bg-semantic-warning-surface text-semantic-warning shrink-0">Master</Badge>
  }
  if (role === "manager") {
    return <Badge variant="outline" className="border-semantic-info-border bg-semantic-info-surface text-semantic-info shrink-0">Manager</Badge>
  }
  return <Badge variant="secondary" className="shrink-0">Operador</Badge>
}

function getEmailNote(role: string, isMaster: boolean) {
  if (isMaster || role === "manager") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Mail className="h-3 w-3" />
        receberá e-mail
      </span>
    )
  }
  return null
}

interface BackofficeClientDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  masterId: string
  details: BackofficeClientDetails
  teams: BackofficeClientTeam[]
  service: IBackofficeClientDetailsService
}

export function BackofficeClientDeleteDialog({
  open,
  onOpenChange,
  masterId,
  details,
  teams,
  service,
}: BackofficeClientDeleteDialogProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const inFlight = useRef(false)

  const affectedUsers = buildAffectedUsers(details.email, details.fullName, details.id, teams)

  async function handleDelete() {
    if (inFlight.current) return

    inFlight.current = true
    setIsDeleting(true)

    try {
      await service.deleteClient(masterId)
      toast.success("Conta excluída com sucesso")
      onOpenChange(false)
      router.push("/backoffice/clients")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao excluir conta"
      toast.error(message)
      setIsDeleting(false)
      inFlight.current = false
    }
  }

  return (
    <Dialog open={open} onOpenChange={isDeleting ? undefined : onOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-130">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Atenção: Esta ação é irreversível
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 space-y-4 pr-1">
          <p className="text-sm text-muted-foreground">
            Ao excluir a conta de <strong className="text-foreground">{details.fullName || details.email}</strong>, as seguintes consequências ocorrerão:
          </p>

          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 space-y-2">
            <div className="flex items-start gap-2 text-sm text-destructive">
              <span className="mt-0.5">•</span>
              <span>Todos os times e dados do cliente serão deletados permanentemente</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-destructive">
              <span className="mt-0.5">•</span>
              <span>Os usuários abaixo perderão acesso à plataforma</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-destructive">
              <span className="mt-0.5">•</span>
              <span>Um e-mail de encerramento será enviado ao master e managers</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span>Usuários com acesso que serão afetados</span>
            </div>

            <div className="rounded-md border divide-y">
              {affectedUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{user.fullName || "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {getEmailNote(user.role, user.isMaster)}
                    {getRoleBadge(user.role, user.isMaster)}
                  </div>
                </div>
              ))}
              {affectedUsers.length === 0 && (
                <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                  Nenhum usuário vinculado
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="pt-4 mt-2 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Excluindo..." : "Excluir conta permanentemente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
