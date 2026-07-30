import { useCallback, useEffect, useRef } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { computeWhatsAppRealtimeHealth } from '@/lib/whatsapp/realtime-health'
import type { WhatsAppContactNameSource } from '@/app/[supabaseId]/whatsapp/features/context/WhatsAppInboxTypes'

export type WhatsAppMessageRealtimeRow = {
  id: string
  conversationId: string
  direction: string
  messageType: string
  status: string
  clientMessageId: string | null
  contentText: string | null
  mediaUrl: string | null
  caption: string | null
  senderDisplayName: string | null
  mediaFileName: string | null
  mediaMimeType: string | null
  storagePath: string | null
  mediaSha256: string | null
  mediaSizeBytes: number | null
  mediaStatus: 'PROCESSING' | 'AVAILABLE' | 'EXPIRED' | 'FAILED' | null
  linkPreview: { title?: string; description?: string; imageUrl?: string; url?: string } | null
  sentByProfileId: string | null
  senderPhone: string | null
  recipientPhone: string | null
  sentAt: string | null
  deliveredAt: string | null
  readAt: string | null
  failedAt: string | null
  deletedForEveryoneAt: string | null
  isPinned: boolean
  isFavorite: boolean
  isHiddenForMe: boolean
  createdAt: string
}

export type WhatsAppConversationRealtimeRow = {
  id: string
  teamId: string
  configId: string
  contactPhone: string
  contactName: string | null
  contactNameSource?: WhatsAppContactNameSource
  contactAvatarUrl: string | null
  externalChatId: string | null
  normalizedPhone: string
  lastMessagePreview: string | null
  lastMessageAt: string | null
  unreadCount: number
  assignedProfileId: string | null
  leadId: string | null
  isArchived: boolean
  deletedAt: string | null
  handoffMode: 'BOT' | 'HUMAN'
  createdAt: string
  updatedAt: string
}

type RealtimeChannelStatus = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED' | string

type Params = {
  enabled: boolean
  teamId: string | null
  selectedConversationId: string | null
  selectedConversationRemoteJid: string | null
  onMessageInserted: (row: WhatsAppMessageRealtimeRow) => void
  onMessageUpdated: (row: WhatsAppMessageRealtimeRow) => void
  onConversationUpdated: (row: WhatsAppConversationRealtimeRow) => void
  onConversationInserted: (row: WhatsAppConversationRealtimeRow) => void
  onContactTyping?: (remoteJid: string, isTyping: boolean) => void
  onRealtimeHealthChange?: (healthy: boolean) => void
}

function mapMessageRow(row: Partial<WhatsAppMessageRealtimeRow>): WhatsAppMessageRealtimeRow | null {
  if (!row?.id || !row?.conversationId) return null
  const mediaStatus = row.mediaStatus
  return {
    id: row.id,
    conversationId: row.conversationId,
    direction: row.direction ?? 'INBOUND',
    messageType: row.messageType ?? 'text',
    status: row.status ?? 'RECEIVED',
    clientMessageId: row.clientMessageId ?? null,
    contentText: row.contentText ?? null,
    mediaUrl: row.mediaUrl ?? null,
    caption: row.caption ?? null,
    senderDisplayName: row.senderDisplayName ?? null,
    mediaFileName: row.mediaFileName ?? null,
    mediaMimeType: row.mediaMimeType ?? null,
    storagePath: row.storagePath ?? null,
    mediaSha256: row.mediaSha256 ?? null,
    mediaSizeBytes: typeof row.mediaSizeBytes === 'number' ? row.mediaSizeBytes : null,
    mediaStatus:
      mediaStatus === 'PROCESSING' ||
      mediaStatus === 'AVAILABLE' ||
      mediaStatus === 'EXPIRED' ||
      mediaStatus === 'FAILED'
        ? mediaStatus
        : null,
    linkPreview: row.linkPreview ?? null,
    sentByProfileId: row.sentByProfileId ?? null,
    senderPhone: row.senderPhone ?? null,
    recipientPhone: row.recipientPhone ?? null,
    sentAt: row.sentAt ?? null,
    deliveredAt: row.deliveredAt ?? null,
    readAt: row.readAt ?? null,
    failedAt: row.failedAt ?? null,
    deletedForEveryoneAt: row.deletedForEveryoneAt ?? null,
    isPinned: row.isPinned ?? false,
    isFavorite: row.isFavorite ?? false,
    isHiddenForMe: row.isHiddenForMe ?? false,
    createdAt: row.createdAt ?? new Date().toISOString(),
  }
}

