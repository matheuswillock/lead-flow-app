"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation"
import { removeProfileFromSegmentList } from "@/lib/radar/radar-segment-promote-list"
import { toast } from "sonner"
import { useTeamContext } from "@/app/context/TeamContext"
import { radarFrontendService } from "../services/RadarService"
import { buildProfileHref, buildTabHref } from "../utils/radarSegmentBuilderUtils"
import {
  buildCampaignRadarSegmentSlug,
  parseCampaignRadarSegmentSlug,
} from "@/lib/radar/segment-audience"
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
import type { RadarExportFormat, RadarExportRow } from "@/lib/radar/exportRadarProfiles"
import { downloadRadarExportFile } from "../utils/downloadRadarExport"

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
  const [fixedSegmentsError, setFixedSegmentsError] = useState(false)
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
  const deepLinkSegmentRef = useRef<string | null>(null)
  const [campaignDeepLinkSegment, setCampaignDeepLinkSegment] = useState<RadarSegment | null>(null)

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
          sort: "engagementScore",
          order: "desc",
        }),
        radarFrontendService.listCustomSegments(supabaseId, activeTeamId),
      ])
      setSegments(segmentsResult.segments)
      setMetrics(segmentsResult.metrics)
      setFixedSegmentsError(Boolean(segmentsResult.fixedSegmentsError))
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


  const exportFilteredProfiles = useCallback(
    async (format: RadarExportFormat) => {
      if (!supabaseId || !activeTeamId) return false
      const result = await withMutationLock(async () => {
        try {
          const exported = await radarFrontendService.exportProfiles(supabaseId, activeTeamId, {
            search: search || undefined,
            consent: consentFilter || undefined,
            sourceType: sourceFilter || undefined,
            channel: channelFilter || undefined,
            lastSeenFrom: lastSeenFrom || undefined,
            lastSeenTo: lastSeenTo || undefined,
          })
          const dateStr = new Date().toISOString().slice(0, 10)
          await downloadRadarExportFile(
            exported.rows as RadarExportRow[],
            format,
            `radar-perfis-${dateStr}`
          )
          if (exported.truncated) {
            toast.success(
              `Exportado ${exported.exported} de ${exported.total} perfis (limite de ${exported.maxRows}).`
            )
          } else {
            toast.success(`Exportados ${exported.exported} perfil(is).`)
          }
          return true
        } catch (exportError) {
          console.error("[useRadarHookFn][exportFilteredProfiles]", exportError)
          toast.error(
            exportError instanceof Error ? exportError.message : "Não foi possível exportar os perfis."
          )
          return false
        }
      })
      if (result === null) return false
      return result
    },
    [
      activeTeamId,
      channelFilter,
      consentFilter,
      lastSeenFrom,
      lastSeenTo,
      search,
      sourceFilter,
      supabaseId,
      withMutationLock,
    ]
  )

  const exportSegmentMembers = useCallback(
    async (target: RadarSegmentProfilesTarget, format: RadarExportFormat) => {
      if (!supabaseId || !activeTeamId) return false
      const result = await withMutationLock(async () => {
        try {
          const exported =
            target.kind === "system"
              ? await radarFrontendService.exportSegmentProfiles(
                  supabaseId,
                  activeTeamId,
                  target.slugOrId
                )
              : await radarFrontendService.exportCustomSegmentProfiles(
                  supabaseId,
                  activeTeamId,
                  target.slugOrId
                )
          const slugSafe = target.name
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
          const dateStr = new Date().toISOString().slice(0, 10)
          await downloadRadarExportFile(
            exported.rows as RadarExportRow[],
            format,
            `radar-segmento-${slugSafe || "export"}-${dateStr}`
          )
          if (exported.truncated) {
            toast.success(
              `Exportado ${exported.exported} de ${exported.total} membros (limite de ${exported.maxRows}).`
            )
          } else {
            toast.success(`Exportados ${exported.exported} membro(s) de "${target.name}".`)
          }
          return true
        } catch (exportError) {
          console.error("[useRadarHookFn][exportSegmentMembers]", exportError)
          toast.error(
            exportError instanceof Error
              ? exportError.message
              : "Não foi possível exportar o segmento."
          )
          return false
        }
      })
      if (result === null) return false
      return result
    },
    [activeTeamId, supabaseId, withMutationLock]
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
        setCampaignDeepLinkSegment((prev) => {
          if (!prev || target.kind !== "system" || target.slugOrId !== prev.slug) {
            return prev
          }
          if (prev.count === result.total) return prev
          return { ...prev, count: result.total }
        })
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

  // Deep-link: ?tab=segmentos&segment=campaign:{uuid}
  useEffect(() => {
    if (!supabaseId || !activeTeamId) return

    const segmentParam = searchParams.get("segment")
    if (!segmentParam) {
      deepLinkSegmentRef.current = null
      setCampaignDeepLinkSegment(null)
      return
    }

    const campaignId = parseCampaignRadarSegmentSlug(segmentParam)
    if (!campaignId) return

    // Key by team so a team switch with the same URL reloads the correct campaign card.
    const deepLinkKey = `${activeTeamId}:${segmentParam}`
    if (deepLinkSegmentRef.current === deepLinkKey) return

    const previousKey = deepLinkSegmentRef.current
    deepLinkSegmentRef.current = deepLinkKey
    if (previousKey !== null && previousKey !== deepLinkKey) {
      setCampaignDeepLinkSegment(null)
      setSegmentProfilesItems([])
      setSegmentProfilesTotal(0)
      setSegmentProfilesPage(1)
    }

    let cancelled = false
    void (async () => {
      try {
        const campaigns = await radarFrontendService.listAvailableCampaigns(supabaseId, activeTeamId)
        if (cancelled) return
        const campaign = campaigns.find((item) => item.id === campaignId)
        const name = campaign ? `Campanha: ${campaign.name}` : `Campanha ${campaignId.slice(0, 8)}…`
        const slug = buildCampaignRadarSegmentSlug(campaignId)
        setCampaignDeepLinkSegment({
          slug,
          name,
          description: "Perfis com pelo menos um evento de e-mail desta campanha",
          count: 0,
          isSystem: true,
        })
        openSegmentProfiles({ kind: "system", slugOrId: slug, name })
      } catch (deepLinkError) {
        if (cancelled) return
        console.error("[useRadarHookFn][campaignDeepLink]", deepLinkError)
        toast.error("Não foi possível abrir o segmento da campanha.")
      }
    })()

    return () => {
      cancelled = true
    }
  }, [activeTeamId, openSegmentProfiles, searchParams, supabaseId])

  const changeSegmentProfilesPage = useCallback(
    (nextPage: number) => {
      if (!segmentProfilesTarget) return
      setSegmentProfilesPage(nextPage)
      void loadSegmentProfiles(segmentProfilesTarget, nextPage)
    },
    [loadSegmentProfiles, segmentProfilesTarget]
  )

  const previewSegmentContactList = useCallback(
    async (slugOrId: string, variant: "system" | "custom"): Promise<number | null> => {
      if (!supabaseId || !activeTeamId) return null
      try {
        const result = await radarFrontendService.previewSegmentContactList(
          supabaseId,
          activeTeamId,
          slugOrId,
          variant
        )
        return result.estimatedCount
      } catch (previewError) {
        console.error("[useRadarHookFn][previewSegmentContactList]", previewError)
        toast.error("Não foi possível calcular a contagem do segmento.")
        return null
      }
    },
    [activeTeamId, supabaseId]
  )

  const materializeSegmentToContactList = useCallback(
    async (slugOrId: string, variant: "system" | "custom"): Promise<boolean> => {
      if (!supabaseId || !activeTeamId) return false
      const result = await withMutationLock(async () => {
        try {
          const res = await radarFrontendService.materializeSegmentToContactList(
            supabaseId,
            activeTeamId,
            slugOrId,
            variant
          )
          toast.success(`Lista criada com ${res.contactCount} contato(s).`)
          return true
        } catch (materializeError) {
          console.error("[useRadarHookFn][materializeSegmentToContactList]", materializeError)
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
    [activeTeamId, supabaseId, withMutationLock]
  )

  const promoteProfileToLead = useCallback(
    async (
      profileId: string,
      options?: { source?: "profile-sheet" | "segment-list" }
    ): Promise<boolean> => {
      if (!supabaseId || !activeTeamId) return false
      const result = await withMutationLock(async () => {
        try {
          await radarFrontendService.promoteProfileToLead(supabaseId, activeTeamId, profileId)
          toast.success("Lead criado a partir do perfil Radar.")
          if (options?.source === "segment-list") {
            let removedFromList = false
            setSegmentProfilesItems((prev) => {
              const next = removeProfileFromSegmentList(prev, profileId)
              removedFromList = next.removed
              return next.items
            })
            if (removedFromList) {
              setSegmentProfilesTotal((prev) => Math.max(0, prev - 1))
            }
          } else {
            await openProfile(profileId)
          }
          await loadDashboard()
          return true
        } catch (promoteError) {
          console.error("[useRadarHookFn][promoteProfileToLead]", promoteError)
          toast.error(
            promoteError instanceof Error
              ? promoteError.message
              : "Não foi possível promover o perfil a Lead."
          )
          return false
        }
      })
      return result ?? false
    },
    [activeTeamId, loadDashboard, openProfile, supabaseId, withMutationLock]
  )

  const updateProfileGender = useCallback(
    async (profileId: string, gender: "male" | "female" | "unknown"): Promise<boolean> => {
      if (!supabaseId || !activeTeamId) return false
      const result = await withMutationLock(async () => {
        try {
          await radarFrontendService.updateProfileGender(supabaseId, activeTeamId, profileId, gender)
          toast.success("Gênero do perfil atualizado.")
          await openProfile(profileId)
          return true
        } catch (updateError) {
          console.error("[useRadarHookFn][updateProfileGender]", updateError)
          toast.error(
            updateError instanceof Error
              ? updateError.message
              : "Não foi possível atualizar o gênero do perfil."
          )
          return false
        }
      })
      return result ?? false
    },
    [activeTeamId, openProfile, supabaseId, withMutationLock]
  )

  return {
    profiles,
    segments,
    customSegments,
    metrics,
    fixedSegmentsError,
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
    exportFilteredProfiles,
    exportSegmentMembers,
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
    campaignDeepLinkSegment,
    touchpoints,
    isLoadingTouchpoints,
    contracts,
    isLoadingContracts,
    previewSegmentContactList,
    materializeSegmentToContactList,
    promoteProfileToLead,
    updateProfileGender,
    reload: loadDashboard,
  }
}
