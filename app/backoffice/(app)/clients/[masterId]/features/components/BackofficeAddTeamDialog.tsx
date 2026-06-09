"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { IBackofficeClientDetailsService } from "../services/IBackofficeClientDetailsService"

interface BackofficeAddTeamDialogProps {
  open: boolean
  masterId: string
  service: IBackofficeClientDetailsService
  onOpenChange: (open: boolean) => void
  onSaved?: () => Promise<void> | void
}

export function BackofficeAddTeamDialog({
  open,
  masterId,
  service,
  onOpenChange,
  onSaved,
}: BackofficeAddTeamDialogProps) {
  const [name, setName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handleOpenChange(next: boolean) {
    if (!next && isSubmitting) return
    if (!next) setName("")
    onOpenChange(next)
  }

  const canSubmit = name.trim().length >= 2 && !isSubmitting

  async function handleSubmit() {
    if (!canSubmit || isSubmitting) return
    setIsSubmitting(true)
    try {
      await service.addTeam(masterId, { name: name.trim() })
      toast.success("Time criado com sucesso")
      await onSaved?.()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar time")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar time</DialogTitle>
          <DialogDescription>
            O time será criado na conta do cliente e o usuário master será adicionado como gerente.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="add-team-name">Nome do time *</Label>
            <Input
              id="add-team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              placeholder="Ex.: Time de Vendas"
              required
            />
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={!canSubmit} onClick={handleSubmit}>
            {isSubmitting ? "Criando..." : "Criar time"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
