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
import { maskPhone, unmask } from "@/lib/masks"
import { normalizeRadarPhone } from "@/lib/radar/normalization"
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
  const [createdConversationId, setCreatedConversationId] = useState<string | null>(null)

  const Icon = triggerIcon === "contact" ? UserPlus : MessageSquarePlus
  const phoneDigits = unmask(phone)
  const isValidPhone = phoneDigits.length >= 10 && phoneDigits.length <= 13
  const showPhoneError = phone.length > 0 && phoneDigits.length > 0 && !isValidPhone
  const canSubmit = isValidPhone && !isCreatingConversation
  const isContactMode = triggerIcon === "contact"

  const resetForm = () => {
    setPhone("")
    setContactName("")
    setCreatedConversationId(null)
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    const conversation = await createConversation({
      phone: normalizeRadarPhone(phoneDigits),
      contactName: contactName.trim() || undefined,
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
        <Button type="button" variant="outline" size="sm" className="min-h-11 flex-1">
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
                Conversa criada. O cadastro interno mantém o nome e o telefone; a sincronização com o celular é apenas enriquecimento.
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
                  className="min-h-11"
                  value={phone}
                  onChange={(e) => setPhone(maskPhone(e.target.value))}
                  autoFocus
                />
                {showPhoneError && (
                  <p className="text-sm text-destructive">
                    Número inválido. Informe DDD + telefone (10 ou 11 dígitos).
                  </p>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor="new-conversation-name">Nome do contato (opcional)</FieldLabel>
                <Input
                  id="new-conversation-name"
                  placeholder="Nome"
                  className="min-h-11"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                />
              </Field>
            </FieldGroup>
          )}
        </div>
        <DialogFooter>
          {createdConversationId ? (
            <Button type="button" variant="outline" className="min-h-11" onClick={() => handleOpenChange(false)}>
              Fechar
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => handleOpenChange(false)}
                disabled={isCreatingConversation}
              >
                Cancelar
              </Button>
              <Button type="button" className="min-h-11" onClick={() => void handleSubmit()} disabled={!canSubmit}>
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
