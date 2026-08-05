"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "next/navigation"
import type { DateRange } from "react-day-picker"
import { toast } from "sonner"
import { useTeamContext } from "@/app/context/TeamContext"
import { publicFormsClientService } from "../services/PublicFormsService"
import type { PublicFormTemplateListItem } from "../services/IPublicFormsService"
import type { PublicFormListItem, PublicFormsIds, RankedForm } from "./PublicFormsTypes"

export function usePublicFormsState() {
  const params = useParams<{ supabaseId: string }>()
  const { activeTeamId } = useTeamContext()
  const ids = useMemo<PublicFormsIds | null>(
    () => (activeTeamId ? { supabaseId: params.supabaseId, teamId: activeTeamId } : null),
    [activeTeamId, params.supabaseId],
  )
  const [items, setItems] = useState<PublicFormListItem[]>([])
  const [ranking, setRanking] = useState<RankedForm[]>([])
  const [rankingLoading, setRankingLoading] = useState(true)
  const [templates, setTemplates] = useState<PublicFormTemplateListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<string[]>([])
  const [approval, setApproval] = useState<string[]>([])
  const [sdrIds, setSdrIds] = useState<string[]>([])
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [capabilities, setCapabilities] = useState({ canEdit: false, canApprove: false })
  const rankingRequestKeyRef = useRef("")

  const refresh = useCallback(async () => {
    if (!ids) return
    setLoading(true)
    setError(null)
    try {
      const [result, templateItems] = await Promise.all([
        publicFormsClientService.list(ids, {
          search,
          status,
          approvalStatus: approval,
          assignedSdrId: sdrIds[0],
          updatedFrom: dateRange?.from?.toISOString(),
          updatedTo: dateRange?.to?.toISOString(),
          page,
          pageSize: 20,
        }),
        publicFormsClientService.listTemplates(ids).catch(() => [] as PublicFormTemplateListItem[]),
      ])
      setItems(result.items)
      setTotal(result.total)
      setTotalPages(result.totalPages)
      setCapabilities(result.capabilities)
      setTemplates(templateItems)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível carregar")
    } finally {
      setLoading(false)
    }
  }, [approval, dateRange, ids, page, sdrIds, search, status])

  const refreshRanking = useCallback(async () => {
    if (!ids) {
      rankingRequestKeyRef.current = ""
      setRanking([])
      setRankingLoading(false)
      return
    }
    const requestKey = `${ids.supabaseId}|${ids.teamId}|ranking`
    rankingRequestKeyRef.current = requestKey
    setRankingLoading(true)
    try {
      const result = await publicFormsClientService.topConverting(ids)
      if (rankingRequestKeyRef.current !== requestKey) return
      setRanking(result.items)
    } catch (requestError) {
      if (rankingRequestKeyRef.current !== requestKey) return
      console.error("[usePublicFormsState] ranking", requestError)
      setRanking([])
    } finally {
      if (rankingRequestKeyRef.current === requestKey) {
        setRankingLoading(false)
      }
    }
  }, [ids])

  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 250)
    return () => window.clearTimeout(timeout)
  }, [refresh])

  useEffect(() => {
    void refreshRanking()
  }, [refreshRanking])

  const action = useCallback(
    async (formId: string, name: string, body?: unknown) => {
      if (!ids) return
      try {
        await publicFormsClientService.action(ids, formId, name, body)
        toast.success("Ação concluída")
        await refresh()
        await refreshRanking()
      } catch (actionError) {
        toast.error(
          actionError instanceof Error ? actionError.message : "Não foi possível concluir",
        )
      }
    },
    [ids, refresh, refreshRanking],
  )

  return {
    ids,
    items,
    ranking,
    rankingLoading,
    templates,
    loading,
    error,
    search,
    setSearch,
    status,
    setStatus,
    approval,
    setApproval,
    sdrIds,
    setSdrIds,
    dateRange,
    setDateRange,
    page,
    setPage,
    total,
    totalPages,
    capabilities,
    refresh,
    action,
  }
}

export type PublicFormsContextValue = ReturnType<typeof usePublicFormsState>