function mapConversationRow(
  row: Partial<WhatsAppConversationRealtimeRow>,
  fallbackTeamId: string
): WhatsAppConversationRealtimeRow | null {
  if (!row?.id) return null
  return {
    id: row.id,
    teamId: row.teamId ?? fallbackTeamId,
    configId: row.configId ?? '',
    contactPhone: row.contactPhone ?? '',
    contactName: row.contactName ?? null,
    contactNameSource: row.contactNameSource ?? 'PUSH_NAME',
    contactAvatarUrl: row.contactAvatarUrl ?? null,
    externalChatId: row.externalChatId ?? null,
    normalizedPhone: row.normalizedPhone ?? '',
    lastMessagePreview: row.lastMessagePreview ?? null,
    lastMessageAt: row.lastMessageAt ?? null,
    unreadCount: row.unreadCount ?? 0,
    assignedProfileId: row.assignedProfileId ?? null,
    leadId: row.leadId ?? null,
    isArchived: row.isArchived ?? false,
    deletedAt: row.deletedAt ?? null,
    handoffMode: row.handoffMode === 'HUMAN' ? 'HUMAN' : 'BOT',
    createdAt: row.createdAt ?? new Date().toISOString(),
    updatedAt: row.updatedAt ?? new Date().toISOString(),
  }
}

type SupabaseBrowserClient = NonNullable<ReturnType<typeof createSupabaseBrowser>>

async function acquireRealtimeAccessToken(supabase: SupabaseBrowserClient): Promise<string | null> {
  try {
    const session = await supabase.auth.getSession()
    const token = session.data.session?.access_token ?? null
    if (token) return token
  } catch {}

  try {
    const res = await fetch('/api/v1/realtime/auth-token', { method: 'GET', cache: 'no-store' })
    if (res.ok) {
      const data = await res.json() as Record<string, unknown>
      const result = data?.result as Record<string, unknown> | undefined
      return typeof result?.accessToken === 'string' ? result.accessToken : null
    }
  } catch {}

  return null
}

/**
 * Saúde derivada exclusivamente de transições reais de estado dos canais
 * (callbacks de subscribe do Supabase). Não há heurística de "staleness" por
 * ausência de eventos: uma inbox quieta é indistinguível de canal morto por
 * esse critério, e marcar canal SUBSCRIBED como degradado dispara o polling
 * de fallback permanentemente (ver incidente do HAR de 2026-07-03).
 * Canais mortos de verdade emitem CHANNEL_ERROR / TIMED_OUT / CLOSED, todos
 * tratados com reconexão + republicação de saúde.
 */
