"use client"

import { useEffect, useState } from "react"
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { toUserToastMessage } from "@/lib/ui/to-user-toast-message"

interface BackofficeExternalPaymentDialogProps {
  open: boolean
  invoiceLabel: string | null
  isSubmitting: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (input: { reference: string; proofUrl: string | null }) => Promise<string>
}

export function BackofficeExternalPaymentDialog({
  open,
  invoiceLabel,
  isSubmitting,
  onOpenChange,
  onConfirm,
}: BackofficeExternalPaymentDialogProps) {
  const [reference, setReference] = useState("")
  const [proofUrl, setProofUrl] = useState("")

  useEffect(() => {
    if (open) {
      setReference("")
      setProofUrl("")
    }
  }, [open])

  async function handleSubmit() {
    if (isSubmitting) return

    const trimmedReference = reference.trim()
    if (!trimmedReference) {
      toast.error("Informe a referência do pagamento externo")
      return
    }

    const trimmedProofUrl = proofUrl.trim() || null
    if (trimmedProofUrl) {
      try {
        const parsed = new URL(trimmedProofUrl)
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          toast.error("Informe uma URL válida para o comprovante (http:// ou https://)")
          return
        }
      } catch {
        toast.error("Informe uma URL válida para o comprovante (http:// ou https://)")
        return
      }
    }

    try {
      const message = await onConfirm({
        reference: trimmedReference,
        proofUrl: trimmedProofUrl,
      })
      toast.success(message)
      onOpenChange(false)
    } catch (error) {
      toast.error(toUserToastMessage(error))
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isSubmitting) return
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="pr-6">Marcar como paga externamente</DialogTitle>
          <DialogDescription>
            Registre a baixa manual da fatura{invoiceLabel ? ` ${invoiceLabel}` : ""} paga fora do
            sistema. A cobrança aberta no provedor, quando aplicável, será cancelada antes da baixa.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="external-payment-reference">Referência *</FieldLabel>
              <Input
                id="external-payment-reference"
                placeholder="Ex.: PIX-2026-001 ou Recibo #42"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                disabled={isSubmitting}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="external-payment-proof-url">Comprovante (URL opcional)</FieldLabel>
              <Input
                id="external-payment-proof-url"
                type="url"
                placeholder="https://..."
                value={proofUrl}
                onChange={(event) => setProofUrl(event.target.value)}
                disabled={isSubmitting}
              />
            </Field>
          </FieldGroup>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            Voltar
          </Button>
          <Button
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              void handleSubmit()
            }}
          >
            {isSubmitting ? "Confirmando..." : "Confirmar pagamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
