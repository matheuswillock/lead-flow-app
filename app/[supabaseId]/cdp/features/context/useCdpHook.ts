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
  const [detailEvents, setDetailEvents] = useState<CdpProfileDetail["events"]>([])
  const [detailEventsTotal, setDetailEventsTotal] = useState(0)
  const [detailEventsPage, setDetailEventsPage] = useState(1)
  const [isLoadingMoreEvents, setIsLoadingMoreEvents] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isSyncingWhatsapp, setIsSyncingWhatsapp] = useState(false)
  const [isSyncingLead, setIsSyncingLead] = useState(false)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState("")
  const [consentFilter, setConsentFilter] = useState<string>("")
  const [sourceFilter, setSourceFilter] = useState<string>("")
  const [channelFilter, setChannelFilter] = useState<string>("")
  const [segmentFilter, setSegmentFilter] = useState<string>("")
  const [lastSeenFrom, setLastSeenFrom] = useState("")
  const [lastSeenTo, setLastSeenTo] = useState("")
  const pageSize = 20
  const detailEventsPageSize = 10

  const loadKeyRef = useRef("")
  const inFlightRef = useRef(false)

  const loadDashboard = useCallback(async () => {
    const key = `${page}:${search}:${consentFilter}:${sourceFilter}:${channelFilter}:${segmentFilter}:${lastSeenFrom}:${lastSeenTo}`
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
          channel: channelFilter || undefined,
          segment: segmentFilter || undefined,
          lastSeenFrom: lastSeenFrom || undefined,
          lastSeenTo: lastSeenTo || undefined,
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
  }, [page, search, consentFilter, sourceFilter, channelFilter, segmentFilter, lastSeenFrom, lastSeenTo])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  const openProfile = useCallback(async (profileId: string) => {
    setIsDetailLoading(true)
    setDetailEventsPage(1)
    try {
      const [detail, eventsResult] = await Promise.all([
        cdpService.getProfile(profileId),
        cdpService.listProfileEvents(profileId, 1, detailEventsPageSize),
      ])
      setSelectedProfile(detail)
      setDetailEvents(eventsResult.items)
      setDetailEventsTotal(eventsResult.total)
    } catch (detailError) {
      console.error("[useCdp][openProfile]", detailError)
      toast.error("Não foi possível carregar o detalhe do perfil.")
    } finally {
      setIsDetailLoading(false)
    }
  }, [detailEventsPageSize])

  const loadMoreProfileEvents = useCallback(async () => {
    if (!selectedProfile || isLoadingMoreEvents) return
    const nextPage = detailEventsPage + 1
    setIsLoadingMoreEvents(true)
    try {
      const eventsResult = await cdpService.listProfileEvents(
        selectedProfile.id,
        nextPage,
        detailEventsPageSize
      )
      setDetailEvents((current) => [...current, ...eventsResult.items])
      setDetailEventsPage(nextPage)
      setDetailEventsTotal(eventsResult.total)
    } catch (eventsError) {
      console.error("[useCdp][loadMoreProfileEvents]", eventsError)
      toast.error("Não foi possível carregar mais eventos.")
    } finally {
      setIsLoadingMoreEvents(false)
    }
  }, [detailEventsPage, detailEventsPageSize, isLoadingMoreEvents, selectedProfile])

  const closeProfile = useCallback(() => {
    setSelectedProfile(null)
    setDetailEvents([])
    setDetailEventsTotal(0)
    setDetailEventsPage(1)
  }, [])

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

  const runWhatsappSync = useCallback(async () => {
    if (isSyncingWhatsapp) return
    setIsSyncingWhatsapp(true)
    try {
      await cdpService.syncWhatsapp()
      setLastSyncAt(new Date())
      toast.success("Sincronização do WhatsApp concluída.")
      await loadDashboard()
    } catch (syncError) {
      console.error("[useCdp][runWhatsappSync]", syncError)
      toast.error("Falha ao sincronizar o WhatsApp na CDP.")
    } finally {
      setIsSyncingWhatsapp(false)
    }
  }, [isSyncingWhatsapp, loadDashboard])

  const syncLeadProfile = useCallback(async () => {
    if (!selectedProfile || isSyncingLead) return
    const leadIdentity = selectedProfile.identities.find((identity) => identity.type === "lead_id")
    if (!leadIdentity?.normalizedValue) {
      toast.error("Este perfil não possui vínculo com lead do CRM.")
      return
    }

    setIsSyncingLead(true)
    try {
      await cdpService.syncCrm({ leadId: leadIdentity.normalizedValue })
      setLastSyncAt(new Date())
      toast.success("Lead sincronizado com sucesso.")
      await openProfile(selectedProfile.id)
      await loadDashboard()
    } catch (syncError) {
      console.error("[useCdp][syncLeadProfile]", syncError)
      toast.error("Falha ao sincronizar o lead.")
    } finally {
      setIsSyncingLead(false)
    }
  }, [isSyncingLead, loadDashboard, openProfile, selectedProfile])

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
    detailEvents,
    detailEventsTotal,
    isLoadingMoreEvents,
    isLoading,
    isSyncing,
    isSyncingWhatsapp,
    isSyncingLead,
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
    channelFilter,
    setChannelFilter,
    segmentFilter,
    lastSeenFrom,
    setLastSeenFrom,
    lastSeenTo,
    setLastSeenTo,
    setPage,
    openProfile,
    closeProfile,
    loadMoreProfileEvents,
    runSync,
    runWhatsappSync,
    syncLeadProfile,
    applySegment,
    clearSegment,
    reload: loadDashboard,
  }
}
