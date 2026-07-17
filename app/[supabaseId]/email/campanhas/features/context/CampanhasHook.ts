"use client"

import { useCallback, useEffect, useRef, useState, useDeferredValue } from "react"
import { toast } from "sonner"
import { CampanhasService } from "../services/CampanhasService"
import type { Campaign, CreditStatus, Template, ContactList, CdpSegmentOption } from "./CampanhasTypes"
import { useFeatureAccess } from "@/app/context/FeatureAccessContext"
import { useTeamContext } from "@/app/context/TeamContext"
import { FEATURE_SLUGS } from "@/lib/features/feature-slugs"
import { cdpService } from "@/app/[supabaseId]/cdp/features/services/CdpService"

const DEFAULT_PAGE_SIZE = 10
const service = new CampanhasService()

export type CampanhasActions = {
  handleSend: (id: string) => Promise<void>
  handleCancel: (id: string) => Promise<void>
  handleDeleteDraft: (id: string) => Promise<void>
  handleArchive: (id: string) => Promise<void>
  handleStatusFilter: (status: string) => void
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
  openEdit: (campaign: Campaign) => void
  closeEdit: () => void
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
  statusFilter: string
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
  editingCampaign: Campaign | null
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
  const [statusFilter, setStatusFilter] = useState("")
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

  // Wizard
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

  // Edit draft
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
  const [editName, setEditName] = useState("")
  const [editTemplateId, setEditTemplateId] = useState("")
  const [editContactListId, setEditContactListId] = useState("")
  const [editScheduledAt, setEditScheduledAt] = useState<Date | undefined>(undefined)
  const [editSaving, setEditSaving] = useState(false)

  const fetchingRef = useRef(false)
  const lastCampaignsKeyRef = useRef("")

  const fetchCampaigns = useCallback(async (
    nextPage: number,
    nextStatus: string,
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
    const key = `${supabaseId}|${activeTeamId}|${nextPage}|${nextStatus}|${nextPageSize}|${nextName}|${nextDateFrom}|${nextDateTo}`
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
        nextStatus || undefined,
        nextName || undefined,
        nextDateFrom || undefined,
        nextDateTo || undefined,
      )
      setCampaigns(result.campaigns)
      setTotal(result.total)
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchCampaigns, fetchCredits, teamLoading, deferredName])

  const handleStatusFilter = useCallback((status: string) => {
    setStatusFilter(status)
    setPage(1)
    void fetchCampaigns(1, status, pageSize, nameFilter, dateFrom, dateTo)
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
    setPage(1)
    void fetchCampaigns(1, statusFilter, pageSize, "", "", "")
  }, [fetchCampaigns, statusFilter, pageSize])

  const handleSend = useCallback(async (id: string) => {
    if (!credits?.hasSubscription && !isCampaignsBetaAccess && !credits?.isBetaExempt) {
      toast.error("Ative um plano em Assinaturas para disparar campanhas")
      return
    }
    setSendingId(id)
    setCampaigns((prev) =>
      prev.map((campaign) =>
        campaign.id === id ? { ...campaign, status: "sending" } : campaign
      )
    )
    console.info("[useCampanhas] handleSend", id)
    try {
      const result = await service.send(supabaseId, activeTeamId, id)
      const total = result.total ?? result.sent
      const detail =
        result.failed > 0
          ? ` (${result.sent} enviados, ${result.failed} falharam)`
          : ""
      toast.success(`Campanha disparada para ${total} destinatário(s)${detail}`)
      if (editingCampaign?.id === id) {
        setEditingCampaign(null)
      }
      void fetchCampaigns(page, statusFilter, pageSize, nameFilter, dateFrom, dateTo)
      void fetchCredits()
    } catch (err) {
      console.error("[useCampanhas] handleSend error", err)
      const message = err instanceof Error ? err.message : "Erro ao disparar campanha"
      toast.error(message || "Erro ao disparar campanha")
      void fetchCampaigns(page, statusFilter, pageSize, nameFilter, dateFrom, dateTo)
    } finally {
      setSendingId(null)
    }
  }, [activeTeamId, credits?.hasSubscription, credits?.isBetaExempt, editingCampaign?.id, fetchCampaigns, fetchCredits, isCampaignsBetaAccess, page, pageSize, nameFilter, dateFrom, dateTo, statusFilter, supabaseId])

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
      toast.success("Rascunho excluído")
    } catch (err) {
      console.error("[useCampanhas] handleDeleteDraft error", err)
      toast.error("Erro ao excluir rascunho")
    } finally {
      setDeletingId(null)
    }
  }, [activeTeamId, supabaseId])

  const handleArchive = useCallback(async (id: string) => {
    setArchivingId(id)
    console.info("[useCampanhas] handleArchive", id)
    try {
      await service.archive(supabaseId, activeTeamId, id)
      setCampaigns((prev) => prev.filter((c) => c.id !== id))
      setTotal((prev) => Math.max(0, prev - 1))
      toast.success("Campanha arquivada")
    } catch (err) {
      console.error("[useCampanhas] handleArchive error", err)
      toast.error("Erro ao arquivar campanha")
    } finally {
      setArchivingId(null)
    }
  }, [activeTeamId, supabaseId])

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

  const openEdit = useCallback(async (campaign: Campaign) => {
    setEditingCampaign(campaign)
    setEditName(campaign.name)
    setEditTemplateId(campaign.template?.id ?? "")
    setEditContactListId(campaign.contactList?.id ?? "")
    setEditScheduledAt(campaign.scheduledAt ? new Date(campaign.scheduledAt) : undefined)
    try {
      const [tmpl, lists] = await Promise.all([
        service.getTemplates(supabaseId, activeTeamId),
        service.getContactLists(supabaseId, activeTeamId),
      ])
      setTemplates(tmpl)
      setContactLists(lists)
    } catch (err) {
      console.error("[useCampanhas] openEdit fetch error", err)
    }
  }, [activeTeamId, supabaseId])

  const closeEdit = useCallback(() => {
    if (editSaving) return
    setEditingCampaign(null)
  }, [editSaving])

  const handleUpdateCampaign = useCallback(async () => {
    if (!editingCampaign || !editName.trim()) {
      toast.error("Nome da campanha é obrigatório")
      return
    }
    if (editingCampaign.status !== "draft" && editingCampaign.status !== "scheduled") {
      toast.error("Somente rascunhos e campanhas agendadas podem ser editados")
      return
    }
    setEditSaving(true)
    console.info("[useCampanhas] handleUpdateCampaign", editingCampaign.id)
    try {
      const updated = await service.update(supabaseId, activeTeamId, editingCampaign.id, {
        name: editName.trim(),
        templateId: editTemplateId || undefined,
        contactListId: editContactListId || undefined,
        scheduledAt: editScheduledAt?.toISOString() ?? null,
      })
      setCampaigns((prev) =>
        prev.map((c) =>
          c.id === updated.id
            ? {
                ...c,
                ...updated,
                totalRecipients: updated.totalRecipients,
                template: c.template,
                contactList: c.contactList,
                creator: c.creator,
              }
            : c
        )
      )
      toast.success("Campanha atualizada")
      setEditingCampaign(null)
    } catch (err) {
      console.error("[useCampanhas] handleUpdateCampaign error", err)
      const message = err instanceof Error ? err.message : "Erro ao atualizar campanha"
      toast.error(message)
    } finally {
      setEditSaving(false)
    }
  }, [activeTeamId, editingCampaign, editName, editTemplateId, editContactListId, editScheduledAt, supabaseId])

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
    editingCampaign,
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
    openEdit,
    closeEdit,
    setEditName,
    setEditTemplateId,
    setEditContactListId,
    setEditScheduledAt,
    handleUpdateCampaign,
  }
}
