"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { IBackofficeClientDetailsService } from "../services/IBackofficeClientDetailsService"
import { API_CLIENT_BASE } from "@/lib/route-map";

interface BackofficeTeamDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  team: { id: string; name: string; membersCount: number } | null
  masterId: string
  service: IBackofficeClientDetailsService
  onSuccess: () => void
}

export function BackofficeTeamDeleteDialog({
  open,
  onOpenChange,
  team,
  onSuccess,
}: BackofficeTeamDeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const inFlight = useRef(false)

  if (!team) return null

  async function handleConfirm() {
    if (inFlight.current) return
    inFlight.current = true
    setIsDeleting(true)

    try {
      const response = await fetch(`${API_CLIENT_BASE}/backoffice/deletion-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "TEAM_DELETE",
          targetId: team!.id,
          reason: `Solicitação de exclusão do time ${team!.name}`,
        }),
      })
      const data = (await response.json()) as {
        isValid?: boolean
        errorMessages?: string[]
        successMessages?: string[]
      }
      if (!response.ok || !data.isValid) {
        throw new Error(data.errorMessages?.[0] ?? "Erro ao solicitar exclusão do time")
      }
      toast.success(
        data.successMessages?.[0] ?? "Solicitação criada — pendente de 2 aprovações"
      )
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao solicitar exclusão do time")
    } finally {
      setIsDeleting(false)
      inFlight.current = false
    }
  }

  const memberCount = team.membersCount

  return (
    <AlertDialog open={open} onOpenChange={isDeleting ? undefined : onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Solicitar exclusão do time</AlertDialogTitle>
          <AlertDialogDescription>
            Isso cria uma solicitação de soft-delete do time <strong>{team.name}</strong> e
            dos leads vinculados. Requer 2 aprovações.
            {memberCount > 0 && (
              <>
                {" "}
                {memberCount === 1
                  ? "1 membro permanecerá com a conta ativa"
                  : `${memberCount} membros permanecerão com as contas ativas`}
                .
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              void handleConfirm()
            }}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Solicitando..." : "Solicitar exclusão"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
