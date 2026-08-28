"use client"

import { useCallback, useEffect, useRef, useState, useDeferredValue } from "react"
import { toast } from "sonner"
import { toastUserError } from "@/lib/ui/to-user-toast-message"
import { backofficeStudioEmailService } from "../../services/BackofficeStudioEmailService"
import type {
  StudioEmailCampaign,
  StudioEmailContactList,
  StudioEmailTemplate,
} from "../../services/IBackofficeStudioEmailService"
import { useBackofficeClientEmailsContext } from "../../context/BackofficeClientEmailsContext"

const DEFAULT_PAGE_SIZE = 10

function statusKey(statuses: string[]): string {
  return [...statuses].sort().join(",")
}

export function useBackofficeCampanhas() {
  const { masterId, selectedTeamId, refreshKey, canManage } = useBackofficeClientEmailsContext()

  const [campaigns, setCampaigns] = useState<StudioEmailCampaign[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [totalPages, setTotalPages] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [nameFilter, setNameFilter] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const deferredName = useDeferredValue(nameFilter)
  const [loading, setLoading] = useState(false)

  const [sendingId, setSendingId] = useState<string | null>(null)
  const [cancelingId, setCancelingId] = useState<string | null>(null)
  const [archivingId, setArchivingId] = useState<string | null>(null)

  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1)
  const [wizardName, setWizardName] = useState("")
  const [wizardTemplateId, setWizardTemplateId] = useState("")
  const [wizardContactListId, setWizardContactListId] = useState("")
  const [wizardCreating, setWizardCreating] = useState(false)
  const [templates, setTemplates] = useState<StudioEmailTemplate[]>([])
  const [contactLists, setContactLists] = useState<StudioEmailContactList[]>([])

  const [detailCampaign, setDetailCampaign] = useState<StudioEmailCampaign | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [editName, setEditName] = useState("")
  const [editTemplateId, setEditTemplateId] = useState("")
  const [editContactListId, setEditContactListId] = useState("")
  const [editSaving, setEditSaving] = useState(false)

  const fetchingRef = useRef(false)
  const lastCampaignsKeyRef = useRef("")

  const fetchCampaigns = useCallback(async () => {
    if (!masterId || !selectedTeamId) {
      setCampaigns([])
      setTotal(0)
      setPage(1)
      setTotalPages(1)
      return
    }

    const key = `${masterId}|${selectedTeamId}|${refreshKey}|${page}|${statusKey(statusFilter)}|${pageSize}|${deferredName}|${dateFrom}|${dateTo}`
    if (fetchingRef.current || lastCampaignsKeyRef.current === key) return

    fetchingRef.current = true
    setLoading(true)
    try {
      const result = await backofficeStudioEmailService.listCampaigns(masterId, selectedTeamId, {
        page,
        pageSize,
        name: deferredName || undefined,
        status: statusFilter.length > 0 ? statusFilter : undefined,
        createdAtFrom: dateFrom || undefined,
        createdAtTo: dateTo || undefined,
      })
      setCampaigns(result.campaigns)
      setTotal(result.total)
      setTotalPages(result.totalPages ?? Math.max(1, Math.ceil(result.total / pageSize)))
    } catch (error) {
      console.error("[useBackofficeCampanhas] fetchCampaigns error", error)
      toast.error("Erro ao carregar campanhas")
    } finally {
      setLoading(false)
      fetchingRef.current = false
      lastCampaignsKeyRef.current = key
    }
  }, [
    masterId,
    selectedTeamId,
    refreshKey,
    page,
    pageSize,
    statusFilter,
    deferredName,
    dateFrom,
    dateTo,
  ])

  useEffect(() => {
    lastCampaignsKeyRef.current = ""
    void fetchCampaigns()
  }, [fetchCampaigns])

  const fetchWizardData = useCallback(async () => {
    if (!masterId || !selectedTeamId) return
    try {
      const [templatesResult, listsResult] = await Promise.all([
        backofficeStudioEmailService.listTemplates(masterId, selectedTeamId, {
          scope: "campaign",
          approvalFilter: "approved",
        }),
        backofficeStudioEmailService.listContactLists(masterId, selectedTeamId),
      ])
      setTemplates(templatesResult)
      setContactLists(listsResult.filter((list) => !list.isBlocklist))
    } catch (error) {
      console.error("[useBackofficeCampanhas] fetchWizardData error", error)
      toast.error("Erro ao carregar templates e listas")
    }
  }, [masterId, selectedTeamId])

  const openWizard = useCallback(() => {
    setWizardOpen(true)
    setWizardStep(1)
    setWizardName("")
    setWizardTemplateId("")
    setWizardContactListId("")
    void fetchWizardData()
  }, [fetchWizardData])

  const closeWizard = useCallback(() => {
    if (wizardCreating) return
    setWizardOpen(false)
    setWizardStep(1)
  }, [wizardCreating])

  const handleCreateCampaign = useCallback(async () => {
    if (!masterId || !selectedTeamId || wizardCreating) return
    if (!wizardName.trim() || !wizardTemplateId || !wizardContactListId) {
      toast.error("Preencha todos os campos obrigatórios")
      return
    }

    setWizardCreating(true)
    try {
      await backofficeStudioEmailService.createCampaign(masterId, selectedTeamId, {
        name: wizardName.trim(),
        templateId: wizardTemplateId,
        contactListId: wizardContactListId,
      })
      toast.success("Campanha criada com sucesso")
      setWizardOpen(false)
      lastCampaignsKeyRef.current = ""
      void fetchCampaigns()
    } catch (error) {
      console.error("[useBackofficeCampanhas] handleCreateCampaign error", error)
      toastUserError(error)
    } finally {
      setWizardCreating(false)
    }
  }, [
    masterId,
    selectedTeamId,
    wizardCreating,
    wizardName,
    wizardTemplateId,
    wizardContactListId,
    fetchCampaigns,
  ])

  const handleSend = useCallback(
    async (campaignId: string) => {
      if (!masterId || !selectedTeamId || sendingId) return
      setSendingId(campaignId)
      try {
        await backofficeStudioEmailService.sendCampaign(masterId, selectedTeamId, campaignId)
        toast.success("Campanha disparada com sucesso")
        lastCampaignsKeyRef.current = ""
        void fetchCampaigns()
        if (detailCampaign?.id === campaignId) {
          const updated = await backofficeStudioEmailService.getCampaign(
            masterId,
            selectedTeamId,
            campaignId
          )
          setDetailCampaign(updated)
        }
      } catch (error) {
        console.error("[useBackofficeCampanhas] handleSend error", error)
        toastUserError(error)
      } finally {
        setSendingId(null)
      }
    },
    [masterId, selectedTeamId, sendingId, fetchCampaigns, detailCampaign?.id]
  )

  const handleCancel = useCallback(
    async (campaignId: string) => {
      if (!masterId || !selectedTeamId || cancelingId) return
      setCancelingId(campaignId)
      try {
        await backofficeStudioEmailService.cancelCampaign(masterId, selectedTeamId, campaignId)
        toast.success("Campanha cancelada")
        lastCampaignsKeyRef.current = ""
        void fetchCampaigns()
        if (detailCampaign?.id === campaignId) {
          const updated = await backofficeStudioEmailService.getCampaign(
            masterId,
            selectedTeamId,
            campaignId
          )
          setDetailCampaign(updated)
        }
      } catch (error) {
        console.error("[useBackofficeCampanhas] handleCancel error", error)
        toastUserError(error)
      } finally {
        setCancelingId(null)
      }
    },
    [masterId, selectedTeamId, cancelingId, fetchCampaigns, detailCampaign?.id]
  )

  const handleArchive = useCallback(
    async (campaignId: string) => {
      if (!masterId || !selectedTeamId || archivingId) return
      setArchivingId(campaignId)
      try {
        await backofficeStudioEmailService.archiveCampaign(masterId, selectedTeamId, campaignId)
        toast.success("Campanha arquivada")
        lastCampaignsKeyRef.current = ""
        void fetchCampaigns()
        if (detailCampaign?.id === campaignId) {
          setDetailCampaign(null)
        }
      } catch (error) {
        console.error("[useBackofficeCampanhas] handleArchive error", error)
        toastUserError(error)
      } finally {
        setArchivingId(null)
      }
    },
    [masterId, selectedTeamId, archivingId, fetchCampaigns, detailCampaign?.id]
  )

  const openView = useCallback(
    async (campaign: StudioEmailCampaign) => {
      if (!masterId || !selectedTeamId) return
      setDetailCampaign(campaign)
      setEditName(campaign.name)
      setEditTemplateId(campaign.template?.id ?? "")
      setEditContactListId(campaign.contactList?.id ?? "")
      setDetailLoading(true)
      void fetchWizardData()
      try {
        const full = await backofficeStudioEmailService.getCampaign(
          masterId,
          selectedTeamId,
          campaign.id
        )
        setDetailCampaign(full)
        setEditName(full.name)
        setEditTemplateId(full.template?.id ?? "")
        setEditContactListId(full.contactList?.id ?? "")
      } catch (error) {
        console.error("[useBackofficeCampanhas] openView error", error)
        toast.error("Erro ao carregar detalhes da campanha")
      } finally {
        setDetailLoading(false)
      }
    },
    [masterId, selectedTeamId, fetchWizardData]
  )

  const closeDetail = useCallback(() => {
    if (editSaving) return
    setDetailCampaign(null)
  }, [editSaving])

  const handleUpdateCampaign = useCallback(async () => {
    if (!masterId || !selectedTeamId || !detailCampaign || editSaving) return
    if (!editName.trim()) {
      toast.error("Nome da campanha é obrigatório")
      return
    }

    setEditSaving(true)
    try {
      const updated = await backofficeStudioEmailService.updateCampaign(
        masterId,
        selectedTeamId,
        detailCampaign.id,
        {
          name: editName.trim(),
          templateId: editTemplateId || undefined,
          contactListId: editContactListId || undefined,
        }
      )
      setDetailCampaign(updated)
      toast.success("Campanha atualizada")
      lastCampaignsKeyRef.current = ""
      void fetchCampaigns()
    } catch (error) {
      console.error("[useBackofficeCampanhas] handleUpdateCampaign error", error)
      toastUserError(error)
    } finally {
      setEditSaving(false)
    }
  }, [
    masterId,
    selectedTeamId,
    detailCampaign,
    editSaving,
    editName,
    editTemplateId,
    editContactListId,
    fetchCampaigns,
  ])

  const handleStatusFilter = useCallback((statuses: string[]) => {
    setStatusFilter(statuses)
    setPage(1)
    lastCampaignsKeyRef.current = ""
  }, [])

  const handleNameFilter = useCallback((value: string) => {
    setNameFilter(value)
    setPage(1)
    lastCampaignsKeyRef.current = ""
  }, [])

  const handleDateFilter = useCallback((from: string, to: string) => {
    setDateFrom(from)
    setDateTo(to)
    setPage(1)
    lastCampaignsKeyRef.current = ""
  }, [])

  const clearFilters = useCallback(() => {
    setNameFilter("")
    setStatusFilter([])
    setDateFrom("")
    setDateTo("")
    setPage(1)
    lastCampaignsKeyRef.current = ""
  }, [])

  const handlePageChange = useCallback((nextPage: number) => {
    setPage(nextPage)
    lastCampaignsKeyRef.current = ""
  }, [])

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size)
    setPage(1)
    lastCampaignsKeyRef.current = ""
  }, [])

  return {
    canManage,
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
    sendingId,
    cancelingId,
    archivingId,
    wizardOpen,
    wizardStep,
    wizardName,
    wizardTemplateId,
    wizardContactListId,
    wizardCreating,
    templates,
    contactLists,
    detailCampaign,
    detailLoading,
    editName,
    editTemplateId,
    editContactListId,
    editSaving,
    openWizard,
    closeWizard,
    setWizardStep,
    setWizardName,
    setWizardTemplateId,
    setWizardContactListId,
    handleCreateCampaign,
    handleSend,
    handleCancel,
    handleArchive,
    openView,
    closeDetail,
    setEditName,
    setEditTemplateId,
    setEditContactListId,
    handleUpdateCampaign,
    handleStatusFilter,
    handleNameFilter,
    handleDateFilter,
    clearFilters,
    handlePageChange,
    handlePageSizeChange,
    masterId,
    selectedTeamId,
  }
}

export type UseBackofficeCampanhasReturn = ReturnType<typeof useBackofficeCampanhas>
