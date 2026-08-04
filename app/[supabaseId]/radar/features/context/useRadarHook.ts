"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { useTeamContext } from "@/app/context/TeamContext"
import { radarFrontendService } from "../services/RadarService"
import { buildProfileHref, buildTabHref } from "../utils/radarSegmentBuilderUtils"
import type {
  RadarCustomSegmentListItem,
  RadarMetrics,
  RadarProfileDetail,
  RadarProfileListItem,
  RadarProfileContracts,
  RadarProfileTouchpoints,
  RadarSegment,
  RadarSegmentRules,
} from "./RadarTypes"
import type { CustomSegmentInput, CustomSegmentUpdateInput } from "../services/IRadarService"

export type RadarTab = "perfis" | "segmentos"

export type RadarSegmentProfilesTarget = { kind: "system" | "custom"; slugOrId: string; name: string }

export type RadarHookReturn = ReturnType<typeof useRadarHookFn>

export function useRadarHookFn() {
  const params = useParams()
  const supabaseId = params.supabaseId as string
  const { activeTeamId } = useTeamContext()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [profiles, setProfiles] = useState<RadarProfileListItem[]>([])
  const [segments, setSegments] = useState<RadarSegment[]>([])
  const [customSegments, setCustomSegments] = useState<RadarCustomSegmentListItem[]>([])
  const [metrics, setMetrics] = useState<RadarMetrics | null>(null)
  const [selectedProfile, setSelectedProfile] = useState<RadarProfileDetail | null>(null)
  const [detailEvents, setDetailEvents] = useState<RadarProfileDetail["events"]>([])
  const [detailEventsTotal, setDetailEventsTotal] = useState(0)
  const [detailEventsPage, setDetailEventsPage] = useState(1)
  const [isLoadingMoreEvents, setIsLoadingMoreEvents] = useState(false)
  const [touchpoints, setTouchpoints] = useState<RadarProfileTouchpoints | null>(null)
  const [isLoadingTouchpoints, setIsLoadingTouchpoints] = useState(false)
  const [contracts, setContracts] = useState<RadarProfileContracts | null>(null)
  const [isLoadingContracts, setIsLoadingContracts] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [isPreviewingAudience, setIsPreviewingAudience] = useState(false)
  const [mutationLock, setMutationLock] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState("")
  const [consentFilter, setConsentFilter] = useState<string>("")
  const [sourceFilter, setSourceFilter] = useState<string>("")
  const [channelFilter, setChannelFilter] = useState<string>("")
  const [lastSeenFrom, setLastSeenFrom] = useState("")
  const [lastSeenTo, setLastSeenTo] = useState("")
  const [segmentProfilesTarget, setSegmentProfilesTarget] = useState<RadarSegmentProfilesTarget | null>(null)
  const [segmentProfilesItems, setSegmentProfilesItems] = useState<RadarProfileDetail[]>([])
  const [segmentProfilesTotal, setSegmentProfilesTotal] = useState(0)
  const [segmentProfilesPage, setSegmentProfilesPage] = useState(1)
  const [isLoadingSegmentProfiles, setIsLoadingSegmentProfiles] = useState(false)
  const pageSize = 20
  const detailEventsPageSize = 10
  const segmentProfilesPageSize = 20

  const loadKeyRef = useRef("")
  const inFlightRef = useRef(false)
  const autoOpenedProfileIdRef = useRef<string | null>(null)
  const touchpointsProfileIdRef = useRef<string | null>(null)
  const contractsProfileIdRef = useRef<string | null>(null)

  const activeTab: RadarTab = searchParams.get("tab") === "segmentos" ? "segmentos" : "perfis"

  const setActiveTab = useCallback(
    (tab: RadarTab) => {
      router.replace(buildTabHref(pathname, searchParams, tab), { scroll: false })
    },
    [pathname, router, searchParams]
  )

  const loadDashboard = useCallback(async () => {
    if (!supabaseId || !activeTeamId) return

    const key = `${page}:${search}:${consentFilter}:${sourceFilter}:${channelFilter}:${lastSeenFrom}:${lastSeenTo}`
    if (inFlightRef.current && loadKeyRef.current === key) return
    inFlightRef.current = true
    loadKeyRef.current = key
    setIsLoading(true)
    setError(null)

    try {
      const [segmentsResult, profilesResult, customSegmentsResult] = await Promise.all([
        radarFrontendService.listSegments(supabaseId, activeTeamId),
        radarFrontendService.listProfiles(supabaseId, activeTeamId, {
          page,
          pageSize,
          search: search || undefined,
          consent: consentFilter || undefined,
          sourceType: sourceFilter || undefined,
          channel: channelFilter || undefined,
          lastSeenFrom: lastSeenFrom || undefined,
          lastSeenTo: lastSeenTo || undefined,
        }),
        radarFrontendService.listCustomSegments(supabaseId, activeTeamId),
      ])
      setSegments(segmentsResult.segments)
      setMetrics(segmentsResult.metrics)
      setProfiles(profilesResult.items)
      setTotal(profilesResult.total)
      setCustomSegments(customSegmentsResult)
    } catch (loadError) {
      console.error("[useRadarHookFn][loadDashboard]", loadError)
      setError("Não foi possível carregar os perfis Radar. Tente novamente.")
    } finally {
      setIsLoading(false)
      inFlightRef.current = false
    }
  }, [
    activeTeamId,
    page,
    search,
    consentFilter,
    sourceFilter,
    channelFilter,
    lastSeenFrom,
    lastSeenTo,
    supabaseId,
  ])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  const openProfile = useCallback(
    async (profileId: string) => {
      if (!supabaseId || !activeTeamId) return

      router.replace(buildProfileHref(pathname, searchParams, profileId), { scroll: false })
      setIsDetailLoading(true)
      setDetailEventsPage(1)
      setTouchpoints(null)
      setContracts(null)
      try {
        const [detail, eventsResult] = await Promise.all([
          radarFrontendService.getProfile(supabaseId, activeTeamId, profileId),
          radarFrontendService.listProfileEvents(
            supabaseId,
            activeTeamId,
            profileId,
            1,
            detailEventsPageSize
          ),
        ])
        setSelectedProfile(detail)
        setDetailEvents(eventsResult.items)
        setDetailEventsTotal(eventsResult.total)
      } catch (detailError) {
        console.error("[useRadarHookFn][openProfile]", detailError)
        toast.error("Não foi possível carregar o detalhe do perfil.")
      } finally {
        setIsDetailLoading(false)
      }

      // Carrega touchpoints e contratos em segundo plano após o perfil abrir.
      // Guard de stale: descarta a resposta se o profileId ativo mudou enquanto
      // a request estava em voo (ex.: sheet fechada e reaberta para outro perfil).
      touchpointsProfileIdRef.current = profileId
      contractsProfileIdRef.current = profileId
      setIsLoadingTouchpoints(true)
      setIsLoadingContracts(true)
      void (async () => {
        try {
          const result = await radarFrontendService.getProfileTouchpoints(supabaseId, activeTeamId, profileId)
          if (touchpointsProfileIdRef.current !== profileId) return
          setTouchpoints(result)
        } catch (tpError) {
          console.error("[useRadarHookFn][loadTouchpoints]", tpError)
        } finally {
          if (touchpointsProfileIdRef.current === profileId) setIsLoadingTouchpoints(false)
        }
      })()
      void (async () => {
        try {
          const result = await radarFrontendService.getProfileContracts(supabaseId, activeTeamId, profileId)
          if (contractsProfileIdRef.current !== profileId) return
          setContracts(result)
        } catch (contractsError) {
          console.error("[useRadarHookFn][loadContracts]", contractsError)
        } finally {
          if (contractsProfileIdRef.current === profileId) setIsLoadingContracts(false)
        }
      })()
    },
    [activeTeamId, detailEventsPageSize, pathname, router, searchParams, supabaseId]
  )

  const closeProfile = useCallback(() => {
    setSelectedProfile(null)
    setDetailEvents([])
    setDetailEventsTotal(0)
    setDetailEventsPage(1)
    setTouchpoints(null)
    touchpointsProfileIdRef.current = null
    setContracts(null)
    contractsProfileIdRef.current = null
    router.replace(buildProfileHref(pathname, searchParams, null), { scroll: false })
  }, [pathname, router, searchParams])

  // Deep-link: abre o Sheet automaticamente quando `?perfil=<id>` já vem na URL
  // (refresh, link colado) — sem isso, o Sheet só abre por clique na tabela.
  useEffect(() => {
    const profileIdFromUrl = searchParams.get("perfil")
    if (!profileIdFromUrl) {
      autoOpenedProfileIdRef.current = null
      return
    }
    if (autoOpenedProfileIdRef.current === profileIdFromUrl) return
    if (selectedProfile?.id === profileIdFromUrl) return
    if (isDetailLoading) return

    autoOpenedProfileIdRef.current = profileIdFromUrl
    void openProfile(profileIdFromUrl)
  }, [searchParams])

  const loadMoreProfileEvents = useCallback(async () => {
    if (!selectedProfile || isLoadingMoreEvents || !supabaseId || !activeTeamId) return
    const nextPage = detailEventsPage + 1
    setIsLoadingMoreEvents(true)
    try {
      const eventsResult = await radarFrontendService.listProfileEvents(
        supabaseId,
        activeTeamId,
        selectedProfile.id,
        nextPage,
        detailEventsPageSize
      )
      setDetailEvents((current) => [...current, ...eventsResult.items])
      setDetailEventsPage(nextPage)
      setDetailEventsTotal(eventsResult.total)
    } catch (eventsError) {
      console.error("[useRadarHookFn][loadMoreProfileEvents]", eventsError)
      toast.error("Não foi possível carregar mais eventos.")
    } finally {
      setIsLoadingMoreEvents(false)
    }
  }, [
    activeTeamId,
    detailEventsPage,
    detailEventsPageSize,
    isLoadingMoreEvents,
    selectedProfile,
    supabaseId,
  ])

  const withMutationLock = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T | null> => {
      if (mutationLock) return null
      setMutationLock(true)
      try {
        return await action()
      } finally {
        setMutationLock(false)
      }
    },
    [mutationLock]
  )

  const createCustomSegment = useCallback(
    async (input: CustomSegmentInput) => {
      if (!supabaseId || !activeTeamId) return false
      const result = await withMutationLock(async () => {
        try {
          await radarFrontendService.createCustomSegment(supabaseId, activeTeamId, input)
          toast.success("Segmento criado com sucesso")
          await loadDashboard()
          return true
        } catch (createError) {
          console.error("[useRadarHookFn][createCustomSegment]", createError)
          toast.error(createError instanceof Error ? createError.message : "Não foi possível criar o segmento.")
          return false
        }
      })
      if (result === null) return false
      return result
    },
    [activeTeamId, loadDashboard, supabaseId, withMutationLock]
  )

  const updateCustomSegment = useCallback(
    async (segmentId: string, input: CustomSegmentUpdateInput) => {
      if (!supabaseId || !activeTeamId) return false
      const result = await withMutationLock(async () => {
        try {
          await radarFrontendService.updateCustomSegment(supabaseId, activeTeamId, segmentId, input)
          toast.success("Segmento atualizado com sucesso")
          await loadDashboard()
          return true
        } catch (updateError) {
          console.error("[useRadarHookFn][updateCustomSegment]", updateError)
          toast.error(updateError instanceof Error ? updateError.message : "Não foi possível atualizar o segmento.")
          return false
        }
      })
      if (result === null) return false
      return result
    },
    [activeTeamId, loadDashboard, supabaseId, withMutationLock]
  )

  const deleteCustomSegment = useCallback(
    async (segmentId: string) => {
      if (!supabaseId || !activeTeamId) return false
      const result = await withMutationLock(async () => {
        try {
          const deleteResult = await radarFrontendService.deleteCustomSegment(
            supabaseId,
            activeTeamId,
            segmentId
          )
          toast.success(
            deleteResult.softDeleted
              ? "Segmento em uso por campanhas — desativado em vez de excluído"
              : "Segmento removido com sucesso"
          )
          await loadDashboard()
          return true
        } catch (deleteError) {
          console.error("[useRadarHookFn][deleteCustomSegment]", deleteError)
          toast.error(deleteError instanceof Error ? deleteError.message : "Não foi possível remover o segmento.")
          return false
        }
      })
      if (result === null) return false
      return result
    },
    [activeTeamId, loadDashboard, supabaseId, withMutationLock]
  )

  const materializeContactList = useCallback(
    async (segmentSlug: string, segmentName: string, listName?: string) => {
      if (!supabaseId || !activeTeamId) return false
      const result = await withMutationLock(async () => {
        try {
          const materialized = await radarFrontendService.materializeContactList(
            supabaseId,
            activeTeamId,
            segmentSlug,
            listName
          )
          toast.success(
            `Lista criada com ${materialized.totalContacts} contato(s) a partir de "${segmentName}".`,
            {
              action: {
                label: "Ver contatos",
                onClick: () => router.push(`/${supabaseId}/email/contatos`),
              },
            }
          )
          return true
        } catch (materializeError) {
          console.error("[useRadarHookFn][materializeContactList]", materializeError)
          toast.error(
            materializeError instanceof Error
              ? materializeError.message
              : "Não foi possível criar a lista de contatos."
          )
          return false
        }
      })
      if (result === null) return false
      return result
    },
    [activeTeamId, router, supabaseId, withMutationLock]
  )

  const previewAudienceCount = useCallback(
    async (rules: RadarSegmentRules): Promise<number | null> => {
      if (isPreviewingAudience || !supabaseId || !activeTeamId) return null
      setIsPreviewingAudience(true)
      try {
        const result = await radarFrontendService.previewCustomSegmentCount(
          supabaseId,
          activeTeamId,
          rules
        )
        return result.count
      } catch (previewError) {
        console.error("[useRadarHookFn][previewAudienceCount]", previewError)
        toast.error("Não foi possível calcular a audiência — revise as condições.")
        return null
      } finally {
        setIsPreviewingAudience(false)
      }
    },
    [activeTeamId, isPreviewingAudience, supabaseId]
  )

  const loadSegmentProfiles = useCallback(
    async (target: RadarSegmentProfilesTarget, targetPage: number) => {
      if (!supabaseId || !activeTeamId) return
      setIsLoadingSegmentProfiles(true)
      try {
        const result =
          target.kind === "system"
            ? await radarFrontendService.listSegmentProfiles(
                supabaseId,
                activeTeamId,
                target.slugOrId,
                targetPage,
                segmentProfilesPageSize
              )
            : await radarFrontendService.listCustomSegmentProfiles(
                supabaseId,
                activeTeamId,
                target.slugOrId,
                targetPage,
                segmentProfilesPageSize
              )
        setSegmentProfilesItems(result.items)
        setSegmentProfilesTotal(result.total)
      } catch (segmentProfilesError) {
        console.error("[useRadarHookFn][loadSegmentProfiles]", segmentProfilesError)
        toast.error("Não foi possível carregar os perfis do segmento.")
      } finally {
        setIsLoadingSegmentProfiles(false)
      }
    },
    [activeTeamId, segmentProfilesPageSize, supabaseId]
  )

  const openSegmentProfiles = useCallback(
    (target: RadarSegmentProfilesTarget) => {
      setSegmentProfilesTarget(target)
      setSegmentProfilesPage(1)
      void loadSegmentProfiles(target, 1)
    },
    [loadSegmentProfiles]
  )

  const closeSegmentProfiles = useCallback(() => {
    setSegmentProfilesTarget(null)
    setSegmentProfilesItems([])
    setSegmentProfilesTotal(0)
    setSegmentProfilesPage(1)
  }, [])

  const changeSegmentProfilesPage = useCallback(
    (nextPage: number) => {
      if (!segmentProfilesTarget) return
      setSegmentProfilesPage(nextPage)
      void loadSegmentProfiles(segmentProfilesTarget, nextPage)
    },
    [loadSegmentProfiles, segmentProfilesTarget]
  )

  return {
    profiles,
    segments,
    customSegments,
    metrics,
    selectedProfile,
    detailEvents,
    detailEventsTotal,
    isLoadingMoreEvents,
    isLoading,
    isDetailLoading,
    isPreviewingAudience,
    mutationLock,
    error,
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
    lastSeenFrom,
    setLastSeenFrom,
    lastSeenTo,
    setLastSeenTo,
    setPage,
    activeTab,
    setActiveTab,
    openProfile,
    closeProfile,
    loadMoreProfileEvents,
    createCustomSegment,
    updateCustomSegment,
    deleteCustomSegment,
    materializeContactList,
    previewAudienceCount,
    segmentProfilesTarget,
    segmentProfilesItems,
    segmentProfilesTotal,
    segmentProfilesPage,
    segmentProfilesPageSize,
    isLoadingSegmentProfiles,
    openSegmentProfiles,
    closeSegmentProfiles,
    changeSegmentProfilesPage,
    touchpoints,
    isLoadingTouchpoints,
    contracts,
    isLoadingContracts,
    reload: loadDashboard,
  }
}
