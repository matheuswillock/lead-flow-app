"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { CampanhasService } from "../services/CampanhasService"
import type { Campaign, CreditStatus, Template, ContactList, CdpSegmentOption } from "./CampanhasTypes"
import { parseLocalToUtc, formatLocalInputValue } from "@/lib/dates"
import { useTimezone } from "@/app/context/TimezoneContext"
import { useFeatureAccess } from "@/app/context/FeatureAccessContext"
import { useTeamContext } from "@/app/context/TeamContext"
import { FEATURE_SLUGS } from "@/lib/features/feature-slugs"

const PAGE_SIZE = 20
const service = new CampanhasService()

export type CampanhasActions = {
  handleSend: (id: string) => Promise<void>
  handleCancel: (id: string) => Promise<void>
  handleDeleteDraft: (id: string) => Promise<void>
  handleStatusFilter: (status: string) => void
  handlePageChange: (page: number) => void
  openWizard: () => void
  closeWizard: () => void
  setWizardStep: (step: 1 | 2 | 3) => void
  setWizardName: (v: string) => void
  setWizardTemplateId: (v: string) => void
  setWizardContactListId: (v: string) => void
  setWizardRecipientSource: (v: "contact_list" | "cdp_segment") => void
  setWizardCdpSegmentSlug: (v: string) => void
  setWizardScheduledAt: (v: string) => void
  handleCreateCampaign: () => Promise<void>
  openEdit: (campaign: Campaign) => void
  closeEdit: () => void
  setEditName: (v: string) => void
  setEditTemplateId: (v: string) => void
  setEditContactListId: (v: string) => void
  setEditScheduledAt: (v: string) => void
  handleUpdateCampaign: () => Promise<void>
}

export type CampanhasHookReturn = {
  campaigns: Campaign[]
  total: number
  page: number
  totalPages: number
  statusFilter: string
  loading: boolean
  credits: CreditStatus | null
  loadingCredits: boolean
  sendingId: string | null
  cancelingId: string | null
  deletingId: string | null
  wizardOpen: boolean
  wizardStep: 1 | 2 | 3
  wizardName: string
  wizardTemplateId: string
  wizardContactListId: string
  wizardRecipientSource: "contact_list" | "cdp_segment"
  wizardCdpSegmentSlug: string
  wizardScheduledAt: string
  wizardCreating: boolean
  templates: Template[]
  contactLists: ContactList[]
  cdpSegments: CdpSegmentOption[]
  editingCampaign: Campaign | null
  editName: string
  editTemplateId: string
  editContactListId: string
  editScheduledAt: string
  editSaving: boolean
} & CampanhasActions

