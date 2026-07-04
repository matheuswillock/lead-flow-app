"use client"

import { useEffect, useState } from "react"
import { Loader2, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { maskPhone, unmask } from "@/lib/masks"
import { useWhatsAppInboxContext } from "../context/WhatsAppInboxContext"
import type { WhatsAppConversation } from "../context/WhatsAppInboxTypes"
import { getConversationDisplayName } from "../utils/whatsappDisplay"

interface CreateLeadFromConversationDialogProps {
  conversation: WhatsAppConversation
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateLeadFromConversationDialog({
  conversation,
  open,
  onOpenChange,
}: CreateLeadFromConversationDialogProps) {
  const { createLeadFromConversation, isCreatingLead } = useWhatsAppInboxContext()

  const defaultName = getConversationDisplayName({
    contactName: conversation.contactName,
    contactPhone: conversation.contactPhone,
    externalChatId: conversation.externalChatId,
  })
  const defaultPhone = conversation.contactPhone

  const [name, setName] = useState(defaultName)
  const [phone, setPhone] = useState(defaultPhone ? maskPhone(unmask(defaultPhone)) : "")

  useEffect(() => {
    if (!open) return
    setName(defaultName)
    setPhone(defaultPhone ? maskPhone(unmask(defaultPhone)) : "")
  }, [open, defaultName, defaultPhone])

  const phoneDigits = unmask(phone)
  const isValidPhone = phoneDigits.length >= 10 && phoneDigits.length <= 13
  const isValidName = name.trim().length > 0
  const canSubmit = isValidName && isValidPhone && !isCreatingLead

  const handleSubmit = async () => {
    if (!canSubmit) return
    try {
      await createLeadFromConversation(conversation.id, {
        name: name.trim(),
        phone: phoneDigits,
      })
      onOpenChange(false)
    } catch {
      // toast já exibido no contexto
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar lead</DialogTitle>
        </DialogHeader>
        <div className="flex flex-1 flex-col overflow-y-auto">
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="create-lead-name">Nome</FieldLabel>
              <Input
                id="create-lead-name"
                placeholder="Nome do lead"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="create-lead-phone">Telefone</FieldLabel>
              <Input
                id="create-lead-phone"
                placeholder="(11) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(maskPhone(e.target.value))}
              />
              {!isValidPhone && phone.length > 0 && (
                <p className="text-sm text-destructive">
                  Número inválido. Informe DDD + telefone (10 ou 11 dígitos).
                </p>
              )}
            </Field>
          </FieldGroup>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCreatingLead}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={!canSubmit}>
            {isCreatingLead ? (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            ) : (
              <UserPlus data-icon="inline-start" />
            )}
            {isCreatingLead ? "Criando..." : "Criar lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
