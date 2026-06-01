'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Search, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { useTemplatesContext } from '../context/TemplatesContext'
import { TemplateCard } from '../components/TemplateCard'

function SkeletonCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-lg border">
          <Skeleton className="h-36 w-full rounded-none" />
          <div className="border-t px-3 py-2.5 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-20 text-center">
      <FileText className="h-10 w-10 text-muted-foreground/40" />
      <div>
        <p className="text-sm font-medium text-muted-foreground">
          {hasSearch ? 'Nenhum template encontrado' : 'Nenhum template criado ainda'}
        </p>
        {!hasSearch && (
          <p className="mt-1 text-xs text-muted-foreground/70">
            Crie seu primeiro template clicando em "Criar Template"
          </p>
        )}
      </div>
    </div>
  )
}

export function TemplatesContainer() {
  const router = useRouter()
  const params = useParams()
  const supabaseId = params.supabaseId as string
  const [search, setSearch] = useState('')
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false)

  const { templates, loading, deleting, duplicating, handleDelete, handleDuplicate } = useTemplatesContext()

  const filtered = search.trim()
    ? templates.filter(
        (t) =>
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          t.subject.toLowerCase().includes(search.toLowerCase())
      )
    : templates

  const handleCreateTemplate = () => {
    if (isCreatingTemplate) return
    setIsCreatingTemplate(true)
    router.push(`/${supabaseId}/email/templates/new`)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
        <Button onClick={handleCreateTemplate} disabled={isCreatingTemplate}>
          {isCreatingTemplate ? <Spinner data-icon="inline-start" /> : null}
          {isCreatingTemplate ? 'Abrindo...' : '+ Criar Template'}
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <SkeletonCards />
      ) : filtered.length === 0 ? (
        <EmptyState hasSearch={search.trim().length > 0} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              deleting={deleting}
              duplicating={duplicating}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
            />
          ))}
        </div>
      )}
    </div>
  )
}
