"use client"

import { useState } from "react"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

interface BanUserDialogProps {
  open: boolean
  isSubmitting: boolean
  isMaster: boolean
  userLabel: string
  onOpenChange: (open: boolean) => void
  onConfirm: (reason?: string | null) => Promise<void>
}

export function BanUserDialog({
  open,
  isSubmitting,
  isMaster,
  userLabel,
  onOpenChange,
  onConfirm,
}: BanUserDialogProps) {
  const [reason, setReason] = useState("")

  async function handleConfirm() {
    await onConfirm(reason.trim() || null)
    setReason("")
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSubmitting) {
          onOpenChange(nextOpen)
          if (!nextOpen) setReason("")
        }
      }}
    >
      <AlertDialogContent className="max-h-[90vh] flex flex-col">
        <AlertDialogHeader>
          <AlertDialogTitle>Banir usuário</AlertDialogTitle>
          <AlertDialogDescription>
            {isMaster
              ? `Todos os usuários vinculados à conta de ${userLabel} perderão acesso à plataforma, mas não serão banidos individualmente no Supabase.`
              : `O usuário ${userLabel} será banido no Supabase e perderá acesso à plataforma.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="overflow-y-auto flex-1">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="ban-reason">Motivo (opcional)</FieldLabel>
              <Textarea
                id="ban-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Descreva o motivo do banimento"
                rows={3}
              />
            </Field>
          </FieldGroup>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={isSubmitting}
            onClick={() => void handleConfirm()}
          >
            {isSubmitting ? "Banindo..." : "Confirmar banimento"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
