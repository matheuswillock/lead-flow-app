"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, MessageSquarePlus, RefreshCw, Search, UserPlus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
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
import { unmask } from "@/lib/masks"
import { normalizeRadarPhone } from "@/lib/radar/normalization"
import { useWhatsAppInboxContext } from "../context/WhatsAppInboxContext"
import type { WhatsAppInboxSearchResult } from "../context/WhatsAppInboxTypes"

type NewConversationDialogProps = {
  triggerLabel: string
  triggerIcon: "conversation" | "contact"
}

export function NewConversationDialog({ triggerLabel, triggerIcon }: NewConversationDialogProps) {
  const { createConversation, isCreatingConversation, selectConversation, searchInbox, syncPhoneContacts, isSyncingContacts } =
    useWhatsAppInboxContext()
  const [open, setOpen] = useState(false)
  const [phone, setPhone] = useState("")
  const [contactName, setContactName] = useState("")
  const [createdConversationId, setCreatedConversationId] = useState<string | null>(null)
  const [searchResult, setSearchResult] = useState<WhatsAppInboxSearchResult>({ conversations: [], contacts: [], startNumber: null })
  const [isSearching, setIsSearching] = useState(false)
  const searchRequestRef = useRef(0)
  const searchAbortRef = useRef<AbortController | null>(null)

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
    setSearchResult({ conversations: [], contacts: [], startNumber: null })
  }

  useEffect(() => {
    const query = phone.trim()
    if (query.length < 2) {
      setSearchResult({ conversations: [], contacts: [], startNumber: null })
      return
    }
    searchAbortRef.current?.abort()
    const controller = new AbortController()
    searchAbortRef.current = controller
    const requestId = ++searchRequestRef.current
    const timeoutId = window.setTimeout(() => {
      setIsSearching(true)
      void searchInbox(query, controller.signal)
        .then((result) => {
          if (requestId === searchRequestRef.current) setSearchResult(result)
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return
          if (requestId === searchRequestRef.current) setSearchResult({ conversations: [], contacts: [], startNumber: null })
        })
        .finally(() => {
          if (requestId === searchRequestRef.current) setIsSearching(false)
        })
    }, 250)
    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [phone, searchInbox])

  const openConversation = (conversationId: string) => {
    selectConversation(conversationId)
    setOpen(false)
    resetForm()
  }

  const createFromContact = async (contactId: string) => {
    const conversation = await createConversation({ contactId })
    if (conversation) {
      setOpen(false)
      resetForm()
    }
  }

  const createFromNumber = async () => {
    if (!searchResult.startNumber) return
    const conversation = await createConversation({
      phone: searchResult.startNumber.normalizedPhone,
      contactName: contactName.trim() || undefined,
    })
    if (conversation) {
      setOpen(false)
      resetForm()
    }
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
                <FieldLabel htmlFor="new-conversation-phone">Buscar ou iniciar conversa</FieldLabel>
                <Input
                  id="new-conversation-phone"
                  placeholder="Nome ou telefone"
                  className="min-h-11"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoFocus
                />
                {showPhoneError && (
                  <p className="text-sm text-destructive">
                    Número inválido. Informe DDD + telefone (10 ou 11 dígitos).
                  </p>
                )}
                {isSearching ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Buscando…</p>
                ) : null}
              </Field>
              {searchResult.conversations.length > 0 ? (
                <Field>
                  <FieldLabel>Conversas</FieldLabel>
                  <div className="flex flex-col gap-1">
                    {searchResult.conversations.map((conversation) => (
                      <Button key={conversation.id} type="button" variant="ghost" className="min-h-11 justify-start" onClick={() => openConversation(conversation.id)}>
                        <Search data-icon="inline-start" />{conversation.contactName ?? conversation.contactPhone}
                      </Button>
                    ))}
                  </div>
                </Field>
              ) : null}
              {searchResult.contacts.length > 0 ? (
                <Field>
                  <FieldLabel>Contatos</FieldLabel>
                  <div className="flex flex-col gap-1">
                    {searchResult.contacts.map((contact) => (
                      <Button key={contact.id} type="button" variant="ghost" className="min-h-11 justify-between" onClick={() => contact.existingConversationId ? openConversation(contact.existingConversationId) : void createFromContact(contact.id)}>
                        <span className="truncate">{contact.name ?? contact.formattedPhone ?? "Contato sem nome"}</span>
                        {contact.syncState !== 'FRESH' ? <Badge variant="secondary">{contact.syncState === 'UNRESOLVED' ? 'Sem número' : contact.syncState}</Badge> : null}
                      </Button>
                    ))}
                  </div>
                </Field>
              ) : null}
              {searchResult.startNumber ? (
                <Button type="button" variant="secondary" className="min-h-11 justify-start" onClick={() => void createFromNumber()} disabled={isCreatingConversation}>
                  <MessageSquarePlus data-icon="inline-start" />Iniciar com {searchResult.startNumber.displayPhone}
                </Button>
              ) : null}
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
