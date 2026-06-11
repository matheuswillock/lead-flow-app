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
  masterId,
  service,
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
      await service.deleteTeam(masterId, team!.id)
      toast.success("Time excluído com sucesso")
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir time")
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
          <AlertDialogTitle>Excluir time</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir o time <strong>{team.name}</strong>?
            {memberCount > 0 && (
              <>
                {" "}
                {memberCount === 1
                  ? "1 membro será desvinculado do time"
                  : `${memberCount} membros serão desvinculados do time`}{" "}
                (as contas não serão excluídas).
              </>
            )}
            {" "}Esta ação não pode ser desfeita.
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
            {isDeleting ? "Excluindo..." : "Excluir time"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
