"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useTeamContext } from '@/app/context/TeamContext'
import { useUserContext } from '@/app/context/UserContext'
import { isManagerLikeRole } from '@/lib/roles'
import { useWhatsAppRealtime } from '@/hooks/useWhatsAppRealtime'
import { dispatchWhatsAppUnreadChanged, WHATSAPP_CONFIG_CHANGED_EVENT, WHATSAPP_UNREAD_CHANGED_EVENT } from '@/lib/whatsapp/unread-events'
import { buildContactLookupFromList } from '../utils/formatWhatsAppMessageText'
import { whatsAppInboxService } from '../services/WhatsAppInboxService'
import type {
  ConversationFilterMode,
  InboxActions,
  InboxState,
  LeadSearchResult,
  SendMessageMediaInput,
  TeamMember,
  WhatsAppConfig,
  WhatsAppConversation,
  WhatsAppMessage,
  WhatsAppTeamContact,
} from './WhatsAppInboxTypes'

const CONVERSATIONS_LIMIT = 20
const MESSAGES_LIMIT = 50
const SEARCH_DEBOUNCE_MS = 400

function dedupeConversationsById(items: WhatsAppConversation[]): WhatsAppConversation[] {
  const byId = new Map<string, WhatsAppConversation>()
  for (const item of items) {
    byId.set(item.id, item)
  }
  return Array.from(byId.values())
}

function sortConversationsByLastMessage(items: WhatsAppConversation[]): WhatsAppConversation[] {
  return [...items].sort((a, b) => {
    const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
    const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
    return bTime - aTime
  })
}

// Preservam a identidade do array de estado quando um refetch devolve dados
// equivalentes aos já renderizados: evita re-render em cascata dos bubbles e
// re-download de mídia (<img> do proxy) quando nada mudou.
function areMessageListsEquivalent(a: WhatsAppMessage[], b: WhatsAppMessage[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!
    const y = b[i]!
    if (
      x.id !== y.id ||
      x.status !== y.status ||
      x.contentText !== y.contentText ||
      x.mediaUrl !== y.mediaUrl ||
      x.deliveredAt !== y.deliveredAt ||
      x.readAt !== y.readAt ||
      x.failedAt !== y.failedAt
    ) {
      return false
    }
  }
  return true
}

function areConversationListsEquivalent(
  a: WhatsAppConversation[],
  b: WhatsAppConversation[]
): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!
    const y = b[i]!
    if (
      x.id !== y.id ||
      x.updatedAt !== y.updatedAt ||
      x.unreadCount !== y.unreadCount ||
      x.lastMessageAt !== y.lastMessageAt ||
      x.lastMessagePreview !== y.lastMessagePreview ||
      x.assignedProfileId !== y.assignedProfileId ||
      x.leadId !== y.leadId ||
      x.isArchived !== y.isArchived ||
      x.contactName !== y.contactName ||
      x.contactNameSource !== y.contactNameSource ||
      x.contactAvatarUrl !== y.contactAvatarUrl
    ) {
      return false
    }
  }
  return true
}

const configInFlightByKey = new Map<string, Promise<WhatsAppConfig | null>>()
const conversationsInFlightByKey = new Map<
  string,
  Promise<{ conversations: WhatsAppConversation[]; total: number }>
>()
const messagesInFlightByKey = new Map<
  string,
  Promise<{ messages: WhatsAppMessage[]; total: number }>
>()
const teamMembersInFlightByKey = new Map<string, Promise<TeamMember[]>>()

