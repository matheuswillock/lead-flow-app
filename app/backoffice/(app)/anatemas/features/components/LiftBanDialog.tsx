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

interface LiftBanDialogProps {
  open: boolean
  isSubmitting: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (liftReason?: string | null) => Promise<void>
}

export function LiftBanDialog({
  open,
  isSubmitting,
  onOpenChange,
  onConfirm,
}: LiftBanDialogProps) {
  const [liftReason, setLiftReason] = useState("")

  async function handleConfirm() {
    await onConfirm(liftReason.trim() || null)
    setLiftReason("")
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSubmitting) {
          onOpenChange(nextOpen)
          if (!nextOpen) setLiftReason("")
        }
      }}
    >
      <AlertDialogContent className="max-h-[90vh] flex flex-col">
        <AlertDialogHeader>
          <AlertDialogTitle>Desbanir usuário</AlertDialogTitle>
          <AlertDialogDescription>
            O acesso no Supabase será restaurado. Em banimentos de conta, os membros vinculados voltam a acessar a plataforma.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="overflow-y-auto flex-1">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="lift-reason">Motivo (opcional)</FieldLabel>
              <Textarea
                id="lift-reason"
                value={liftReason}
                onChange={(event) => setLiftReason(event.target.value)}
                placeholder="Descreva o motivo do desbanimento"
                rows={3}
              />
            </Field>
          </FieldGroup>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
          <Button type="button" disabled={isSubmitting} onClick={() => void handleConfirm()}>
            {isSubmitting ? "Desbanindo..." : "Confirmar desbanimento"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
