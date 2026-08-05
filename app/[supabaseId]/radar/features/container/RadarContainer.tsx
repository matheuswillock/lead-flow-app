"use client"

import { useCallback, useMemo, useState } from "react"
import { Database, Download, Plus } from "lucide-react"
import { useFeatureAccess } from "@/app/context/FeatureAccessContext"
import { FEATURE_SLUGS } from "@/lib/features/feature-slugs"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useRadarContext } from "../context/RadarContext"
import type { RadarCustomSegmentListItem, RadarSegment } from "../context/RadarTypes"
import type { RadarSegmentProfilesTarget } from "../context/useRadarHook"
import { RadarEmptyState } from "../components/RadarEmptyState"
import { RadarProfileFilters } from "../components/RadarProfileFilters"
import { RadarProfileSheet } from "../components/RadarProfileSheet"
import { RadarProfilesTable } from "../components/RadarProfilesTable"
import { RadarSegmentBuilderDialog } from "../components/RadarSegmentBuilderDialog"
import { RadarSegmentCard } from "../components/RadarSegmentCard"
import { RadarSegmentProfilesSheet } from "../components/RadarSegmentProfilesSheet"
import { RadarImportButton } from "../components/radar-import/RadarImportButton"

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
    isDetailLoading,
    mutationLock,
    error,
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
    deleteCustomSegment,
    previewSegmentContactList,
    materializeSegmentToContactList,
    exportFilteredProfiles,
    exportSegmentMembers,
    segmentProfilesTarget,
    segmentProfilesItems,
    segmentProfilesTotal,
    segmentProfilesPage,
    segmentProfilesPageSize,
    isLoadingSegmentProfiles,
    openSegmentProfiles,
    closeSegmentProfiles,
    changeSegmentProfilesPage,
    campaignDeepLinkSegment,
    touchpoints,
    isLoadingTouchpoints,
    contracts,
    isLoadingContracts,
    reload,
  } = useRadarContext()

  const [builderOpen, setBuilderOpen] = useState(false)
  const [editingSegment, setEditingSegment] = useState<RadarCustomSegmentListItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RadarCustomSegmentListItem | null>(null)
  const [contactListPreviewTarget, setContactListPreviewTarget] = useState<RadarSegmentProfilesTarget | null>(null)
  const [contactListPreviewCount, setContactListPreviewCount] = useState<number | null>(null)
  const [isPreviewingContactList, setIsPreviewingContactList] = useState(false)
  const [isCreatingContactList, setIsCreatingContactList] = useState(false)

  const handleOpenContactListDialog = useCallback(
    async (target: RadarSegmentProfilesTarget) => {
      setContactListPreviewTarget(target)
      setContactListPreviewCount(null)
      setIsPreviewingContactList(true)
      const count = await previewSegmentContactList(target.slugOrId, target.kind)
      setContactListPreviewCount(count)
      setIsPreviewingContactList(false)
    },
    [previewSegmentContactList]
  )

  const handleConfirmContactList = useCallback(async () => {
    if (!contactListPreviewTarget) return
    setIsCreatingContactList(true)
    try {
      await materializeSegmentToContactList(contactListPreviewTarget.slugOrId, contactListPreviewTarget.kind)
      setContactListPreviewTarget(null)
      setContactListPreviewCount(null)
    } finally {
      setIsCreatingContactList(false)
    }
  }, [contactListPreviewTarget, materializeSegmentToContactList])

  const systemSegments = useMemo(() => {
    const base = segments.filter((segment: RadarSegment) => segment.isSystem)
    if (!campaignDeepLinkSegment) return base
    if (base.some((segment) => segment.slug === campaignDeepLinkSegment.slug)) return base
    return [campaignDeepLinkSegment, ...base]
  }, [campaignDeepLinkSegment, segments])

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
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Database data-icon="inline-start" />
            <h1 className="text-xl font-semibold">Radar</h1>
          </div>
          <p className="text-sm text-muted-foreground">Perfis unificados para campanhas de e-mail</p>
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={mutationLock || total === 0}>
                    <Download data-icon="inline-start" />
                    Exportar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => void exportFilteredProfiles("csv")}>
                    CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void exportFilteredProfiles("excel")}>
                    Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
                    title="Nenhum perfil encontrado"
                    description="Os perfis são sincronizados automaticamente a partir do CRM, carteira e e-mail."
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
                        onExport={(format) =>
                          void exportSegmentMembers(
                            { kind: "system", slugOrId: segment.slug, name: segment.name },
                            format
                          )
                        }
                        onCreateContactList={() =>
                          void handleOpenContactListDialog({ kind: "system", slugOrId: segment.slug, name: segment.name })
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
                          onExport={
                            segment.isActive
                              ? (format) =>
                                  void exportSegmentMembers(
                                    { kind: "custom", slugOrId: segment.id, name: segment.name },
                                    format
                                  )
                              : undefined
                          }
                          onCreateContactList={
                            segment.isActive
                              ? () =>
                                  void handleOpenContactListDialog({
                                    kind: "custom",
                                    slugOrId: segment.id,
                                    name: segment.name,
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
          touchpoints={touchpoints}
          isLoadingTouchpoints={isLoadingTouchpoints}
          contracts={contracts}
          isLoadingContracts={isLoadingContracts}
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

        <AlertDialog
          open={Boolean(contactListPreviewTarget)}
          onOpenChange={(open) => {
            if (!open) {
              setContactListPreviewTarget(null)
              setContactListPreviewCount(null)
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Criar lista de contatos?</AlertDialogTitle>
              <AlertDialogDescription>
                {isPreviewingContactList
                  ? "Calculando contagem do segmento…"
                  : contactListPreviewCount === null
                    ? "Não foi possível calcular a contagem."
                    : `Será criada uma lista com ${contactListPreviewCount} contato(s) do segmento "${contactListPreviewTarget?.name}". Esta é uma cópia estática — alterações futuras no segmento não atualizam a lista.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isCreatingContactList}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={isPreviewingContactList || isCreatingContactList || contactListPreviewCount === null}
                onClick={(e) => {
                  e.preventDefault()
                  void handleConfirmContactList()
                }}
              >
                {isCreatingContactList ? "Criando…" : "Criar lista"}
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
