"use client"

import { useState } from "react"
import { LoaderCircle, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { isValidResendRecipientEmail } from "@/lib/email/is-valid-resend-recipient-email"

type SendDnsInstructionsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  domainName: string
  sending: boolean
  onSend: (recipientEmail: string) => Promise<boolean>
}

const INVALID_EMAIL_MESSAGE = "Informe um e-mail válido para receber as instruções"

/**
 * Envia as instruções de cadastro DNS para o responsável técnico pela
 * hospedagem (ex.: suporte da hospedagem ou TI do cliente). O conteúdo é
 * remontado no servidor a partir do domínio do time — daqui sai só o
 * destinatário.
 */
export function SendDnsInstructionsDialog({
  open,
  onOpenChange,
  domainName,
  sending,
  onSend,
}: SendDnsInstructionsDialogProps) {
  const [recipientEmailInput, setRecipientEmailInput] = useState("")
  const [validationError, setValidationError] = useState<string | null>(null)

  function closeAndReset(nextOpen: boolean) {
    if (!nextOpen) {
      setRecipientEmailInput("")
      setValidationError(null)
    }
    onOpenChange(nextOpen)
  }

  async function submitSendInstructions() {
    const validation = isValidResendRecipientEmail(recipientEmailInput)
    if (!validation.ok) {
      setValidationError(INVALID_EMAIL_MESSAGE)
      return
    }
    setValidationError(null)
    const sent = await onSend(validation.email)
    if (sent) closeAndReset(false)
  }

  return (
    <Dialog open={open} onOpenChange={closeAndReset}>
      <DialogContent className="max-h-[90vh] flex flex-col gap-0 p-0 sm:max-w-md">
        <DialogHeader className="shrink-0 border-b border-border/60 px-6 py-4">
          <DialogTitle>Enviar instruções por e-mail</DialogTitle>
          <DialogDescription>
            Quem receber ganha o passo a passo completo para cadastrar os registros DNS de{" "}
            <span className="font-mono text-xs">{domainName}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 px-6 py-4">
          <FieldGroup className="gap-5">
            <Field data-invalid={validationError ? true : undefined}>
              <FieldLabel htmlFor="dns-instructions-recipient-input">
                E-mail do responsável técnico
              </FieldLabel>
              <FieldContent>
                <Input
                  id="dns-instructions-recipient-input"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="Ex: suporte@hospedagem.com.br"
                  value={recipientEmailInput}
                  aria-invalid={validationError ? true : undefined}
                  onChange={(event) => {
                    setRecipientEmailInput(event.target.value)
                    if (validationError) setValidationError(null)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void submitSendInstructions()
                  }}
                  disabled={sending}
                />
                {validationError ? (
                  <FieldError>{validationError}</FieldError>
                ) : (
                  <FieldDescription>
                    Ex.: o suporte da hospedagem ou o TI responsável pelo domínio.
                  </FieldDescription>
                )}
              </FieldContent>
            </Field>
          </FieldGroup>
        </div>

        <DialogFooter className="shrink-0 border-t border-border/60 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            className="max-lg:h-11"
            onClick={() => closeAndReset(false)}
            disabled={sending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="max-lg:h-11"
            onClick={() => void submitSendInstructions()}
            disabled={sending || !recipientEmailInput.trim()}
          >
            {sending ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
            ) : (
              <Mail data-icon="inline-start" />
            )}
            Enviar instruções
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
