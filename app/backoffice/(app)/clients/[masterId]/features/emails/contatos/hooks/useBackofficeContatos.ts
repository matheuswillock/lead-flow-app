"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { backofficeStudioEmailService } from "../../services/BackofficeStudioEmailService"
import type {
  StudioEmailContact,
  StudioEmailContactList,
} from "../../services/IBackofficeStudioEmailService"
import { useBackofficeClientEmailsContext } from "../../context/BackofficeClientEmailsContext"

const PAGE_SIZE = 50

export function useBackofficeContatos() {
  const { masterId, selectedTeamId, refreshKey, canManage } = useBackofficeClientEmailsContext()

  const [lists, setLists] = useState<StudioEmailContactList[]>([])
  const [selectedListId, setSelectedListId] = useState<string | null>(null)
  const [contacts, setContacts] = useState<StudioEmailContact[]>([])
  const [totalContacts, setTotalContacts] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState("")
  const [loadingLists, setLoadingLists] = useState(false)
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [deletingContactId, setDeletingContactId] = useState<string | null>(null)
  const [creatingList, setCreatingList] = useState(false)
  const [deletingListId, setDeletingListId] = useState<string | null>(null)
  const [addingContact, setAddingContact] = useState(false)
  const [uploading, setUploading] = useState(false)

  const fetchingListsRef = useRef(false)
  const fetchingContactsRef = useRef(false)
  const lastContactsKeyRef = useRef("")
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchLists = useCallback(async () => {
    if (!masterId || !selectedTeamId) {
      setLists([])
      return
    }
    if (fetchingListsRef.current) return

    fetchingListsRef.current = true
    setLoadingLists(true)
    try {
      const result = await backofficeStudioEmailService.listContactLists(masterId, selectedTeamId)
      setLists(result)
    } catch (error) {
      console.error("[useBackofficeContatos] fetchLists error", error)
      toast.error("Erro ao carregar listas de contatos")
    } finally {
      setLoadingLists(false)
      fetchingListsRef.current = false
    }
  }, [masterId, selectedTeamId])

  const fetchContacts = useCallback(
    async (listId: string, nextPage: number, nextSearch: string) => {
      if (!masterId || !selectedTeamId) return

      const key = `${masterId}|${selectedTeamId}|${refreshKey}|${listId}|${nextPage}|${nextSearch}`
      if (fetchingContactsRef.current || lastContactsKeyRef.current === key) return

      fetchingContactsRef.current = true
      setLoadingContacts(true)
      try {
        const result = await backofficeStudioEmailService.listContacts(
          masterId,
          selectedTeamId,
          listId,
          { page: nextPage, pageSize: PAGE_SIZE, search: nextSearch || undefined }
        )
        setContacts(result.contacts)
        setTotalContacts(result.total)
        setPage(result.page)
        setTotalPages(result.totalPages)
        lastContactsKeyRef.current = key
      } catch (error) {
        console.error("[useBackofficeContatos] fetchContacts error", error)
        toast.error("Erro ao carregar contatos")
        setContacts([])
        setTotalContacts(0)
        setTotalPages(1)
      } finally {
        setLoadingContacts(false)
        fetchingContactsRef.current = false
      }
    },
    [masterId, selectedTeamId, refreshKey]
  )

  useEffect(() => {
    setSelectedListId(null)
    setContacts([])
    setTotalContacts(0)
    setPage(1)
    setTotalPages(1)
    setSearch("")
    lastContactsKeyRef.current = ""
    fetchingContactsRef.current = false
  }, [selectedTeamId])

  useEffect(() => {
    lastContactsKeyRef.current = ""
    void fetchLists()
  }, [fetchLists, refreshKey])

  useEffect(() => {
    if (!selectedListId) {
      setContacts([])
      setTotalContacts(0)
      setPage(1)
      setTotalPages(1)
      setSearch("")
      lastContactsKeyRef.current = ""
      return
    }
    lastContactsKeyRef.current = ""
    void fetchContacts(selectedListId, 1, "")
    setSearch("")
    setPage(1)
  }, [selectedListId, fetchContacts])

  const handleSelectList = useCallback((id: string) => {
    setSelectedListId(id)
  }, [])

  const handleCreateList = useCallback(
    async (name: string, description?: string) => {
      if (!masterId || !selectedTeamId || creatingList) return
      setCreatingList(true)
      try {
        const created = await backofficeStudioEmailService.createContactList(
          masterId,
          selectedTeamId,
          { name, description }
        )
        await fetchLists()
        setSelectedListId(created.id)
        toast.success(`Lista "${created.name}" criada com sucesso`)
      } catch (error) {
        console.error("[useBackofficeContatos] handleCreateList error", error)
        toast.error(error instanceof Error ? error.message : "Erro ao criar lista")
        throw error
      } finally {
        setCreatingList(false)
      }
    },
    [masterId, selectedTeamId, creatingList, fetchLists]
  )

  const handleDeleteList = useCallback(
    async (id: string) => {
      if (!masterId || !selectedTeamId || deletingListId) return
      setDeletingListId(id)
      try {
        await backofficeStudioEmailService.deleteContactList(masterId, selectedTeamId, id)
        await fetchLists()
        if (selectedListId === id) {
          setSelectedListId(null)
        }
        toast.success("Lista excluída com sucesso")
      } catch (error) {
        console.error("[useBackofficeContatos] handleDeleteList error", error)
        toast.error(error instanceof Error ? error.message : "Erro ao excluir lista")
        throw error
      } finally {
        setDeletingListId(null)
      }
    },
    [masterId, selectedTeamId, deletingListId, fetchLists, selectedListId]
  )

  const handleAddContact = useCallback(
    async (email: string, name?: string) => {
      if (!masterId || !selectedTeamId || !selectedListId || addingContact) return
      setAddingContact(true)
      try {
        await backofficeStudioEmailService.addContact(masterId, selectedTeamId, selectedListId, {
          email,
          name: name ?? null,
        })
        lastContactsKeyRef.current = ""
        await fetchContacts(selectedListId, page, search)
        await fetchLists()
        toast.success("Contato adicionado")
      } catch (error) {
        console.error("[useBackofficeContatos] handleAddContact error", error)
        toast.error(error instanceof Error ? error.message : "Erro ao adicionar contato")
        throw error
      } finally {
        setAddingContact(false)
      }
    },
    [masterId, selectedTeamId, selectedListId, addingContact, fetchContacts, page, search, fetchLists]
  )

  const handleDeleteContact = useCallback(
    async (contactId: string) => {
      if (!masterId || !selectedTeamId || !selectedListId || deletingContactId) return
      setDeletingContactId(contactId)
      try {
        await backofficeStudioEmailService.deleteContact(
          masterId,
          selectedTeamId,
          selectedListId,
          contactId
        )
        setContacts((prev) => prev.filter((c) => c.id !== contactId))
        setTotalContacts((prev) => Math.max(0, prev - 1))
        setLists((prev) =>
          prev.map((l) =>
            l.id === selectedListId
              ? { ...l, totalContacts: Math.max(0, l.totalContacts - 1) }
              : l
          )
        )
        toast.success("Contato removido")
      } catch (error) {
        console.error("[useBackofficeContatos] handleDeleteContact error", error)
        toast.error("Erro ao remover contato")
      } finally {
        setDeletingContactId(null)
      }
    },
    [masterId, selectedTeamId, selectedListId, deletingContactId]
  )

  const handleUploadContacts = useCallback(
    async (file: File) => {
      if (!masterId || !selectedTeamId || !selectedListId || uploading) return false
      setUploading(true)
      try {
        await backofficeStudioEmailService.uploadContacts(
          masterId,
          selectedTeamId,
          selectedListId,
          file
        )
        toast.success("Importação iniciada com sucesso")
        lastContactsKeyRef.current = ""
        await fetchLists()
        await fetchContacts(selectedListId, page, search)
        return true
      } catch (error) {
        console.error("[useBackofficeContatos] handleUploadContacts error", error)
        toast.error(error instanceof Error ? error.message : "Erro ao importar contatos")
        return false
      } finally {
        setUploading(false)
      }
    },
    [masterId, selectedTeamId, selectedListId, uploading, fetchLists, fetchContacts, page, search]
  )

  const handleSearch = useCallback(
    (query: string) => {
      setSearch(query)
      if (!selectedListId) return
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
      searchDebounceRef.current = setTimeout(() => {
        lastContactsKeyRef.current = ""
        setPage(1)
        void fetchContacts(selectedListId, 1, query)
      }, 300)
    },
    [selectedListId, fetchContacts]
  )

  const handlePageChange = useCallback(
    (nextPage: number) => {
      if (!selectedListId) return
      lastContactsKeyRef.current = ""
      setPage(nextPage)
      void fetchContacts(selectedListId, nextPage, search)
    },
    [selectedListId, search, fetchContacts]
  )

  const selectedList = lists.find((l) => l.id === selectedListId) ?? null

  return {
    canManage,
    lists,
    selectedListId,
    selectedList,
    contacts,
    totalContacts,
    page,
    totalPages,
    search,
    loadingLists,
    loadingContacts,
    deletingContactId,
    creatingList,
    deletingListId,
    addingContact,
    uploading,
    handleSelectList,
    handleCreateList,
    handleDeleteList,
    handleAddContact,
    handleDeleteContact,
    handleUploadContacts,
    handleSearch,
    handlePageChange,
  }
}

export type UseBackofficeContatosReturn = ReturnType<typeof useBackofficeContatos>
