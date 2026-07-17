"use client"

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { toast } from "sonner"
import type { IBackofficeEmailContatosService } from "../services/IBackofficeEmailContatosService"
import type {
  BackofficeEmailContactListItem,
  BackofficeEmailContactsPage,
} from "./BackofficeEmailContatosTypes"

export interface BackofficeEmailContatosContextValue {
  contactLists: BackofficeEmailContactListItem[]
  isLoading: boolean
  isSaving: boolean
  error: string | null
  refresh: () => Promise<void>
  createContactList: (name: string) => Promise<boolean>
  archiveContactList: (id: string) => Promise<void>
  uploadContacts: (listId: string, file: File) => Promise<boolean>
  listContacts: (listId: string, page: number, pageSize: number) => Promise<BackofficeEmailContactsPage>
  deleteContact: (listId: string, contactId: string) => Promise<void>
}

export const BackofficeEmailContatosContext = createContext<
  BackofficeEmailContatosContextValue | undefined
>(undefined)

interface ProviderProps {
  children: ReactNode
  service: IBackofficeEmailContatosService
}

export function BackofficeEmailContatosProvider({ children, service }: ProviderProps) {
  const [contactLists, setContactLists] = useState<BackofficeEmailContactListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlightRef = useRef(false)

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setIsLoading(true)
    setError(null)
    try {
      const lists = await service.listContactLists()
      setContactLists(lists)
    } catch (err) {
      console.error("[BackofficeEmailContatosContext][refresh]", err)
      setError(err instanceof Error ? err.message : "Erro ao carregar listas")
    } finally {
      setIsLoading(false)
      inFlightRef.current = false
    }
  }, [service])

  const createContactList = useCallback(
    async (name: string) => {
      setIsSaving(true)
      try {
        const created = await service.createContactList(name)
        setContactLists((prev) => [created, ...prev])
        toast.success("Lista criada com sucesso")
        return true
      } catch (err) {
        console.error("[BackofficeEmailContatosContext][createContactList]", err)
        toast.error(err instanceof Error ? err.message : "Erro ao criar lista")
        return false
      } finally {
        setIsSaving(false)
      }
    },
    [service]
  )

  const archiveContactList = useCallback(
    async (id: string) => {
      try {
        await service.archiveContactList(id)
        setContactLists((prev) => prev.filter((l) => l.id !== id))
        toast.success("Lista arquivada")
      } catch (err) {
        console.error("[BackofficeEmailContatosContext][archiveContactList]", err)
        toast.error(err instanceof Error ? err.message : "Erro ao arquivar lista")
      }
    },
    [service]
  )

  const uploadContacts = useCallback(
    async (listId: string, file: File) => {
      setIsSaving(true)
      try {
        await service.uploadContacts(listId, file)
        toast.success("Importação enfileirada — os contatos aparecerão em instantes")
        await refresh()
        return true
      } catch (err) {
        console.error("[BackofficeEmailContatosContext][uploadContacts]", err)
        toast.error(err instanceof Error ? err.message : "Erro ao enviar arquivo")
        return false
      } finally {
        setIsSaving(false)
      }
    },
    [service, refresh]
  )

  const listContacts = useCallback(
    async (listId: string, page: number, pageSize: number) => {
      try {
        return await service.listContacts(listId, page, pageSize)
      } catch (err) {
        console.error("[BackofficeEmailContatosContext][listContacts]", err)
        toast.error(err instanceof Error ? err.message : "Erro ao carregar contatos")
        return { contacts: [], total: 0 }
      }
    },
    [service]
  )

  const deleteContact = useCallback(
    async (listId: string, contactId: string) => {
      try {
        await service.deleteContact(listId, contactId)
        toast.success("Contato removido")
      } catch (err) {
        console.error("[BackofficeEmailContatosContext][deleteContact]", err)
        toast.error(err instanceof Error ? err.message : "Erro ao remover contato")
      }
    },
    [service]
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo<BackofficeEmailContatosContextValue>(
    () => ({
      contactLists,
      isLoading,
      isSaving,
      error,
      refresh,
      createContactList,
      archiveContactList,
      uploadContacts,
      listContacts,
      deleteContact,
    }),
    [
      contactLists,
      isLoading,
      isSaving,
      error,
      refresh,
      createContactList,
      archiveContactList,
      uploadContacts,
      listContacts,
      deleteContact,
    ]
  )

  return (
    <BackofficeEmailContatosContext.Provider value={value}>
      {children}
    </BackofficeEmailContatosContext.Provider>
  )
}