export function useCampanhas(supabaseId: string): CampanhasHookReturn {
  const { tz } = useTimezone()
  const { isBeta } = useFeatureAccess()
  const { activeTeamId, isLoading: teamLoading } = useTeamContext()
  const isCampaignsBetaAccess = isBeta(FEATURE_SLUGS.EMAIL_CAMPAIGNS)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [statusFilter, setStatusFilter] = useState("")
  const [loading, setLoading] = useState(false)
  const [credits, setCredits] = useState<CreditStatus | null>(null)
  const [loadingCredits, setLoadingCredits] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [cancelingId, setCancelingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Wizard
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1)
  const [wizardName, setWizardName] = useState("")
  const [wizardTemplateId, setWizardTemplateId] = useState("")
  const [wizardContactListId, setWizardContactListId] = useState("")
  const [wizardRecipientSource, setWizardRecipientSource] = useState<"contact_list" | "cdp_segment">("contact_list")
  const [wizardCdpSegmentSlug, setWizardCdpSegmentSlug] = useState("")
  const [wizardScheduledAt, setWizardScheduledAt] = useState("")
  const [wizardCreating, setWizardCreating] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [contactLists, setContactLists] = useState<ContactList[]>([])
  const [cdpSegments, setCdpSegments] = useState<CdpSegmentOption[]>([])

  // Edit draft
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
  const [editName, setEditName] = useState("")
  const [editTemplateId, setEditTemplateId] = useState("")
  const [editContactListId, setEditContactListId] = useState("")
  const [editScheduledAt, setEditScheduledAt] = useState("")
  const [editSaving, setEditSaving] = useState(false)

  const fetchingRef = useRef(false)

  const fetchCampaigns = useCallback(async (nextPage: number, nextStatus: string) => {
    if (teamLoading) return
    if (!activeTeamId) {
      setCampaigns([])
      setTotal(0)
      setPage(1)
      setTotalPages(1)
      return
    }
    if (fetchingRef.current) return
    fetchingRef.current = true
    setLoading(true)
    console.info("[useCampanhas] fetchCampaigns", { nextPage, nextStatus })
    try {
      const result = await service.list(supabaseId, activeTeamId, nextPage, PAGE_SIZE, nextStatus || undefined)
      setCampaigns(result.campaigns)
      setTotal(result.total)
      setPage(result.page)
      setTotalPages(result.totalPages)
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
    void fetchCampaigns(1, "")
    void fetchCredits()
  }, [fetchCampaigns, fetchCredits, teamLoading])

  const handleStatusFilter = useCallback((status: string) => {
    setStatusFilter(status)
    setPage(1)
    void fetchCampaigns(1, status)
  }, [fetchCampaigns])

  const handlePageChange = useCallback((nextPage: number) => {
    setPage(nextPage)
    void fetchCampaigns(nextPage, statusFilter)
  }, [fetchCampaigns, statusFilter])

  const handleSend = useCallback(async (id: string) => {
    if (!credits?.hasSubscription && !isCampaignsBetaAccess) {
      toast.error("Ative um plano em Assinaturas para disparar campanhas")
      return
    }
    setSendingId(id)
    console.info("[useCampanhas] handleSend", id)
    try {
      const result = await service.send(supabaseId, activeTeamId, id)
      toast.success(`Campanha disparada: ${result.sent} emails enviados`)
      void fetchCampaigns(page, statusFilter)
      void fetchCredits()
    } catch (err) {
      console.error("[useCampanhas] handleSend error", err)
      toast.error("Erro ao disparar campanha")
    } finally {
      setSendingId(null)
    }
  }, [activeTeamId, credits?.hasSubscription, fetchCampaigns, fetchCredits, isCampaignsBetaAccess, page, statusFilter, supabaseId])

  const handleCancel = useCallback(async (id: string) => {
    setCancelingId(id)
    console.info("[useCampanhas] handleCancel", id)
    try {
      await service.cancel(supabaseId, activeTeamId, id)
      toast.success("Campanha cancelada")
      void fetchCampaigns(page, statusFilter)
    } catch (err) {
      console.error("[useCampanhas] handleCancel error", err)
      toast.error("Erro ao cancelar campanha")
    } finally {
      setCancelingId(null)
    }
  }, [activeTeamId, fetchCampaigns, page, statusFilter, supabaseId])

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

  const openWizard = useCallback(async () => {
    setWizardStep(1)
    setWizardName("")
    setWizardTemplateId("")
    setWizardContactListId("")
    setWizardRecipientSource("contact_list")
    setWizardCdpSegmentSlug("")
    setWizardScheduledAt("")
    setWizardOpen(true)
    try {
      const [tmpl, lists, segmentsRes] = await Promise.all([
        service.getTemplates(supabaseId, activeTeamId),
        service.getContactLists(supabaseId, activeTeamId),
        fetch("/api/v1/cdp/segments", { cache: "no-store" }).then((res) => res.json()),
      ])
      setTemplates(tmpl)
      setContactLists(lists)
      if (segmentsRes?.isValid) {
        const segments = (segmentsRes.result as { segments?: CdpSegmentOption[] })?.segments ?? []
        setCdpSegments(segments)
      } else {
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
        scheduledAt: wizardScheduledAt
          ? parseLocalToUtc(wizardScheduledAt, tz).toISOString()
          : undefined,
      })
      toast.success("Campanha criada com sucesso")
      setWizardOpen(false)
      void fetchCampaigns(1, statusFilter)
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
    tz,
    fetchCampaigns,
    statusFilter,
    supabaseId,
  ])

  const openEdit = useCallback(async (campaign: Campaign) => {
    setEditingCampaign(campaign)
    setEditName(campaign.name)
    setEditTemplateId(campaign.template?.id ?? "")
    setEditContactListId(campaign.contactList?.id ?? "")
    setEditScheduledAt(campaign.scheduledAt ? formatLocalInputValue(new Date(campaign.scheduledAt), tz) : "")
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
  }, [activeTeamId, supabaseId, tz])

  const closeEdit = useCallback(() => {
    if (editSaving) return
    setEditingCampaign(null)
  }, [editSaving])

  const handleUpdateCampaign = useCallback(async () => {
    if (!editingCampaign || !editName.trim()) {
      toast.error("Nome da campanha é obrigatório")
      return
    }
    setEditSaving(true)
    console.info("[useCampanhas] handleUpdateCampaign", editingCampaign.id)
    try {
      const updated = await service.update(supabaseId, activeTeamId, editingCampaign.id, {
        name: editName.trim(),
        templateId: editTemplateId || undefined,
        contactListId: editContactListId || undefined,
        scheduledAt: editScheduledAt
          ? parseLocalToUtc(editScheduledAt, tz).toISOString()
          : null,
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
      toast.error("Erro ao atualizar campanha")
    } finally {
      setEditSaving(false)
    }
  }, [activeTeamId, editingCampaign, editName, editTemplateId, editContactListId, editScheduledAt, supabaseId, tz])

  return {
    campaigns,
    total,
    page,
    totalPages,
    statusFilter,
    loading,
    credits,
    loadingCredits,
    sendingId,
    cancelingId,
    deletingId,
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
    handleStatusFilter,
    handlePageChange,
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
