"use client"

import { useState } from 'react'
import { Archive, ArchiveX, Bot, MoreVertical, Trash2, UserCheck, UserPlus } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useWhatsAppInboxContext } from '../context/WhatsAppInboxContext'
import type { WhatsAppConversation } from '../context/WhatsAppInboxTypes'
import { CreateLeadFromConversationDialog } from './CreateLeadFromConversationDialog'

interface ConversationActionsMenuProps {
  conversation: WhatsAppConversation
}

export function ConversationActionsMenu({ conversation }: ConversationActionsMenuProps) {
  const {
    archiveConversation,
    unarchiveConversation,
    deleteConversation,
    takeoverConversation,
    setHandoffMode,
    isArchiving,
    isDeleting,
    isChangingHandoff,
    isCreatingLead,
  } = useWhatsAppInboxContext()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [createLeadDialogOpen, setCreateLeadDialogOpen] = useState(false)

  const isBusy = isArchiving || isDeleting || isChangingHandoff || isCreatingLead
  const hasLinkedLead = conversation.leadId !== null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={isBusy} aria-label="Ações da conversa">
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {conversation.handoffMode === 'BOT' ? (
            <DropdownMenuItem
              onClick={() => takeoverConversation(conversation.id)}
              disabled={isBusy}
            >
              <UserCheck data-icon="inline-start" />
              Assumir conversa
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => setHandoffMode(conversation.id, 'BOT')}
              disabled={isBusy}
            >
              <Bot data-icon="inline-start" />
              Devolver ao bot
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {!hasLinkedLead && (
            <DropdownMenuItem
              onClick={() => setCreateLeadDialogOpen(true)}
              disabled={isBusy}
            >
              <UserPlus data-icon="inline-start" />
              Criar lead
            </DropdownMenuItem>
          )}
          {conversation.isArchived ? (
            <DropdownMenuItem
              onClick={() => unarchiveConversation(conversation.id)}
              disabled={isBusy}
            >
              <ArchiveX data-icon="inline-start" />
              Desarquivar
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => archiveConversation(conversation.id)}
              disabled={isBusy}
            >
              <Archive data-icon="inline-start" />
              Arquivar
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setDeleteDialogOpen(true)}
            disabled={isBusy}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 data-icon="inline-start" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateLeadFromConversationDialog
        conversation={conversation}
        open={createLeadDialogOpen}
        onOpenChange={setCreateLeadDialogOpen}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conversa</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A conversa e todas as mensagens serão excluídas permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setDeleteDialogOpen(false)
                deleteConversation(conversation.id)
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
