import { useEffect, useRef } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase/browser'

export type WhatsAppMessageRealtimeRow = {
  id: string
  conversationId: string
  direction: string
  messageType: string
  status: string
  contentText: string | null
  mediaUrl: string | null
  caption: string | null
  senderDisplayName: string | null
  mediaFileName: string | null
  linkPreview: { title?: string; description?: string; imageUrl?: string; url?: string } | null
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
  teamId: string
  configId: string
  contactPhone: string
  contactName: string | null
  contactAvatarUrl: string | null
  externalChatId: string | null
  normalizedPhone: string
  lastMessagePreview: string | null
  lastMessageAt: string | null
  unreadCount: number
  assignedProfileId: string | null
  leadId: string | null
  isArchived: boolean
  createdAt: string
  updatedAt: string
}

type RealtimeChannelStatus = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED' | string

type Params = {
  enabled: boolean
  teamId: string | null
  selectedConversationId: string | null
  onMessageInserted: (row: WhatsAppMessageRealtimeRow) => void
  onMessageUpdated: (row: WhatsAppMessageRealtimeRow) => void
  onConversationUpdated: (row: WhatsAppConversationRealtimeRow) => void
  onConversationInserted: (row: WhatsAppConversationRealtimeRow) => void
  onRealtimeHealthChange?: (healthy: boolean) => void
}

function mapMessageRow(row: Partial<WhatsAppMessageRealtimeRow>): WhatsAppMessageRealtimeRow | null {
  if (!row?.id || !row?.conversationId) return null
  return {
    id: row.id,
    conversationId: row.conversationId,
    direction: row.direction ?? 'INBOUND',
    messageType: row.messageType ?? 'text',
    status: row.status ?? 'RECEIVED',
    contentText: row.contentText ?? null,
    mediaUrl: row.mediaUrl ?? null,
    caption: row.caption ?? null,
    senderDisplayName: row.senderDisplayName ?? null,
    mediaFileName: row.mediaFileName ?? null,
    linkPreview: row.linkPreview ?? null,
    sentByProfileId: row.sentByProfileId ?? null,
    senderPhone: row.senderPhone ?? null,
    recipientPhone: row.recipientPhone ?? null,
    sentAt: row.sentAt ?? null,
    deliveredAt: row.deliveredAt ?? null,
    readAt: row.readAt ?? null,
    failedAt: row.failedAt ?? null,
    createdAt: row.createdAt ?? new Date().toISOString(),
  }
}

function isChannelHealthy(status: RealtimeChannelStatus): boolean {
  return status === 'SUBSCRIBED'
}

