"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { cdpService } from "../services/CdpService"
import type { CdpMetrics, CdpProfileDetail, CdpProfileListItem, CdpSegment } from "./CdpTypes"

export type CdpHookReturn = ReturnType<typeof useCdp>

export function useCdp() {
  const [profiles, setProfiles] = useState<CdpProfileListItem[]>([])
  const [segments, setSegments] = useState<CdpSegment[]>([])
  const [metrics, setMetrics] = useState<CdpMetrics | null>(null)
  const [selectedProfile, setSelectedProfile] = useState<CdpProfileDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState("")
  const [consentFilter, setConsentFilter] = useState<string>("")
  const [sourceFilter, setSourceFilter] = useState<string>("")
  const [segmentFilter, setSegmentFilter] = useState<string>("")
  const pageSize = 20

  const loadKeyRef = useRef("")
  const inFlightRef = useRef(false)

  const loadDashboard = useCallback(async () => {
    const key = `${page}:${search}:${consentFilter}:${sourceFilter}:${segmentFilter}`
    if (inFlightRef.current && loadKeyRef.current === key) return
    inFlightRef.current = true
    loadKeyRef.current = key
    setIsLoading(true)
    setError(null)

    try {
      const [segmentsResult, profilesResult] = await Promise.all([
        cdpService.listSegments(),
        cdpService.listProfiles({
          page,
          pageSize,
          search: search || undefined,
          consent: consentFilter || undefined,
          sourceType: sourceFilter || undefined,
          segment: segmentFilter || undefined,
        }),
      ])
      setSegments(segmentsResult.segments)
      setMetrics(segmentsResult.metrics)
      setProfiles(profilesResult.items)
      setTotal(profilesResult.total)
    } catch (loadError) {
      console.error("[useCdp][loadDashboard]", loadError)
      setError("Não foi possível carregar os perfis CDP. Tente sincronizar novamente.")
    } finally {
      setIsLoading(false)
      inFlightRef.current = false
    }
  }, [page, search, consentFilter, sourceFilter, segmentFilter])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  const openProfile = useCallback(async (profileId: string) => {
    setIsDetailLoading(true)
    try {
      const detail = await cdpService.getProfile(profileId)
      setSelectedProfile(detail)
    } catch (detailError) {
      console.error("[useCdp][openProfile]", detailError)
      toast.error("Não foi possível carregar o detalhe do perfil.")
    } finally {
      setIsDetailLoading(false)
    }
  }, [])

  const closeProfile = useCallback(() => setSelectedProfile(null), [])

  const runSync = useCallback(async () => {
    if (isSyncing) return
    setIsSyncing(true)
    try {
      const [crm, portfolio, email] = await Promise.all([
        cdpService.syncCrm(),
        cdpService.syncPortfolio(),
        cdpService.syncEmail(),
      ])
      setLastSyncAt(new Date())
      toast.success(
        `Sincronização concluída. Criados: ${crm.created + portfolio.created + email.created}, enriquecidos: ${crm.enriched + portfolio.enriched + email.enriched}.`
      )
      await loadDashboard()
    } catch (syncError) {
      console.error("[useCdp][runSync]", syncError)
      toast.error("Falha ao sincronizar a CDP.")
    } finally {
      setIsSyncing(false)
    }
  }, [isSyncing, loadDashboard])

  const applySegment = useCallback((slug: string) => {
    setSegmentFilter(slug)
    setPage(1)
  }, [])

  const clearSegment = useCallback(() => {
    setSegmentFilter("")
    setPage(1)
  }, [])

  return {
    profiles,
    segments,
    metrics,
    selectedProfile,
    isLoading,
    isSyncing,
    isDetailLoading,
    error,
    lastSyncAt,
    page,
    total,
    pageSize,
    search,
    setSearch,
    consentFilter,
    setConsentFilter,
    sourceFilter,
    setSourceFilter,
    segmentFilter,
    setPage,
    openProfile,
    closeProfile,
    runSync,
    applySegment,
    clearSegment,
    reload: loadDashboard,
  }
}