export function useWhatsAppInbox(supabaseId: string): InboxState & InboxActions {
  const { activeTeamId, activeTeam, isTeamMaster } = useTeamContext()
  const { user } = useUserContext()

  const [config, setConfig] = useState<WhatsAppConfig | null>(null)
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<WhatsAppMessage[]>([])
  const [totalConversations, setTotalConversations] = useState(0)
  const [isLoadingConfig, setIsLoadingConfig] = useState(false)
  const [isLoadingConversations, setIsLoadingConversations] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false)
  const [totalMessages, setTotalMessages] = useState(0)
  const [messagePage, setMessagePage] = useState(1)
  const [isSending, setIsSending] = useState(false)
  const [searchQuery, setSearchQueryState] = useState('')
  const [page, setPage] = useState(1)
  const [isAssigning, setIsAssigning] = useState(false)
  const [isChangingHandoff, setIsChangingHandoff] = useState(false)
  const [isLinkingLead, setIsLinkingLead] = useState(false)
  const [isUpdatingContactName, setIsUpdatingContactName] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isCreatingConversation, setIsCreatingConversation] = useState(false)
  const [isSyncingContacts, setIsSyncingContacts] = useState(false)
  const [isSyncingGroupParticipants, setIsSyncingGroupParticipants] = useState(false)
  const [contacts, setContacts] = useState<WhatsAppTeamContact[]>([])
  const [isLoadingContacts, setIsLoadingContacts] = useState(false)
  const [unreadTotal, setUnreadTotal] = useState(0)
  const [allUnreadTotal, setAllUnreadTotal] = useState(0)
  const [mineUnreadTotal, setMineUnreadTotal] = useState(0)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [isLoadingTeamMembers, setIsLoadingTeamMembers] = useState(false)
  const [filterMode, setFilterModeState] = useState<ConversationFilterMode>('all')

  const currentConfigKeyRef = useRef<string | null>(null)
  const inFlightConfigKeyRef = useRef<string | null>(null)
  const lastSuccessConfigKeyRef = useRef<string | null>(null)

  const currentConvsKeyRef = useRef<string | null>(null)
  const inFlightConvsKeyRef = useRef<string | null>(null)

  const currentMessagesConvIdRef = useRef<string | null>(null)
  const inFlightMessagesConvIdRef = useRef<string | null>(null)

  const inFlightTeamMembersKeyRef = useRef<string | null>(null)

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSearchRef = useRef<string>('')
  const messageRefetchTimerRef = useRef<number | null>(null)
  // Timestamp da última mensagem recebida via INSERT realtime na conversa aberta.
  // Usado para suprimir o refetch de "heal" só quando o UPDATE da conversa
  // reflete exatamente essa mensagem (evita suprimir heal de INSERT perdido).
  const lastRealtimeInsertMessageAtRef = useRef<string | null>(null)

  // Guards síncronos de double-submit: setados/checados ANTES de qualquer
  // await, diferente dos states React (isSending, isAssigning, etc.) cuja
  // atualização é assíncrona e não bloqueia um segundo clique no mesmo tick.
  const isSendingRef = useRef(false)
  const isAssigningRef = useRef(false)
  const isChangingHandoffRef = useRef(false)
  const isLinkingLeadRef = useRef(false)
  const isUpdatingContactNameRef = useRef(false)
  const isArchivingRef = useRef(false)
  const isDeletingRef = useRef(false)

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current)
      }
      if (messageRefetchTimerRef.current !== null) {
        window.clearTimeout(messageRefetchTimerRef.current)
      }
      if (unreadRefreshTrailingTimerRef.current !== null) {
        window.clearTimeout(unreadRefreshTrailingTimerRef.current)
      }
    }
  }, [])

  const messagesRef = useRef<WhatsAppMessage[]>([])
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId) ?? null

  const currentProfileId = user?.id ?? null
  const canManageAssignment = isTeamMaster || isManagerLikeRole(activeTeam?.role)
  const contactLookup = useMemo(() => buildContactLookupFromList(contacts), [contacts])
  const hasMoreConversations = conversations.length < totalConversations
  const hasMoreMessages = messages.length < totalMessages

  // Load config
  const loadConfig = useCallback(async () => {
    if (!activeTeamId) {
      setConfig(null)
      setIsLoadingConfig(false)
      currentConfigKeyRef.current = null
      inFlightConfigKeyRef.current = null
      lastSuccessConfigKeyRef.current = null
      return
    }

    const key = `${supabaseId}:${activeTeamId}`
    currentConfigKeyRef.current = key

    // Só pula refetch quando já carregamos config válida (null após 404 deve tentar de novo)
    if (lastSuccessConfigKeyRef.current === key) {
      setIsLoadingConfig(false)
      return
    }

    if (inFlightConfigKeyRef.current === key) {
      return
    }

    setIsLoadingConfig(true)
    inFlightConfigKeyRef.current = key

    const existing = configInFlightByKey.get(key)
    const promise =
      existing ??
      whatsAppInboxService.fetchConfig(activeTeamId, supabaseId).finally(() => {
        configInFlightByKey.delete(key)
      })

    if (!existing) {
      configInFlightByKey.set(key, promise)
    }

    try {
      const result = await promise
      if (currentConfigKeyRef.current !== key) return
      setConfig(result)
      if (result !== null) {
        lastSuccessConfigKeyRef.current = key
      } else {
        lastSuccessConfigKeyRef.current = null
      }
    } catch (error) {
      if (currentConfigKeyRef.current === key) {
        setConfig(null)
      }
      console.error('[useWhatsAppInbox] Erro ao carregar configuração do WhatsApp:', error)
      toast.error(error instanceof Error ? error.message : 'Não foi possível carregar a configuração do WhatsApp')
    } finally {
      if (currentConfigKeyRef.current === key) {
        setIsLoadingConfig(false)
      }
      if (inFlightConfigKeyRef.current === key) {
        inFlightConfigKeyRef.current = null
      }
    }
  }, [activeTeamId, supabaseId])

  const filterModeRef = useRef<ConversationFilterMode>('all')
  const conversationIdsRef = useRef<Set<string>>(new Set())
  const realtimeHealthyRef = useRef(true)
  const selectedConversationIdRef = useRef<string | null>(null)
  const selectedLastMessageAtRef = useRef<string | null>(null)
  const searchQueryRef = useRef('')

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId
  }, [selectedConversationId])

  useEffect(() => {
    selectedLastMessageAtRef.current = selectedConversation?.lastMessageAt ?? null
  }, [selectedConversation?.lastMessageAt])

  useEffect(() => {
    searchQueryRef.current = searchQuery
  }, [searchQuery])

  useEffect(() => {
    conversationIdsRef.current = new Set(conversations.map((c) => c.id))
  }, [conversations])

  const handleRealtimeHealthChange = useCallback((healthy: boolean) => {
    realtimeHealthyRef.current = healthy
  }, [])

  // Fresh unread totals for filter tab badges (independent of current filter page)
  // Throttle + in-flight guard: eventos realtime de conversa chegam em rajada
  // (ex.: sync de contatos atualiza dezenas de conversas) e cada chamada custa
  // 2 fetches de lista. Chamadas dentro da janela viram um único trailing
  // refresh que captura o estado mais recente.
  const UNREAD_REFRESH_MIN_INTERVAL_MS = 4_000
  const unreadRefreshInFlightRef = useRef(false)
  const unreadRefreshLastAtRef = useRef(0)
  const unreadRefreshTrailingTimerRef = useRef<number | null>(null)
  const refreshUnreadCountsRef = useRef<() => void>(() => {})

  const refreshUnreadCounts = useCallback(async () => {
    if (!activeTeamId) {
      setUnreadTotal(0)
      setAllUnreadTotal(0)
      setMineUnreadTotal(0)
      return
    }

    const now = Date.now()
    const elapsed = now - unreadRefreshLastAtRef.current
    if (unreadRefreshInFlightRef.current || elapsed < UNREAD_REFRESH_MIN_INTERVAL_MS) {
      if (unreadRefreshTrailingTimerRef.current === null) {
        const delay = Math.max(UNREAD_REFRESH_MIN_INTERVAL_MS - elapsed, 250)
        unreadRefreshTrailingTimerRef.current = window.setTimeout(() => {
          unreadRefreshTrailingTimerRef.current = null
          refreshUnreadCountsRef.current()
        }, delay)
      }
      return
    }

    unreadRefreshInFlightRef.current = true
    unreadRefreshLastAtRef.current = now

    try {
      const profileId = user?.id
      const requests = [
        whatsAppInboxService.fetchConversations(activeTeamId, supabaseId, {
          hasUnread: true,
          limit: 1,
          page: 1,
        }),
      ]

      if (profileId) {
        requests.push(
          whatsAppInboxService.fetchConversations(activeTeamId, supabaseId, {
            hasUnread: true,
            assignedProfileId: profileId,
            limit: 1,
            page: 1,
          })
        )
      }

      const results = await Promise.all(requests)
      const allResult = results[0]!
      const mineResult = profileId ? results[1] : undefined

      setUnreadTotal(allResult.total)
      setAllUnreadTotal(allResult.total)
      setMineUnreadTotal(mineResult?.total ?? 0)
    } catch {
      // keep previous values on transient errors
    } finally {
      unreadRefreshInFlightRef.current = false
    }
  }, [activeTeamId, supabaseId, user?.id])

  useEffect(() => {
    refreshUnreadCountsRef.current = () => void refreshUnreadCounts()
  }, [refreshUnreadCounts])

  useEffect(() => {
    if (!activeTeamId || !config) return
    void refreshUnreadCounts()
  }, [activeTeamId, config, refreshUnreadCounts])

  useEffect(() => {
    if (!activeTeamId || !config) return
    const onUnreadChanged = () => void refreshUnreadCounts()
    window.addEventListener(WHATSAPP_UNREAD_CHANGED_EVENT, onUnreadChanged)
    return () => window.removeEventListener(WHATSAPP_UNREAD_CHANGED_EVENT, onUnreadChanged)
  }, [activeTeamId, config, refreshUnreadCounts])

  // Load conversations
  const loadConversations = useCallback(
    async (pageNum: number, search: string, filter?: ConversationFilterMode) => {
      if (!activeTeamId) {
        setConversations([])
        setTotalConversations(0)
        setIsLoadingConversations(false)
        currentConvsKeyRef.current = null
        inFlightConvsKeyRef.current = null
        return
      }

      const effectiveFilter = filter ?? filterModeRef.current
      const key = `${supabaseId}:${activeTeamId}:${pageNum}:${search}:${effectiveFilter}`
      currentConvsKeyRef.current = key

      if (inFlightConvsKeyRef.current === key) {
        return
      }

      setIsLoadingConversations(true)
      inFlightConvsKeyRef.current = key

      const hasUnread = effectiveFilter === 'unread' ? true : undefined
      const assignedProfileId = effectiveFilter === 'mine' ? (user?.id ?? undefined) : undefined
      const isArchived = effectiveFilter === 'archived' ? true : false

      const existing = conversationsInFlightByKey.get(key)
      const promise =
        existing ??
        whatsAppInboxService
          .fetchConversations(activeTeamId, supabaseId, {
            page: pageNum,
            limit: CONVERSATIONS_LIMIT,
            search: search || undefined,
            hasUnread,
            assignedProfileId,
            isArchived,
          })
          .finally(() => {
            conversationsInFlightByKey.delete(key)
          })

      if (!existing) {
        conversationsInFlightByKey.set(key, promise)
      }

      try {
        const result = await promise
        if (currentConvsKeyRef.current !== key) return
        setConversations((prev) => {
          if (pageNum > 1) {
            return dedupeConversationsById([...prev, ...result.conversations])
          }
          return areConversationListsEquivalent(prev, result.conversations)
            ? prev
            : result.conversations
        })
        setTotalConversations(result.total)
        if (pageNum > 1) {
          setPage(pageNum)
        }
      } catch (error) {
        if (currentConvsKeyRef.current === key) {
          setConversations([])
          setTotalConversations(0)
        }
        console.error('[useWhatsAppInbox] Erro ao carregar conversas:', error)
        toast.error(error instanceof Error ? error.message : 'Não foi possível carregar as conversas')
      } finally {
        if (currentConvsKeyRef.current === key) {
          setIsLoadingConversations(false)
        }
        if (inFlightConvsKeyRef.current === key) {
          inFlightConvsKeyRef.current = null
        }
      }
    },
    [activeTeamId, supabaseId]
  )

  // Load messages for selected conversation
  const loadMessages = useCallback(
    async (conversationId: string, pageNum = 1) => {
      if (!activeTeamId) return

      currentMessagesConvIdRef.current = conversationId

      const msgKey = `${conversationId}:${pageNum}`
      if (inFlightMessagesConvIdRef.current === msgKey) return

      if (pageNum === 1) {
        setIsLoadingMessages(true)
      } else {
        setIsLoadingOlderMessages(true)
      }
      inFlightMessagesConvIdRef.current = msgKey

      const existing = messagesInFlightByKey.get(msgKey)
      const promise =
        existing ??
        whatsAppInboxService
          .fetchMessages(activeTeamId, supabaseId, conversationId, { page: pageNum, limit: MESSAGES_LIMIT })
          .finally(() => {
            messagesInFlightByKey.delete(msgKey)
          })

      if (!existing) {
        messagesInFlightByKey.set(msgKey, promise)
      }

      try {
        const result = await promise
        if (currentMessagesConvIdRef.current !== conversationId) return
        setTotalMessages(result.total)
        if (pageNum === 1) {
          // API returns newest-first (DESC); reverse so oldest is at top, newest at bottom
          const fetched = result.messages.slice().reverse()
          const fetchedIds = new Set(fetched.map((m) => m.id))
          setMessages((prev) => {
            // Preserva mensagens inseridas via Realtime durante o fetch inicial
            // (mesma conversa) que ainda não vieram na resposta paginada.
            const realtimeOnly = prev.filter(
              (m) => m.conversationId === conversationId && !fetchedIds.has(m.id)
            )
            const next =
              realtimeOnly.length === 0
                ? fetched
                : [...fetched, ...realtimeOnly].sort(
                    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                  )
            return areMessageListsEquivalent(prev, next) ? prev : next
          })
        } else {
          // Older messages go at the top; API returns newest-first so reverse before prepending
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id))
            const fresh = result.messages.filter((m) => !existingIds.has(m.id)).slice().reverse()
            return [...fresh, ...prev]
          })
          setMessagePage(pageNum)
        }
      } catch (error) {
        if (currentMessagesConvIdRef.current === conversationId) {
          if (pageNum === 1) setMessages([])
        }
        console.error('[useWhatsAppInbox] Erro ao carregar mensagens:', error)
        toast.error(error instanceof Error ? error.message : 'Não foi possível carregar as mensagens')
      } finally {
        if (currentMessagesConvIdRef.current === conversationId) {
          if (pageNum === 1) setIsLoadingMessages(false)
          else setIsLoadingOlderMessages(false)
        }
        if (inFlightMessagesConvIdRef.current === msgKey) {
          inFlightMessagesConvIdRef.current = null
        }
      }
    },
    [activeTeamId, supabaseId]
  )

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  useEffect(() => {
    const onConfigChanged = () => {
      lastSuccessConfigKeyRef.current = null
      void loadConfig()
    }
    window.addEventListener(WHATSAPP_CONFIG_CHANGED_EVENT, onConfigChanged)
    return () => window.removeEventListener(WHATSAPP_CONFIG_CHANGED_EVENT, onConfigChanged)
  }, [loadConfig])

  useEffect(() => {
    if (!activeTeamId || config?.historySyncStatus !== 'RUNNING') return

    let cancelled = false

    const intervalId = window.setInterval(() => {
      void (async () => {
        try {
          const refreshed = await whatsAppInboxService.fetchConfig(activeTeamId, supabaseId)
          if (cancelled) return
          setConfig(refreshed)
          if (refreshed?.historySyncStatus === 'COMPLETED') {
            void loadConversations(1, pendingSearchRef.current, filterModeRef.current)
          }
        } catch (error) {
          if (!cancelled) {
            console.error('[useWhatsAppInbox] Erro ao atualizar status de sincronização:', error)
          }
        }
      })()
    }, 10000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [activeTeamId, supabaseId, config?.historySyncStatus, loadConversations])

  useEffect(() => {
    void loadConversations(1, pendingSearchRef.current, filterModeRef.current)
    setPage(1)
  }, [loadConversations, activeTeamId])

  const selectConversation = useCallback(
    (id: string) => {
      setSelectedConversationId(id)
      setMessages([])
      setTotalMessages(0)
      setMessagePage(1)
      lastRealtimeInsertMessageAtRef.current = null
      void loadMessages(id, 1)

      // Lazy-load team members on first conversation open for operator name display
      if (teamMembers.length === 0) void loadTeamMembersInternal()

      // Zero the unread count locally and fire-and-forget the server update
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
      )
      if (activeTeamId) {
        void whatsAppInboxService
          .markConversationRead(activeTeamId, supabaseId, id)
          .then(() => {
            // O listener de WHATSAPP_UNREAD_CHANGED_EVENT deste hook já chama
            // refreshUnreadCounts; chamar direto aqui duplicava o fetch.
            dispatchWhatsAppUnreadChanged()
          })
          .catch((err: unknown) => {
            console.error('[useWhatsAppInbox] Erro ao marcar como lida:', err)
          })
      }
    },
    [loadMessages, activeTeamId, supabaseId, teamMembers.length]
  )

  const loadOlderMessages = useCallback(() => {
    if (!selectedConversationId || isLoadingOlderMessages) return
    // messagePage só avança dentro de loadMessages após sucesso do fetch,
    // evitando pular uma página quando a requisição falha.
    void loadMessages(selectedConversationId, messagePage + 1)
  }, [selectedConversationId, messagePage, isLoadingOlderMessages, loadMessages])

  const loadMoreConversations = useCallback(() => {
    if (isLoadingConversations) return
    // page só avança dentro de loadConversations após sucesso do fetch,
    // evitando pular uma página quando a requisição falha.
    void loadConversations(page + 1, pendingSearchRef.current, filterModeRef.current)
  }, [page, loadConversations, isLoadingConversations])

  const setSearchQuery = useCallback(
    (q: string) => {
      setSearchQueryState(q)
      pendingSearchRef.current = q

      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current)
      }

      searchDebounceRef.current = setTimeout(() => {
        setPage(1)
        void loadConversations(1, q, filterModeRef.current)
      }, SEARCH_DEBOUNCE_MS)
    },
    [loadConversations]
  )

  const setFilterMode = useCallback(
    (mode: ConversationFilterMode) => {
      filterModeRef.current = mode
      setFilterModeState(mode)
      setPage(1)
      void loadConversations(1, pendingSearchRef.current, mode)
    },
    [loadConversations]
  )

  // Shared send routine used by sendMessage (new optimistic message) and
  // resendMessage (existing FAILED message reused by id).
  const performSend = useCallback(
    async (
      conversationId: string,
      text: string,
      optimisticId: string,
      media?: SendMessageMediaInput,
      mentionedJids?: string[]
    ) => {
      if (!activeTeamId) return
      isSendingRef.current = true
      setIsSending(true)
      try {
        const result = await whatsAppInboxService.sendMessage(
          activeTeamId,
          supabaseId,
          conversationId,
          text,
          media,
          mentionedJids
        )
        // Promote the optimistic bubble to the real message id so the realtime
        // INSERT for the same id is de-duplicated by handleMessageInserted.
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticId
              ? {
                  ...m,
                  id: result.messageId,
                  status: 'SENT',
                  sentAt: m.sentAt ?? new Date().toISOString(),
                  sentByProfileId: m.sentByProfileId ?? currentProfileId,
                }
              : m
          )
        )
      } catch (error) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticId
              ? { ...m, status: 'FAILED', failedAt: new Date().toISOString() }
              : m
          )
        )
        console.error('[useWhatsAppInbox] Erro ao enviar mensagem:', error)
        toast.error(error instanceof Error ? error.message : 'Não foi possível enviar a mensagem')
      } finally {
        setIsSending(false)
        isSendingRef.current = false
      }
    },
    [activeTeamId, supabaseId, currentProfileId]
  )

  const sendMessage = useCallback(
    (text: string, media?: SendMessageMediaInput, mentionedJids?: string[]) => {
      if (!activeTeamId || !selectedConversationId || isSendingRef.current) return

      const trimmedText = text.trim()
      if (!trimmedText && !media) return

      const optimisticId = `optimistic-${Date.now()}`
      const messageType = media
        ? media.mediatype === 'image'
          ? 'IMAGE'
          : media.mediatype === 'document'
            ? 'DOCUMENT'
            : media.mediatype === 'audio'
              ? 'AUDIO'
              : 'VIDEO'
        : 'TEXT'

      const optimisticMessage: WhatsAppMessage = {
        id: optimisticId,
        conversationId: selectedConversationId,
        direction: 'OUTBOUND',
        messageType,
        status: 'PENDING',
        contentText: trimmedText || null,
        mediaUrl: null,
        caption: media?.caption ?? null,
        senderDisplayName: null,
        mediaFileName: media?.fileName ?? null,
        linkPreview: null,
        sentByProfileId: currentProfileId,
        senderPhone: null,
        recipientPhone: null,
        sentAt: new Date().toISOString(),
        deliveredAt: null,
        readAt: null,
        failedAt: null,
        isAutoResponse: false,
        createdAt: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, optimisticMessage])

      performSend(selectedConversationId, trimmedText, optimisticId, media, mentionedJids).catch((error) => {
        console.error('[useWhatsAppInbox] Erro inesperado ao enviar mensagem:', error)
        setIsSending(false)
        isSendingRef.current = false
      })
    },
    [activeTeamId, selectedConversationId, performSend, currentProfileId]
  )

  const resendMessage = useCallback(
    (messageId: string) => {
      if (isSendingRef.current) return

      const target = messagesRef.current.find((m) => m.id === messageId)
      if (!target || !target.contentText) return

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, status: 'PENDING', failedAt: null } : m
        )
      )

      performSend(target.conversationId, target.contentText, messageId).catch((error) => {
        console.error('[useWhatsAppInbox] Erro inesperado ao reenviar mensagem:', error)
        setIsSending(false)
        isSendingRef.current = false
      })
    },
    [performSend]
  )

  const loadTeamMembersInternal = useCallback(async () => {
    if (!activeTeamId) return

    const key = `${supabaseId}:${activeTeamId}`

    if (inFlightTeamMembersKeyRef.current === key) return

    setIsLoadingTeamMembers(true)
    inFlightTeamMembersKeyRef.current = key

    const existing = teamMembersInFlightByKey.get(key)
    const promise =
      existing ??
      whatsAppInboxService.fetchTeamMembers(activeTeamId, supabaseId).finally(() => {
        teamMembersInFlightByKey.delete(key)
      })

    if (!existing) {
      teamMembersInFlightByKey.set(key, promise)
    }

    try {
      const result = await promise
      setTeamMembers(result)
    } catch (error) {
      console.error('[useWhatsAppInbox] Erro ao carregar membros do time:', error)
      toast.error(error instanceof Error ? error.message : 'Não foi possível carregar os membros do time')
    } finally {
      setIsLoadingTeamMembers(false)
      if (inFlightTeamMembersKeyRef.current === key) {
        inFlightTeamMembersKeyRef.current = null
      }
    }
  }, [activeTeamId, supabaseId])

  const loadTeamMembers = loadTeamMembersInternal

  // Realtime callbacks
  const handleMessageInserted = useCallback(
    (row: {
      id: string
      conversationId: string
      direction: string
      messageType: string
      status: string
      contentText: string | null
      mediaUrl: string | null
      caption: string | null
      senderDisplayName?: string | null
      mediaFileName?: string | null
      linkPreview?: WhatsAppMessage['linkPreview']
      sentByProfileId: string | null
      senderPhone: string | null
      recipientPhone: string | null
      sentAt: string | null
      deliveredAt: string | null
      readAt: string | null
      failedAt: string | null
      isAutoResponse?: boolean
      createdAt: string
    }) => {
      if (row.conversationId !== currentMessagesConvIdRef.current) return

      // O INSERT chegou pelo canal realtime: o refetch de "heal" agendado por
      // handleConversationUpdated só fica redundante se o UPDATE refletir esta mesma mensagem.
      lastRealtimeInsertMessageAtRef.current = row.sentAt ?? row.createdAt
      if (messageRefetchTimerRef.current !== null) {
        window.clearTimeout(messageRefetchTimerRef.current)
        messageRefetchTimerRef.current = null
      }

      setMessages((prev) => {
        if (prev.some((m) => m.id === row.id)) return prev
        const msg: WhatsAppMessage = {
          id: row.id,
          conversationId: row.conversationId,
          direction: row.direction as 'INBOUND' | 'OUTBOUND',
          messageType: row.messageType,
          status: row.status,
          contentText: row.contentText,
          mediaUrl: row.mediaUrl,
          caption: row.caption,
          senderDisplayName: row.senderDisplayName ?? null,
          mediaFileName: row.mediaFileName ?? null,
          linkPreview: row.linkPreview ?? null,
          sentByProfileId: row.sentByProfileId,
          senderPhone: row.senderPhone,
          recipientPhone: row.recipientPhone,
          sentAt: row.sentAt,
          deliveredAt: row.deliveredAt,
          readAt: row.readAt,
          failedAt: row.failedAt,
          isAutoResponse: row.isAutoResponse ?? false,
          createdAt: row.createdAt,
        }
        return [...prev, msg]
      })

      // Conversa aberta recebendo mensagem nova: marca como lida no servidor
      // para o badge de não lidos não ficar dessincronizado (local mostra 0,
      // mas o servidor ainda contava como não lida).
      if (row.direction === 'INBOUND' && activeTeamId) {
        void whatsAppInboxService
          .markConversationRead(activeTeamId, supabaseId, row.conversationId)
          .then(() => {
            // O listener de WHATSAPP_UNREAD_CHANGED_EVENT já chama
            // refreshUnreadCounts; chamar direto aqui duplicava o fetch.
            dispatchWhatsAppUnreadChanged()
          })
          .catch((err: unknown) => {
            console.error('[useWhatsAppInbox] Erro ao marcar como lida automaticamente:', err)
          })
      }
    },
    [activeTeamId, supabaseId]
  )

  const handleMessageUpdated = useCallback(
    (row: {
      id: string
      conversationId: string
      status: string
      deliveredAt: string | null
      readAt: string | null
      failedAt: string | null
    }) => {
      if (row.conversationId !== currentMessagesConvIdRef.current) return
      setMessages((prev) =>
        prev.map((m) =>
          m.id === row.id
            ? {
                ...m,
                status: row.status,
                deliveredAt: row.deliveredAt,
                readAt: row.readAt,
                failedAt: row.failedAt,
              }
            : m
        )
      )
    },
    []
  )

  const handleConversationUpdated = useCallback(
    (row: {
      id: string
      configId: string
      contactPhone?: string
      contactName?: string | null
      contactNameSource?: WhatsAppConversation['contactNameSource']
      contactAvatarUrl?: string | null
      lastMessagePreview: string | null
      lastMessageAt: string | null
      unreadCount: number
      assignedProfileId: string | null
      leadId: string | null
      isArchived: boolean
      handoffMode?: 'BOT' | 'HUMAN'
    }) => {
      if (!conversationIdsRef.current.has(row.id)) {
        // RLS do realtime já aplica RBAC-alvo; aceitar INSERT/UPDATE de conversas
        // ainda não paginadas localmente (ex.: inbound novo para manager/operator).
        setConversations((prev) => {
          if (prev.some((c) => c.id === row.id)) return prev
          const newConv: WhatsAppConversation = {
            id: row.id,
            teamId: activeTeamId ?? '',
            configId: row.configId,
            leadId: row.leadId,
            externalChatId: null,
            contactPhone: row.contactPhone ?? '',
            contactName: row.contactName ?? null,
            contactNameSource: row.contactNameSource ?? 'PUSH_NAME',
            contactAvatarUrl: row.contactAvatarUrl ?? null,
            normalizedPhone: '',
            assignedProfileId: row.assignedProfileId,
            lastMessageAt: row.lastMessageAt,
            lastMessagePreview: row.lastMessagePreview,
            unreadCount: row.unreadCount,
            isArchived: row.isArchived,
            handoffMode: row.handoffMode ?? 'BOT',
            welcomeSentAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
          return sortConversationsByLastMessage([newConv, ...prev])
        })
        void refreshUnreadCounts()
        return
      }
      setConversations((prev) =>
        sortConversationsByLastMessage(
          prev.map((c) =>
            c.id === row.id
              ? {
                  ...c,
                  contactName: row.contactName ?? c.contactName,
                  contactNameSource: row.contactNameSource ?? c.contactNameSource,
                  contactAvatarUrl: row.contactAvatarUrl ?? c.contactAvatarUrl,
                  lastMessagePreview: row.lastMessagePreview,
                  lastMessageAt: row.lastMessageAt,
                  unreadCount: c.id === selectedConversationIdRef.current ? 0 : row.unreadCount,
                  assignedProfileId: row.assignedProfileId,
                  leadId: row.leadId,
                  isArchived: row.isArchived,
                  ...(row.handoffMode !== undefined ? { handoffMode: row.handoffMode } : {}),
                }
              : c
          )
        )
      )
      void refreshUnreadCounts()

      const openId = selectedConversationIdRef.current
      if (openId && row.id === openId && row.lastMessageAt) {
        const previousAt = selectedLastMessageAtRef.current
        if (previousAt !== row.lastMessageAt) {
          selectedLastMessageAtRef.current = row.lastMessageAt

          // O refetch abaixo é apenas "heal" para INSERT perdido pelo canal de
          // mensagens. Suprimir só quando o UPDATE da conversa corresponde à
          // mensagem já mergeada via INSERT — se lastMessageAt divergir, há
          // mensagem nova não recebida pelo canal de mensagens.
          const insertAlreadyCoversUpdate =
            lastRealtimeInsertMessageAtRef.current !== null &&
            row.lastMessageAt === lastRealtimeInsertMessageAtRef.current
          if (insertAlreadyCoversUpdate) return

          if (messageRefetchTimerRef.current !== null) {
            window.clearTimeout(messageRefetchTimerRef.current)
          }
          messageRefetchTimerRef.current = window.setTimeout(() => {
            messageRefetchTimerRef.current = null
            if (selectedConversationIdRef.current === openId) {
              void loadMessages(openId, 1)
            }
          }, 500)
        }
      }
    },
    [refreshUnreadCounts, loadMessages, activeTeamId]
  )

  const handleConversationInserted = useCallback(
    (row: {
      id: string
      teamId: string
      configId: string
      contactPhone: string
      contactName: string | null
      contactNameSource?: WhatsAppConversation['contactNameSource']
      contactAvatarUrl: string | null
      externalChatId: string | null
      normalizedPhone: string
      lastMessagePreview: string | null
      lastMessageAt: string | null
      unreadCount: number
      assignedProfileId: string | null
      leadId: string | null
      isArchived: boolean
      handoffMode?: 'BOT' | 'HUMAN'
      welcomeSentAt?: string | null
      createdAt: string
      updatedAt: string
    }) => {
      if (row.teamId !== activeTeamId) return

      const conversation: WhatsAppConversation = {
        id: row.id,
        teamId: row.teamId,
        configId: row.configId,
        leadId: row.leadId,
        externalChatId: row.externalChatId,
        contactPhone: row.contactPhone,
        contactName: row.contactName,
        contactNameSource: row.contactNameSource ?? 'PUSH_NAME',
        contactAvatarUrl: row.contactAvatarUrl,
        normalizedPhone: row.normalizedPhone,
        assignedProfileId: row.assignedProfileId,
        lastMessageAt: row.lastMessageAt,
        lastMessagePreview: row.lastMessagePreview,
        unreadCount: row.unreadCount,
        isArchived: row.isArchived,
        handoffMode: row.handoffMode ?? 'BOT',
        welcomeSentAt: row.welcomeSentAt ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }

      setConversations((prev) => {
        if (prev.some((item) => item.id === conversation.id)) return prev
        return sortConversationsByLastMessage(dedupeConversationsById([conversation, ...prev]))
      })
      setTotalConversations((prev) => prev + 1)
    },
    [activeTeamId]
  )

  useWhatsAppRealtime({
    enabled: Boolean(activeTeamId && config),
    teamId: activeTeamId ?? null,
    selectedConversationId,
    onMessageInserted: handleMessageInserted,
    onMessageUpdated: handleMessageUpdated,
    onConversationUpdated: handleConversationUpdated,
    onConversationInserted: handleConversationInserted,
    onRealtimeHealthChange: handleRealtimeHealthChange,
  })

  useEffect(() => {
    if (!activeTeamId || !config) return

    const HEALTHY_INTERVAL_MS = 60_000
    const UNHEALTHY_INTERVAL_MS = 12_000

    let currentIntervalId: number | null = null
    let wasHealthy = realtimeHealthyRef.current

    const startInterval = (healthy: boolean) => {
      if (currentIntervalId !== null) window.clearInterval(currentIntervalId)
      const intervalMs = healthy ? HEALTHY_INTERVAL_MS : UNHEALTHY_INTERVAL_MS
      currentIntervalId = window.setInterval(() => {
        if (realtimeHealthyRef.current) {
          void refreshUnreadCounts()
          return
        }
        void loadConversations(1, searchQueryRef.current, filterModeRef.current)
        const openId = selectedConversationIdRef.current
        if (openId) void loadMessages(openId, 1)
        void refreshUnreadCounts()
      }, intervalMs)
    }

    startInterval(wasHealthy)

    const checkIntervalId = window.setInterval(() => {
      const healthy = realtimeHealthyRef.current
      if (healthy !== wasHealthy) {
        wasHealthy = healthy
        startInterval(healthy)
      }
    }, 5_000)

    return () => {
      if (currentIntervalId !== null) window.clearInterval(currentIntervalId)
      window.clearInterval(checkIntervalId)
    }
  }, [activeTeamId, config, loadConversations, loadMessages, refreshUnreadCounts])

  const assignConversation = useCallback(
    (conversationId: string, profileId: string) => {
      if (!activeTeamId || isAssigningRef.current) return
      isAssigningRef.current = true

      const executeAssign = async () => {
        setIsAssigning(true)
        try {
          await whatsAppInboxService.assignConversation(activeTeamId, supabaseId, conversationId, profileId)
          setConversations((prev) =>
            prev.map((c) =>
              c.id === conversationId
                ? { ...c, assignedProfileId: profileId, handoffMode: 'HUMAN' as const }
                : c
            )
          )
          toast.success('Responsável atribuído com sucesso')
        } catch (error) {
          console.error('[useWhatsAppInbox] Erro ao atribuir conversa:', error)
          toast.error(error instanceof Error ? error.message : 'Não foi possível atribuir o responsável')
        } finally {
          setIsAssigning(false)
          isAssigningRef.current = false
        }
      }

      executeAssign().catch((error) => {
        console.error('[useWhatsAppInbox] Erro inesperado ao atribuir conversa:', error)
        setIsAssigning(false)
        isAssigningRef.current = false
      })
    },
    [activeTeamId, supabaseId]
  )

  const updateConversationHandoffState = useCallback(
    (conversationId: string, handoffMode: 'BOT' | 'HUMAN', assignedProfileId?: string | null) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                handoffMode,
                ...(assignedProfileId !== undefined ? { assignedProfileId } : {}),
              }
            : c
        )
      )
    },
    []
  )

  const takeoverConversation = useCallback(
    (conversationId: string) => {
      if (!activeTeamId || !currentProfileId || isChangingHandoffRef.current) return
      isChangingHandoffRef.current = true

      const execute = async () => {
        setIsChangingHandoff(true)
        try {
          await whatsAppInboxService.takeoverConversation(activeTeamId, supabaseId, conversationId)
          updateConversationHandoffState(conversationId, 'HUMAN', currentProfileId)
          toast.success('Conversa assumida com sucesso')
        } catch (error) {
          console.error('[useWhatsAppInbox] Erro ao assumir conversa:', error)
          toast.error(error instanceof Error ? error.message : 'Não foi possível assumir a conversa')
        } finally {
          setIsChangingHandoff(false)
          isChangingHandoffRef.current = false
        }
      }

      execute().catch((error) => {
        console.error('[useWhatsAppInbox] Erro inesperado ao assumir conversa:', error)
        setIsChangingHandoff(false)
        isChangingHandoffRef.current = false
      })
    },
    [activeTeamId, supabaseId, currentProfileId, updateConversationHandoffState]
  )

  const setHandoffMode = useCallback(
    (conversationId: string, mode: 'BOT' | 'HUMAN') => {
      if (!activeTeamId || isChangingHandoffRef.current) return
      isChangingHandoffRef.current = true

      const execute = async () => {
        setIsChangingHandoff(true)
        try {
          await whatsAppInboxService.setHandoffMode(activeTeamId, supabaseId, conversationId, mode)
          updateConversationHandoffState(conversationId, mode)
          toast.success(mode === 'BOT' ? 'Conversa devolvida ao bot' : 'Conversa assumida para atendimento humano')
        } catch (error) {
          console.error('[useWhatsAppInbox] Erro ao alterar handoff:', error)
          toast.error(
            error instanceof Error ? error.message : 'Não foi possível alterar o modo de atendimento'
          )
        } finally {
          setIsChangingHandoff(false)
          isChangingHandoffRef.current = false
        }
      }

      execute().catch((error) => {
        console.error('[useWhatsAppInbox] Erro inesperado ao alterar handoff:', error)
        setIsChangingHandoff(false)
        isChangingHandoffRef.current = false
      })
    },
    [activeTeamId, supabaseId, updateConversationHandoffState]
  )

  const linkLead = useCallback(
    (conversationId: string, leadId: string) => {
      if (!activeTeamId || isLinkingLeadRef.current) return
      isLinkingLeadRef.current = true

      const execute = async () => {
        setIsLinkingLead(true)
        try {
          const updated = await whatsAppInboxService.linkLead(
            activeTeamId,
            supabaseId,
            conversationId,
            leadId
          )
          setConversations((prev) =>
            prev.map((c) =>
              c.id === conversationId
                ? updated
                  ? { ...c, ...updated, leadId: updated.leadId ?? leadId }
                  : { ...c, leadId }
                : c
            )
          )
          toast.success('Lead vinculado com sucesso')
        } catch (error) {
          console.error('[useWhatsAppInbox] Erro ao vincular lead:', error)
          toast.error(error instanceof Error ? error.message : 'Não foi possível vincular o lead')
        } finally {
          setIsLinkingLead(false)
          isLinkingLeadRef.current = false
        }
      }

      execute().catch((error) => {
        console.error('[useWhatsAppInbox] Erro inesperado ao vincular lead:', error)
        setIsLinkingLead(false)
        isLinkingLeadRef.current = false
      })
    },
    [activeTeamId, supabaseId]
  )

  const updateContactName = useCallback(
    async (conversationId: string, contactName: string) => {
      if (!activeTeamId || isUpdatingContactNameRef.current) return
      isUpdatingContactNameRef.current = true

      try {
        setIsUpdatingContactName(true)
        const updated = await whatsAppInboxService.updateConversationContactName(
          activeTeamId,
          supabaseId,
          conversationId,
          contactName
        )
        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? { ...c, ...updated } : c))
        )
        toast.success('Nome do contato atualizado')
      } catch (error) {
        console.error('[useWhatsAppInbox] Erro ao atualizar nome do contato:', error)
        toast.error(
          error instanceof Error ? error.message : 'Não foi possível atualizar o nome do contato'
        )
        throw error
      } finally {
        setIsUpdatingContactName(false)
        isUpdatingContactNameRef.current = false
      }
    },
    [activeTeamId, supabaseId]
  )

  const searchLeads = useCallback(
    async (query: string): Promise<LeadSearchResult[]> => {
      if (!activeTeamId || !activeTeam?.role || !query.trim()) return []
      try {
        return await whatsAppInboxService.searchLeads(
          activeTeamId,
          supabaseId,
          query,
          activeTeam.role
        )
      } catch (error) {
        console.error('[useWhatsAppInbox] Erro ao buscar leads:', error)
        return []
      }
    },
    [activeTeamId, activeTeam?.role, supabaseId]
  )

  const archiveConversation = useCallback(
    (conversationId: string) => {
      if (!activeTeamId || isArchivingRef.current) return
      isArchivingRef.current = true

      const execute = async () => {
        setIsArchiving(true)
        try {
          await whatsAppInboxService.archiveConversation(activeTeamId, supabaseId, conversationId)
          setConversations((prev) => prev.filter((c) => c.id !== conversationId))
          if (selectedConversationId === conversationId) setSelectedConversationId(null)
          toast.success('Conversa arquivada com sucesso')
        } catch (error) {
          console.error('[useWhatsAppInbox] Erro ao arquivar conversa:', error)
          toast.error(error instanceof Error ? error.message : 'Não foi possível arquivar a conversa')
        } finally {
          setIsArchiving(false)
          isArchivingRef.current = false
        }
      }

      execute().catch((error) => {
        console.error('[useWhatsAppInbox] Erro inesperado ao arquivar conversa:', error)
        setIsArchiving(false)
        isArchivingRef.current = false
      })
    },
    [activeTeamId, supabaseId, selectedConversationId]
  )

  const unarchiveConversation = useCallback(
    (conversationId: string) => {
      if (!activeTeamId || isArchivingRef.current) return
      isArchivingRef.current = true

      const execute = async () => {
        setIsArchiving(true)
        try {
          await whatsAppInboxService.unarchiveConversation(activeTeamId, supabaseId, conversationId)
          setConversations((prev) => prev.filter((c) => c.id !== conversationId))
          if (selectedConversationId === conversationId) setSelectedConversationId(null)
          toast.success('Conversa desarquivada com sucesso')
        } catch (error) {
          console.error('[useWhatsAppInbox] Erro ao desarquivar conversa:', error)
          toast.error(error instanceof Error ? error.message : 'Não foi possível desarquivar a conversa')
        } finally {
          setIsArchiving(false)
          isArchivingRef.current = false
        }
      }

      execute().catch((error) => {
        console.error('[useWhatsAppInbox] Erro inesperado ao desarquivar conversa:', error)
        setIsArchiving(false)
        isArchivingRef.current = false
      })
    },
    [activeTeamId, supabaseId, selectedConversationId]
  )

  const deleteConversation = useCallback(
    (conversationId: string) => {
      if (!activeTeamId || isDeletingRef.current) return
      isDeletingRef.current = true

      const execute = async () => {
        setIsDeleting(true)
        try {
          await whatsAppInboxService.deleteConversation(activeTeamId, supabaseId, conversationId)
          setConversations((prev) => prev.filter((c) => c.id !== conversationId))
          if (selectedConversationId === conversationId) setSelectedConversationId(null)
          toast.success('Conversa excluída com sucesso')
        } catch (error) {
          console.error('[useWhatsAppInbox] Erro ao excluir conversa:', error)
          toast.error(error instanceof Error ? error.message : 'Não foi possível excluir a conversa')
        } finally {
          setIsDeleting(false)
          isDeletingRef.current = false
        }
      }

      execute().catch((error) => {
        console.error('[useWhatsAppInbox] Erro inesperado ao excluir conversa:', error)
        setIsDeleting(false)
        isDeletingRef.current = false
      })
    },
    [activeTeamId, supabaseId, selectedConversationId]
  )

  const createConversation = useCallback(
    async (input: { phone: string; contactName?: string; initialMessage?: string }) => {
      if (!activeTeamId || isCreatingConversation) return
      setIsCreatingConversation(true)
      try {
        const conversation = await whatsAppInboxService.createConversation(
          activeTeamId,
          supabaseId,
          input
        )
        const conversationWithAssignee = currentProfileId
          ? { ...conversation, assignedProfileId: conversation.assignedProfileId ?? currentProfileId }
          : conversation
        setConversations((prev) => dedupeConversationsById([conversationWithAssignee, ...prev]))
        setSelectedConversationId(conversation.id)
        setMessages([])
        setTotalMessages(0)
        setMessagePage(1)
        void loadMessages(conversation.id, 1)
        toast.success('Conversa criada com sucesso')
        return conversationWithAssignee
      } catch (error) {
        console.error('[useWhatsAppInbox] Erro ao criar conversa:', error)
        toast.error(error instanceof Error ? error.message : 'Não foi possível criar a conversa')
        throw error
      } finally {
        setIsCreatingConversation(false)
      }
    },
    [activeTeamId, supabaseId, isCreatingConversation, loadMessages, currentProfileId]
  )

  const loadContacts = useCallback(
    async (groupJid?: string) => {
      if (!activeTeamId) {
        setContacts([])
        return
      }
      setIsLoadingContacts(true)
      try {
        const fetched = await whatsAppInboxService.fetchContacts(activeTeamId, supabaseId, {
          groupJid,
        })
        setContacts(fetched)
      } catch (error) {
        console.error('[useWhatsAppInbox] Erro ao carregar contatos:', error)
      } finally {
        setIsLoadingContacts(false)
      }
    },
    [activeTeamId, supabaseId]
  )

  useEffect(() => {
    if (!activeTeamId || config?.status !== 'CONNECTED') {
      setContacts([])
      return
    }
    void loadContacts(selectedConversation?.externalChatId ?? undefined)
  }, [activeTeamId, config?.status, selectedConversation?.externalChatId, loadContacts])

  const syncPhoneContacts = useCallback(
    async (conversationId?: string) => {
      if (!activeTeamId || isSyncingContacts) {
        return { imported: 0, updatedConversations: 0, totalContacts: 0 }
      }
      setIsSyncingContacts(true)
      try {
        const result = await whatsAppInboxService.syncPhoneContacts(
          activeTeamId,
          supabaseId,
          conversationId
        )
        await loadContacts(selectedConversation?.externalChatId ?? undefined)
        if (result.imported > 0 || result.updatedConversations > 0) {
          void loadConversations(1, pendingSearchRef.current, filterModeRef.current)
          toast.success(
            `${result.imported} contato(s) importado(s), ${result.updatedConversations} conversa(s) atualizada(s)`
          )
        } else {
          toast.info('Nenhum contato correspondente encontrado na agenda')
        }
        return result
      } catch (error) {
        console.error('[useWhatsAppInbox] Erro ao sincronizar contatos:', error)
        toast.error(error instanceof Error ? error.message : 'Não foi possível sincronizar os contatos')
        throw error
      } finally {
        setIsSyncingContacts(false)
      }
    },
    [
      activeTeamId,
      supabaseId,
      isSyncingContacts,
      loadConversations,
      loadContacts,
      selectedConversation?.externalChatId,
    ]
  )

  const syncGroupParticipants = useCallback(
    async (conversationId: string) => {
      if (!activeTeamId || isSyncingGroupParticipants) {
        return { imported: 0, totalParticipants: 0 }
      }
      setIsSyncingGroupParticipants(true)
      try {
        const result = await whatsAppInboxService.syncGroupParticipants(
          activeTeamId,
          supabaseId,
          conversationId
        )
        await loadContacts(selectedConversation?.externalChatId ?? undefined)
        toast.success(`${result.imported} participante(s) sincronizado(s)`)
        return result
      } catch (error) {
        console.error('[useWhatsAppInbox] Erro ao sincronizar participantes:', error)
        toast.error(
          error instanceof Error ? error.message : 'Não foi possível sincronizar os participantes'
        )
        throw error
      } finally {
        setIsSyncingGroupParticipants(false)
      }
    },
    [activeTeamId, supabaseId, isSyncingGroupParticipants, loadContacts, selectedConversation?.externalChatId]
  )

  return {
    config,
    conversations,
    selectedConversationId,
    selectedConversation,
    messages,
    totalConversations,
    isLoadingConfig,
    isLoadingConversations,
    isLoadingMessages,
    isLoadingOlderMessages,
    hasMoreMessages,
    isSending,
    searchQuery,
    filterMode,
    page,
    hasMoreConversations,
    isAssigning,
    isChangingHandoff,
    isLinkingLead,
    isUpdatingContactName,
    isArchiving,
    isDeleting,
    teamMembers,
    isLoadingTeamMembers,
    currentProfileId,
    activeTeamId,
    canManageAssignment,
    isCreatingConversation,
    isSyncingContacts,
    isSyncingGroupParticipants,
    isLoadingContacts,
    contacts,
    contactLookup,
    isTeamMaster,
    unreadTotal,
    allUnreadTotal,
    mineUnreadTotal,
    selectConversation,
    loadMoreConversations,
    loadOlderMessages,
    sendMessage,
    resendMessage,
    setSearchQuery,
    setFilterMode,
    assignConversation,
    takeoverConversation,
    setHandoffMode,
    loadTeamMembers,
    linkLead,
    updateContactName,
    searchLeads,
    archiveConversation,
    unarchiveConversation,
    deleteConversation,
    createConversation,
    syncPhoneContacts,
    syncGroupParticipants,
    loadContacts,
  }
}
