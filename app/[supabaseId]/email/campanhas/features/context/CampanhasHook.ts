"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { CampanhasService } from "../services/CampanhasService"
import type { Campaign, CreditStatus, Template, ContactList } from "./CampanhasTypes"

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
  setWizardScheduledAt: (v: string) => void
  handleCreateCampaign: () => Promise<void>
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
  wizardScheduledAt: string
  wizardCreating: boolean
  templates: Template[]
  contactLists: ContactList[]
} & CampanhasActions

export function useCampanhas(supabaseId: string): CampanhasHookReturn {
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
  const [wizardScheduledAt, setWizardScheduledAt] = useState("")
  const [wizardCreating, setWizardCreating] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [contactLists, setContactLists] = useState<ContactList[]>([])

  const fetchingRef = useRef(false)

  const fetchCampaigns = useCallback(async (nextPage: number, nextStatus: string) => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setLoading(true)
    console.info("[useCampanhas] fetchCampaigns", { nextPage, nextStatus })
    try {
      const result = await service.list(nextPage, PAGE_SIZE, nextStatus || undefined)
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
  }, [])

  const fetchCredits = useCallback(async () => {
    setLoadingCredits(true)
    try {
      const result = await service.getCreditStatus()
      setCredits(result)
    } catch (err) {
      console.error("[useCampanhas] fetchCredits error", err)
    } finally {
      setLoadingCredits(false)
    }
  }, [])

  useEffect(() => {
    void fetchCampaigns(1, "")
    void fetchCredits()
  }, [supabaseId])

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
    setSendingId(id)
    console.info("[useCampanhas] handleSend", id)
    try {
      const result = await service.send(id)
      toast.success(`Campanha disparada: ${result.sent} emails enviados`)
      void fetchCampaigns(page, statusFilter)
      void fetchCredits()
    } catch (err) {
      console.error("[useCampanhas] handleSend error", err)
      toast.error("Erro ao disparar campanha")
    } finally {
      setSendingId(null)
    }
  }, [fetchCampaigns, fetchCredits, page, statusFilter])

  const handleCancel = useCallback(async (id: string) => {
    setCancelingId(id)
    console.info("[useCampanhas] handleCancel", id)
    try {
      await service.cancel(id)
      toast.success("Campanha cancelada")
      void fetchCampaigns(page, statusFilter)
    } catch (err) {
      console.error("[useCampanhas] handleCancel error", err)
      toast.error("Erro ao cancelar campanha")
    } finally {
      setCancelingId(null)
    }
  }, [fetchCampaigns, page, statusFilter])

  const handleDeleteDraft = useCallback(async (id: string) => {
    setDeletingId(id)
    console.info("[useCampanhas] handleDeleteDraft", id)
    try {
      await service.deleteDraft(id)
      setCampaigns((prev) => prev.filter((c) => c.id !== id))
      setTotal((prev) => Math.max(0, prev - 1))
      toast.success("Rascunho excluído")
    } catch (err) {
      console.error("[useCampanhas] handleDeleteDraft error", err)
      toast.error("Erro ao excluir rascunho")
    } finally {
      setDeletingId(null)
    }
  }, [])

  const openWizard = useCallback(async () => {
    setWizardStep(1)
    setWizardName("")
    setWizardTemplateId("")
    setWizardContactListId("")
    setWizardScheduledAt("")
    setWizardOpen(true)
    try {
      const [tmpl, lists] = await Promise.all([
        service.getTemplates(),
        service.getContactLists(),
      ])
      setTemplates(tmpl)
      setContactLists(lists)
    } catch (err) {
      console.error("[useCampanhas] openWizard fetch error", err)
    }
  }, [])

  const closeWizard = useCallback(() => {
    if (wizardCreating) return
    setWizardOpen(false)
  }, [wizardCreating])

  const handleCreateCampaign = useCallback(async () => {
    if (!wizardName.trim() || !wizardTemplateId || !wizardContactListId) {
      toast.error("Preencha o nome, template e lista de contatos")
      return
    }
    setWizardCreating(true)
    console.info("[useCampanhas] handleCreateCampaign")
    try {
      await service.create({
        name: wizardName.trim(),
        templateId: wizardTemplateId,
        contactListId: wizardContactListId,
        // Converter horário local do browser para UTC antes de enviar
        scheduledAt: wizardScheduledAt
          ? new Date(wizardScheduledAt).toISOString()
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
  }, [wizardName, wizardTemplateId, wizardContactListId, wizardScheduledAt, fetchCampaigns, statusFilter])

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
    wizardScheduledAt,
    wizardCreating,
    templates,
    contactLists,
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
    setWizardScheduledAt,
    handleCreateCampaign,
  }
}
