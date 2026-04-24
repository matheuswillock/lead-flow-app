'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { FileText, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { ITemplatePickerService, TemplatePickerItem } from '../services/ITemplatePickerService'

interface EmailTemplatePickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (templateId: string) => void | Promise<void>
  service: ITemplatePickerService
}

function formatUpdatedAt(updatedAt: string) {
  const value = new Date(updatedAt)

  if (Number.isNaN(value.getTime())) {
    return updatedAt
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(value)
}

function TemplatePickerSkeletonCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <Skeleton className="h-28 w-full bg-white/10" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-4 w-3/4 bg-white/10" />
        <Skeleton className="h-3 w-full bg-white/10" />
        <Skeleton className="h-3 w-1/2 bg-white/10" />
      </div>
    </div>
  )
}

function TemplatePickerCard({
  template,
  selecting,
  onSelect,
}: {
  template: TemplatePickerItem
  selecting: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={selecting}
      className={cn(
        'overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] text-left transition-colors',
        'hover:border-white/18 hover:bg-white/[0.05] disabled:cursor-wait disabled:opacity-60'
      )}
    >
      {template.thumbnailUrl ? (
        <img src={template.thumbnailUrl} alt={template.name} className="h-28 w-full object-cover" />
      ) : (
        <div className="flex h-28 items-center justify-center bg-[#111117] text-xs font-medium uppercase tracking-[0.18em] text-white/34">
          Template
        </div>
      )}

      <div className="space-y-1.5 p-4">
        <p className="truncate text-sm font-medium text-white">{template.name}</p>
        <p className="line-clamp-2 min-h-10 text-xs leading-5 text-white/52">{template.subject}</p>
        <p className="text-[11px] text-white/34">{formatUpdatedAt(template.updatedAt)}</p>
      </div>
    </button>
  )
}

export function EmailTemplatePickerDialog({
  open,
  onOpenChange,
  onSelect,
  service,
}: EmailTemplatePickerDialogProps) {
  const params = useParams()
  const teamId = String(params.supabaseId ?? '')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [templates, setTemplates] = useState<TemplatePickerItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selectingId, setSelectingId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setQuery('')
      setError(null)
      setSelectingId(null)
      return
    }

    let cancelled = false

    const loadTemplates = async () => {
      setLoading(true)
      setError(null)

      try {
        const result = await service.listTemplates(teamId)
        if (!cancelled) {
          setTemplates(result)
        }
      } catch (fetchError) {
        if (!cancelled) {
          const message = fetchError instanceof Error ? fetchError.message : 'Erro ao carregar templates'
          setError(message)
          setTemplates([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadTemplates()

    return () => {
      cancelled = true
    }
  }, [open, service, teamId])

  const filteredTemplates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (normalizedQuery.length === 0) {
      return templates
    }

    return templates.filter((template) => template.name.toLowerCase().includes(normalizedQuery))
  }, [query, templates])

  const handleSelect = async (templateId: string) => {
    setSelectingId(templateId)

    try {
      await onSelect(templateId)
    } finally {
      setSelectingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col gap-0 overflow-hidden rounded-[28px] border-[#1d212b] bg-[#05050A] p-0 text-white">
        <DialogHeader className="border-b border-white/8 px-6 py-5 text-left">
          <DialogTitle className="text-xl font-semibold text-white">Pick a template</DialogTitle>
          <DialogDescription className="text-white/45">
            Escolha um template salvo do time para carregar no editor.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-6 py-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/34" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nome"
              className="h-11 rounded-2xl border-white/10 bg-white/6 pl-10 text-white placeholder:text-white/26"
            />
          </div>

          <div className="dialog-scrollbar-visible max-h-[60vh] overflow-y-auto pr-1">
            {loading ? (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <TemplatePickerSkeletonCard key={index} />
                ))}
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-[#2d1c1a] bg-[#1a0f0d] px-4 py-5 text-sm text-[#ffb4a6]">
                {error}
              </div>
            ) : templates.length === 0 ? (
              <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-6 text-center">
                <FileText className="h-12 w-12 text-white/18" />
                <p className="mt-5 text-sm font-medium text-white">Nenhum template salvo ainda</p>
                <p className="mt-2 text-sm text-white/42">Crie um template para reutilizá-lo aqui</p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="mt-5 rounded-full border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08] hover:text-white"
                >
                  Fechar
                </Button>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-6 text-center">
                <p className="text-sm font-medium text-white">Nenhum template encontrado</p>
                <p className="mt-2 text-sm text-white/42">Nenhum template corresponde à busca atual.</p>
                <div className="mt-4 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-medium text-white/42">
                  CTA em breve
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                {filteredTemplates.map((template) => (
                  <TemplatePickerCard
                    key={template.id}
                    template={template}
                    selecting={selectingId === template.id}
                    onSelect={() => void handleSelect(template.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
