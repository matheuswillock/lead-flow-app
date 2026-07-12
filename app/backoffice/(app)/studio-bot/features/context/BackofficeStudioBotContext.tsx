"use client"

import {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { toast } from "sonner"
import { useBackofficeUser } from "@/app/backoffice/context/BackofficeUserContext"
import type { IBackofficeStudioBotService } from "../services/IBackofficeStudioBotService"
import type {
  BackofficeStudioBotAuthChallenge,
  BackofficeStudioBotAuthChallengeFilters,
  BackofficeStudioBotChannel,
  BackofficeStudioBotChannelFormData,
  BackofficeStudioBotContextValue,
  BackofficeStudioBotConversationItem,
  BackofficeStudioBotConversationsFilters,
  BackofficeStudioBotMessage,
  BackofficeStudioBotPagination,
  BackofficeStudioBotProfileFormData,
  BackofficeStudioBotQrCode,
  BackofficeStudioBotUserLink,
} from "./BackofficeStudioBotTypes"

const DEFAULT_PAGINATION: BackofficeStudioBotPagination = {
  page: 1,
  pageSize: 20,
  totalItems: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
}

const DEFAULT_CONVERSATIONS_FILTERS: BackofficeStudioBotConversationsFilters = {
  search: "",
}

const DEFAULT_AUTH_FILTERS: BackofficeStudioBotAuthChallengeFilters = {
  source: "all",
  status: "all",
}

export const BackofficeStudioBotContext = createContext<BackofficeStudioBotContextValue | null>(
  null
)

interface ProviderProps {
  children: ReactNode
  service: IBackofficeStudioBotService
}

export function BackofficeStudioBotProvider({ children, service }: ProviderProps) {
  const { user } = useBackofficeUser()
  const canManage = !user?.isOperator

  const [channel, setChannel] = useState<BackofficeStudioBotChannel | null>(null)
  const [qrCode, setQrCode] = useState<BackofficeStudioBotQrCode | null>(null)
  const [conversations, setConversations] = useState<BackofficeStudioBotConversationItem[]>([])
  const [conversationsPagination, setConversationsPagination] =
    useState<BackofficeStudioBotPagination>(DEFAULT_PAGINATION)
  const [conversationsFilters, setConversationsFiltersState] =
    useState<BackofficeStudioBotConversationsFilters>(DEFAULT_CONVERSATIONS_FILTERS)
  const [selectedUserLinkId, setSelectedUserLinkId] = useState<string | null>(null)
  const [messages, setMessages] = useState<BackofficeStudioBotMessage[]>([])
  const [userLinks, setUserLinks] = useState<BackofficeStudioBotUserLink[]>([])
  const [userLinksPagination, setUserLinksPagination] =
    useState<BackofficeStudioBotPagination>(DEFAULT_PAGINATION)
  const [authChallenges, setAuthChallenges] = useState<BackofficeStudioBotAuthChallenge[]>([])
  const [authChallengesPagination, setAuthChallengesPagination] =
    useState<BackofficeStudioBotPagination>(DEFAULT_PAGINATION)
  const [authChallengesFilters, setAuthChallengesFiltersState] =
    useState<BackofficeStudioBotAuthChallengeFilters>(DEFAULT_AUTH_FILTERS)

  const [isLoadingChannel, setIsLoadingChannel] = useState(false)
  const [isLoadingConversations, setIsLoadingConversations] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isTestingPing, setIsTestingPing] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [isSyncingProfile, setIsSyncingProfile] = useState(false)
  const [isLoadingUserLinks, setIsLoadingUserLinks] = useState(false)
  const [isRevokingLink, setIsRevokingLink] = useState(false)
  const [isLoadingAuthChallenges, setIsLoadingAuthChallenges] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const conversationsRequestRef = useRef(0)
  const messagesRequestRef = useRef(0)

  const loadChannel = useCallback(async () => {
    setIsLoadingChannel(true)
    setError(null)
    try {
      const result = await service.getChannel()
      setChannel(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao carregar canal"
      setError(message)
    } finally {
      setIsLoadingChannel(false)
    }
  }, [service])

  const updateChannelProfile = useCallback(
    async (form: BackofficeStudioBotProfileFormData) => {
      if (!canManage) return false
      setIsSavingProfile(true)
      try {
        const output = await service.updateChannelProfile(form)
        if (!output.isValid) {
          toast.error(output.errorMessages?.[0] ?? "Erro ao salvar perfil")
          return false
        }
        const updated = output.result?.channel as BackofficeStudioBotChannel | undefined
        if (updated) setChannel(updated)
        toast.success(output.successMessages?.[0] ?? "Perfil atualizado")
        return true
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao salvar perfil")
        return false
      } finally {
        setIsSavingProfile(false)
      }
    },
    [canManage, service]
  )

  const updateChannel = useCallback(
    async (form: BackofficeStudioBotChannelFormData) => {
      if (!canManage) return false
      setIsSavingProfile(true)
      try {
        const output = await service.updateChannel(form)
        if (!output.isValid) {
          toast.error(output.errorMessages?.[0] ?? "Erro ao salvar canal")
          return false
        }
        const updated = output.result?.channel as BackofficeStudioBotChannel | undefined
        if (updated) setChannel(updated)
        toast.success(output.successMessages?.[0] ?? "Canal atualizado")
        return true
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao salvar canal")
        return false
      } finally {
        setIsSavingProfile(false)
      }
    },
    [canManage, service]
  )

  const testPing = useCallback(async () => {
    if (!canManage) return false
    setIsTestingPing(true)
    try {
      const output = await service.testPing()
      if (!output.isValid) {
        toast.error(output.errorMessages?.[0] ?? "Ping N8N falhou")
        return false
      }
      toast.success("N8N respondeu com sucesso")
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao testar ping")
      return false
    } finally {
      setIsTestingPing(false)
    }
  }, [canManage, service])

  const uploadChannelAvatar = useCallback(
    async (file: File) => {
      if (!canManage) return false
      setIsUploadingAvatar(true)
      try {
        const output = await service.uploadChannelAvatar(file)
        if (!output.isValid) {
          toast.error(output.errorMessages?.[0] ?? "Erro ao enviar avatar")
          return false
        }
        const updated = output.result?.channel as BackofficeStudioBotChannel | undefined
        if (updated) setChannel(updated)
        toast.success(output.successMessages?.[0] ?? "Avatar atualizado")
        return true
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao enviar avatar")
        return false
      } finally {
        setIsUploadingAvatar(false)
      }
    },
    [canManage, service]
  )

  const reconnectChannel = useCallback(async () => {
    if (!canManage) return false
    setIsReconnecting(true)
    try {
      const output = await service.reconnectChannel()
      if (!output.isValid) {
        toast.error(output.errorMessages?.[0] ?? "Erro ao reconectar canal")
        if (output.result?.channel) setChannel(output.result.channel)
        setQrCode(null)
        return false
      }
      if (output.result?.channel) setChannel(output.result.channel)
      setQrCode(output.result?.qrCode ?? null)
      toast.success(
        output.result?.qrCode ? "Escaneie o QR Code para conectar" : "Bethânia já está conectada"
      )
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao reconectar canal")
      setQrCode(null)
      return false
    } finally {
      setIsReconnecting(false)
    }
  }, [canManage, service])

  const disconnectChannel = useCallback(async () => {
    if (!canManage) return false
    setIsDisconnecting(true)
    try {
      const output = await service.disconnectChannel()
      if (!output.isValid) {
        toast.error(output.errorMessages?.[0] ?? "Erro ao desconectar canal")
        return false
      }
      if (output.result?.channel) setChannel(output.result.channel)
      setQrCode(null)
      toast.success(output.successMessages?.[0] ?? "WhatsApp da Bethânia desconectado")
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao desconectar canal")
      return false
    } finally {
      setIsDisconnecting(false)
    }
  }, [canManage, service])

  const replaceChannelConnection = useCallback(async () => {
    if (!canManage) return false
    const disconnected = await disconnectChannel()
    if (!disconnected) return false
    return reconnectChannel()
  }, [canManage, disconnectChannel, reconnectChannel])

  const refreshChannelConnection = useCallback(async () => {
    if (!canManage) return false
    try {
      const output = await service.refreshChannelConnection()
      if (!output.isValid) {
        return false
      }
      if (output.result?.channel) setChannel(output.result.channel)
      if (output.result?.connected) {
        setQrCode(null)
        toast.success("Bethânia conectada no WhatsApp")
      }
      return Boolean(output.result?.connected)
    } catch (err) {
      console.error("[BackofficeStudioBotContext][refreshChannelConnection]", err)
      return false
    }
  }, [canManage, service])

  const clearQrCode = useCallback(() => {
    setQrCode(null)
  }, [])

  const syncChannelProfile = useCallback(async () => {
    if (!canManage) return false
    setIsSyncingProfile(true)
    try {
      const output = await service.syncChannelProfile()
      if (!output.isValid) {
        toast.error(output.errorMessages?.[0] ?? "Erro ao sincronizar perfil")
        return false
      }
      toast.success(output.successMessages?.[0] ?? "Sincronização solicitada")
      await loadChannel()
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao sincronizar perfil")
      return false
    } finally {
      setIsSyncingProfile(false)
    }
  }, [canManage, loadChannel, service])

  const loadConversations = useCallback(async () => {
    const requestId = ++conversationsRequestRef.current
    setIsLoadingConversations(true)
    setError(null)
    try {
      const result = await service.listConversations(conversationsFilters, {
        page: conversationsPagination.page,
        pageSize: conversationsPagination.pageSize,
      })
      if (requestId !== conversationsRequestRef.current) return
      setConversations(result.items)
      setConversationsPagination(result.pagination)
    } catch (err) {
      if (requestId !== conversationsRequestRef.current) return
      const message = err instanceof Error ? err.message : "Erro ao carregar conversas"
      setError(message)
    } finally {
      if (requestId === conversationsRequestRef.current) {
        setIsLoadingConversations(false)
      }
    }
  }, [conversationsFilters, conversationsPagination.page, conversationsPagination.pageSize, service])

  const loadMessages = useCallback(
    async (userLinkId: string) => {
      const requestId = ++messagesRequestRef.current
      setIsLoadingMessages(true)
      try {
        const result = await service.listMessages(userLinkId, { limit: 50 })
        if (requestId !== messagesRequestRef.current) return
        setMessages(result.messages)
      } catch (err) {
        if (requestId !== messagesRequestRef.current) return
        toast.error(err instanceof Error ? err.message : "Erro ao carregar mensagens")
        setMessages([])
      } finally {
        if (requestId === messagesRequestRef.current) {
          setIsLoadingMessages(false)
        }
      }
    },
    [service]
  )

  const selectConversation = useCallback(
    (userLinkId: string) => {
      setSelectedUserLinkId(userLinkId)
      void loadMessages(userLinkId)
    },
    [loadMessages]
  )

  const loadUserLinks = useCallback(async () => {
    setIsLoadingUserLinks(true)
    setError(null)
    try {
      const result = await service.listUserLinks({
        page: userLinksPagination.page,
        pageSize: userLinksPagination.pageSize,
      })
      setUserLinks(result.items)
      setUserLinksPagination(result.pagination)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao carregar vínculos"
      setError(message)
    } finally {
      setIsLoadingUserLinks(false)
    }
  }, [service, userLinksPagination.page, userLinksPagination.pageSize])

  const revokeUserLink = useCallback(
    async (userLinkId: string) => {
      if (!canManage) return false
      setIsRevokingLink(true)
      try {
        const output = await service.revokeUserLink(userLinkId)
        if (!output.isValid) {
          toast.error(output.errorMessages?.[0] ?? "Erro ao revogar vínculo")
          return false
        }
        toast.success(output.successMessages?.[0] ?? "Vínculo revogado")
        await loadUserLinks()
        return true
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao revogar vínculo")
        return false
      } finally {
        setIsRevokingLink(false)
      }
    },
    [canManage, loadUserLinks, service]
  )

  const loadAuthChallenges = useCallback(async () => {
    setIsLoadingAuthChallenges(true)
    setError(null)
    try {
      const result = await service.listAuthChallenges(authChallengesFilters, {
        page: authChallengesPagination.page,
        pageSize: authChallengesPagination.pageSize,
      })
      setAuthChallenges(result.items)
      setAuthChallengesPagination(result.pagination)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao carregar verificações"
      setError(message)
    } finally {
      setIsLoadingAuthChallenges(false)
    }
  }, [
    authChallengesFilters,
    authChallengesPagination.page,
    authChallengesPagination.pageSize,
    service,
  ])

  const setConversationsFilters = useCallback(
    (filters: BackofficeStudioBotConversationsFilters) => {
      setConversationsFiltersState(filters)
      setConversationsPagination((prev) => ({ ...prev, page: 1 }))
    },
    []
  )

  const setConversationsPage = useCallback((page: number) => {
    setConversationsPagination((prev) => ({ ...prev, page }))
  }, [])

  const setUserLinksPage = useCallback((page: number) => {
    setUserLinksPagination((prev) => ({ ...prev, page }))
  }, [])

  const setAuthChallengesFilters = useCallback(
    (filters: BackofficeStudioBotAuthChallengeFilters) => {
      setAuthChallengesFiltersState(filters)
      setAuthChallengesPagination((prev) => ({ ...prev, page: 1 }))
    },
    []
  )

  const setAuthChallengesPage = useCallback((page: number) => {
    setAuthChallengesPagination((prev) => ({ ...prev, page }))
  }, [])

  useEffect(() => {
    void loadConversations()
  }, [loadConversations])

  const value: BackofficeStudioBotContextValue = {
    channel,
    qrCode,
    conversations,
    conversationsPagination,
    conversationsFilters,
    selectedUserLinkId,
    messages,
    isLoadingChannel,
    isLoadingConversations,
    isLoadingMessages,
    isSavingProfile,
    isTestingPing,
    isUploadingAvatar,
    isReconnecting,
    isDisconnecting,
    isSyncingProfile,
    userLinks,
    userLinksPagination,
    isLoadingUserLinks,
    isRevokingLink,
    authChallenges,
    authChallengesPagination,
    authChallengesFilters,
    isLoadingAuthChallenges,
    canManage,
    error,
    loadChannel,
    updateChannelProfile,
    updateChannel,
    testPing,
    uploadChannelAvatar,
    reconnectChannel,
    refreshChannelConnection,
    disconnectChannel,
    replaceChannelConnection,
    clearQrCode,
    syncChannelProfile,
    setConversationsFilters,
    setConversationsPage,
    loadConversations,
    selectConversation,
    loadMessages,
    setUserLinksPage,
    loadUserLinks,
    revokeUserLink,
    setAuthChallengesFilters,
    setAuthChallengesPage,
    loadAuthChallenges,
  }

  return (
    <BackofficeStudioBotContext.Provider value={value}>
      {children}
    </BackofficeStudioBotContext.Provider>
  )
}
