import { useEffect, useRef } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase/browser'

export type WhatsAppMessageRealtimeRow = {
  id: string
  conversationId: string
  direction: string
  messageType: string
  status: string
  contentText: string | null
  sentByProfileId: string | null
  senderPhone: string | null
  recipientPhone: string | null
  sentAt: string | null
  deliveredAt: string | null
  readAt: string | null
  failedAt: string | null
  createdAt: string
}

export type WhatsAppConversationRealtimeRow = {
  id: string
  configId: string
  lastMessagePreview: string | null
  lastMessageAt: string | null
  unreadCount: number
  assignedProfileId: string | null
  leadId: string | null
  isArchived: boolean
}

type Params = {
  enabled: boolean
  teamId: string | null
  selectedConversationId: string | null
  onMessageInserted: (row: WhatsAppMessageRealtimeRow) => void
  onConversationUpdated: (row: WhatsAppConversationRealtimeRow) => void
}

export function useWhatsAppRealtime({
  enabled,
  teamId,
  selectedConversationId,
  onMessageInserted,
  onConversationUpdated,
}: Params) {
  const reconnectTimerRef = useRef<number | null>(null)
  const reconnectAttemptRef = useRef(0)
  const onMessageInsertedRef = useRef(onMessageInserted)
  const onConversationUpdatedRef = useRef(onConversationUpdated)

  useEffect(() => { onMessageInsertedRef.current = onMessageInserted }, [onMessageInserted])
  useEffect(() => { onConversationUpdatedRef.current = onConversationUpdated }, [onConversationUpdated])

  useEffect(() => {
    if (!enabled || !teamId) return

    const supabase = createSupabaseBrowser()
    if (!supabase) return

    let cancelled = false
    let msgsChannel: ReturnType<typeof supabase.channel> | null = null
    let convsChannel: ReturnType<typeof supabase.channel> | null = null

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
    }

    const teardown = () => {
      if (msgsChannel) { void supabase.removeChannel(msgsChannel); msgsChannel = null }
      if (convsChannel) { void supabase.removeChannel(convsChannel); convsChannel = null }
    }

    const scheduleReconnect = (reason: string) => {
      if (cancelled || reconnectTimerRef.current !== null) return
      reconnectAttemptRef.current += 1
      const delayMs = Math.min(1000 * 2 ** (reconnectAttemptRef.current - 1), 10000)
      console.info(`[WhatsAppRealtime] Reagendando conexão (${reason}) em ${delayMs}ms`)
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null
        if (!cancelled) void setup()
      }, delayMs)
    }

    const setup = async () => {
      try {
        clearReconnectTimer()
        teardown()

        let accessToken: string | null = null
        try {
          const session = await supabase.auth.getSession()
          accessToken = session.data.session?.access_token ?? null
        } catch {}

        if (!accessToken) {
          try {
            const res = await fetch('/api/v1/realtime/auth-token', { method: 'GET', cache: 'no-store' })
            if (res.ok) {
              const data = await res.json() as Record<string, unknown>
              const result = data?.result as Record<string, unknown> | undefined
              accessToken = typeof result?.accessToken === 'string' ? result.accessToken : null
            }
          } catch {}
        }

        if (!accessToken) {
          scheduleReconnect('MISSING_TOKEN')
          return
        }

        if (cancelled) return

        await supabase.realtime.setAuth(accessToken)

        const suffix = `${teamId}-${Date.now()}`

        // Channel 1: conversation updates (unread counts, last preview, assignment)
        convsChannel = supabase
          .channel(`whatsapp-conversations-${suffix}`)
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'whatsapp_conversations', filter: `teamId=eq.${teamId}` },
            (payload) => {
              const row = payload.new as Partial<WhatsAppConversationRealtimeRow>
              if (!row?.id) return
              onConversationUpdatedRef.current({
                id: row.id,
                configId: row.configId ?? '',
                lastMessagePreview: row.lastMessagePreview ?? null,
                lastMessageAt: row.lastMessageAt ?? null,
                unreadCount: row.unreadCount ?? 0,
                assignedProfileId: row.assignedProfileId ?? null,
                leadId: row.leadId ?? null,
                isArchived: row.isArchived ?? false,
              })
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') reconnectAttemptRef.current = 0
            if (status === 'CHANNEL_ERROR') scheduleReconnect('CHANNEL_ERROR')
            if (status === 'TIMED_OUT') scheduleReconnect('TIMED_OUT')
          })

        // Channel 2: new messages for selected conversation (re-subscribes when selectedConversationId changes)
        if (selectedConversationId) {
          msgsChannel = supabase
            .channel(`whatsapp-messages-${suffix}`)
            .on(
              'postgres_changes',
              {
                event: 'INSERT',
                schema: 'public',
                table: 'whatsapp_messages',
                filter: `conversationId=eq.${selectedConversationId}`,
              },
              (payload) => {
                const row = payload.new as Partial<WhatsAppMessageRealtimeRow>
                if (!row?.id || !row?.conversationId) return
                onMessageInsertedRef.current({
                  id: row.id,
                  conversationId: row.conversationId,
                  direction: row.direction ?? 'INBOUND',
                  messageType: row.messageType ?? 'text',
                  status: row.status ?? 'RECEIVED',
                  contentText: row.contentText ?? null,
                  sentByProfileId: row.sentByProfileId ?? null,
                  senderPhone: row.senderPhone ?? null,
                  recipientPhone: row.recipientPhone ?? null,
                  sentAt: row.sentAt ?? null,
                  deliveredAt: row.deliveredAt ?? null,
                  readAt: row.readAt ?? null,
                  failedAt: row.failedAt ?? null,
                  createdAt: row.createdAt ?? new Date().toISOString(),
                })
              }
            )
            .subscribe((status) => {
              if (status === 'SUBSCRIBED') reconnectAttemptRef.current = 0
              if (status === 'CHANNEL_ERROR') scheduleReconnect('CHANNEL_ERROR')
              if (status === 'TIMED_OUT') scheduleReconnect('TIMED_OUT')
            })
        }
      } catch (error) {
        console.error('[WhatsAppRealtime] Falha ao inicializar:', error)
        scheduleReconnect('CHANNEL_ERROR')
      }
    }

    void setup()

    return () => {
      cancelled = true
      clearReconnectTimer()
      teardown()
    }
  }, [enabled, teamId, selectedConversationId])
}
