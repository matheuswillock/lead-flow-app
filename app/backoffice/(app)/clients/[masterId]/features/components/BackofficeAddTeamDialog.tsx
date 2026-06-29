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
import { Switch } from "@/components/ui/switch"
import type { IBackofficeClientDetailsService } from "../services/IBackofficeClientDetailsService"

interface BackofficeAddTeamDialogProps {
  open: boolean
  masterId: string
  masterUserType?: { slug: "common" | "member_pro"; isExpired: boolean }
  service: IBackofficeClientDetailsService
  onOpenChange: (open: boolean) => void
  onSaved?: () => Promise<void> | void
}

function defaultGenerateCharge(
  userType?: { slug: "common" | "member_pro"; isExpired: boolean }
): boolean {
  return userType?.slug === "member_pro" && !userType.isExpired
}

export function BackofficeAddTeamDialog({
  open,
  masterId,
  masterUserType,
  service,
  onOpenChange,
  onSaved,
}: BackofficeAddTeamDialogProps) {
  const [name, setName] = useState("")
  const [generateCharge, setGenerateCharge] = useState(() => defaultGenerateCharge(masterUserType))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const showChargeToggle =
    masterUserType?.slug === "member_pro" && !masterUserType.isExpired

  function handleOpenChange(next: boolean) {
    if (!next && isSubmitting) return
    if (!next) {
      setName("")
      setGenerateCharge(defaultGenerateCharge(masterUserType))
    }
    onOpenChange(next)
  }

  const canSubmit = name.trim().length >= 2 && !isSubmitting

  async function handleSubmit() {
    if (!canSubmit || isSubmitting) return
    setIsSubmitting(true)
    try {
      const result = await service.addTeam(masterId, {
        name: name.trim(),
        generateCharge: showChargeToggle ? generateCharge : false,
      })

      if (result.kind === "pending_payment") {
        toast.success("Cobrança pendente criada. O time será criado após o pagamento.", {
          description: result.checkoutUrl,
          action: {
            label: "Copiar link",
            onClick: () => void navigator.clipboard.writeText(result.checkoutUrl),
          },
        })
      } else {
        toast.success("Time criado com sucesso")
      }
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

          {showChargeToggle ? (
            <div className="flex flex-col gap-2">
              <Label>Cobrança</Label>
              <div className="flex items-center justify-between rounded-md border border-input px-3 py-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">Gerar cobrança</span>
                  <span className="text-xs text-muted-foreground">
                    Quando desligado, o time é criado sem cobrar o master.
                  </span>
                </div>
                <Switch
                  checked={generateCharge}
                  onCheckedChange={setGenerateCharge}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          ) : null}
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
