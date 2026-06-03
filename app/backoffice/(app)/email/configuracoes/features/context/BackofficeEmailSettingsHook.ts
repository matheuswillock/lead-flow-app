"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import type { IBackofficeEmailSettingsService, UpdateEmailSettingsData } from "../services/IBackofficeEmailSettingsService"
import type { BackofficeTeamEmailEntry, EmailSettings } from "./BackofficeEmailSettingsTypes"

export type BackofficeEmailSettingsHookReturn = {
  items: BackofficeTeamEmailEntry[]
  total: number
  page: number
  totalPages: number
  isLoading: boolean
  isSaving: boolean
  search: string
  setSearch: (v: string) => void
  handlePageChange: (p: number) => void
  selectedTeamId: string | null
  handleSelectTeam: (teamId: string) => void
  selectedSettings: EmailSettings | null
  handleUpdateTeam: (data: UpdateEmailSettingsData) => Promise<void>
}

export function useBackofficeEmailSettingsState(
  service: IBackofficeEmailSettingsService
): BackofficeEmailSettingsHookReturn {
  const [items, setItems] = useState<BackofficeTeamEmailEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [search, setSearchState] = useState("")
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [selectedSettings, setSelectedSettings] = useState<EmailSettings | null>(null)

  const fetchingRef = useRef(false)
  const lastKeyRef = useRef("")

  const fetchList = useCallback(async (s: string, p: number) => {
    const key = `${s}::${p}`
    if (fetchingRef.current || lastKeyRef.current === key) return
    fetchingRef.current = true
    lastKeyRef.current = key
    setIsLoading(true)
    try {
      const result = await service.list({ search: s || undefined, page: p, pageSize: 20 })
      setItems(result.items)
      setTotal(result.total)
      setTotalPages(result.totalPages)
    } catch (err) {
      console.error("[BackofficeEmailSettings] fetchList error", err)
      toast.error("Erro ao carregar configurações")
    } finally {
      setIsLoading(false)
      fetchingRef.current = false
    }
  }, [service])

  useEffect(() => {
    void fetchList(search, page)
  }, [fetchList, search, page])

  const setSearch = useCallback((v: string) => {
    setSearchState(v)
    setPage(1)
    lastKeyRef.current = ""
  }, [])

  const handlePageChange = useCallback((p: number) => {
    setPage(p)
    lastKeyRef.current = ""
  }, [])

  const handleSelectTeam = useCallback((teamId: string) => {
    setSelectedTeamId(teamId)
    const found = items.find((i) => i.teamId === teamId)
    setSelectedSettings(found?.settings ?? null)
  }, [items])

  const handleUpdateTeam = useCallback(async (data: UpdateEmailSettingsData) => {
    if (!selectedTeamId) return
    setIsSaving(true)
    try {
      const updated = await service.update(selectedTeamId, data)
      setSelectedSettings(updated)
      setItems((prev) =>
        prev.map((i) => i.teamId === selectedTeamId ? { ...i, settings: updated } : i)
      )
      toast.success("Configurações salvas")
    } catch (err) {
      console.error("[BackofficeEmailSettings] handleUpdateTeam error", err)
      toast.error("Erro ao salvar configurações")
    } finally {
      setIsSaving(false)
    }
  }, [selectedTeamId, service])

  return {
    items, total, page, totalPages,
    isLoading, isSaving,
    search, setSearch,
    handlePageChange,
    selectedTeamId, handleSelectTeam,
    selectedSettings, handleUpdateTeam,
  }
}
