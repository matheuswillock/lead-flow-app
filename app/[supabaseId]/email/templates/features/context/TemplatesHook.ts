'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { Template, TemplateRankingResult, TemplatesState, TemplateTab } from './TemplatesTypes'
import { createTemplatesService } from '../services/TemplatesService'
import { useStudioEmailRuntime } from '@/lib/email/use-studio-email-runtime'

const defaultService = createTemplatesService()

interface UseTemplatesReturn extends TemplatesState {
  ranking: TemplateRankingResult | null
  rankingLoading: boolean
  fetchTemplates: () => Promise<void>
  setActiveTab: (tab: TemplateTab) => void
  activeRole: 'manager' | 'backoffice' | 'operator' | null
  handleDelete: (id: string) => Promise<void>
  handleDuplicate: (id: string) => Promise<void>
  handleSubmitForApproval: (id: string) => Promise<void>
  handleApprove: (id: string) => Promise<void>
  handleReject: (id: string, reviewNote: string) => Promise<void>
}

export function useTemplates(supabaseId: string): UseTemplatesReturn {
  const { host, teamId: activeTeamId, activeRole, teamLoading } = useStudioEmailRuntime()
  const service = host?.services.templates ?? defaultService
  const [templates, setTemplates] = useState<Template[]>([])
  const [ranking, setRanking] = useState<TemplateRankingResult | null>(null)
  const [rankingLoading, setRankingLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [duplicating, setDuplicating] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [approving, setApproving] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TemplateTab>('all')
  const [templateApprovalRequired, setTemplateApprovalRequired] = useState(false)

  const isFetchingRef = useRef(false)
  const lastFetchKeyRef = useRef("")
  const rankingFetchKeyRef = useRef("")

  const fetchTemplates = useCallback(async () => {
    if (teamLoading) return
    if (!activeTeamId) {
      setTemplates([])
      setLoading(false)
      setError('Selecione um time para visualizar templates')
      return
    }

    const key = `${supabaseId}|${activeTeamId}`
    if (isFetchingRef.current || lastFetchKeyRef.current === key) {
      console.info('[useTemplates] Fetch already in-flight or cached, skipping')
      return
    }

    isFetchingRef.current = true
    setLoading(true)
    setError(null)

    try {
      console.info('[useTemplates] Fetching templates')
      const [data, settings] = await Promise.all([
        service.list(supabaseId, activeTeamId),
        service.getApprovalSettings(supabaseId, activeTeamId),
      ])
      setTemplates(data)
      setTemplateApprovalRequired(settings.templateApprovalRequired)
      lastFetchKeyRef.current = key
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar templates'
      console.error('[useTemplates] Failed to fetch templates', err)
      setError(message)
      toast.error('Erro ao carregar templates', { description: message })
    } finally {
      setLoading(false)
      isFetchingRef.current = false
    }
  }, [activeTeamId, supabaseId, teamLoading])

  const fetchRanking = useCallback(async () => {
    if (teamLoading) return
    if (!activeTeamId) {
      setRanking(null)
      setRankingLoading(false)
      return
    }

    const key = `${supabaseId}|${activeTeamId}|ranking`
    if (rankingFetchKeyRef.current === key) return
    rankingFetchKeyRef.current = key
    setRankingLoading(true)

    try {
      if (!service.getTopRanking) {
        setRanking(null)
        return
      }
      const data = await service.getTopRanking(supabaseId, activeTeamId)
      setRanking(data)
    } catch (err) {
      console.error('[useTemplates] Failed to fetch ranking', err)
      setRanking(null)
      rankingFetchKeyRef.current = ""
    } finally {
      setRankingLoading(false)
    }
  }, [activeTeamId, supabaseId, teamLoading])

  const handleDelete = useCallback(
    async (id: string) => {
      setDeleting(id)
      try {
        console.info('[useTemplates] Deleting template', id)
        await service.delete(supabaseId, id, activeTeamId)
        setTemplates((prev) => prev.filter((t) => t.id !== id))
        toast.success('Template excluído com sucesso')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao excluir template'
        console.error('[useTemplates] Failed to delete template', err)
        toast.error('Erro ao excluir template', { description: message })
      } finally {
        setDeleting(null)
      }
    },
    [activeTeamId, supabaseId]
  )

  const handleDuplicate = useCallback(
    async (id: string) => {
      if (duplicating === id) return

      const sourceTemplate = templates.find((template) => template.id === id)
      if (!sourceTemplate) {
        toast.error('Template não encontrado para duplicação')
        return
      }

      setDuplicating(id)
      try {
        const duplicated = await service.create(
          supabaseId,
          {
            name: `Cópia de ${sourceTemplate.name}`,
            subject: sourceTemplate.subject,
            previewText: sourceTemplate.previewText ?? undefined,
            mailyJson: sourceTemplate.mailyJson ?? undefined,
            html: sourceTemplate.html ?? undefined,
          },
          activeTeamId
        )
        setTemplates((prev) => [duplicated, ...prev])
        toast.success('Template duplicado com sucesso')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao duplicar template'
        console.error('[useTemplates] Failed to duplicate template', err)
        await fetchTemplates()
        toast.error('Erro ao duplicar template', { description: message })
      } finally {
        setDuplicating(null)
      }
    },
    [activeTeamId, duplicating, fetchTemplates, supabaseId, templates]
  )

  const handleSubmitForApproval = useCallback(
    async (id: string) => {
      if (submitting === id) return
      setSubmitting(id)
      try {
        const updated = await service.submitForApproval(supabaseId, id, activeTeamId)
        setTemplates((prev) => prev.map((t) => (t.id === id ? updated : t)))
        toast.success('Template enviado para aprovação')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao enviar para aprovação'
        console.error('[useTemplates] Failed to submit for approval', err)
        toast.error('Erro ao enviar para aprovação', { description: message })
      } finally {
        setSubmitting(null)
      }
    },
    [activeTeamId, submitting, supabaseId]
  )

  const handleApprove = useCallback(
    async (id: string) => {
      if (approving === id) return
      setApproving(id)
      try {
        const updated = await service.approve(supabaseId, id, activeTeamId)
        setTemplates((prev) => prev.map((t) => (t.id === id ? updated : t)))
        toast.success('Template aprovado com sucesso')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao aprovar template'
        console.error('[useTemplates] Failed to approve template', err)
        toast.error('Erro ao aprovar template', { description: message })
      } finally {
        setApproving(null)
      }
    },
    [activeTeamId, approving, supabaseId]
  )

  const handleReject = useCallback(
    async (id: string, reviewNote: string) => {
      if (rejecting === id) return
      setRejecting(id)
      try {
        const updated = await service.reject(supabaseId, id, reviewNote, activeTeamId)
        setTemplates((prev) => prev.map((t) => (t.id === id ? updated : t)))
        toast.success('Template recusado')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao recusar template'
        console.error('[useTemplates] Failed to reject template', err)
        toast.error('Erro ao recusar template', { description: message })
      } finally {
        setRejecting(null)
      }
    },
    [activeTeamId, rejecting, supabaseId]
  )

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  useEffect(() => {
    void fetchRanking()
  }, [fetchRanking])

  return {
    templates,
    ranking,
    rankingLoading,
    loading,
    error,
    deleting,
    duplicating,
    submitting,
    approving,
    rejecting,
    activeTab,
    templateApprovalRequired,
    setActiveTab,
    activeRole,
    fetchTemplates,
    handleDelete,
    handleDuplicate,
    handleSubmitForApproval,
    handleApprove,
    handleReject,
  }
}
