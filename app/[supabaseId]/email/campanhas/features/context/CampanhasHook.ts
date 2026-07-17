"use client"

import { useCallback, useEffect, useRef, useState, useDeferredValue } from "react"
import { toast } from "sonner"
import { CampanhasService } from "../services/CampanhasService"
import type {
  Campaign,
  CreditStatus,
  Template,
  ContactList,
  CdpSegmentOption,
  CampaignSheetTab,
} from "./CampanhasTypes"
import { useFeatureAccess } from "@/app/context/FeatureAccessContext"
import { useTeamContext } from "@/app/context/TeamContext"
import { FEATURE_SLUGS } from "@/lib/features/feature-slugs"
import { cdpService } from "@/app/[supabaseId]/cdp/features/services/CdpService"

const DEFAULT_PAGE_SIZE = 10
const service = new CampanhasService()

const EDITABLE_STATUSES = new Set(["draft", "scheduled", "sent", "failed"])

function statusKey(statuses: string[]): string {
  return [...statuses].sort().join(",")
}

export type CampanhasActions = {
  handleSend: (id: string) => Promise<void>
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
  closeWizard: () => void
  setWizardStep: (step: 1 | 2 | 3) => void
  setWizardName: (v: string) => void
  setWizardTemplateId: (v: string) => void
  setWizardContactListId: (v: string) => void
  setWizardRecipientSource: (v: "contact_list" | "cdp_segment") => void
  setWizardCdpSegmentSlug: (v: string) => void
  setWizardScheduledAt: (v: Date | undefined) => void
  handleCreateCampaign: () => Promise<void>
  openView: (campaign: Campaign) => void
  openEdit: (campaign: Campaign) => void
  closeDetail: () => void
  setSheetTab: (tab: CampaignSheetTab) => void
  setEditName: (v: string) => void
  setEditTemplateId: (v: string) => void
  setEditContactListId: (v: string) => void
  setEditScheduledAt: (v: Date | undefined) => void
  handleUpdateCampaign: () => Promise<void>
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
  wizardStep: 1 | 2 | 3
  wizardName: string
  wizardTemplateId: string
  wizardContactListId: string
  wizardRecipientSource: "contact_list" | "cdp_segment"
  wizardCdpSegmentSlug: string
  wizardScheduledAt: Date | undefined
  wizardCreating: boolean
  templates: Template[]
  contactLists: ContactList[]
  cdpSegments: CdpSegmentOption[]
  detailCampaign: Campaign | null
  sheetTab: CampaignSheetTab
  editName: string
  editTemplateId: string
  editContactListId: string
  editScheduledAt: Date | undefined
  editSaving: boolean
} & CampanhasActions

