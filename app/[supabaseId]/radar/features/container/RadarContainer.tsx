"use client"

import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useMemo, useState } from "react"
import { Database, Plus, RefreshCw } from "lucide-react"
import { useFeatureAccess } from "@/app/context/FeatureAccessContext"
import { FEATURE_SLUGS } from "@/lib/features/feature-slugs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { useRadarContext } from "../context/RadarContext"
import type { RadarCustomSegmentListItem } from "../context/RadarTypes"
import { RadarEmptyState } from "../components/RadarEmptyState"
import { RadarProfileFilters } from "../components/RadarProfileFilters"
import { RadarProfileSheet } from "../components/RadarProfileSheet"
import { RadarProfilesTable } from "../components/RadarProfilesTable"
import { RadarSegmentBuilderDialog } from "../components/RadarSegmentBuilderDialog"
import { RadarSegmentCard } from "../components/RadarSegmentCard"
import { RadarSegmentProfilesSheet } from "../components/RadarSegmentProfilesSheet"
import { RadarImportButton } from "../components/radar-import/RadarImportButton"
import { CUSTOM_RADAR_SEGMENT_PREFIX } from "@/lib/radar/segment-audience"

export function RadarContainer() {
  const { hasAccess } = useFeatureAccess()
  const {
    profiles,
    segments,
    customSegments,
    metrics,
    selectedProfile,
    detailEvents,
    detailEventsTotal,
    isLoadingMoreEvents,
    isLoading,
    isSyncing,
    isSyncingWhatsapp,
    isSyncingLead,
    isDetailLoading,
    mutationLock,
    error,
    lastSyncAt,
    page,
    total,
    pageSize,
    search,
    setSearch,
    consentFilter,
    setConsentFilter,
    sourceFilter,
    setSourceFilter,
    channelFilter,
    setChannelFilter,
    lastSeenFrom,
    setLastSeenFrom,
    lastSeenTo,
    setLastSeenTo,
    setPage,
    activeTab,
    setActiveTab,
    openProfile,
    closeProfile,
    loadMoreProfileEvents,
    runSync,
    runWhatsappSync,
    syncLeadProfile,
    deleteCustomSegment,
    materializeContactList,
    segmentProfilesTarget,
    segmentProfilesItems,
    segmentProfilesTotal,
    segmentProfilesPage,
    segmentProfilesPageSize,
    isLoadingSegmentProfiles,
    openSegmentProfiles,
    closeSegmentProfiles,
    changeSegmentProfilesPage,
    reload,
  } = useRadarContext()

  const [builderOpen, setBuilderOpen] = useState(false)
  const [editingSegment, setEditingSegment] = useState<RadarCustomSegmentListItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RadarCustomSegmentListItem | null>(null)
  const [materializeTarget, setMaterializeTarget] = useState<{ slug: string; name: string; count: number } | null>(
    null
  )

  const systemSegments = useMemo(() => segments.filter((segment) => segment.isSystem), [segments])

  if (!hasAccess(FEATURE_SLUGS.RADAR)) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-muted-foreground">Você não tem acesso a esta funcionalidade.</p>
      </div>
    )
  }

  const sheetOpen = Boolean(selectedProfile) || isDetailLoading

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Database data-icon="inline-start" />
              <h1 className="text-xl font-semibold">Radar</h1>
            </div>
            <p className="text-sm text-muted-foreground">Perfis unificados para campanhas de e-mail</p>
          </div>
          <div className="flex items-center gap-2">
            {lastSyncAt ? (
              <Badge variant="outline">
                Último sync: {format(lastSyncAt, "dd/MM HH:mm", { locale: ptBR })}
              </Badge>
            ) : null}
            <Button variant="outline" disabled={isSyncingWhatsapp} onClick={() => void runWhatsappSync()}>
              <RefreshCw className={cn(isSyncingWhatsapp && "animate-spin")} data-icon="inline-start" />
              Sincronizar WhatsApp
            </Button>
            <Button variant="outline" disabled={isSyncing} onClick={() => void runSync()}>
              <RefreshCw className={cn(isSyncing && "animate-spin")} data-icon="inline-start" />
              Sincronizar
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: "Perfis unificados", value: metrics?.totalProfiles ?? 0 },
            { label: "Aptos para e-mail", value: metrics?.marketable ?? 0 },
            { label: "Bloqueados", value: metrics?.blocked ?? 0 },
            { label: "Com engajamento recente", value: metrics?.engaged ?? 0 },
          ].map((card) => (
            <Card key={card.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-7 w-16" /> : <p className="text-2xl font-semibold">{card.value}</p>}
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "perfis" | "segmentos")}>
          <TabsList>
            <TabsTrigger value="perfis">Perfis</TabsTrigger>
            <TabsTrigger value="segmentos">Segmentos</TabsTrigger>
          </TabsList>

          <TabsContent value="perfis" className="flex flex-col gap-4">
            <div className="flex justify-end">
              <RadarImportButton mutationLock={mutationLock} onImportComplete={() => void reload()} />
            </div>
            <RadarProfileFilters
              search={search}
              onSearchChange={(value) => {
                setSearch(value)
                setPage(1)
              }}
              consentFilter={consentFilter}
              onConsentFilterChange={(value) => {
                setConsentFilter(value)
                setPage(1)
              }}
              sourceFilter={sourceFilter}
              onSourceFilterChange={(value) => {
                setSourceFilter(value)
                setPage(1)
              }}
              channelFilter={channelFilter}
              onChannelFilterChange={(value) => {
                setChannelFilter(value)
                setPage(1)
              }}
              lastSeenFrom={lastSeenFrom}
              onLastSeenFromChange={(value) => {
                setLastSeenFrom(value)
                setPage(1)
              }}
              lastSeenTo={lastSeenTo}
              onLastSeenToChange={(value) => {
                setLastSeenTo(value)
                setPage(1)
              }}
            />

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Perfis</CardTitle>
              </CardHeader>
              <CardContent>
                {!isLoading && !error && profiles.length === 0 ? (
                  <RadarEmptyState
                    title="Nenhum perfil sincronizado"
                    description='Use "Sincronizar" para importar dados do CRM, carteira e e-mail.'
                  />
                ) : (
                  <RadarProfilesTable
                    profiles={profiles}
                    isLoading={isLoading}
                    error={error}
                    page={page}
                    total={total}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onViewProfile={(id) => void openProfile(id)}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="segmentos" className="flex flex-col gap-4">
            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">Segmentos do sistema</p>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {isLoading
                  ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
                  : systemSegments.map((segment) => (
                      <RadarSegmentCard
                        key={segment.slug}
                        name={segment.name}
                        description={segment.description}
                        count={segment.count}
                        variant="system"
                        mutationLock={mutationLock}
                        onViewProfiles={() =>
                          openSegmentProfiles({ kind: "system", slugOrId: segment.slug, name: segment.name })
                        }
                        onCreateContactList={() =>
                          setMaterializeTarget({ slug: segment.slug, name: segment.name, count: segment.count })
                        }
                      />
                    ))}
              </div>
            </div>

            <Separator />

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-muted-foreground">Meus segmentos</p>
                <Button
                  size="sm"
                  disabled={mutationLock}
                  onClick={() => {
                    setEditingSegment(null)
                    setBuilderOpen(true)
                  }}
                >
                  <Plus data-icon="inline-start" />
                  Novo segmento
                </Button>
              </div>

              {!isLoading && customSegments.length === 0 ? (
                <RadarEmptyState
                  title="Nenhum segmento personalizado ainda"
                  description="Crie um segmento com condições sobre perfil, consentimento, eventos, campos do lead ou status do CRM."
                  actionLabel="Novo segmento"
                  onAction={() => {
                    setEditingSegment(null)
                    setBuilderOpen(true)
                  }}
                />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {isLoading
                    ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
                    : customSegments.map((segment) => (
                        <RadarSegmentCard
                          key={segment.id}
                          name={segment.name}
                          description={segment.description}
                          count={segment.count}
                          variant="custom"
                          isInactive={!segment.isActive}
                          mutationLock={mutationLock}
                          onViewProfiles={
                            segment.isActive
                              ? () => openSegmentProfiles({ kind: "custom", slugOrId: segment.id, name: segment.name })
                              : undefined
                          }
                          onCreateContactList={
                            segment.isActive
                              ? () =>
                                  setMaterializeTarget({
                                    slug: `${CUSTOM_RADAR_SEGMENT_PREFIX}${segment.id}`,
                                    name: segment.name,
                                    count: segment.count,
                                  })
                              : undefined
                          }
                          onEdit={() => {
                            setEditingSegment(segment)
                            setBuilderOpen(true)
                          }}
                          onDelete={() => setDeleteTarget(segment)}
                        />
                      ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <RadarProfileSheet
          open={sheetOpen}
          onOpenChange={(open) => !open && closeProfile()}
          profile={selectedProfile}
          isLoading={isDetailLoading}
          detailEvents={detailEvents}
          detailEventsTotal={detailEventsTotal}
          isLoadingMoreEvents={isLoadingMoreEvents}
          onLoadMoreEvents={() => void loadMoreProfileEvents()}
          isSyncingLead={isSyncingLead}
          onSyncLead={() => void syncLeadProfile()}
        />

        <RadarSegmentBuilderDialog open={builderOpen} onOpenChange={setBuilderOpen} segment={editingSegment} />

        <RadarSegmentProfilesSheet
          segmentName={segmentProfilesTarget?.name ?? null}
          open={Boolean(segmentProfilesTarget)}
          onOpenChange={(open) => !open && closeSegmentProfiles()}
          profiles={segmentProfilesItems}
          isLoading={isLoadingSegmentProfiles}
          page={segmentProfilesPage}
          total={segmentProfilesTotal}
          pageSize={segmentProfilesPageSize}
          onPageChange={changeSegmentProfilesPage}
          onViewProfile={(id) => {
            closeSegmentProfiles()
            void openProfile(id)
          }}
        />

        <AlertDialog open={Boolean(materializeTarget)} onOpenChange={(open) => !open && setMaterializeTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Criar lista de contatos?</AlertDialogTitle>
              <AlertDialogDescription>
                Será criada uma lista de e-mail com até {materializeTarget?.count ?? 0} contato(s) do segmento
                &quot;{materializeTarget?.name}&quot;. Contatos duplicados serão ignorados automaticamente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={mutationLock}
                onClick={() => {
                  if (!materializeTarget) return
                  void materializeContactList(
                    materializeTarget.slug,
                    materializeTarget.name,
                    `Segmento: ${materializeTarget.name}`
                  ).then(() => setMaterializeTarget(null))
                }}
              >
                Criar lista
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir segmento?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. Se o segmento &quot;{deleteTarget?.name}&quot; estiver em uso por
                uma campanha ativa, ele será desativado em vez de excluído.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={mutationLock}
                onClick={() => {
                  if (!deleteTarget) return
                  void deleteCustomSegment(deleteTarget.id).then(() => setDeleteTarget(null))
                }}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  )
}
