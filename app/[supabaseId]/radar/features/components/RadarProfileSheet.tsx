"use client"

import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import type { RadarProfileDetail, RadarProfileTouchpoints } from "../context/RadarTypes"
import { getEventTypeIcon, isMilestoneEventType } from "../utils/radarSegmentBuilderUtils"
import { EligibilityBadge, SourceBadges, WhatsappBadge } from "./RadarProfileBadges"

type RadarProfileSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: RadarProfileDetail | null
  isLoading: boolean
  detailEvents: RadarProfileDetail["events"]
  detailEventsTotal: number
  isLoadingMoreEvents: boolean
  onLoadMoreEvents: () => void
  isSyncingLead: boolean
  onSyncLead: () => void
  touchpoints: RadarProfileTouchpoints | null
  isLoadingTouchpoints: boolean
}

export function RadarProfileSheet({
  open,
  onOpenChange,
  profile,
  isLoading,
  detailEvents,
  detailEventsTotal,
  isLoadingMoreEvents,
  onLoadMoreEvents,
  isSyncingLead,
  onSyncLead,
  touchpoints,
  isLoadingTouchpoints,
}: RadarProfileSheetProps) {
  const hasLeadIdentity = profile?.identities.some((identity) => identity.type === "lead_id") ?? false

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full max-w-lg flex-col sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Detalhe do perfil</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4">
          {isLoading || !profile ? (
            <div className="flex flex-col gap-2 py-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                  <h2 className="text-lg font-semibold">{profile.displayName}</h2>
                  {profile.primaryDocument ? (
                    <p className="text-sm text-muted-foreground">Documento: {profile.primaryDocument}</p>
                  ) : null}
                  {profile.displayPhone ? (
                    <p className="text-sm text-muted-foreground">{profile.displayPhone}</p>
                  ) : null}
                  {profile.primaryEmail ? (
                    <p className="text-sm text-muted-foreground">{profile.primaryEmail}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <EligibilityBadge profile={profile} />
                    <WhatsappBadge profile={profile} />
                  </div>
                </div>
              </div>

              <Tabs defaultValue="resumo">
                <TabsList>
                  <TabsTrigger value="resumo">Resumo</TabsTrigger>
                  <TabsTrigger value="contatos">Contatos</TabsTrigger>
                  <TabsTrigger value="identidades">Identidades</TabsTrigger>
                  <TabsTrigger value="consentimentos">Consentimentos</TabsTrigger>
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                </TabsList>

                <TabsContent value="resumo" className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-1">
                    <SourceBadges profile={profile} />
                  </div>
                  <Separator />
                  <p className="text-sm font-medium">Últimos eventos</p>
                  {profile.events.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem eventos registrados.</p>
                  ) : (
                    profile.events.map((event) => {
                      const EventIcon = getEventTypeIcon(event.eventType)
                      return (
                        <div key={event.id} className="flex items-center gap-2 text-sm">
                          <EventIcon className="size-4 text-muted-foreground" />
                          <span className="font-medium">{event.eventType}</span>
                          {isMilestoneEventType(event.eventType) ? (
                            <Badge variant="secondary">Marco</Badge>
                          ) : null}
                          <span className="text-muted-foreground">
                            {" "}
                            — {format(new Date(event.occurredAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                      )
                    })
                  )}
                </TabsContent>

                <TabsContent value="contatos" className="flex flex-col gap-3">
                  {isLoadingTouchpoints ? (
                    <div className="flex flex-col gap-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ) : !touchpoints || touchpoints.breakdown.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum ponto de contato registrado.</p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Pontos de contato</p>
                        <Badge variant="secondary">{touchpoints.total} total</Badge>
                      </div>
                      <Separator />
                      <div className="flex flex-col gap-2">
                        {touchpoints.breakdown
                          .sort((a, b) => b.count - a.count)
                          .map((channel) => (
                            <div
                              key={channel.channel}
                              className="flex flex-col gap-1 rounded-md border p-3 text-sm"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{channel.channel}</span>
                                <Badge variant="outline">{channel.count}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Primeiro:{" "}
                                {format(new Date(channel.firstEventAt), "dd/MM/yyyy HH:mm", {
                                  locale: ptBR,
                                })}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Último:{" "}
                                {format(new Date(channel.lastEventAt), "dd/MM/yyyy HH:mm", {
                                  locale: ptBR,
                                })}
                              </p>
                            </div>
                          ))}
                      </div>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="identidades" className="flex flex-col gap-2">
                  {profile.identities.map((identity) => (
                    <div key={identity.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
                      <Badge variant="outline">{identity.type}</Badge>
                      <span className="text-muted-foreground">{identity.value ?? identity.normalizedValue}</span>
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="consentimentos" className="flex flex-col gap-2">
                  {profile.consents.map((consent) => (
                    <div key={`${consent.channel}-${consent.status}`} className="rounded-md border p-2 text-sm">
                      <p className="font-medium">{consent.channel}</p>
                      <p>{consent.status}</p>
                      {consent.reason ? <p className="text-muted-foreground">{consent.reason}</p> : null}
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="timeline" className="flex flex-col gap-2">
                  {detailEvents.map((event) => {
                    const EventIcon = getEventTypeIcon(event.eventType)
                    return (
                      <div key={event.id} className="rounded-md border p-2 text-sm">
                        <div className="flex items-center gap-2">
                          <EventIcon className="size-4 text-muted-foreground" />
                          <p className="font-medium">{event.eventType}</p>
                          {isMilestoneEventType(event.eventType) ? (
                            <Badge variant="secondary">Marco</Badge>
                          ) : null}
                        </div>
                        <p className="text-muted-foreground">
                          {format(new Date(event.occurredAt), "dd/MM/yyyy HH:mm", { locale: ptBR })} — {event.sourceType}
                        </p>
                      </div>
                    )
                  })}
                  {detailEvents.length < detailEventsTotal ? (
                    <Button size="sm" variant="outline" disabled={isLoadingMoreEvents} onClick={onLoadMoreEvents}>
                      {isLoadingMoreEvents ? "Carregando..." : "Carregar mais"}
                    </Button>
                  ) : null}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>

        {hasLeadIdentity ? (
          <SheetFooter>
            <Button size="sm" variant="outline" disabled={isSyncingLead} onClick={onSyncLead}>
              <RefreshCw className={cn(isSyncingLead && "animate-spin")} data-icon="inline-start" />
              Sincronizar lead
            </Button>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