export function useWhatsAppRealtime({
  enabled,
  teamId,
  selectedConversationId,
  selectedConversationRemoteJid,
  onMessageInserted,
  onMessageUpdated,
  onConversationUpdated,
  onConversationInserted,
  onContactTyping,
  onRealtimeHealthChange,
}: Params) {
  const onMessageInsertedRef = useRef(onMessageInserted)
  const onMessageUpdatedRef = useRef(onMessageUpdated)
  const onConversationUpdatedRef = useRef(onConversationUpdated)
  const onConversationInsertedRef = useRef(onConversationInserted)
  const onContactTypingRef = useRef(onContactTyping)
  const onRealtimeHealthChangeRef = useRef(onRealtimeHealthChange)
  const selectedConversationRemoteJidRef = useRef(selectedConversationRemoteJid)

  useEffect(() => { onMessageInsertedRef.current = onMessageInserted }, [onMessageInserted])
  useEffect(() => { onMessageUpdatedRef.current = onMessageUpdated }, [onMessageUpdated])
  useEffect(() => { onConversationUpdatedRef.current = onConversationUpdated }, [onConversationUpdated])
  useEffect(() => { onConversationInsertedRef.current = onConversationInserted }, [onConversationInserted])
  useEffect(() => { onContactTypingRef.current = onContactTyping }, [onContactTyping])
  useEffect(() => { onRealtimeHealthChangeRef.current = onRealtimeHealthChange }, [onRealtimeHealthChange])
  useEffect(() => { selectedConversationRemoteJidRef.current = selectedConversationRemoteJid }, [selectedConversationRemoteJid])

  const convsStatusRef = useRef<RealtimeChannelStatus | null>(null)
  const msgsStatusRef = useRef<RealtimeChannelStatus | null>(null)
  const msgsInitializingRef = useRef(false)
  const hasSelectedConversationRef = useRef<boolean>(selectedConversationId !== null)
  const prevHealthRef = useRef<boolean | null>(null)

  useEffect(() => {
    hasSelectedConversationRef.current = selectedConversationId !== null
  }, [selectedConversationId])

  const publishHealth = useCallback(() => {
    const healthy = computeWhatsAppRealtimeHealth({
      convsStatus: convsStatusRef.current,
      msgsStatus: msgsStatusRef.current,
      hasSelectedConversation: hasSelectedConversationRef.current,
      msgsInitializing: msgsInitializingRef.current,
    })
    if (prevHealthRef.current !== healthy) {
      console.info('[WhatsAppRealtime] Health:', healthy ? 'OK' : 'DEGRADED')
      prevHealthRef.current = healthy
    }
    onRealtimeHealthChangeRef.current?.(healthy)
  }, [])

  // Canal de conversas: vive pelo escopo (team), independe da conversa aberta.
  const convsReconnectTimerRef = useRef<number | null>(null)
  const convsReconnectAttemptRef = useRef(0)

  useEffect(() => {
    if (!enabled || !teamId) {
      convsStatusRef.current = null
      onRealtimeHealthChangeRef.current?.(false)
      return
    }

    const supabase = createSupabaseBrowser()
    if (!supabase) {
      onRealtimeHealthChangeRef.current?.(false)
      return
    }

    let cancelled = false
    let generation = 0
    let channel: ReturnType<typeof supabase.channel> | null = null

    const clearReconnectTimer = () => {
      if (convsReconnectTimerRef.current !== null) {
        window.clearTimeout(convsReconnectTimerRef.current)
        convsReconnectTimerRef.current = null
      }
    }

    const teardown = () => {
      if (channel) { void supabase.removeChannel(channel); channel = null }
      convsStatusRef.current = null
    }

    const scheduleReconnect = (reason: string) => {
      if (cancelled || convsReconnectTimerRef.current !== null) return
      convsReconnectAttemptRef.current += 1
      const delayMs = Math.min(1000 * 2 ** (convsReconnectAttemptRef.current - 1), 10000)
      console.info(`[WhatsAppRealtime] Reagendando canal de conversas (${reason}) em ${delayMs}ms`)
      convsReconnectTimerRef.current = window.setTimeout(() => {
        convsReconnectTimerRef.current = null
        if (!cancelled) void setup()
      }, delayMs)
    }

    const setup = async () => {
      try {
        clearReconnectTimer()
        teardown()
        const gen = ++generation

        const accessToken = await acquireRealtimeAccessToken(supabase)
        if (cancelled || gen !== generation) return
        if (!accessToken) {
          onRealtimeHealthChangeRef.current?.(false)
          scheduleReconnect('MISSING_TOKEN')
          return
        }

        await supabase.realtime.setAuth(accessToken)
        if (cancelled || gen !== generation) return

        channel = supabase
          .channel(`whatsapp-conversations-${teamId}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'whatsapp_conversations', filter: `teamId=eq.${teamId}` },
            (payload) => {
              console.info('[WhatsAppRealtime] Evento:', { event: 'INSERT', table: 'whatsapp_conversations' })
              const row = payload.new as Partial<WhatsAppConversationRealtimeRow>
              if (!row?.id || !row.teamId) return
              const mapped = mapConversationRow(row, teamId)
              if (mapped) onConversationInsertedRef.current(mapped)
            }
          )
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'whatsapp_conversations', filter: `teamId=eq.${teamId}` },
            (payload) => {
              console.info('[WhatsAppRealtime] Evento:', { event: 'UPDATE', table: 'whatsapp_conversations' })
              const mapped = mapConversationRow(payload.new as Partial<WhatsAppConversationRealtimeRow>, teamId)
              if (mapped) onConversationUpdatedRef.current(mapped)
            }
          )
          .subscribe((status) => {
            // Callbacks de canais já derrubados (teardown de resubscribe emite
            // CLOSED) não devem influenciar a saúde nem agendar reconexão.
            if (cancelled || gen !== generation) return
            convsStatusRef.current = status
            if (status === 'SUBSCRIBED') convsReconnectAttemptRef.current = 0
            publishHealth()
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
              scheduleReconnect(status)
            }
          })
      } catch (error) {
        console.error('[WhatsAppRealtime] Falha ao inicializar canal de conversas:', error)
        onRealtimeHealthChangeRef.current?.(false)
        scheduleReconnect('SETUP_ERROR')
      }
    }

    void setup()

    return () => {
      cancelled = true
      generation++
      clearReconnectTimer()
      teardown()
      prevHealthRef.current = null
      onRealtimeHealthChangeRef.current?.(false)
    }
  }, [enabled, teamId, publishHealth])

  // Canal de mensagens: escopo = conversa aberta. Só ele é recriado ao trocar
  // de conversa; o canal de conversas acima permanece intacto.
  const msgsReconnectTimerRef = useRef<number | null>(null)
  const msgsReconnectAttemptRef = useRef(0)

  useEffect(() => {
    if (!enabled || !teamId || !selectedConversationId) {
      msgsInitializingRef.current = false
      msgsStatusRef.current = null
      if (enabled && teamId) publishHealth()
      return
    }

    const supabase = createSupabaseBrowser()
    if (!supabase) {
      msgsInitializingRef.current = false
      msgsStatusRef.current = 'CHANNEL_ERROR'
      publishHealth()
      return
    }

    msgsInitializingRef.current = true
    msgsStatusRef.current = null
    publishHealth()

    let cancelled = false
    let generation = 0
    let channel: ReturnType<typeof supabase.channel> | null = null

    const clearReconnectTimer = () => {
      if (msgsReconnectTimerRef.current !== null) {
        window.clearTimeout(msgsReconnectTimerRef.current)
        msgsReconnectTimerRef.current = null
      }
    }

    const teardown = () => {
      if (channel) { void supabase.removeChannel(channel); channel = null }
      msgsStatusRef.current = null
    }

    const markMsgsChannelFailed = () => {
      msgsInitializingRef.current = false
      msgsStatusRef.current = 'CHANNEL_ERROR'
      publishHealth()
    }

    const scheduleReconnect = (reason: string) => {
      if (cancelled || msgsReconnectTimerRef.current !== null) return
      msgsReconnectAttemptRef.current += 1
      const delayMs = Math.min(1000 * 2 ** (msgsReconnectAttemptRef.current - 1), 10000)
      console.info(`[WhatsAppRealtime] Reagendando canal de mensagens (${reason}) em ${delayMs}ms`)
      msgsReconnectTimerRef.current = window.setTimeout(() => {
        msgsReconnectTimerRef.current = null
        if (!cancelled) void setup()
      }, delayMs)
    }

    const setup = async () => {
      try {
        clearReconnectTimer()
        teardown()
        msgsInitializingRef.current = true
        publishHealth()
        const gen = ++generation

        const accessToken = await acquireRealtimeAccessToken(supabase)
        if (cancelled || gen !== generation) return
        if (!accessToken) {
          markMsgsChannelFailed()
          scheduleReconnect('MISSING_TOKEN')
          return
        }

        await supabase.realtime.setAuth(accessToken)
        if (cancelled || gen !== generation) return

        channel = supabase
          .channel(`whatsapp-messages-${selectedConversationId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'whatsapp_messages',
              filter: `conversationId=eq.${selectedConversationId}`,
            },
            (payload) => {
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
              console.info('[WhatsAppRealtime] Evento:', { event: 'UPDATE', table: 'whatsapp_messages' })
              const mapped = mapMessageRow(payload.new as Partial<WhatsAppMessageRealtimeRow>)
              if (mapped) onMessageUpdatedRef.current(mapped)
            }
          )
          .subscribe((status) => {
            if (cancelled || gen !== generation) return
            msgsStatusRef.current = status
            if (status === 'SUBSCRIBED') {
              msgsInitializingRef.current = false
              msgsReconnectAttemptRef.current = 0
            } else if (
              status === 'CHANNEL_ERROR' ||
              status === 'TIMED_OUT' ||
              status === 'CLOSED'
            ) {
              msgsInitializingRef.current = false
            }
            publishHealth()
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
              scheduleReconnect(status)
            }
          })
      } catch (error) {
        console.error('[WhatsAppRealtime] Falha ao inicializar canal de mensagens:', error)
        markMsgsChannelFailed()
        scheduleReconnect('SETUP_ERROR')
      }
    }

    void setup()

    return () => {
      cancelled = true
      generation++
      clearReconnectTimer()
      teardown()
      msgsInitializingRef.current = false
      publishHealth()
    }
  }, [enabled, teamId, selectedConversationId, publishHealth])

  // Canal de presença: escuta broadcasts PRESENCE_UPDATE do servidor para indicador de digitação.
  useEffect(() => {
    if (!enabled || !teamId) return
    const supabase = createSupabaseBrowser()
    if (!supabase) return

    const channel = supabase
      .channel(`whatsapp-presence:${teamId}`)
      .on('broadcast', { event: 'contact_typing' }, ({ payload }) => {
        const p = payload as { remoteJid?: string; isTyping?: boolean }
        if (typeof p?.remoteJid !== 'string') return
        if (p.remoteJid !== selectedConversationRemoteJidRef.current) return
        onContactTypingRef.current?.(p.remoteJid, p.isTyping === true)
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [enabled, teamId])
}
