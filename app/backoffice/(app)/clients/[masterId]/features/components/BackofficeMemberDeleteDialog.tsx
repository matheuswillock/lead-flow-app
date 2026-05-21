"use client"

import { useEffect, useRef, useState } from "react"
import { AlertTriangle, Eye, EyeOff, Mail } from "lucide-react"
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
import type { BackofficeClientTeamMember } from "../context/BackofficeClientDetailsTypes"
import type { IBackofficeClientDetailsService } from "../services/IBackofficeClientDetailsService"

interface BackofficeMemberDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  member: BackofficeClientTeamMember | null
  service: IBackofficeClientDetailsService
  onSuccess: () => void
}

export function BackofficeMemberDeleteDialog({
  open,
  onOpenChange,
  member,
  service,
  onSuccess,
}: BackofficeMemberDeleteDialogProps) {
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const inFlight = useRef(false)

  useEffect(() => {
    if (!open) {
      setPassword("")
      setShowPassword(false)
    }
  }, [open])

  if (!member) return null

  async function handleDelete() {
    if (!member || !password || inFlight.current) return

    inFlight.current = true
    setIsDeleting(true)

    try {
      await service.deleteMember(member.id, password)
      toast.success("Conta excluída com sucesso")
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir conta")
      setIsDeleting(false)
      inFlight.current = false
    }
  }

  return (
    <Dialog open={open} onOpenChange={isDeleting ? undefined : onOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Atenção: Esta ação é irreversível
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 space-y-4 pr-1">
          <p className="text-sm text-muted-foreground">
            Ao excluir a conta de{" "}
            <strong className="text-foreground">{member.fullName || member.email}</strong>,
            as seguintes consequências ocorrerão:
          </p>

          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 space-y-2">
            <div className="flex items-start gap-2 text-sm text-destructive">
              <span className="mt-0.5">•</span>
              <span>Todos os times deste cliente perderão este membro</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-destructive">
              <span className="mt-0.5">•</span>
              <span>Os leads atribuídos a este operador serão deletados</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-destructive">
              <span className="mt-0.5">•</span>
              <span>Assinaturas vinculadas no Asaas serão canceladas</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-destructive">
              <span className="mt-0.5">•</span>
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                Um e-mail de encerramento será enviado para{" "}
                <strong className="text-foreground">{member.email}</strong>
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="backoffice-admin-password" className="text-sm font-medium">
              Digite sua senha de backoffice para confirmar
            </Label>
            <div className="relative">
              <Input
                id="backoffice-admin-password"
                type={showPassword ? "text" : "password"}
                placeholder="Sua senha"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isDeleting}
                autoComplete="current-password"
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                disabled={isDeleting}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Usamos sua senha apenas para validar sua identidade antes da exclusão.
            </p>
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
            onClick={() => void handleDelete()}
            disabled={!password || isDeleting}
          >
            {isDeleting ? "Excluindo..." : "Excluir conta permanentemente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