export function useWhatsAppRealtime({
  enabled,
  teamId,
  selectedConversationId,
  onMessageInserted,
  onMessageUpdated,
  onConversationUpdated,
  onConversationInserted,
  onRealtimeHealthChange,
}: Params) {
  const reconnectTimerRef = useRef<number | null>(null)
  const reconnectAttemptRef = useRef(0)
  const onMessageInsertedRef = useRef(onMessageInserted)
  const onMessageUpdatedRef = useRef(onMessageUpdated)
  const onConversationUpdatedRef = useRef(onConversationUpdated)
  const onConversationInsertedRef = useRef(onConversationInserted)
  const onRealtimeHealthChangeRef = useRef(onRealtimeHealthChange)
  const convsStatusRef = useRef<RealtimeChannelStatus | null>(null)
  const msgsStatusRef = useRef<RealtimeChannelStatus | null>(null)
  const lastEventAtRef = useRef<number>(0)
  const subscribedAtRef = useRef<number>(0)
  const prevHealthRef = useRef<boolean | null>(null)

  useEffect(() => { onMessageInsertedRef.current = onMessageInserted }, [onMessageInserted])
  useEffect(() => { onMessageUpdatedRef.current = onMessageUpdated }, [onMessageUpdated])
  useEffect(() => { onConversationUpdatedRef.current = onConversationUpdated }, [onConversationUpdated])
  useEffect(() => { onConversationInsertedRef.current = onConversationInserted }, [onConversationInserted])
  useEffect(() => { onRealtimeHealthChangeRef.current = onRealtimeHealthChange }, [onRealtimeHealthChange])

  const STALENESS_THRESHOLD_MS = 90_000

  const publishHealth = (selectedId: string | null) => {
    const convsOk = isChannelHealthy(convsStatusRef.current ?? '')
    const msgsOk = !selectedId || isChannelHealthy(msgsStatusRef.current ?? '')

    const now = Date.now()
    const subscribedLongEnough = subscribedAtRef.current > 0 && (now - subscribedAtRef.current) > STALENESS_THRESHOLD_MS
    const noRecentEvents = lastEventAtRef.current === 0 || (now - lastEventAtRef.current) > STALENESS_THRESHOLD_MS
    const stale = convsOk && subscribedLongEnough && noRecentEvents

    const healthy = convsOk && msgsOk && !stale

    if (prevHealthRef.current !== healthy) {
      console.info('[WhatsAppRealtime] Health:', healthy ? 'OK' : 'DEGRADED', stale ? '(stale)' : '')
      prevHealthRef.current = healthy
    }
    onRealtimeHealthChangeRef.current?.(healthy)
  }

  useEffect(() => {
    if (!enabled || !teamId) {
      onRealtimeHealthChangeRef.current?.(false)
      return
    }

    const supabase = createSupabaseBrowser()
    if (!supabase) {
      onRealtimeHealthChangeRef.current?.(false)
      return
    }

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
      convsStatusRef.current = null
      msgsStatusRef.current = null
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
          onRealtimeHealthChangeRef.current?.(false)
          scheduleReconnect('MISSING_TOKEN')
          return
        }

        if (cancelled) return

        await supabase.realtime.setAuth(accessToken)

        const suffix = `${teamId}-${Date.now()}`

        convsChannel = supabase
          .channel(`whatsapp-conversations-${suffix}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'whatsapp_conversations', filter: `teamId=eq.${teamId}` },
            (payload) => {
              lastEventAtRef.current = Date.now()
              console.info('[WhatsAppRealtime] Evento:', { event: 'INSERT', table: 'whatsapp_conversations' })
              const row = payload.new as Partial<WhatsAppConversationRealtimeRow>
              if (!row?.id || !row.teamId) return
              onConversationInsertedRef.current({
                id: row.id,
                teamId: row.teamId,
                configId: row.configId ?? '',
                contactPhone: row.contactPhone ?? '',
                contactName: row.contactName ?? null,
                contactAvatarUrl: row.contactAvatarUrl ?? null,
                externalChatId: row.externalChatId ?? null,
                normalizedPhone: row.normalizedPhone ?? '',
                lastMessagePreview: row.lastMessagePreview ?? null,
                lastMessageAt: row.lastMessageAt ?? null,
                unreadCount: row.unreadCount ?? 0,
                assignedProfileId: row.assignedProfileId ?? null,
                leadId: row.leadId ?? null,
                isArchived: row.isArchived ?? false,
                createdAt: row.createdAt ?? new Date().toISOString(),
                updatedAt: row.updatedAt ?? new Date().toISOString(),
              })
            }
          )
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'whatsapp_conversations', filter: `teamId=eq.${teamId}` },
            (payload) => {
              lastEventAtRef.current = Date.now()
              console.info('[WhatsAppRealtime] Evento:', { event: 'UPDATE', table: 'whatsapp_conversations' })
              const row = payload.new as Partial<WhatsAppConversationRealtimeRow>
              if (!row?.id) return
              onConversationUpdatedRef.current({
                id: row.id,
                teamId: row.teamId ?? teamId,
                configId: row.configId ?? '',
                contactPhone: row.contactPhone ?? '',
                contactName: row.contactName ?? null,
                contactAvatarUrl: row.contactAvatarUrl ?? null,
                externalChatId: row.externalChatId ?? null,
                normalizedPhone: row.normalizedPhone ?? '',
                lastMessagePreview: row.lastMessagePreview ?? null,
                lastMessageAt: row.lastMessageAt ?? null,
                unreadCount: row.unreadCount ?? 0,
                assignedProfileId: row.assignedProfileId ?? null,
                leadId: row.leadId ?? null,
                isArchived: row.isArchived ?? false,
                createdAt: row.createdAt ?? new Date().toISOString(),
                updatedAt: row.updatedAt ?? new Date().toISOString(),
              })
            }
          )
          .subscribe((status) => {
            convsStatusRef.current = status
            if (status === 'SUBSCRIBED') {
              reconnectAttemptRef.current = 0
              subscribedAtRef.current = Date.now()
            }
            publishHealth(selectedConversationId)
            if (status === 'CHANNEL_ERROR') scheduleReconnect('CHANNEL_ERROR')
            if (status === 'TIMED_OUT') scheduleReconnect('TIMED_OUT')
          })

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
                lastEventAtRef.current = Date.now()
                console.info('[WhatsAppRealtime] Evento:', { event: 'INSERT', table: 'whatsapp_messages' })
                const mapped = mapMessageRow(payload.new as Partial<WhatsAppMessageRealtimeRow>)
                if (mapped) onMessageInsertedRef.current(mapped)
              }
            )
            .on(
              'postgres_changes',
              {
                event: 'UPDATE',
                schema: 'public',
                table: 'whatsapp_messages',
                filter: `conversationId=eq.${selectedConversationId}`,
              },
              (payload) => {
                lastEventAtRef.current = Date.now()
                console.info('[WhatsAppRealtime] Evento:', { event: 'UPDATE', table: 'whatsapp_messages' })
                const mapped = mapMessageRow(payload.new as Partial<WhatsAppMessageRealtimeRow>)
                if (mapped) onMessageUpdatedRef.current(mapped)
              }
            )
            .subscribe((status) => {
              msgsStatusRef.current = status
              publishHealth(selectedConversationId)
              if (status === 'SUBSCRIBED') reconnectAttemptRef.current = 0
              if (status === 'CHANNEL_ERROR') scheduleReconnect('CHANNEL_ERROR')
              if (status === 'TIMED_OUT') scheduleReconnect('TIMED_OUT')
            })
        } else {
          msgsStatusRef.current = 'SUBSCRIBED'
          publishHealth(null)
        }
      } catch (error) {
        console.error('[WhatsAppRealtime] Falha ao inicializar:', error)
        onRealtimeHealthChangeRef.current?.(false)
        scheduleReconnect('CHANNEL_ERROR')
      }
    }

    void setup()

    const healthIntervalId = window.setInterval(() => {
      publishHealth(selectedConversationId)
    }, 30_000)

    return () => {
      cancelled = true
      clearReconnectTimer()
      window.clearInterval(healthIntervalId)
      teardown()
      lastEventAtRef.current = 0
      subscribedAtRef.current = 0
      prevHealthRef.current = null
      onRealtimeHealthChangeRef.current?.(false)
    }
  }, [enabled, teamId, selectedConversationId])
}
