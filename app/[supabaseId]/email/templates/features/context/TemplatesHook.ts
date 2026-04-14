'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Template, TemplatesState } from './TemplatesTypes'
import { createTemplatesService } from '../services/TemplatesService'

const service = createTemplatesService()

interface UseTemplatesReturn extends TemplatesState {
  fetchTemplates: () => Promise<void>
  handleDelete: (id: string) => Promise<void>
}

export function useTemplates(supabaseId: string): UseTemplatesReturn {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const isFetchingRef = useRef(false)

  const fetchTemplates = useCallback(async () => {
    if (isFetchingRef.current) {
      console.info('[useTemplates] Fetch already in-flight, skipping')
      return
    }

    isFetchingRef.current = true
    setLoading(true)
    setError(null)

    try {
      console.info('[useTemplates] Fetching templates')
      const data = await service.list(supabaseId)
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
  }, [supabaseId])

  const handleDelete = useCallback(
    async (id: string) => {
      setDeleting(id)
      try {
        console.info('[useTemplates] Deleting template', id)
        await service.delete(supabaseId, id)
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
    [supabaseId]
  )

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  return {
    templates,
    loading,
    error,
    deleting,
    fetchTemplates,
    handleDelete,
  }
}
