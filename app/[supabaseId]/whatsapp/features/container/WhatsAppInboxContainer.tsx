"use client"

import { Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useWhatsAppInboxContext } from '../context/WhatsAppInboxContext'
import { MessagingInboxLayout } from '@/components/messaging/MessagingInboxLayout'
import { ConversationList } from '../components/ConversationList'
import { MessagePanel } from '../components/MessagePanel'
import { InboxSkeleton } from '../components/InboxSkeleton'
import { NoConfigState } from '../components/NoConfigState'
import type { WhatsAppConfig } from '../context/WhatsAppInboxTypes'

const HISTORY_SYNC_BANNER_MAX_MS = 30 * 60 * 1000

function isActiveHistorySync(config: WhatsAppConfig): boolean {
  if (config.historySyncStatus !== 'RUNNING') return false
  if (!config.historySyncStartedAt) return true
  const startedAt = new Date(config.historySyncStartedAt).getTime()
  if (Number.isNaN(startedAt)) return false
  return Date.now() - startedAt < HISTORY_SYNC_BANNER_MAX_MS
}

interface WhatsAppInboxContainerProps {
  supabaseId: string
}

export function WhatsAppInboxContainer({ supabaseId }: WhatsAppInboxContainerProps) {
  const { config, isLoadingConfig, selectedConversationId } = useWhatsAppInboxContext()

  if (isLoadingConfig) {
    return <InboxSkeleton />
  }

  if (!config || config.status !== 'CONNECTED') {
    return <NoConfigState supabaseId={supabaseId} />
  }

  const showHistorySyncBanner = isActiveHistorySync(config)

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col gap-2 overflow-hidden pt-0 md:h-[calc(100vh-theme(spacing.16))] md:max-h-none">
      {showHistorySyncBanner ? (
        <Alert>
          <Loader2 className="animate-spin" data-icon="inline-start" />
          <AlertDescription>Sincronizando conversas dos últimos 30 dias…</AlertDescription>
        </Alert>
      ) : null}
      <MessagingInboxLayout
        showPanel={Boolean(selectedConversationId)}
        list={<ConversationList />}
        panel={<MessagePanel />}
      />
    </div>
  )
}
