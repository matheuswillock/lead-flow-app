"use client"

import { UserPlus, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useWhatsAppInboxContext } from '../context/WhatsAppInboxContext'
import type { WhatsAppConversation } from '../context/WhatsAppInboxTypes'

interface AssignmentControlProps {
  selectedConversation: WhatsAppConversation
}

export function AssignmentControl({ selectedConversation }: AssignmentControlProps) {
  const {
    assignConversation,
    teamMembers,
    isLoadingTeamMembers,
    loadTeamMembers,
    isAssigning,
    canManageAssignment,
    currentProfileId,
  } = useWhatsAppInboxContext()

  const assignedToMe = selectedConversation.assignedProfileId === currentProfileId
  const assignedMember = teamMembers.find((m) => m.id === selectedConversation.assignedProfileId)

  const assignedLabel = selectedConversation.assignedProfileId
    ? assignedToMe
      ? 'Você'
      : (assignedMember?.name ?? 'Atribuída')
    : 'Sem responsável'

  // Operador sem responsável atribuído: botão de auto-atribuição
  if (!canManageAssignment && selectedConversation.assignedProfileId === null) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs"
        onClick={() => {
          if (currentProfileId) {
            assignConversation(selectedConversation.id, currentProfileId)
          }
        }}
        disabled={isAssigning || !currentProfileId}
      >
        <UserPlus className="size-3.5" />
        Assumir conversa
      </Button>
    )
  }

  // Operador com responsável atribuído: visualização apenas
  if (!canManageAssignment) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <User className="size-3.5" />
        {assignedLabel}
      </span>
    )
  }

  // Manager/Master: popover para escolher responsável
  return (
    <Popover onOpenChange={(open) => { if (open) loadTeamMembers() }}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" disabled={isAssigning}>
          <UserPlus className="size-3.5" />
          {assignedLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1">
        {isLoadingTeamMembers ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">Carregando membros...</p>
        ) : teamMembers.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">Nenhum membro encontrado</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {teamMembers.map((member) => (
              <button
                key={member.id}
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50"
                disabled={isAssigning}
                onClick={() => assignConversation(selectedConversation.id, member.id)}
              >
                <span className="flex-1 truncate">{member.name}</span>
                {member.id === selectedConversation.assignedProfileId && (
                  <Badge variant="default" className="h-4 px-1 text-[10px]">atual</Badge>
                )}
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
