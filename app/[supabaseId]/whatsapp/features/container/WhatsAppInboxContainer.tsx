"use client"

import { useWhatsAppInboxContext } from '../context/WhatsAppInboxContext'
import { ConversationList } from '../components/ConversationList'
import { MessagePanel } from '../components/MessagePanel'
import { InboxSkeleton } from '../components/InboxSkeleton'
import { NoConfigState } from '../components/NoConfigState'

interface WhatsAppInboxContainerProps {
  supabaseId: string
}

export function WhatsAppInboxContainer({ supabaseId }: WhatsAppInboxContainerProps) {
  const { config, isLoadingConfig } = useWhatsAppInboxContext()

  if (isLoadingConfig) {
    return <InboxSkeleton />
  }

  if (config !== null && config.status !== 'CONNECTED') {
    return <NoConfigState supabaseId={supabaseId} />
  }

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] overflow-hidden rounded-lg border border-border">
      <ConversationList />
      <MessagePanel />
    </div>
  )
}
