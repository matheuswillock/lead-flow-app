"use client"

import { useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { toastUserError } from "@/lib/ui/to-user-toast-message"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useWhatsAppInboxContext } from "../context/WhatsAppInboxContext"
import type { WhatsAppMessage } from "../context/WhatsAppInboxTypes"
import { whatsAppInboxService } from "../services/WhatsAppInboxService"
import { getConversationDisplayName } from "../utils/whatsappDisplay"

interface ForwardMessageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  message: WhatsAppMessage | null
}

export function ForwardMessageDialog({ open, onOpenChange, message }: ForwardMessageDialogProps) {
  const { conversations, selectedConversationId, activeTeamId, supabaseId } =
    useWhatsAppInboxContext()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [filter, setFilter] = useState("")
  const [isForwarding, setIsForwarding] = useState(false)
  const clientMessageIdsRef = useRef<Record<string, string>>({})

  const candidates = useMemo(() => {
    const term = filter.trim().toLowerCase()
    return conversations.filter((conversation) => {
      if (conversation.id === selectedConversationId) return false
      if (!term) return true
      const name = getConversationDisplayName({
        contactName: conversation.contactName,
        contactPhone: conversation.contactPhone,
        externalChatId: conversation.externalChatId,
      }).toLowerCase()
      return name.includes(term) || conversation.contactPhone.includes(term)
    })
  }, [conversations, filter, selectedConversationId])

  const toggleId = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const resetState = () => {
    setSelectedIds([])
    setFilter("")
    setIsForwarding(false)
    clientMessageIdsRef.current = {}
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      resetState()
    }
    onOpenChange(next)
  }

  const resolveClientMessageId = (conversationId: string) => {
    const existing = clientMessageIdsRef.current[conversationId]
    if (existing) return existing
    const created = crypto.randomUUID()
    clientMessageIdsRef.current[conversationId] = created
    return created
  }

  const handleForward = async () => {
    if (!message || !activeTeamId || selectedIds.length === 0 || isForwarding) return
    setIsForwarding(true)
    try {
      const result = await whatsAppInboxService.forwardMessage(
        activeTeamId,
        supabaseId,
        message.id,
        selectedIds.map((conversationId) => ({
          conversationId,
          clientMessageId: resolveClientMessageId(conversationId),
        }))
      )

      const failedIds = result.results.filter((item) => !item.ok).map((item) => item.conversationId)
      const successCount = result.results.filter((item) => item.ok).length

      if (failedIds.length === 0) {
        toast.success(
          selectedIds.length === 1
            ? "Mensagem encaminhada"
            : `Mensagem encaminhada para ${selectedIds.length} conversas`
        )
        handleOpenChange(false)
        return
      }

      if (successCount > 0) {
        toast.warning(
          `Encaminhado para ${successCount} conversa(s). ${failedIds.length} destino(s) falharam — tente novamente.`
        )
      } else {
        toast.error("Não foi possível encaminhar para os destinos selecionados.")
      }

      setSelectedIds(failedIds)
    } catch (error) {
      toastUserError(error)
    } finally {
      setIsForwarding(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col">
        <DialogHeader>
          <DialogTitle>Encaminhar mensagem</DialogTitle>
          <DialogDescription>Selecione uma ou mais conversas de destino.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-1 flex-col gap-3 overflow-hidden">
          <Input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filtrar conversas"
            aria-label="Filtrar conversas para encaminhar"
          />
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col gap-1">
              {candidates.length === 0 ? (
                <p className="px-1 py-4 text-sm text-muted-foreground">Nenhuma conversa disponível</p>
              ) : (
                candidates.map((conversation) => {
                  const label = getConversationDisplayName({
                    contactName: conversation.contactName,
                    contactPhone: conversation.contactPhone,
                    externalChatId: conversation.externalChatId,
                  })
                  const checked = selectedIds.includes(conversation.id)
                  return (
                    <label
                      key={conversation.id}
                      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleId(conversation.id)}
                        aria-label={`Selecionar ${label}`}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{label}</span>
                    </label>
                  )
                })
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={selectedIds.length === 0 || isForwarding}
            onClick={() => void handleForward()}
          >
            Encaminhar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
