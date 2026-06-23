"use client"

import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Database, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useCdpContext } from "../context/CdpContext"
import type { CdpProfileListItem } from "../context/CdpTypes"

function consentBadge(profile: CdpProfileListItem) {
  const emailConsent = profile.consents.find((c) => c.channel === "email")
  if (emailConsent?.status === "blocked") {
    return <Badge variant="destructive">Bloqueado</Badge>
  }
  if (emailConsent?.status === "allowed" && profile.primaryEmail) {
    return <Badge className="border-semantic-success-border bg-semantic-success-surface text-semantic-success">Apto</Badge>
  }
  return <Badge variant="secondary">Indefinido</Badge>
}

function sourceBadges(profile: CdpProfileListItem) {
  const types = [...new Set(profile.sourceLinks.map((l) => l.sourceType))]
  return types.map((type) => (
    <Badge key={type} variant="outline" className="text-xs">
      {type.replace("_", " ")}
    </Badge>
  ))
}

export function CdpContainer() {
  const {
    profiles,
    segments,
    metrics,
    selectedProfile,
    isLoading,
    isSyncing,
    isDetailLoading,
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
    segmentFilter,
    setPage,
    openProfile,
    closeProfile,
    runSync,
    applySegment,
    clearSegment,
  } = useCdpContext()

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Database data-icon="inline-start" />
            <h1 className="text-xl font-semibold">CDP</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Perfis unificados para campanhas de e-mail
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastSyncAt ? (
            <Badge variant="outline">
              Último sync: {format(lastSyncAt, "dd/MM HH:mm", { locale: ptBR })}
            </Badge>
          ) : null}
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

      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="max-w-xs"
          placeholder="Buscar nome, telefone ou e-mail"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
        />
        <Select
          value={segmentFilter || "__all"}
          onValueChange={(v) => (v === "__all" ? clearSegment() : applySegment(v))}
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Segmento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todos os segmentos</SelectItem>
            {segments.map((segment) => (
              <SelectItem key={segment.slug} value={segment.slug}>
                {segment.name} ({segment.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={consentFilter || "__all"}
          onValueChange={(v) => {
            setConsentFilter(v === "__all" ? "" : v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Consentimento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Consentimento</SelectItem>
            <SelectItem value="allowed">Apto</SelectItem>
            <SelectItem value="blocked">Bloqueado</SelectItem>
            <SelectItem value="unknown">Indefinido</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={sourceFilter || "__all"}
          onValueChange={(v) => {
            setSourceFilter(v === "__all" ? "" : v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Origem</SelectItem>
            <SelectItem value="crm_lead">CRM</SelectItem>
            <SelectItem value="portfolio">Carteira</SelectItem>
            <SelectItem value="email_contact">E-mail</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Perfis</CardTitle>
          </CardHeader>
          <CardContent>
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : isLoading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : profiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum perfil sincronizado. Use &quot;Sincronizar&quot; para importar dados do CRM, carteira e e-mail.
              </p>
            ) : (
              <>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Consentimento</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Última interação</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {profiles.map((profile) => (
                        <TableRow key={profile.id}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{profile.displayName}</span>
                              <span className="text-xs text-muted-foreground">{profile.displayPhone}</span>
                              {profile.primaryEmail ? (
                                <span className="text-xs text-muted-foreground">{profile.primaryEmail}</span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>{consentBadge(profile)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">{sourceBadges(profile)}</div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {profile.lastSeenAt
                              ? format(new Date(profile.lastSeenAt), "dd/MM/yyyy HH:mm", { locale: ptBR })
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" onClick={() => void openProfile(profile.id)}>
                              Detalhe
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex flex-col gap-2 md:hidden">
                  {profiles.map((profile) => (
                    <Card key={profile.id}>
                      <CardContent className="flex flex-col gap-2 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{profile.displayName}</span>
                          {consentBadge(profile)}
                        </div>
                        <p className="text-xs text-muted-foreground">{profile.displayPhone}</p>
                        <Button size="sm" variant="outline" onClick={() => void openProfile(profile.id)}>
                          Ver detalhe
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Página {page} de {totalPages} ({total} perfis)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Anterior
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Segmentos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
              : segments.map((segment) => (
                  <div key={segment.slug} className="flex flex-col gap-1 rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{segment.name}</span>
                      <Badge variant="secondary">{segment.count}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{segment.description}</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="self-start px-0"
                      onClick={() => applySegment(segment.slug)}
                    >
                      Ver perfis
                    </Button>
                  </div>
                ))}
          </CardContent>
        </Card>
      </div>

      <Sheet open={Boolean(selectedProfile) || isDetailLoading} onOpenChange={(open) => !open && closeProfile()}>
        <SheetContent className="flex w-full max-w-lg flex-col sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Detalhe do perfil</SheetTitle>
          </SheetHeader>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto py-4">
            {isDetailLoading || !selectedProfile ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1">
                  <h2 className="text-lg font-semibold">{selectedProfile.displayName}</h2>
                  <p className="text-sm text-muted-foreground">{selectedProfile.displayPhone}</p>
                  {selectedProfile.primaryEmail ? (
                    <p className="text-sm text-muted-foreground">{selectedProfile.primaryEmail}</p>
                  ) : null}
                  {consentBadge(selectedProfile)}
                </div>
                <Tabs defaultValue="resumo">
                  <TabsList>
                    <TabsTrigger value="resumo">Resumo</TabsTrigger>
                    <TabsTrigger value="identidades">Identidades</TabsTrigger>
                    <TabsTrigger value="consentimentos">Consentimentos</TabsTrigger>
                    <TabsTrigger value="timeline">Timeline</TabsTrigger>
                  </TabsList>
                  <TabsContent value="resumo" className="flex flex-col gap-3">
                    <div className="flex flex-wrap gap-1">{sourceBadges(selectedProfile)}</div>
                    <Separator />
                    <p className="text-sm font-medium">Últimos eventos</p>
                    {selectedProfile.events.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sem eventos registrados.</p>
                    ) : (
                      selectedProfile.events.map((event) => (
                        <div key={event.id} className="text-sm">
                          <span className="font-medium">{event.eventType}</span>
                          <span className="text-muted-foreground">
                            {" "}
                            — {format(new Date(event.occurredAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                      ))
                    )}
                  </TabsContent>
                  <TabsContent value="identidades" className="flex flex-col gap-2">
                    {selectedProfile.identities.map((identity) => (
                      <div key={identity.id} className="rounded-md border p-2 text-sm">
                        <p className="font-medium">{identity.type}</p>
                        <p className="text-muted-foreground">{identity.value ?? identity.normalizedValue}</p>
                      </div>
                    ))}
                  </TabsContent>
                  <TabsContent value="consentimentos" className="flex flex-col gap-2">
                    {selectedProfile.consents.map((consent) => (
                      <div key={`${consent.channel}-${consent.status}`} className="rounded-md border p-2 text-sm">
                        <p className="font-medium">{consent.channel}</p>
                        <p>{consent.status}</p>
                        {consent.reason ? <p className="text-muted-foreground">{consent.reason}</p> : null}
                      </div>
                    ))}
                  </TabsContent>
                  <TabsContent value="timeline" className="flex flex-col gap-2">
                    {selectedProfile.events.map((event) => (
                      <div key={event.id} className="rounded-md border p-2 text-sm">
                        <p className="font-medium">{event.eventType}</p>
                        <p className="text-muted-foreground">
                          {format(new Date(event.occurredAt), "dd/MM/yyyy HH:mm", { locale: ptBR })} — {event.sourceType}
                        </p>
                      </div>
                    ))}
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
