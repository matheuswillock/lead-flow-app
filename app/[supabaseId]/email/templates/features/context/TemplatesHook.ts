'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Template, TemplatesState } from './TemplatesTypes'
import { createTemplatesService } from '../services/TemplatesService'
import { useTeamContext } from '@/app/context/TeamContext'

const service = createTemplatesService()

interface UseTemplatesReturn extends TemplatesState {
  fetchTemplates: () => Promise<void>
  handleDelete: (id: string) => Promise<void>
  handleDuplicate: (id: string) => Promise<void>
}

export function useTemplates(supabaseId: string): UseTemplatesReturn {
  const { activeTeamId, isLoading: teamLoading } = useTeamContext()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [duplicating, setDuplicating] = useState<string | null>(null)

  const isFetchingRef = useRef(false)

  const fetchTemplates = useCallback(async () => {
    if (teamLoading) return
    if (!activeTeamId) {
      setTemplates([])
      setLoading(false)
      setError('Selecione um time para visualizar templates')
      return
    }

    if (isFetchingRef.current) {
      console.info('[useTemplates] Fetch already in-flight, skipping')
      return
    }

    isFetchingRef.current = true
    setLoading(true)
    setError(null)

    try {
      console.info('[useTemplates] Fetching templates')
      const data = await service.list(supabaseId, activeTeamId)
      setTemplates(data)
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
        const duplicatedTemplate = await service.create(
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

        setTemplates((prev) => [duplicatedTemplate, ...prev])
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

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  return {
    templates,
    loading,
    error,
    deleting,
    duplicating,
    fetchTemplates,
    handleDelete,
    handleDuplicate,
  }
}
