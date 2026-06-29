"use client"

import { useState } from "react"
import { Loader2, MessageSquarePlus, RefreshCw, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { maskPhone, unmask } from "@/lib/masks"
import { normalizeCdpPhone } from "@/lib/cdp/normalization"
import { useWhatsAppInboxContext } from "../context/WhatsAppInboxContext"

type NewConversationDialogProps = {
  triggerLabel: string
  triggerIcon: "conversation" | "contact"
}

export function NewConversationDialog({ triggerLabel, triggerIcon }: NewConversationDialogProps) {
  const { createConversation, isCreatingConversation, syncPhoneContacts, isSyncingContacts } =
    useWhatsAppInboxContext()
  const [open, setOpen] = useState(false)
  const [phone, setPhone] = useState("")
  const [contactName, setContactName] = useState("")
  const [initialMessage, setInitialMessage] = useState("")
  const [createdConversationId, setCreatedConversationId] = useState<string | null>(null)

  const Icon = triggerIcon === "contact" ? UserPlus : MessageSquarePlus
  const phoneDigits = unmask(phone)
  const canSubmit = phoneDigits.length >= 10 && !isCreatingConversation
  const isContactMode = triggerIcon === "contact"

  const resetForm = () => {
    setPhone("")
    setContactName("")
    setInitialMessage("")
    setCreatedConversationId(null)
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    const conversation = await createConversation({
      phone: normalizeCdpPhone(phoneDigits),
      contactName: contactName.trim() || undefined,
      initialMessage: initialMessage.trim() || undefined,
    })
    if (isContactMode && conversation?.id && !contactName.trim()) {
      setCreatedConversationId(conversation.id)
      return
    }
    setOpen(false)
    resetForm()
  }

  const handleSyncContacts = async () => {
    if (!createdConversationId) return
    await syncPhoneContacts(createdConversationId)
    setOpen(false)
    resetForm()
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) resetForm()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="flex-1">
          <Icon data-icon="inline-start" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{triggerLabel}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-1 flex-col overflow-y-auto">
          {createdConversationId ? (
            <div className="flex flex-col gap-3 py-2">
              <p className="text-sm text-muted-foreground">
                Conversa criada. Sincronize com a agenda do celular para preencher o nome do contato.
              </p>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleSyncContacts()}
                disabled={isSyncingContacts}
              >
                {isSyncingContacts ? (
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                ) : (
                  <RefreshCw data-icon="inline-start" />
                )}
                Sincronizar com contatos do celular
              </Button>
            </div>
          ) : (
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor="new-conversation-phone">Telefone</FieldLabel>
                <Input
                  id="new-conversation-phone"
                  placeholder="(11) 99999-9999"
                  value={phone}
                  onChange={(e) => setPhone(maskPhone(e.target.value))}
                  autoFocus
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="new-conversation-name">Nome do contato (opcional)</FieldLabel>
                <Input
                  id="new-conversation-name"
                  placeholder="Nome"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="new-conversation-message">Mensagem inicial (opcional)</FieldLabel>
                <Textarea
                  id="new-conversation-message"
                  placeholder="Olá!"
                  value={initialMessage}
                  onChange={(e) => setInitialMessage(e.target.value)}
                  rows={3}
                />
              </Field>
            </FieldGroup>
          )}
        </div>
        <DialogFooter>
          {createdConversationId ? (
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Fechar
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isCreatingConversation}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={() => void handleSubmit()} disabled={!canSubmit}>
                {isCreatingConversation ? (
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                ) : null}
                {isCreatingConversation ? "Criando..." : "Criar"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
