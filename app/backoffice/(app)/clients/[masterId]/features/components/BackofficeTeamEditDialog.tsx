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
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import type { IBackofficeClientDetailsService } from "../services/IBackofficeClientDetailsService"

interface BackofficeTeamEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  team: { id: string; name: string; transferRoutes: Array<{ teamId: string; teamName: string }> } | null
  allTeams: Array<{ id: string; name: string }>
  masterId: string
  service: IBackofficeClientDetailsService
  onSuccess: () => void
}

export function BackofficeTeamEditDialog({
  open,
  onOpenChange,
  team,
  allTeams,
  masterId,
  service,
  onSuccess,
}: BackofficeTeamEditDialogProps) {
  const [name, setName] = useState("")
  const [transferTargetTeamIds, setTransferTargetTeamIds] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inFlight = useRef(false)

  useEffect(() => {
    if (open && team) {
      setName(team.name)
      setTransferTargetTeamIds(team.transferRoutes.map((r) => r.teamId))
    }
  }, [open, team])

  if (!team) return null

  const otherTeams = allTeams.filter((t) => t.id !== team.id)
  const nameValid = name.trim().length >= 2
  const nameChanged = name.trim() !== team.name
  const transferRoutesChanged =
    JSON.stringify([...transferTargetTeamIds].sort()) !==
    JSON.stringify([...team.transferRoutes.map((r) => r.teamId)].sort())
  const hasChanges = (nameValid && nameChanged) || transferRoutesChanged

  function toggleTransferTarget(teamId: string) {
    setTransferTargetTeamIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    )
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!hasChanges || inFlight.current) return

    inFlight.current = true
    setIsSubmitting(true)

    try {
      await service.updateTeam(masterId, team!.id, {
        ...(nameValid && nameChanged ? { name: name.trim() } : {}),
        ...(transferRoutesChanged ? { transferTargetTeamIds } : {}),
      })
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
      <DialogContent className="sm:max-w-110 max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Editar time</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-y-auto flex-1">
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

          {otherTeams.length > 0 && (
            <>
              <Separator />
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-sm font-medium">Times que recebem transferência</p>
                  <p className="text-xs text-muted-foreground">
                    Leads deste time poderão ser transferidos para os times selecionados.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {otherTeams.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between rounded-md border border-input px-3 py-2.5"
                    >
                      <span className="text-sm">{t.name}</span>
                      <Switch
                        checked={transferTargetTeamIds.includes(t.id)}
                        onCheckedChange={() => toggleTransferTarget(t.id)}
                        disabled={isSubmitting}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <DialogFooter className="mt-auto">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!hasChanges || isSubmitting}>
              {isSubmitting ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
