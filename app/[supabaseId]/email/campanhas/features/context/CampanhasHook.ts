"use client"

import { useCallback, useEffect, useRef, useState, useDeferredValue } from "react"
import { toast } from "sonner"
import { CampanhasService } from "../services/CampanhasService"
import type {
  Campaign,
  CreditStatus,
  Template,
  ContactList,
  RadarSegmentOption,
  CampaignSheetTab,
  CampaignPreviewPlan,
  WizardTabId,
} from "./CampanhasTypes"
import { useFeatureAccess } from "@/app/context/FeatureAccessContext"
import { FEATURE_SLUGS } from "@/lib/features/feature-slugs"
import { radarFrontendService } from "@/app/[supabaseId]/radar/features/services/RadarService"
import { useStudioEmailRuntime } from "@/lib/email/use-studio-email-runtime"

const DEFAULT_PAGE_SIZE = 10
const defaultService = new CampanhasService()

import type { CampaignWritePayload } from "../services/CampanhasService"

const EDITABLE_STATUSES = new Set(["draft", "scheduled"])

type WizardSubCampaignSchedule = { index: number; scheduledAt: Date }

function statusKey(statuses: string[]): string {
  return [...statuses].sort().join(",")
}

function schedulesEqual(
  a: WizardSubCampaignSchedule[],
  b: WizardSubCampaignSchedule[]
): boolean {
  if (a.length !== b.length) return false
  return a.every((entry, i) => {
    const other = b[i]
    return (
      entry.index === other.index &&
      entry.scheduledAt.getTime() === other.scheduledAt.getTime()
    )
  })
}

/** Preserva datas existentes e inicializa índices faltantes a partir do preview/fallback. */
function syncSubCampaignSchedules(params: {
  plan: CampaignPreviewPlan
  prev: WizardSubCampaignSchedule[]
  fallbackStart?: Date
  intervalDays?: number
}): WizardSubCampaignSchedule[] {
  if (params.plan.subCampaigns.length <= 1) return []

  const byIndex = new Map(params.prev.map((entry) => [entry.index, entry.scheduledAt]))
  const next: WizardSubCampaignSchedule[] = []

  for (const sub of params.plan.subCampaigns) {
    const existing = byIndex.get(sub.index)
    if (existing) {
      next.push({ index: sub.index, scheduledAt: existing })
      continue
    }

    if (sub.scheduledAt) {
      const parsed = new Date(sub.scheduledAt)
      if (!Number.isNaN(parsed.getTime())) {
        next.push({ index: sub.index, scheduledAt: parsed })
        continue
      }
    }

    if (params.fallbackStart && params.intervalDays && params.intervalDays >= 1) {
      const seeded = new Date(params.fallbackStart)
      seeded.setDate(seeded.getDate() + (sub.index - 1) * params.intervalDays)
      next.push({ index: sub.index, scheduledAt: seeded })
    }
  }

  return next
}

function buildCampaignPayload(params: {
  name: string
  description?: string | null
  templateId: string
  recipientSource: "contact_list" | "radar_segment"
  contactListIds: string[]
  listStrategy: "single" | "merge" | "per_list"
  radarSegmentSlug: string
  scheduledAt?: Date
  uniformSchedule: boolean
  scheduleIntervalDays: number
  subCampaignSchedules: Array<{ index: number; scheduledAt: Date }>
}): CampaignWritePayload {
  const payload: CampaignWritePayload = {
    name: params.name.trim(),
    templateId: params.templateId,
    uniformSchedule: params.uniformSchedule,
    // Sempre envia description (string ou null) para permitir limpar no update
    description: params.description?.trim() ? params.description.trim() : null,
    ...(params.scheduledAt ? { scheduledAt: params.scheduledAt.toISOString() } : {}),
    ...(params.uniformSchedule && params.scheduleIntervalDays >= 1
      ? { scheduleIntervalDays: params.scheduleIntervalDays }
      : {}),
    ...(!params.uniformSchedule && params.subCampaignSchedules.length > 0
      ? {
          subCampaignSchedules: params.subCampaignSchedules.map((entry) => ({
            index: entry.index,
            scheduledAt: entry.scheduledAt.toISOString(),
          })),
        }
      : {}),
  }

  if (params.recipientSource === "radar_segment") {
    return { ...payload, radarSegmentSlug: params.radarSegmentSlug }
  }

  if (params.contactListIds.length === 1) {
    return { ...payload, contactListId: params.contactListIds[0] }
  }

  return {
    ...payload,
    contactListIds: params.contactListIds,
    listStrategy: params.listStrategy,
  }
}

export type CampanhasActions = {
  handleSend: (id: string, options?: { retryFailedOnly?: boolean }) => Promise<void>
  handleCancel: (id: string) => Promise<void>
  handleDeleteDraft: (id: string) => Promise<void>
  handleArchive: (id: string) => Promise<void>
  handleStatusFilter: (statuses: string[]) => void
  handlePageChange: (page: number) => void
  handlePageSizeChange: (size: number) => void
  handleNameFilter: (value: string) => void
  handleDateFilter: (from: string, to: string) => void
  clearFilters: () => void
  openWizard: () => void
  openEditWizard: (campaign: Campaign) => void
  openDuplicateWizard: (campaign: Campaign) => void
  closeWizard: () => void
  setWizardActiveTab: (tab: WizardTabId) => void
  setWizardName: (v: string) => void
  setWizardDescription: (v: string) => void
  setWizardTemplateId: (v: string) => void
  toggleWizardContactListId: (listId: string, selected: boolean) => void
  setWizardListStrategy: (strategy: "single" | "merge" | "per_list") => void
  setWizardRecipientSource: (v: "contact_list" | "radar_segment") => void
  setWizardRadarSegmentSlug: (v: string) => void
  setWizardScheduledAt: (v: Date | undefined) => void
  setWizardUniformSchedule: (v: boolean) => void
  setWizardScheduleIntervalDays: (v: number) => void
  setWizardSubCampaignSchedule: (index: number, date: Date | undefined) => void
  setWizardSubCampaignListId: (index: number, listId: string | undefined) => void
  setWizardSubCampaignName: (index: number, name: string) => void
  refreshWizardPreviewPlan: () => Promise<void>
  handleSaveCampaign: () => Promise<void>
  handleMaterializeRadarSegment: () => Promise<void>
  openView: (campaign: Campaign) => void
  openEditById: (id: string) => Promise<void>
  closeDetail: () => void
  setSheetTab: (tab: CampaignSheetTab) => void
}

