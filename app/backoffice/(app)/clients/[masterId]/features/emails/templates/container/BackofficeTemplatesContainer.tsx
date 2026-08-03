"use client"

import { useMemo, useState } from "react"
import { FileText, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { useBackofficeClientEmailsContext } from "../../context/BackofficeClientEmailsContext"
import { useBackofficeTemplates, type BackofficeTemplateTab } from "../hooks/useBackofficeTemplates"
import { BackofficeTemplateCard } from "../components/BackofficeTemplateCard"
import { CreateBackofficeTemplateDialog } from "../components/CreateBackofficeTemplateDialog"

const TABS: Array<{ key: BackofficeTemplateTab; label: string }> = [
  { key: "draft", label: "Rascunhos" },
  { key: "published", label: "Publicados" },
  { key: "pending_approval", label: "Aguardando" },
]

function SkeletonCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-lg border">
          <Skeleton className="h-32 w-full rounded-none" />
          <div className="border-t px-3 py-2.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-1.5 h-3 w-48" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function BackofficeTemplatesContainer() {
  const { masterId, selectedTeamId, refreshKey, canManage } = useBackofficeClientEmailsContext()
  const [search, setSearch] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const { templates, allTemplates, loading, creating, activeTab, setActiveTab, createTemplate } =
    useBackofficeTemplates(masterId, selectedTeamId, refreshKey)

  const counts = useMemo(
    () => ({
      draft: allTemplates.filter(
        (t) => t.status === "draft" && t.approvalStatus !== "pending_approval"
      ).length,
      published: allTemplates.filter((t) => t.status === "published").length,
      pending_approval: allTemplates.filter((t) => t.approvalStatus === "pending_approval").length,
    }),
    [allTemplates]
  )

  const filtered = search.trim()
    ? templates.filter(
        (t) =>
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          t.subject.toLowerCase().includes(search.toLowerCase())
      )
    : templates

  if (!selectedTeamId) return null

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Templates</h2>
        {canManage ? (
          <Button type="button" onClick={() => setCreateOpen(true)} disabled={creating}>
            {creating ? <Spinner data-icon="inline-start" /> : null}
            + Criar template
          </Button>
        ) : null}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou assunto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as BackofficeTemplateTab)}>
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key} className="shrink-0 gap-1.5">
              {tab.label}
              {counts[tab.key] > 0 && (
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-bold",
                    activeTab === tab.key
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
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
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <FileText className="size-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {search.trim() ? "Nenhum template encontrado" : "Nenhum template nesta categoria"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((template) => (
            <BackofficeTemplateCard
              key={template.id}
              template={template}
              masterId={masterId}
              teamId={selectedTeamId}
            />
          ))}
        </div>
      )}

      {canManage ? (
        <CreateBackofficeTemplateDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          creating={creating}
          onCreate={createTemplate}
        />
      ) : null}
    </div>
  )
}
