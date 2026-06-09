"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { IBackofficeClientDetailsService } from "../services/IBackofficeClientDetailsService"

interface BackofficeTeamEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  team: { id: string; name: string } | null
  masterId: string
  service: IBackofficeClientDetailsService
  onSuccess: () => void
}

export function BackofficeTeamEditDialog({
  open,
  onOpenChange,
  team,
  masterId,
  service,
  onSuccess,
}: BackofficeTeamEditDialogProps) {
  const [name, setName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inFlight = useRef(false)

  useEffect(() => {
    if (open && team) {
      setName(team.name)
    }
  }, [open, team])

  if (!team) return null

  const nameValid = name.trim().length >= 2
  const nameChanged = name.trim() !== team.name

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!nameValid || !nameChanged || inFlight.current) return

    inFlight.current = true
    setIsSubmitting(true)

    try {
      await service.updateTeam(masterId, team!.id, { name: name.trim() })
      toast.success("Time atualizado com sucesso")
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar time")
    } finally {
      setIsSubmitting(false)
      inFlight.current = false
    }
  }

  return (
    <Dialog open={open} onOpenChange={isSubmitting ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-110">
        <DialogHeader>
          <DialogTitle>Editar time</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="team-name">Nome do time</Label>
            <Input
              id="team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do time"
              disabled={isSubmitting}
              autoFocus
            />
            {name.length > 0 && !nameValid && (
              <p className="text-xs text-destructive">Mínimo de 2 caracteres</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!nameValid || !nameChanged || isSubmitting}>
              {isSubmitting ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