export type CampanhasHookReturn = {
  campaigns: Campaign[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  statusFilter: string[]
  nameFilter: string
  dateFrom: string
  dateTo: string
  loading: boolean
  credits: CreditStatus | null
  loadingCredits: boolean
  sendingId: string | null
  cancelingId: string | null
  deletingId: string | null
  archivingId: string | null
  wizardOpen: boolean
  wizardMode: "create" | "edit"
  wizardCampaignId?: string
  wizardActiveTab: WizardTabId
  wizardName: string
  wizardDescription: string
  wizardTemplateId: string
  wizardContactListIds: string[]
  wizardListStrategy: "single" | "merge" | "per_list"
  wizardRecipientSource: "contact_list" | "radar_segment"
  wizardRadarSegmentSlug: string
  wizardScheduledAt: Date | undefined
  wizardUniformSchedule: boolean
  wizardScheduleIntervalDays: number
  wizardSubCampaignSchedules: Array<{ index: number; scheduledAt: Date }>
  wizardSubCampaignListIds: Record<number, string>
  wizardSubCampaignNames: Record<number, string>
  wizardPreviewPlan: CampaignPreviewPlan | null
  wizardPreviewLoading: boolean
  wizardLinkedForm: { id: string; name: string; publicId: string } | null
  wizardSaving: boolean
  wizardHydrating: boolean
  materializingSegment: boolean
  templates: Template[]
  contactLists: ContactList[]
  radarSegments: RadarSegmentOption[]
  detailCampaign: Campaign | null
  sheetTab: CampaignSheetTab
} & CampanhasActions

export function useCampanhas(supabaseId: string): CampanhasHookReturn {
  const { isBeta } = useFeatureAccess()
  const {
    host,
    teamId: activeTeamId,
    teamLoading,
    hideRadarSegments,
    bypassCreditsCheck,
    skipBetaGate,
  } = useStudioEmailRuntime()
  const service = host?.services.campanhas ?? defaultService
  const isCampaignsBetaAccess = skipBetaGate ? true : isBeta(FEATURE_SLUGS.EMAIL_CAMPAIGNS)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [nameFilter, setNameFilter] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const deferredName = useDeferredValue(nameFilter)
  const [loading, setLoading] = useState(false)
  const [credits, setCredits] = useState<CreditStatus | null>(null)
  const [loadingCredits, setLoadingCredits] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [cancelingId, setCancelingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [archivingId, setArchivingId] = useState<string | null>(null)

  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardMode, setWizardMode] = useState<"create" | "edit">("create")
  const [wizardCampaignId, setWizardCampaignId] = useState<string | undefined>(undefined)
  const [wizardActiveTab, setWizardActiveTab] = useState<WizardTabId>("geral")
  const [wizardName, setWizardName] = useState("")
  const [wizardDescription, setWizardDescriptionState] = useState("")
  const [wizardTemplateId, setWizardTemplateId] = useState("")
  const [wizardContactListIds, setWizardContactListIds] = useState<string[]>([])
  const [wizardListStrategy, setWizardListStrategy] = useState<"single" | "merge" | "per_list">("single")
  const [wizardRecipientSource, setWizardRecipientSource] = useState<"contact_list" | "radar_segment">("contact_list")
  const [wizardRadarSegmentSlug, setWizardRadarSegmentSlug] = useState("")
  const [wizardScheduledAt, setWizardScheduledAt] = useState<Date | undefined>(undefined)
  const [wizardUniformSchedule, setWizardUniformScheduleState] = useState(true)
  const [wizardScheduleIntervalDays, setWizardScheduleIntervalDays] = useState(1)
  const [wizardSubCampaignSchedules, setWizardSubCampaignSchedules] = useState<WizardSubCampaignSchedule[]>([])
  const [wizardSubCampaignListIds, setWizardSubCampaignListIds] = useState<Record<number, string>>({})
  const [wizardSubCampaignNames, setWizardSubCampaignNames] = useState<Record<number, string>>({})
  const [wizardPreviewPlan, setWizardPreviewPlan] = useState<CampaignPreviewPlan | null>(null)
  const wizardPreviewPlanRef = useRef<CampaignPreviewPlan | null>(null)
  const wizardScheduledAtRef = useRef<Date | undefined>(undefined)
  const wizardScheduleIntervalDaysRef = useRef(1)
  wizardPreviewPlanRef.current = wizardPreviewPlan
  wizardScheduledAtRef.current = wizardScheduledAt
  wizardScheduleIntervalDaysRef.current = wizardScheduleIntervalDays
  const [wizardPreviewLoading, setWizardPreviewLoading] = useState(false)
  const [wizardLinkedForm, setWizardLinkedForm] = useState<{ id: string; name: string; publicId: string } | null>(null)
  const [wizardSaving, setWizardSaving] = useState(false)
  const [wizardHydrating, setWizardHydrating] = useState(false)
  const [materializingSegment, setMaterializingSegment] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [contactLists, setContactLists] = useState<ContactList[]>([])
  const [radarSegments, setRadarSegments] = useState<RadarSegmentOption[]>([])

  const [detailCampaign, setDetailCampaign] = useState<Campaign | null>(null)
  const [sheetTab, setSheetTab] = useState<CampaignSheetTab>("campaign")

  const fetchingRef = useRef(false)
  const lastCampaignsKeyRef = useRef("")
  const sendingIdRef = useRef<string | null>(null)
  const sendingCampaignSnapshotRef = useRef<Campaign | null>(null)
  const sendingSubCampaignParentIdRef = useRef<string | null>(null)
  const dispatchSeenInListRef = useRef(false)

  const fetchCampaigns = useCallback(async (
    nextPage: number,
    nextStatus: string[],
    nextPageSize: number,
    nextName: string,
    nextDateFrom: string,
    nextDateTo: string,
  ) => {
    if (teamLoading) return
    if (!activeTeamId) {
      setCampaigns([])
      setTotal(0)
      setPage(1)
      setTotalPages(1)
      return
    }
    const key = `${supabaseId}|${activeTeamId}|${nextPage}|${statusKey(nextStatus)}|${nextPageSize}|${nextName}|${nextDateFrom}|${nextDateTo}`
    if (fetchingRef.current || lastCampaignsKeyRef.current === key) return
    fetchingRef.current = true
    setLoading(true)
    console.info("[useCampanhas] fetchCampaigns", { nextPage, nextStatus, nextPageSize, nextName, nextDateFrom, nextDateTo })
    try {
      const result = await service.list(
        supabaseId,
        activeTeamId,
        nextPage,
        nextPageSize,
        nextStatus.length > 0 ? nextStatus : undefined,
        nextName || undefined,
        nextDateFrom || undefined,
        nextDateTo || undefined,
      )
      const inFlightId = sendingIdRef.current
      const snapshot = sendingCampaignSnapshotRef.current
      const filteringSending = nextStatus.length === 0 || nextStatus.includes("sending")
      const stillInSendingList = Boolean(
        inFlightId && result.campaigns.some((campaign) => campaign.id === inFlightId)
      )

      if (inFlightId && stillInSendingList) {
        dispatchSeenInListRef.current = true
      }

      if (
        inFlightId &&
        snapshot &&
        filteringSending &&
        !stillInSendingList &&
        !dispatchSeenInListRef.current
      ) {
        // Ainda aguardando a campanha aparecer como "sending" na lista
        setCampaigns([{ ...snapshot, status: "sending" }, ...result.campaigns])
        setTotal(Math.max(result.total, 1))
      } else {
        setCampaigns(result.campaigns)
        setTotal(result.total)
      }
      setPage(result.page)
      setTotalPages(result.totalPages)
      lastCampaignsKeyRef.current = key
    } catch (err) {
      console.error("[useCampanhas] fetchCampaigns error", err)
      toast.error("Erro ao carregar campanhas")
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [activeTeamId, supabaseId, teamLoading])

  const fetchCredits = useCallback(async () => {
    if (teamLoading || !activeTeamId) return
    setLoadingCredits(true)
    try {
      const result = await service.getCreditStatus(supabaseId, activeTeamId)
      setCredits(result)
    } catch (err) {
      console.error("[useCampanhas] fetchCredits error", err)
    } finally {
      setLoadingCredits(false)
    }
  }, [activeTeamId, supabaseId, teamLoading])

  useEffect(() => {
    if (teamLoading) return
    void fetchCampaigns(1, statusFilter, pageSize, deferredName, dateFrom, dateTo)
    void fetchCredits()
  }, [fetchCampaigns, fetchCredits, teamLoading, deferredName])

  const handleStatusFilter = useCallback((statuses: string[]) => {
    setStatusFilter(statuses)
    setPage(1)
    void fetchCampaigns(1, statuses, pageSize, nameFilter, dateFrom, dateTo)
  }, [fetchCampaigns, pageSize, nameFilter, dateFrom, dateTo])

  const handlePageChange = useCallback((nextPage: number) => {
    setPage(nextPage)
    void fetchCampaigns(nextPage, statusFilter, pageSize, nameFilter, dateFrom, dateTo)
  }, [fetchCampaigns, statusFilter, pageSize, nameFilter, dateFrom, dateTo])

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size)
    setPage(1)
    void fetchCampaigns(1, statusFilter, size, nameFilter, dateFrom, dateTo)
  }, [fetchCampaigns, statusFilter, nameFilter, dateFrom, dateTo])

  const handleNameFilter = useCallback((value: string) => {
    setNameFilter(value)
    setPage(1)
  }, [])

  const handleDateFilter = useCallback((from: string, to: string) => {
    setDateFrom(from)
    setDateTo(to)
    setPage(1)
    void fetchCampaigns(1, statusFilter, pageSize, nameFilter, from, to)
  }, [fetchCampaigns, statusFilter, pageSize, nameFilter])

  const clearFilters = useCallback(() => {
    setNameFilter("")
    setDateFrom("")
    setDateTo("")
    setStatusFilter([])
    setPage(1)
    void fetchCampaigns(1, [], pageSize, "", "", "")
  }, [fetchCampaigns, pageSize])

  const handleSend = useCallback(async (id: string, options?: { retryFailedOnly?: boolean }) => {
    if (
      !bypassCreditsCheck &&
      !credits?.hasSubscription &&
      !isCampaignsBetaAccess &&
      !credits?.isBetaExempt
    ) {
      toast.error("Ative um plano em Assinaturas para disparar campanhas")
      return
    }

    const campaignToSend = campaigns.find((campaign) => campaign.id === id)
    const isDetailSubCampaign = Boolean(detailCampaign?.subCampaigns?.some((sub) => sub.id === id))
    const retryFailedOnly = options?.retryFailedOnly === true
    const sendingSnapshot = campaignToSend
      ? { ...campaignToSend, status: "sending" as const }
      : null
    if (!isDetailSubCampaign) {
      sendingSubCampaignParentIdRef.current = null
      sendingIdRef.current = id
      sendingCampaignSnapshotRef.current = sendingSnapshot
      dispatchSeenInListRef.current = false
      setSendingId(id)
      setStatusFilter(["sending"])
      setPage(1)
      lastCampaignsKeyRef.current = ""
    } else {
      sendingSubCampaignParentIdRef.current = detailCampaign?.id ?? null
      sendingIdRef.current = null
      sendingCampaignSnapshotRef.current = null
      dispatchSeenInListRef.current = false
      setSendingId(id)
    }

    if (sendingSnapshot) {
      setCampaigns([sendingSnapshot])
      setTotal(1)
      setTotalPages(1)
    } else if (!isDetailSubCampaign) {
      setCampaigns((prev) =>
        prev.map((campaign) =>
          campaign.id === id ? { ...campaign, status: "sending" } : campaign
        )
      )
    }

    console.info("[useCampanhas] handleSend", { id, retryFailedOnly })
    try {
      const result = await service.send(supabaseId, activeTeamId, id, {
        ...(retryFailedOnly ? { retryFailedOnly: true } : {}),
      })
      if (sendingCampaignSnapshotRef.current) {
        sendingCampaignSnapshotRef.current = {
          ...sendingCampaignSnapshotRef.current,
          totalRecipients: result.totalRecipients,
          status: "sending",
        }
      }
      setCampaigns((prev) =>
        prev.map((campaign) =>
          campaign.id === id
            ? { ...campaign, totalRecipients: result.totalRecipients, status: "sending" }
            : campaign
        )
      )
      setDetailCampaign((prev) => {
        if (!prev?.subCampaigns?.some((sub) => sub.id === id)) return prev
        return {
          ...prev,
          subCampaigns: prev.subCampaigns.map((sub) =>
            sub.id === id
              ? { ...sub, totalRecipients: result.totalRecipients, status: "sending" }
              : sub
          ),
        }
      })
      toast.success(
        result.retryFailedOnly || retryFailedOnly
          ? `Reenvio das falhas iniciado (${result.totalRecipients.toLocaleString("pt-BR")} destinatário(s)). Quem já recebeu não será reenviado.`
          : "Disparo iniciado em segundo plano. Você pode sair desta página."
      )
      if (detailCampaign?.id === id) {
        setDetailCampaign(null)
      }
      if (!isDetailSubCampaign) {
        lastCampaignsKeyRef.current = ""
        void fetchCampaigns(1, ["sending"], pageSize, nameFilter, dateFrom, dateTo)
      } else {
        void fetchCampaigns(page, statusFilter, pageSize, nameFilter, dateFrom, dateTo)
      }
      void fetchCredits()
    } catch (err) {
      console.error("[useCampanhas] handleSend error", err)
      const rawMessage = err instanceof Error ? err.message : "Erro ao disparar campanha"
      const message =
        /409|idempotency|idempotência/i.test(rawMessage)
          ? retryFailedOnly
            ? "Não foi possível reenviar as falhas agora. Tente novamente em instantes."
            : "Não foi possível disparar a campanha agora. Tente novamente em instantes."
          : rawMessage || "Erro ao disparar campanha"
      toast.error(message)
      if (!isDetailSubCampaign) {
        sendingIdRef.current = null
        sendingCampaignSnapshotRef.current = null
        dispatchSeenInListRef.current = false
        setSendingId(null)
        lastCampaignsKeyRef.current = ""
        void fetchCampaigns(1, statusFilter, pageSize, nameFilter, dateFrom, dateTo)
      } else {
        sendingSubCampaignParentIdRef.current = null
        setSendingId(null)
      }
    }
  }, [activeTeamId, campaigns, credits?.hasSubscription, credits?.isBetaExempt, detailCampaign, fetchCampaigns, fetchCredits, isCampaignsBetaAccess, page, pageSize, nameFilter, dateFrom, dateTo, statusFilter, supabaseId])

  useEffect(() => {
    const trackedId = sendingId
    if (!trackedId) return

    const tracked = campaigns.find((campaign) => campaign.id === trackedId)
    if (tracked?.status === "sending") {
      dispatchSeenInListRef.current = true
      return
    }

    if (tracked) {
      const name = tracked.name
      sendingIdRef.current = null
      sendingCampaignSnapshotRef.current = null
      sendingSubCampaignParentIdRef.current = null
      dispatchSeenInListRef.current = false
      setSendingId(null)
      if (tracked.status === "failed") {
        toast.error(
          tracked.errorMessage
            ? `Disparo de "${name}" falhou: ${tracked.errorMessage}`
            : `Disparo de "${name}" falhou.`
        )
      } else {
        toast.success(`Disparo de "${name}" concluído. O status foi atualizado automaticamente.`)
      }
      void fetchCredits()
      return
    }

    if (dispatchSeenInListRef.current && statusFilter.includes("sending")) {
      const name = sendingCampaignSnapshotRef.current?.name
      sendingIdRef.current = null
      sendingCampaignSnapshotRef.current = null
      sendingSubCampaignParentIdRef.current = null
      dispatchSeenInListRef.current = false
      setSendingId(null)
      if (name) {
        toast.success(`Disparo de "${name}" concluído. O status foi atualizado automaticamente.`)
      } else {
        toast.success("Disparo concluído. O status foi atualizado automaticamente.")
      }
      void fetchCredits()
    }
  }, [campaigns, sendingId, statusFilter, fetchCredits])

  useEffect(() => {
    if (!sendingId) return

    const parentCampaignId = sendingSubCampaignParentIdRef.current
    if (!parentCampaignId) return
    const trackedParentCampaignId: string = parentCampaignId

    async function refreshSubCampaignStatus() {
      try {
        const detailed = await service.getById(supabaseId, activeTeamId, trackedParentCampaignId)
        setDetailCampaign((prev) => (prev?.id === trackedParentCampaignId ? detailed : prev))

        const tracked = detailed.subCampaigns?.find((sub) => sub.id === sendingId)
        if (!tracked || tracked.status === "sending") return

        sendingSubCampaignParentIdRef.current = null
        dispatchSeenInListRef.current = false
        setSendingId(null)
        if (tracked.status === "failed") {
          toast.error(
            tracked.errorMessage
              ? `Disparo de "${tracked.name}" falhou: ${tracked.errorMessage}`
              : `Disparo de "${tracked.name}" falhou.`
          )
        } else {
          toast.success(`Disparo de "${tracked.name}" concluído. O status foi atualizado automaticamente.`)
        }
        void fetchCredits()
        void fetchCampaigns(page, statusFilter, pageSize, nameFilter, dateFrom, dateTo)
      } catch (err) {
        console.error("[useCampanhas] refreshSubCampaignStatus error", err)
      }
    }

    void refreshSubCampaignStatus()
    const intervalId = window.setInterval(() => {
      void refreshSubCampaignStatus()
    }, 4000)
    return () => window.clearInterval(intervalId)
  }, [
    activeTeamId,
    dateFrom,
    dateTo,
    fetchCampaigns,
    fetchCredits,
    nameFilter,
    page,
    pageSize,
    sendingId,
    statusFilter,
    supabaseId,
  ])

  useEffect(() => {
    if (!sendingId) return
    if (sendingSubCampaignParentIdRef.current) return

    const pollStatus =
      statusFilter.includes("sending") || statusFilter.length === 0
        ? statusFilter.length === 0
          ? ["sending"]
          : statusFilter
        : ["sending"]

    const intervalId = window.setInterval(() => {
      lastCampaignsKeyRef.current = ""
      void fetchCampaigns(1, pollStatus, pageSize, nameFilter, dateFrom, dateTo)
    }, 4000)
    return () => window.clearInterval(intervalId)
  }, [sendingId, statusFilter, fetchCampaigns, pageSize, nameFilter, dateFrom, dateTo])

  // Ao voltar à página com campanha já em envio, acompanha no banner/poll
  useEffect(() => {
    if (sendingId) return
    const existingSending = campaigns.find((campaign) => campaign.status === "sending")
    if (!existingSending) return
    sendingIdRef.current = existingSending.id
    sendingCampaignSnapshotRef.current = existingSending
    dispatchSeenInListRef.current = true
    setSendingId(existingSending.id)
  }, [campaigns, sendingId])

  // Detecta formulário vinculado ao trocar o template no wizard (mesma lógica do getById)
  useEffect(() => {
    if (!wizardOpen) return
    if (!wizardTemplateId) {
      setWizardLinkedForm(null)
      return
    }
    const selected = templates.find((template) => template.id === wizardTemplateId)
    if (!selected) return
    setWizardLinkedForm(selected.linkedForm ?? null)
  }, [wizardOpen, wizardTemplateId, templates])

  const handleCancel = useCallback(async (id: string) => {
    setCancelingId(id)
    console.info("[useCampanhas] handleCancel", id)
    try {
      await service.cancel(supabaseId, activeTeamId, id)
      toast.success("Campanha cancelada")
      void fetchCampaigns(page, statusFilter, pageSize, nameFilter, dateFrom, dateTo)
    } catch (err) {
      console.error("[useCampanhas] handleCancel error", err)
      toast.error("Erro ao cancelar campanha")
    } finally {
      setCancelingId(null)
    }
  }, [activeTeamId, fetchCampaigns, page, pageSize, nameFilter, dateFrom, dateTo, statusFilter, supabaseId])

  const handleDeleteDraft = useCallback(async (id: string) => {
    setDeletingId(id)
    console.info("[useCampanhas] handleDeleteDraft", id)
    try {
      await service.deleteDraft(supabaseId, activeTeamId, id)
      setCampaigns((prev) => prev.filter((c) => c.id !== id))
      setTotal((prev) => Math.max(0, prev - 1))
      if (detailCampaign?.id === id) setDetailCampaign(null)
      toast.success("Rascunho excluído")
    } catch (err) {
      console.error("[useCampanhas] handleDeleteDraft error", err)
      toast.error("Erro ao excluir rascunho")
    } finally {
      setDeletingId(null)
    }
  }, [activeTeamId, detailCampaign?.id, supabaseId])

  const handleArchive = useCallback(async (id: string) => {
    setArchivingId(id)
    console.info("[useCampanhas] handleArchive", id)
    try {
      await service.archive(supabaseId, activeTeamId, id)
      setCampaigns((prev) => prev.filter((c) => c.id !== id))
      setTotal((prev) => Math.max(0, prev - 1))
      if (detailCampaign?.id === id) setDetailCampaign(null)
      toast.success("Campanha arquivada")
    } catch (err) {
      console.error("[useCampanhas] handleArchive error", err)
      toast.error("Erro ao arquivar campanha")
    } finally {
      setArchivingId(null)
    }
  }, [activeTeamId, detailCampaign?.id, supabaseId])

  const setWizardDescription = useCallback((v: string) => {
    setWizardDescriptionState(v)
  }, [])

  const resetWizardState = useCallback(() => {
    setWizardMode("create")
    setWizardCampaignId(undefined)
    setWizardActiveTab("geral")
    setWizardName("")
    setWizardDescriptionState("")
    setWizardTemplateId("")
    setWizardContactListIds([])
    setWizardListStrategy("single")
    setWizardRecipientSource("contact_list")
    setWizardRadarSegmentSlug("")
    setWizardScheduledAt(undefined)
    setWizardUniformScheduleState(true)
    setWizardScheduleIntervalDays(1)
    setWizardSubCampaignSchedules([])
    setWizardSubCampaignListIds({})
    setWizardSubCampaignNames({})
    setWizardPreviewPlan(null)
    setWizardLinkedForm(null)
    setWizardHydrating(false)
  }, [])

  const loadWizardOptions = useCallback(async () => {
    const [tmpl, lists] = await Promise.all([
      service.getTemplates(supabaseId, activeTeamId),
      service.getContactLists(supabaseId, activeTeamId),
    ])
    setTemplates(tmpl)
    setContactLists(lists)
    try {
      if (activeTeamId && !hideRadarSegments) {
        const segmentsRes = await radarFrontendService.listSegments(supabaseId, activeTeamId)
        setRadarSegments(segmentsRes.segments as RadarSegmentOption[])
      } else {
        setRadarSegments([])
      }
    } catch {
      setRadarSegments([])
    }
  }, [activeTeamId, hideRadarSegments, service, supabaseId])

  const ensureWizardOptionsFromCampaign = useCallback((campaign: Campaign) => {
    const templateId = campaign.template?.id ?? campaign.templateId
    if (templateId) {
      setTemplates((prev) => {
        if (prev.some((template) => template.id === templateId)) return prev
        const injected: Template = {
          id: templateId,
          name: campaign.template?.name ?? "Template da campanha",
          subject: campaign.template?.subject ?? "",
          status: "published",
          isCurrentPublished: true,
        }
        return [injected, ...prev]
      })
    }

    const listIds =
      campaign.sourceContactListIds && campaign.sourceContactListIds.length > 0
        ? campaign.sourceContactListIds
        : campaign.contactList?.id || campaign.contactListId
          ? [campaign.contactList?.id ?? (campaign.contactListId as string)]
          : (campaign.subCampaigns ?? [])
              .map((sub) => sub.contactListId)
              .filter((id): id is string => Boolean(id))

    const uniqueListIds = Array.from(new Set(listIds))
    if (uniqueListIds.length === 0) return

    setContactLists((prev) => {
      const missing = uniqueListIds.filter((id) => !prev.some((list) => list.id === id))
      if (missing.length === 0) return prev

      const injected: ContactList[] = missing.map((id) => {
        if (campaign.contactList?.id === id) {
          return {
            id,
            name: campaign.contactList.name,
            totalContacts: campaign.contactList.totalContacts ?? 0,
            activeContacts: campaign.contactList.activeContacts,
          }
        }
        const child = campaign.subCampaigns?.find((sub) => sub.contactListId === id)
        return {
          id,
          name: child?.name ? `Lista de ${child.name}` : "Lista da campanha",
          totalContacts: child?.totalRecipients ?? 0,
        }
      })
      return [...injected, ...prev]
    })
  }, [])

  const hydrateWizardFromCampaign = useCallback((
    campaign: Campaign,
    options?: { mode?: "create" | "edit"; namePrefix?: string }
  ) => {
    const mode = options?.mode ?? "edit"
    const childListIds = Array.from(
      new Set(
        (campaign.subCampaigns ?? [])
          .map((sub) => sub.contactListId)
          .filter((id): id is string => Boolean(id))
      )
    )
    const storedSourceIds = campaign.sourceContactListIds ?? []
    const listIds =
      storedSourceIds.length > 0
        ? storedSourceIds
        : campaign.contactList?.id || campaign.contactListId
          ? [campaign.contactList?.id ?? (campaign.contactListId as string)]
          : childListIds

    const uniqueListIds = Array.from(new Set(listIds))
    const isPerList =
      uniqueListIds.length > 1 &&
      childListIds.length > 1 &&
      storedSourceIds.length === 0

    const templateId = campaign.template?.id ?? campaign.templateId ?? ""
    const subSchedules = (campaign.subCampaigns ?? [])
      .filter((sub) => sub.scheduledAt && (sub.subCampaignIndex ?? 0) > 0)
      .map((sub) => ({
        index: sub.subCampaignIndex as number,
        scheduledAt: new Date(sub.scheduledAt as string),
      }))
      .sort((a, b) => a.index - b.index)

    const firstScheduled =
      campaign.scheduledAt
        ? new Date(campaign.scheduledAt)
        : subSchedules[0]?.scheduledAt

    const MS_PER_DAY = 24 * 60 * 60 * 1000
    let intervalDays = 1
    let uniform = true
    if (subSchedules.length > 1) {
      const deltas: number[] = []
      let allExactWholeDayGaps = true
      for (let i = 1; i < subSchedules.length; i++) {
        const diffMs =
          subSchedules[i].scheduledAt.getTime() - subSchedules[i - 1].scheduledAt.getTime()
        // Only treat as uniform when every gap is an exact identical whole-day interval.
        // Rounding (e.g. 36h → 2 days) would silently rewrite custom schedules on save.
        if (diffMs <= 0 || diffMs % MS_PER_DAY !== 0) {
          allExactWholeDayGaps = false
          break
        }
        const days = diffMs / MS_PER_DAY
        if (days < 1) {
          allExactWholeDayGaps = false
          break
        }
        deltas.push(days)
      }
      if (
        allExactWholeDayGaps &&
        deltas.length > 0 &&
        deltas.every((day) => day === deltas[0])
      ) {
        intervalDays = deltas[0]
        uniform = true
      } else {
        uniform = false
      }
    }

    const subListIds: Record<number, string> = {}
    const subNames: Record<number, string> = {}
    for (const sub of campaign.subCampaigns ?? []) {
      if (sub.subCampaignIndex && sub.contactListId) {
        subListIds[sub.subCampaignIndex] = sub.contactListId
      }
      if (sub.subCampaignIndex && sub.name.trim()) {
        subNames[sub.subCampaignIndex] = sub.name
      }
    }

    const baseName = (campaign.name ?? "").trim()
    const prefixedName =
      options?.namePrefix && baseName && !baseName.startsWith(options.namePrefix)
        ? `${options.namePrefix}${baseName}`
        : baseName

    setWizardMode(mode)
    // Create/duplicate: never bind an existing id — close without save must not persist.
    setWizardCampaignId(mode === "edit" ? campaign.id : undefined)
    setWizardActiveTab("geral")
    setWizardName(prefixedName)
    setWizardDescriptionState(campaign.description ?? "")
    setWizardTemplateId(templateId)
    setWizardContactListIds(uniqueListIds)
    setWizardListStrategy(
      uniqueListIds.length > 1 ? (isPerList ? "per_list" : "merge") : "single"
    )
    setWizardRecipientSource(campaign.radarSegmentSlug ? "radar_segment" : "contact_list")
    setWizardRadarSegmentSlug(campaign.radarSegmentSlug ?? "")
    setWizardScheduledAt(firstScheduled)
    setWizardUniformScheduleState(uniform)
    setWizardScheduleIntervalDays(intervalDays)
    setWizardSubCampaignSchedules(uniform ? [] : subSchedules)
    setWizardSubCampaignListIds(subListIds)
    setWizardSubCampaignNames(subNames)
    setWizardLinkedForm(campaign.linkedForm ?? null)
    ensureWizardOptionsFromCampaign(campaign)
  }, [ensureWizardOptionsFromCampaign])

  const openWizard = useCallback(async () => {
    resetWizardState()
    setWizardOpen(true)
    try {
      await loadWizardOptions()
    } catch (err) {
      console.error("[useCampanhas] openWizard fetch error", err)
    }
  }, [loadWizardOptions, resetWizardState])

  const openEditWizard = useCallback(async (campaign: Campaign) => {
    // Imutabilidade: apenas draft|scheduled — sent/failed usam disparo (novo dispatch) ou Duplicar.
    if (!EDITABLE_STATUSES.has(campaign.status)) {
      toast.error("Campanha não pode ser editada no status atual")
      return
    }
    resetWizardState()
    setWizardHydrating(true)
    // Preenche com o que já temos enquanto carrega o detalhe completo
    hydrateWizardFromCampaign(campaign, { mode: "edit" })
    setWizardOpen(true)
    setDetailCampaign(null)
    try {
      await loadWizardOptions()
      const detailed = await service.getById(supabaseId, activeTeamId, campaign.id)
      hydrateWizardFromCampaign(detailed, { mode: "edit" })
    } catch (err) {
      console.error("[useCampanhas] openEditWizard error", err)
      toast.error("Erro ao carregar detalhes da campanha para edição")
    } finally {
      setWizardHydrating(false)
    }
  }, [activeTeamId, hydrateWizardFromCampaign, loadWizardOptions, resetWizardState, service, supabaseId])

  const openDuplicateWizard = useCallback(async (campaign: Campaign) => {
    resetWizardState()
    setWizardHydrating(true)
    hydrateWizardFromCampaign(campaign, { mode: "create", namePrefix: "Cópia de " })
    setWizardOpen(true)
    setDetailCampaign(null)
    try {
      await loadWizardOptions()
      const detailed = await service.getById(supabaseId, activeTeamId, campaign.id)
      hydrateWizardFromCampaign(detailed, { mode: "create", namePrefix: "Cópia de " })
    } catch (err) {
      console.error("[useCampanhas] openDuplicateWizard error", err)
      toast.error("Erro ao carregar detalhes da campanha para duplicar")
      setWizardOpen(false)
      resetWizardState()
    } finally {
      setWizardHydrating(false)
    }
  }, [activeTeamId, hydrateWizardFromCampaign, loadWizardOptions, resetWizardState, service, supabaseId])

  const closeWizard = useCallback(() => {
    if (wizardSaving) return
    setWizardOpen(false)
    setWizardHydrating(false)
    // Descarta estado de create/duplicar sem persistir rascunho órfão.
    resetWizardState()
  }, [resetWizardState, wizardSaving])

  const toggleWizardContactListId = useCallback((listId: string, selected: boolean) => {
    setWizardContactListIds((prev) => {
      if (selected) return Array.from(new Set([...prev, listId]))
      const next = prev.filter((id) => id !== listId)
      if (next.length <= 1) setWizardListStrategy("single")
      return next
    })
  }, [])

  const setWizardUniformSchedule = useCallback((uniform: boolean) => {
    setWizardUniformScheduleState(uniform)
    if (uniform) {
      setWizardSubCampaignSchedules([])
      return
    }

    const plan = wizardPreviewPlanRef.current
    if (!plan || plan.subCampaigns.length <= 1) return

    setWizardSubCampaignSchedules((prev) => {
      const synced = syncSubCampaignSchedules({
        plan,
        prev,
        fallbackStart: wizardScheduledAtRef.current,
        intervalDays: wizardScheduleIntervalDaysRef.current,
      })
      return schedulesEqual(prev, synced) ? prev : synced
    })
  }, [])

  const setWizardSubCampaignSchedule = useCallback((index: number, date: Date | undefined) => {
    setWizardSubCampaignSchedules((prev) => {
      const without = prev.filter((entry) => entry.index !== index)
      if (!date) return without
      return [...without, { index, scheduledAt: date }].sort((a, b) => a.index - b.index)
    })
  }, [])

  const setWizardSubCampaignListId = useCallback((index: number, listId: string | undefined) => {
    setWizardSubCampaignListIds((prev) => {
      if (!listId) {
        const { [index]: _removed, ...rest } = prev
        return rest
      }
      return { ...prev, [index]: listId }
    })
  }, [])

  const setWizardSubCampaignName = useCallback((index: number, name: string) => {
    setWizardSubCampaignNames((prev) => ({ ...prev, [index]: name }))
  }, [])

  const refreshWizardPreviewPlan = useCallback(async () => {
    if (!wizardName.trim() || !wizardTemplateId) {
      setWizardPreviewPlan(null)
      return
    }
    const hasAudience =
      (wizardRecipientSource === "contact_list" && wizardContactListIds.length > 0) ||
      (wizardRecipientSource === "radar_segment" && Boolean(wizardRadarSegmentSlug))
    if (!hasAudience) {
      setWizardPreviewPlan(null)
      return
    }

    setWizardPreviewLoading(true)
    try {
      const payload = buildCampaignPayload({
        name: wizardName,
        description: wizardDescription,
        templateId: wizardTemplateId,
        recipientSource: wizardRecipientSource,
        contactListIds: wizardContactListIds,
        listStrategy: wizardListStrategy,
        radarSegmentSlug: wizardRadarSegmentSlug,
        scheduledAt: wizardScheduledAt,
        uniformSchedule: wizardUniformSchedule,
        scheduleIntervalDays: wizardScheduleIntervalDays,
        subCampaignSchedules: wizardSubCampaignSchedules,
      })
      const plan = await service.previewPlan(supabaseId, activeTeamId, payload)
      setWizardPreviewPlan(plan)

      if (!wizardUniformSchedule && plan.subCampaigns.length > 1) {
        setWizardSubCampaignSchedules((prev) => {
          const synced = syncSubCampaignSchedules({
            plan,
            prev,
            fallbackStart: wizardScheduledAt,
            intervalDays: wizardScheduleIntervalDays,
          })
          return schedulesEqual(prev, synced) ? prev : synced
        })
      }
    } catch (err) {
      console.error("[useCampanhas] refreshWizardPreviewPlan error", err)
      setWizardPreviewPlan(null)
    } finally {
      setWizardPreviewLoading(false)
    }
  }, [
    activeTeamId,
    service,
    supabaseId,
    wizardContactListIds,
    wizardDescription,
    wizardListStrategy,
    wizardName,
    wizardRadarSegmentSlug,
    wizardRecipientSource,
    wizardScheduleIntervalDays,
    wizardScheduledAt,
    wizardSubCampaignSchedules,
    wizardTemplateId,
    wizardUniformSchedule,
  ])

  const handleSaveCampaign = useCallback(async () => {
    setWizardSaving(true)
    try {
      const payload = buildCampaignPayload({
        name: wizardName,
        description: wizardDescription,
        templateId: wizardTemplateId,
        recipientSource: wizardRecipientSource,
        contactListIds: wizardContactListIds,
        listStrategy: wizardListStrategy,
        radarSegmentSlug: wizardRadarSegmentSlug,
        scheduledAt: wizardScheduledAt,
        uniformSchedule: wizardUniformSchedule,
        scheduleIntervalDays: wizardScheduleIntervalDays,
        subCampaignSchedules: wizardSubCampaignSchedules,
      })

      if (wizardMode === "edit" && wizardCampaignId) {
        const detailed = await service.getById(supabaseId, activeTeamId, wizardCampaignId)
        const subCampaignUpdates =
          wizardPreviewPlan?.subCampaigns
            .map((sub) => {
              const child = detailed.subCampaigns?.find((entry) => entry.subCampaignIndex === sub.index)
              if (!child) return null
              const customSchedule = wizardSubCampaignSchedules.find((entry) => entry.index === sub.index)
              const contactListOverride = wizardSubCampaignListIds[sub.index]
              const overriddenName = wizardSubCampaignNames[sub.index]
              const resolvedName = (overriddenName ?? sub.name).trim() || sub.name
              return {
                id: child.id,
                name: resolvedName,
                scheduledAt: customSchedule
                  ? customSchedule.scheduledAt.toISOString()
                  : sub.scheduledAt ?? null,
                ...(contactListOverride !== undefined && { contactListId: contactListOverride }),
              }
            })
            .filter((entry): entry is { id: string; name: string; scheduledAt: string | null } => Boolean(entry)) ?? []

        await service.update(supabaseId, activeTeamId, wizardCampaignId, {
          name: payload.name,
          description: payload.description,
          templateId: payload.templateId,
          ...(subCampaignUpdates.length > 0 ? { subCampaignUpdates } : {}),
        })
        toast.success("Campanha atualizada")
      } else {
        const created = await service.create(supabaseId, activeTeamId, payload)
        const hasNameOverrides = Object.keys(wizardSubCampaignNames).length > 0
        if (hasNameOverrides) {
          let children = created.subCampaigns
          if (!children?.length && (created.subCampaignCount ?? 0) > 0) {
            const detailed = await service.getById(supabaseId, activeTeamId, created.id)
            children = detailed.subCampaigns
          }
          const nameUpdates =
            (children ?? [])
              .map((child) => {
                const index = child.subCampaignIndex
                if (index == null) return null
                const override = wizardSubCampaignNames[index]
                if (override === undefined) return null
                const resolvedName = override.trim() || child.name
                if (resolvedName === child.name) return null
                return { id: child.id, name: resolvedName }
              })
              .filter((entry): entry is { id: string; name: string } => Boolean(entry))
          if (nameUpdates.length > 0) {
            await service.update(supabaseId, activeTeamId, created.id, {
              subCampaignUpdates: nameUpdates,
            })
          }
        }
        const subCount = created.subCampaignCount ?? created.subCampaigns?.length ?? 0
        toast.success(
          subCount > 0
            ? `Campanha criada com ${subCount} sub-campanhas`
            : "Campanha criada com sucesso"
        )
      }

      setWizardOpen(false)
      resetWizardState()
      lastCampaignsKeyRef.current = ""
      void fetchCampaigns(page, statusFilter, pageSize, nameFilter, dateFrom, dateTo)
    } catch (err) {
      console.error("[useCampanhas] handleSaveCampaign error", err)
      const message = err instanceof Error ? err.message : "Erro ao salvar campanha"
      toast.error(message)
    } finally {
      setWizardSaving(false)
    }
  }, [
    activeTeamId,
    dateFrom,
    dateTo,
    detailCampaign,
    fetchCampaigns,
    nameFilter,
    page,
    pageSize,
    resetWizardState,
    service,
    statusFilter,
    supabaseId,
    wizardCampaignId,
    wizardContactListIds,
    wizardDescription,
    wizardListStrategy,
    wizardMode,
    wizardName,
    wizardPreviewPlan?.subCampaigns,
    wizardRadarSegmentSlug,
    wizardRecipientSource,
    wizardScheduleIntervalDays,
    wizardScheduledAt,
    wizardSubCampaignSchedules,
    wizardSubCampaignListIds,
    wizardSubCampaignNames,
    wizardTemplateId,
    wizardUniformSchedule,
  ])

  const handleMaterializeRadarSegment = useCallback(async () => {
    if (!wizardRadarSegmentSlug || !activeTeamId) return
    setMaterializingSegment(true)
    try {
      const result = await radarFrontendService.materializeContactList(
        supabaseId,
        activeTeamId,
        wizardRadarSegmentSlug
      )
      toast.success(`Lista criada com ${result.totalContacts.toLocaleString("pt-BR")} contatos`)
      const lists = await service.getContactLists(supabaseId, activeTeamId)
      setContactLists(lists)
      setWizardRecipientSource("contact_list")
      setWizardRadarSegmentSlug("")
      setWizardContactListIds([result.listId])
      setWizardListStrategy("single")
    } catch (err) {
      console.error("[useCampanhas] handleMaterializeRadarSegment error", err)
      const message = err instanceof Error ? err.message : "Erro ao materializar lista"
      toast.error(message)
    } finally {
      setMaterializingSegment(false)
    }
  }, [activeTeamId, service, supabaseId, wizardRadarSegmentSlug])

  const openView = useCallback((campaign: Campaign) => {
    setDetailCampaign(campaign)
    setSheetTab("campaign")
    void service
      .getById(supabaseId, activeTeamId, campaign.id)
      .then((detailed) => setDetailCampaign(detailed))
      .catch((err) => {
        console.error("[useCampanhas] openView getById error", err)
      })
  }, [activeTeamId, supabaseId])

  const openEditById = useCallback(async (id: string) => {
    try {
      const detailed = await service.getById(supabaseId, activeTeamId, id)
      if (!EDITABLE_STATUSES.has(detailed.status)) {
        toast.error("Campanha não pode ser editada no status atual")
        return
      }
      await openEditWizard(detailed)
    } catch (err) {
      console.error("[useCampanhas] openEditById getById error", err)
      const message = err instanceof Error ? err.message : "Erro ao carregar campanha"
      toast.error(message)
    }
  }, [activeTeamId, openEditWizard, service, supabaseId])

  const closeDetail = useCallback(() => {
    setDetailCampaign(null)
  }, [])

  return {
    campaigns,
    total,
    page,
    pageSize,
    totalPages,
    statusFilter,
    nameFilter,
    dateFrom,
    dateTo,
    loading,
    credits,
    loadingCredits,
    sendingId,
    cancelingId,
    deletingId,
    archivingId,
    wizardOpen,
    wizardMode,
    wizardCampaignId,
    wizardActiveTab,
    wizardName,
    wizardDescription,
    wizardTemplateId,
    wizardContactListIds,
    wizardListStrategy,
    wizardRecipientSource,
    wizardRadarSegmentSlug,
    wizardScheduledAt,
    wizardUniformSchedule,
    wizardScheduleIntervalDays,
    wizardSubCampaignSchedules,
    wizardSubCampaignListIds,
    wizardSubCampaignNames,
    wizardPreviewPlan,
    wizardPreviewLoading,
    wizardLinkedForm,
    wizardSaving,
    wizardHydrating,
    materializingSegment,
    templates,
    contactLists,
    radarSegments,
    detailCampaign,
    sheetTab,
    handleSend,
    handleCancel,
    handleDeleteDraft,
    handleArchive,
    handleStatusFilter,
    handlePageChange,
    handlePageSizeChange,
    handleNameFilter,
    handleDateFilter,
    clearFilters,
    openWizard,
    openEditWizard,
    openDuplicateWizard,
    closeWizard,
    setWizardActiveTab,
    setWizardName,
    setWizardDescription,
    setWizardTemplateId,
    toggleWizardContactListId,
    setWizardListStrategy,
    setWizardRecipientSource,
    setWizardRadarSegmentSlug,
    setWizardScheduledAt,
    setWizardUniformSchedule,
    setWizardScheduleIntervalDays,
    setWizardSubCampaignSchedule,
    setWizardSubCampaignListId,
    setWizardSubCampaignName,
    refreshWizardPreviewPlan,
    handleSaveCampaign,
    handleMaterializeRadarSegment,
    openView,
    openEditById,
    closeDetail,
    setSheetTab,
  }
}