export function useCampanhas(supabaseId: string): CampanhasHookReturn {
  const { isBeta } = useFeatureAccess()
  const { activeTeamId, isLoading: teamLoading } = useTeamContext()
  const isCampaignsBetaAccess = isBeta(FEATURE_SLUGS.EMAIL_CAMPAIGNS)
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
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1)
  const [wizardName, setWizardName] = useState("")
  const [wizardTemplateId, setWizardTemplateId] = useState("")
  const [wizardContactListId, setWizardContactListId] = useState("")
  const [wizardRecipientSource, setWizardRecipientSource] = useState<"contact_list" | "cdp_segment">("contact_list")
  const [wizardCdpSegmentSlug, setWizardCdpSegmentSlug] = useState("")
  const [wizardScheduledAt, setWizardScheduledAt] = useState<Date | undefined>(undefined)
  const [wizardCreating, setWizardCreating] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [contactLists, setContactLists] = useState<ContactList[]>([])
  const [cdpSegments, setCdpSegments] = useState<CdpSegmentOption[]>([])

  const [detailCampaign, setDetailCampaign] = useState<Campaign | null>(null)
  const [sheetTab, setSheetTab] = useState<CampaignSheetTab>("campaign")
  const [editName, setEditName] = useState("")
  const [editTemplateId, setEditTemplateId] = useState("")
  const [editContactListId, setEditContactListId] = useState("")
  const [editScheduledAt, setEditScheduledAt] = useState<Date | undefined>(undefined)
  const [editSaving, setEditSaving] = useState(false)

  const fetchingRef = useRef(false)
  const lastCampaignsKeyRef = useRef("")
  const sendingIdRef = useRef<string | null>(null)
  const sendingCampaignSnapshotRef = useRef<Campaign | null>(null)
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

  const handleSend = useCallback(async (id: string) => {
    if (!credits?.hasSubscription && !isCampaignsBetaAccess && !credits?.isBetaExempt) {
      toast.error("Ative um plano em Assinaturas para disparar campanhas")
      return
    }

    const campaignToSend = campaigns.find((campaign) => campaign.id === id)
    const sendingSnapshot = campaignToSend
      ? { ...campaignToSend, status: "sending" as const }
      : null
    sendingIdRef.current = id
    sendingCampaignSnapshotRef.current = sendingSnapshot
    dispatchSeenInListRef.current = false
    setSendingId(id)
    setStatusFilter(["sending"])
    setPage(1)
    lastCampaignsKeyRef.current = ""

    if (sendingSnapshot) {
      setCampaigns([sendingSnapshot])
      setTotal(1)
      setTotalPages(1)
    } else {
      setCampaigns((prev) =>
        prev.map((campaign) =>
          campaign.id === id ? { ...campaign, status: "sending" } : campaign
        )
      )
    }

    console.info("[useCampanhas] handleSend", id)
    try {
      const result = await service.send(supabaseId, activeTeamId, id)
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
      toast.success("Disparo iniciado em segundo plano. Você pode sair desta página.")
      if (detailCampaign?.id === id) {
        setDetailCampaign(null)
      }
      lastCampaignsKeyRef.current = ""
      void fetchCampaigns(1, ["sending"], pageSize, nameFilter, dateFrom, dateTo)
      void fetchCredits()
    } catch (err) {
      console.error("[useCampanhas] handleSend error", err)
      const message = err instanceof Error ? err.message : "Erro ao disparar campanha"
      toast.error(message || "Erro ao disparar campanha")
      sendingIdRef.current = null
      sendingCampaignSnapshotRef.current = null
      dispatchSeenInListRef.current = false
      setSendingId(null)
      lastCampaignsKeyRef.current = ""
      void fetchCampaigns(1, statusFilter, pageSize, nameFilter, dateFrom, dateTo)
    }
  }, [activeTeamId, campaigns, credits?.hasSubscription, credits?.isBetaExempt, detailCampaign?.id, fetchCampaigns, fetchCredits, isCampaignsBetaAccess, pageSize, nameFilter, dateFrom, dateTo, statusFilter, supabaseId])

  useEffect(() => {
    const trackedId = sendingId
    if (!trackedId) return

    const tracked = campaigns.find((campaign) => campaign.id === trackedId)
    if (tracked?.status === "sending") {
      dispatchSeenInListRef.current = true
      return
    }

    if (tracked) {
      // Já apareceu na lista com status terminal (sent/failed/…)
      const name = tracked.name
      sendingIdRef.current = null
      sendingCampaignSnapshotRef.current = null
      dispatchSeenInListRef.current = false
      setSendingId(null)
      toast.success(`Disparo de "${name}" concluído. O status foi atualizado automaticamente.`)
      void fetchCredits()
      return
    }

    if (dispatchSeenInListRef.current && statusFilter.includes("sending")) {
      const name = sendingCampaignSnapshotRef.current?.name
      sendingIdRef.current = null
      sendingCampaignSnapshotRef.current = null
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

  const openWizard = useCallback(async () => {
    setWizardStep(1)
    setWizardName("")
    setWizardTemplateId("")
    setWizardContactListId("")
    setWizardRecipientSource("contact_list")
    setWizardCdpSegmentSlug("")
    setWizardScheduledAt(undefined)
    setWizardOpen(true)
    try {
      const [tmpl, lists] = await Promise.all([
        service.getTemplates(supabaseId, activeTeamId),
        service.getContactLists(supabaseId, activeTeamId),
      ])
      setTemplates(tmpl)
      setContactLists(lists)
      try {
        if (activeTeamId) {
          const segmentsRes = await cdpService.listSegments(supabaseId, activeTeamId)
          setCdpSegments(segmentsRes.segments as CdpSegmentOption[])
        } else {
          setCdpSegments([])
        }
      } catch {
        setCdpSegments([])
      }
    } catch (err) {
      console.error("[useCampanhas] openWizard fetch error", err)
    }
  }, [activeTeamId, supabaseId])

  const closeWizard = useCallback(() => {
    if (wizardCreating) return
    setWizardOpen(false)
  }, [wizardCreating])

  const handleCreateCampaign = useCallback(async () => {
    const hasContactList = wizardRecipientSource === "contact_list" && wizardContactListId
    const hasCdpSegment = wizardRecipientSource === "cdp_segment" && wizardCdpSegmentSlug
    if (!wizardName.trim() || !wizardTemplateId || (!hasContactList && !hasCdpSegment)) {
      toast.error("Preencha o nome, template e origem dos destinatários")
      return
    }
    setWizardCreating(true)
    console.info("[useCampanhas] handleCreateCampaign")
    try {
      await service.create(supabaseId, activeTeamId, {
        name: wizardName.trim(),
        templateId: wizardTemplateId,
        ...(hasContactList ? { contactListId: wizardContactListId } : {}),
        ...(hasCdpSegment ? { cdpSegmentSlug: wizardCdpSegmentSlug } : {}),
        scheduledAt: wizardScheduledAt?.toISOString(),
      })
      toast.success("Campanha criada com sucesso")
      setWizardOpen(false)
      void fetchCampaigns(1, statusFilter, pageSize, nameFilter, dateFrom, dateTo)
    } catch (err) {
      console.error("[useCampanhas] handleCreateCampaign error", err)
      toast.error("Erro ao criar campanha")
    } finally {
      setWizardCreating(false)
    }
  }, [
    activeTeamId,
    wizardName,
    wizardTemplateId,
    wizardRecipientSource,
    wizardContactListId,
    wizardCdpSegmentSlug,
    wizardScheduledAt,
    fetchCampaigns,
    statusFilter,
    pageSize,
    nameFilter,
    dateFrom,
    dateTo,
    supabaseId,
  ])

  const loadEditOptions = useCallback(async () => {
    try {
      const [tmpl, lists] = await Promise.all([
        service.getTemplates(supabaseId, activeTeamId),
        service.getContactLists(supabaseId, activeTeamId),
      ])
      setTemplates(tmpl)
      setContactLists(lists)
    } catch (err) {
      console.error("[useCampanhas] loadEditOptions error", err)
    }
  }, [activeTeamId, supabaseId])

  const hydrateEditForm = useCallback((campaign: Campaign) => {
    setEditName(campaign.name)
    setEditTemplateId(campaign.template?.id ?? "")
    setEditContactListId(campaign.contactList?.id ?? "")
    setEditScheduledAt(campaign.scheduledAt ? new Date(campaign.scheduledAt) : undefined)
  }, [])

  const openView = useCallback((campaign: Campaign) => {
    setDetailCampaign(campaign)
    setSheetTab("campaign")
    hydrateEditForm(campaign)
    void loadEditOptions()
  }, [hydrateEditForm, loadEditOptions])

  const openEdit = useCallback((campaign: Campaign) => {
    if (!EDITABLE_STATUSES.has(campaign.status)) {
      toast.error("Campanha não pode ser editada no status atual")
      return
    }
    setDetailCampaign(campaign)
    setSheetTab("campaign")
    hydrateEditForm(campaign)
    void loadEditOptions()
  }, [hydrateEditForm, loadEditOptions])

  const closeDetail = useCallback(() => {
    if (editSaving) return
    setDetailCampaign(null)
  }, [editSaving])

  const handleUpdateCampaign = useCallback(async () => {
    if (!detailCampaign || !editName.trim()) {
      toast.error("Nome da campanha é obrigatório")
      return
    }
    if (!EDITABLE_STATUSES.has(detailCampaign.status)) {
      toast.error("Campanha não pode ser editada no status atual")
      return
    }
    setEditSaving(true)
    console.info("[useCampanhas] handleUpdateCampaign", detailCampaign.id)
    try {
      const canSchedule = detailCampaign.status === "draft" || detailCampaign.status === "scheduled"
      const updated = await service.update(supabaseId, activeTeamId, detailCampaign.id, {
        name: editName.trim(),
        templateId: editTemplateId || undefined,
        contactListId: editContactListId || undefined,
        ...(canSchedule ? { scheduledAt: editScheduledAt?.toISOString() ?? null } : {}),
      })
      const nextTemplate = templates.find((t) => t.id === (editTemplateId || detailCampaign.template?.id)) ?? detailCampaign.template
      const nextList = contactLists.find((l) => l.id === (editContactListId || detailCampaign.contactList?.id)) ?? detailCampaign.contactList
      const merged: Campaign = {
        ...detailCampaign,
        ...updated,
        name: updated.name,
        totalRecipients: updated.totalRecipients,
        scheduledAt: updated.scheduledAt,
        status: updated.status,
        template: nextTemplate ? { id: nextTemplate.id, name: nextTemplate.name } : detailCampaign.template,
        contactList: nextList ? { id: nextList.id, name: nextList.name } : detailCampaign.contactList,
        creator: detailCampaign.creator,
      }
      setCampaigns((prev) => prev.map((c) => (c.id === merged.id ? merged : c)))
      setDetailCampaign(merged)
      toast.success("Campanha atualizada")
      setSheetTab("campaign")
      void fetchCampaigns(page, statusFilter, pageSize, nameFilter, dateFrom, dateTo)
    } catch (err) {
      console.error("[useCampanhas] handleUpdateCampaign error", err)
      const message = err instanceof Error ? err.message : "Erro ao atualizar campanha"
      toast.error(message)
    } finally {
      setEditSaving(false)
    }
  }, [
    activeTeamId,
    contactLists,
    dateFrom,
    dateTo,
    detailCampaign,
    editContactListId,
    editName,
    editScheduledAt,
    editTemplateId,
    fetchCampaigns,
    nameFilter,
    page,
    pageSize,
    statusFilter,
    supabaseId,
    templates,
  ])

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
    wizardStep,
    wizardName,
    wizardTemplateId,
    wizardContactListId,
    wizardRecipientSource,
    wizardCdpSegmentSlug,
    wizardScheduledAt,
    wizardCreating,
    templates,
    contactLists,
    cdpSegments,
    detailCampaign,
    sheetTab,
    editName,
    editTemplateId,
    editContactListId,
    editScheduledAt,
    editSaving,
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
    closeWizard,
    setWizardStep,
    setWizardName,
    setWizardTemplateId,
    setWizardContactListId,
    setWizardRecipientSource,
    setWizardCdpSegmentSlug,
    setWizardScheduledAt,
    handleCreateCampaign,
    openView,
    openEdit,
    closeDetail,
    setSheetTab,
    setEditName,
    setEditTemplateId,
    setEditContactListId,
    setEditScheduledAt,
    handleUpdateCampaign,
  }
}
