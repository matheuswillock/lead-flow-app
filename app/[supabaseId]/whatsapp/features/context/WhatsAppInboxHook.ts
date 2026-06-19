"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useTeamContext } from '@/app/context/TeamContext'
import { useUserContext } from '@/app/context/UserContext'
import { isManagerLikeRole } from '@/lib/roles'
import { useWhatsAppRealtime } from '@/hooks/useWhatsAppRealtime'
import { whatsAppInboxService } from '../services/WhatsAppInboxService'
import type {
  ConversationFilterMode,
  InboxActions,
  InboxState,
  LeadSearchResult,
  TeamMember,
  WhatsAppConfig,
  WhatsAppConversation,
  WhatsAppMessage,
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
  const [isLinkingLead, setIsLinkingLead] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
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

  const messagesRef = useRef<WhatsAppMessage[]>([])
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId) ?? null

  const currentProfileId = user?.id ?? null
  const canManageAssignment = isTeamMaster || isManagerLikeRole(activeTeam?.role)
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
      lastSuccessConfigKeyRef.current = key
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
        setConversations((prev) =>
          pageNum > 1
            ? dedupeConversationsById([...prev, ...result.conversations])
            : result.conversations
        )
        setTotalConversations(result.total)
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
          setMessages(result.messages)
        } else {
          // Older messages go at the top; API returns newest-first so reverse before prepending
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id))
            const fresh = result.messages.filter((m) => !existingIds.has(m.id))
            return [...fresh, ...prev]
          })
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
    void loadConversations(1, pendingSearchRef.current, filterModeRef.current)
    setPage(1)
  }, [loadConversations, activeTeamId])

  const selectConversation = useCallback(
    (id: string) => {
      setSelectedConversationId(id)
      setMessages([])
      setTotalMessages(0)
      setMessagePage(1)
      void loadMessages(id, 1)

      // Lazy-load team members on first conversation open for operator name display
      if (teamMembers.length === 0) void loadTeamMembersInternal()

      // Zero the unread count locally and fire-and-forget the server update
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
      )
      if (activeTeamId) {
        whatsAppInboxService
          .markConversationRead(activeTeamId, supabaseId, id)
          .catch((err: unknown) => {
            console.error('[useWhatsAppInbox] Erro ao marcar como lida:', err)
          })
      }
    },
    [loadMessages, activeTeamId, supabaseId, teamMembers.length]
  )

  const loadOlderMessages = useCallback(() => {
    if (!selectedConversationId || isLoadingOlderMessages) return
    const nextPage = messagePage + 1
    setMessagePage(nextPage)
    void loadMessages(selectedConversationId, nextPage)
  }, [selectedConversationId, messagePage, isLoadingOlderMessages, loadMessages])

  const loadMoreConversations = useCallback(() => {
    if (isLoadingConversations) return
    const nextPage = page + 1
    setPage(nextPage)
    void loadConversations(nextPage, pendingSearchRef.current, filterModeRef.current)
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
    async (conversationId: string, text: string, optimisticId: string) => {
      if (!activeTeamId) return
      setIsSending(true)
      try {
        const result = await whatsAppInboxService.sendMessage(
          activeTeamId,
          supabaseId,
          conversationId,
          text
        )
        // Promote the optimistic bubble to the real message id so the realtime
        // INSERT for the same id is de-duplicated by handleMessageInserted.
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticId
              ? { ...m, id: result.messageId, status: 'SENT', sentAt: m.sentAt ?? new Date().toISOString() }
              : m
          )
        )
        toast.success('Mensagem enviada')
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
      }
    },
    [activeTeamId, supabaseId]
  )

  const sendMessage = useCallback(
    (text: string) => {
      if (!activeTeamId || !selectedConversationId || isSending) return

      const trimmedText = text.trim()
      if (!trimmedText) return

      const optimisticId = `optimistic-${Date.now()}`
      const optimisticMessage: WhatsAppMessage = {
        id: optimisticId,
        conversationId: selectedConversationId,
        direction: 'OUTBOUND',
        messageType: 'text',
        status: 'PENDING',
        contentText: trimmedText,
        sentByProfileId: null,
        senderPhone: null,
        recipientPhone: null,
        sentAt: new Date().toISOString(),
        deliveredAt: null,
        readAt: null,
        failedAt: null,
        createdAt: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, optimisticMessage])

      performSend(selectedConversationId, trimmedText, optimisticId).catch((error) => {
        console.error('[useWhatsAppInbox] Erro inesperado ao enviar mensagem:', error)
        setIsSending(false)
      })
    },
    [activeTeamId, selectedConversationId, isSending, performSend]
  )

  const resendMessage = useCallback(
    (messageId: string) => {
      if (isSending) return

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
      })
    },
    [isSending, performSend]
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
    (row: { id: string; conversationId: string; direction: string; messageType: string; status: string; contentText: string | null; sentByProfileId: string | null; senderPhone: string | null; recipientPhone: string | null; sentAt: string | null; deliveredAt: string | null; readAt: string | null; failedAt: string | null; createdAt: string }) => {
      if (row.conversationId !== currentMessagesConvIdRef.current) return
      setMessages((prev) => {
        if (prev.some((m) => m.id === row.id)) return prev
        const msg: WhatsAppMessage = {
          id: row.id,
          conversationId: row.conversationId,
          direction: row.direction as 'INBOUND' | 'OUTBOUND',
          messageType: row.messageType,
          status: row.status,
          contentText: row.contentText,
          sentByProfileId: row.sentByProfileId,
          senderPhone: row.senderPhone,
          recipientPhone: row.recipientPhone,
          sentAt: row.sentAt,
          deliveredAt: row.deliveredAt,
          readAt: row.readAt,
          failedAt: row.failedAt,
          createdAt: row.createdAt,
        }
        return [...prev, msg]
      })
    },
    []
  )

  const handleConversationUpdated = useCallback(
    (row: { id: string; configId: string; lastMessagePreview: string | null; lastMessageAt: string | null; unreadCount: number; assignedProfileId: string | null; leadId: string | null; isArchived: boolean }) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === row.id
            ? {
                ...c,
                lastMessagePreview: row.lastMessagePreview,
                lastMessageAt: row.lastMessageAt,
                unreadCount: c.id === selectedConversationId ? 0 : row.unreadCount,
                assignedProfileId: row.assignedProfileId,
                leadId: row.leadId,
                isArchived: row.isArchived,
              }
            : c
        )
      )
    },
    [selectedConversationId]
  )

  useWhatsAppRealtime({
    enabled: Boolean(activeTeamId && config),
    teamId: activeTeamId ?? null,
    selectedConversationId,
    onMessageInserted: handleMessageInserted,
    onConversationUpdated: handleConversationUpdated,
  })

  const assignConversation = useCallback(
    (conversationId: string, profileId: string) => {
      if (!activeTeamId || isAssigning) return

      const executeAssign = async () => {
        setIsAssigning(true)
        try {
          await whatsAppInboxService.assignConversation(activeTeamId, supabaseId, conversationId, profileId)
          setConversations((prev) =>
            prev.map((c) => (c.id === conversationId ? { ...c, assignedProfileId: profileId } : c))
          )
          toast.success('Responsável atribuído com sucesso')
        } catch (error) {
          console.error('[useWhatsAppInbox] Erro ao atribuir conversa:', error)
          toast.error(error instanceof Error ? error.message : 'Não foi possível atribuir o responsável')
        } finally {
          setIsAssigning(false)
        }
      }

      executeAssign().catch((error) => {
        console.error('[useWhatsAppInbox] Erro inesperado ao atribuir conversa:', error)
        setIsAssigning(false)
      })
    },
    [activeTeamId, supabaseId, isAssigning]
  )

  const linkLead = useCallback(
    (conversationId: string, leadId: string) => {
      if (!activeTeamId || isLinkingLead) return

      const execute = async () => {
        setIsLinkingLead(true)
        try {
          await whatsAppInboxService.linkLead(activeTeamId, supabaseId, conversationId, leadId)
          setConversations((prev) =>
            prev.map((c) => (c.id === conversationId ? { ...c, leadId } : c))
          )
          toast.success('Lead vinculado com sucesso')
        } catch (error) {
          console.error('[useWhatsAppInbox] Erro ao vincular lead:', error)
          toast.error(error instanceof Error ? error.message : 'Não foi possível vincular o lead')
        } finally {
          setIsLinkingLead(false)
        }
      }

      execute().catch((error) => {
        console.error('[useWhatsAppInbox] Erro inesperado ao vincular lead:', error)
        setIsLinkingLead(false)
      })
    },
    [activeTeamId, supabaseId, isLinkingLead]
  )

  const searchLeads = useCallback(
    async (query: string): Promise<LeadSearchResult[]> => {
      if (!activeTeamId || !query.trim()) return []
      try {
        return await whatsAppInboxService.searchLeads(activeTeamId, supabaseId, query)
      } catch (error) {
        console.error('[useWhatsAppInbox] Erro ao buscar leads:', error)
        return []
      }
    },
    [activeTeamId, supabaseId]
  )

  const archiveConversation = useCallback(
    (conversationId: string) => {
      if (!activeTeamId || isArchiving) return

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
        }
      }

      execute().catch((error) => {
        console.error('[useWhatsAppInbox] Erro inesperado ao arquivar conversa:', error)
        setIsArchiving(false)
      })
    },
    [activeTeamId, supabaseId, isArchiving, selectedConversationId]
  )

  const unarchiveConversation = useCallback(
    (conversationId: string) => {
      if (!activeTeamId || isArchiving) return

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
        }
      }

      execute().catch((error) => {
        console.error('[useWhatsAppInbox] Erro inesperado ao desarquivar conversa:', error)
        setIsArchiving(false)
      })
    },
    [activeTeamId, supabaseId, isArchiving, selectedConversationId]
  )

  const deleteConversation = useCallback(
    (conversationId: string) => {
      if (!activeTeamId || isDeleting) return

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
        }
      }

      execute().catch((error) => {
        console.error('[useWhatsAppInbox] Erro inesperado ao excluir conversa:', error)
        setIsDeleting(false)
      })
    },
    [activeTeamId, supabaseId, isDeleting, selectedConversationId]
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
    isLinkingLead,
    isArchiving,
    isDeleting,
    teamMembers,
    isLoadingTeamMembers,
    currentProfileId,
    canManageAssignment,
    selectConversation,
    loadMoreConversations,
    loadOlderMessages,
    sendMessage,
    resendMessage,
    setSearchQuery,
    setFilterMode,
    assignConversation,
    loadTeamMembers,
    linkLead,
    searchLeads,
    archiveConversation,
    unarchiveConversation,
    deleteConversation,
  }
}
