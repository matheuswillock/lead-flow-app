'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Search, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useTemplatesContext } from '../context/TemplatesContext'
import { TemplateCard } from '../components/TemplateCard'
import type { TemplateTab } from '../context/TemplatesTypes'
import { useOptionalStudioEmailHost } from '@/lib/email/studio-email-host'

const TABS: { key: TemplateTab; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'draft', label: 'Rascunhos' },
  { key: 'pending_approval', label: 'Aguardando aprovação' },
  { key: 'published', label: 'Publicados' },
  { key: 'rejected', label: 'Recusados' },
]

function SkeletonCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-lg border">
          <Skeleton className="h-32 w-full rounded-none" />
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
      <FileText className="size-10 text-muted-foreground/40" />
      <div>
        <p className="text-sm font-medium text-muted-foreground">
          {hasSearch ? 'Nenhum template encontrado' : 'Nenhum template nesta categoria'}
        </p>
        {!hasSearch && (
          <p className="mt-1 text-xs text-muted-foreground/70">
            Crie seu primeiro template clicando em "+ Criar Template"
          </p>
        )}
      </div>
    </div>
  )
}

export function TemplatesContainer() {
  const router = useRouter()
  const params = useParams()
  const host = useOptionalStudioEmailHost()
  const supabaseId = (host?.supabaseId ?? params.supabaseId) as string
  const [search, setSearch] = useState('')
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false)

  const {
    templates,
    loading,
    deleting,
    duplicating,
    submitting,
    approving,
    rejecting,
    activeTab,
    templateApprovalRequired,
    setActiveTab,
    activeRole,
    handleDelete,
    handleDuplicate,
    handleSubmitForApproval,
    handleApprove,
    handleReject,
  } = useTemplatesContext()

  const tabFiltered = templates.filter((t) => {
    if (activeTab === 'all') return true
    if (activeTab === 'draft') return t.status === 'draft' && t.approvalStatus === 'approved'
    if (activeTab === 'pending_approval') return t.approvalStatus === 'pending_approval'
    if (activeTab === 'published') return t.status === 'published'
    if (activeTab === 'rejected') return t.approvalStatus === 'rejected'
    return true
  })

  const counts: Record<TemplateTab, number> = {
    all: templates.length,
    draft: templates.filter((t) => t.status === 'draft' && t.approvalStatus === 'approved').length,
    pending_approval: templates.filter((t) => t.approvalStatus === 'pending_approval').length,
    published: templates.filter((t) => t.status === 'published').length,
    rejected: templates.filter((t) => t.approvalStatus === 'rejected').length,
  }

  const filtered = search.trim()
    ? tabFiltered.filter(
        (t) =>
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          t.subject.toLowerCase().includes(search.toLowerCase())
      )
    : tabFiltered

  const handleCreateTemplate = () => {
    if (isCreatingTemplate) return
    setIsCreatingTemplate(true)
    router.push(
      host?.hrefs.templateEditor("new") ?? `/${supabaseId}/email/templates/new`
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
        <Button onClick={handleCreateTemplate} disabled={isCreatingTemplate}>
          {isCreatingTemplate ? <Spinner data-icon="inline-start" /> : null}
          {isCreatingTemplate ? 'Abrindo...' : '+ Criar Template'}
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TemplateTab)}>
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key} className="shrink-0 gap-1.5">
              {tab.label}
              {counts[tab.key] > 0 && (
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[10px] font-bold',
                    activeTab === tab.key
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {counts[tab.key]}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

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
              activeRole={activeRole}
              templateApprovalRequired={templateApprovalRequired}
              deleting={deleting}
              duplicating={duplicating}
              submitting={submitting}
              approving={approving}
              rejecting={rejecting}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
              onSubmitForApproval={handleSubmitForApproval}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ))}
        </div>
      )}
    </div>
  )
}
