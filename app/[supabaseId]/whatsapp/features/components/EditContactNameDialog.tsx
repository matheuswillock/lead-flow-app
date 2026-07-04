"use client"

import { useEffect, useState } from "react"
import { Loader2, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useWhatsAppInboxContext } from "../context/WhatsAppInboxContext"
import type { WhatsAppConversation } from "../context/WhatsAppInboxTypes"
import { getConversationDisplayName } from "../utils/whatsappDisplay"

interface EditContactNameDialogProps {
  conversation: WhatsAppConversation
}

export function EditContactNameDialog({ conversation }: EditContactNameDialogProps) {
  const { updateContactName, isUpdatingContactName } = useWhatsAppInboxContext()

  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")

  const defaultName = getConversationDisplayName({
    contactName: conversation.contactName,
    contactPhone: conversation.contactPhone,
    externalChatId: conversation.externalChatId,
  })

  const persistedName = conversation.contactName?.trim() ?? ""

  useEffect(() => {
    if (!open) return
    setName(persistedName)
  }, [open, persistedName])

  const trimmedName = name.trim()
  const canSubmit =
    trimmedName.length > 0 &&
    trimmedName !== persistedName &&
    !isUpdatingContactName

  const handleSubmit = async () => {
    if (!canSubmit) return
    try {
      await updateContactName(conversation.id, trimmedName)
      setOpen(false)
    } catch {
      // toast handled in context
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-muted-foreground"
          aria-label="Editar nome do contato"
        >
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar nome do contato</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto flex-1">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="contact-name">Nome</FieldLabel>
              <Input
                id="contact-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={defaultName}
                disabled={isUpdatingContactName}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && canSubmit) {
                    event.preventDefault()
                    void handleSubmit()
                  }
                }}
              />
            </Field>
          </FieldGroup>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isUpdatingContactName}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={!canSubmit}>
            {isUpdatingContactName ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
