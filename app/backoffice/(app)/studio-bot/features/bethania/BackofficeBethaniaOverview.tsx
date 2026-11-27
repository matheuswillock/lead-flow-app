"use client"

import { useEffect, useState } from "react"
import { Activity, ChevronLeft, ChevronRight, CircleOff, Clock3, Server, Webhook } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { useBackofficeBethania } from "./BackofficeBethaniaContext"

const HEALTH_LABELS = { healthy: "Conector saudável", unhealthy: "Conector indisponível", unconfigured: "Conector não configurado" } as const
const LOG_LABELS: Record<string, string> = { pending: "Pendente", sending: "Enviando", sent: "Entregue", failed: "Falhou", suppressed: "Suprimido" }

export function BackofficeBethaniaOverview() {
  const { overview, events, logs, selectedEventType, logsPage, logsPageSize, logsTotal, isLoading, isSaving, error, setSelectedEventType, setLogsPage, togglePause, setSenderUrl } = useBackofficeBethania()
  const [webhookUrl, setWebhookUrl] = useState("")
  useEffect(() => setWebhookUrl(overview?.sender.webhookUrl ?? ""), [overview?.sender.webhookUrl])
  const selectedEvent = events.find((event) => event.eventType === selectedEventType)
  const lastPage = Math.max(1, Math.ceil(logsTotal / logsPageSize))

  if (isLoading) return <main className="flex min-h-0 flex-col gap-4 p-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-40 w-full" /><Skeleton className="h-64 w-full" /></main>

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 sm:p-6" aria-label="Operação da Bethânia">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Bethânia · automações</h1>
        <p className="text-sm text-muted-foreground">Status do bot, controles de entrega e auditoria dos eventos da agenda.</p>
      </header>
      {error ? <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}
      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]" aria-label="Estado do sistema">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3"><div className="flex flex-col gap-1"><CardTitle className="text-base">Estado da Bethânia</CardTitle><CardDescription>Controle global da fila de mensagens automáticas.</CardDescription></div><Badge variant={overview?.paused ? "destructive" : "outline"}>{overview?.paused ? "Pausada" : "Ativa"}</Badge></CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3"><span className="inline-flex size-10 items-center justify-center rounded-xl bg-muted text-foreground"><Activity aria-hidden="true" /></span><div><p className="font-medium">{overview?.paused ? "Bethânia está pausada" : "Bethânia está ativa"}</p><p className="text-sm text-muted-foreground">A pausa global interrompe todos os eventos de saída.</p></div></div>
            <label className="flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-sm font-medium">Pausa de emergência<Switch aria-label="Pausa de emergência" checked={overview?.paused ?? false} disabled={isSaving} onCheckedChange={(paused) => void togglePause({ scope: "global", paused })} /></label>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Server aria-hidden="true" className="size-4" /> Saúde do conector</CardTitle><CardDescription>Disponibilidade reportada pelo serviço de envio.</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-4"><Badge variant={overview?.sender.health === "healthy" ? "outline" : "secondary"} className="w-fit">{overview ? HEALTH_LABELS[overview.sender.health] : "Indisponível"}</Badge><p className="text-xs text-muted-foreground">{overview?.sender.configured ? "Envio configurado" : "Configuração de envio ausente"}</p><form className="flex flex-col gap-2" onSubmit={(event) => { event.preventDefault(); void setSenderUrl(webhookUrl).catch(() => undefined) }}><label htmlFor="bethania-webhook-url" className="text-sm font-medium">URL do webhook</label><input id="bethania-webhook-url" aria-label="URL do webhook" type="url" inputMode="url" autoComplete="url" value={webhookUrl} onChange={(event) => setWebhookUrl(event.target.value)} placeholder="https://sender.example.com" className="min-h-11 w-full rounded-md border bg-background px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /><p className="text-xs text-muted-foreground">Informe apenas a origem do conector (HTTPS e domínio permitido). Segredos não são aceitos nem exibidos.</p><Button type="submit" className="min-h-11 w-fit" disabled={isSaving || !webhookUrl.trim()}>Salvar URL</Button></form></CardContent>
        </Card>
      </section>
      <section className="flex flex-col gap-3" aria-labelledby="events-heading"><div className="flex flex-col gap-1"><h2 id="events-heading" className="text-lg font-semibold">Eventos monitorados</h2><p className="text-sm text-muted-foreground">Pausas individuais não alteram o estado global.</p></div><div className="grid gap-3 md:grid-cols-2">{events.map((event) => <Card key={event.eventType}><CardContent className="flex min-h-24 items-center justify-between gap-4 p-4"><div className="flex min-w-0 flex-col gap-1"><p className="font-medium">{event.description}</p><code className="break-all text-xs text-muted-foreground">{event.eventType}</code></div><label className="flex min-h-11 shrink-0 items-center gap-2 text-sm"><span>{event.paused ? "Pausado" : "Ativo"}</span><Switch aria-label={`${event.paused ? "Retomar" : "Pausar"} ${event.description.toLowerCase()}`} checked={event.paused} disabled={isSaving} onCheckedChange={(paused) => void togglePause({ scope: "event", eventType: event.eventType, paused })} /></label></CardContent></Card>)}</div></section>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div className="flex flex-col gap-1"><CardTitle className="flex items-center gap-2 text-base"><Webhook aria-hidden="true" className="size-4" /> Registros de entrega</CardTitle><CardDescription>Últimas tentativas para o evento selecionado.</CardDescription></div><label className="flex flex-col gap-1 text-sm font-medium">Filtrar por evento<select className="min-h-11 rounded-md border bg-background px-3 text-sm" value={selectedEventType} onChange={(event) => setSelectedEventType(event.target.value)} aria-label="Filtrar registros por evento">{events.map((item) => <option key={item.eventType} value={item.eventType}>{item.description}</option>)}</select></label></CardHeader>
        <CardContent className="flex flex-col gap-3">{logs.length ? logs.map((log) => <div key={log.id} className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 flex-col gap-1"><div className="flex flex-wrap items-center gap-2"><Badge variant={log.status === "failed" ? "destructive" : "secondary"}>{LOG_LABELS[log.status] ?? log.status}</Badge><span className="text-xs text-muted-foreground">{log.attempts} {log.attempts === 1 ? "tentativa" : "tentativas"}</span></div><code className="break-all text-xs text-muted-foreground">{log.errorCode ? `Código: ${log.errorCode}` : "Sem código de erro"}</code></div><time className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground" dateTime={log.createdAt}><Clock3 aria-hidden="true" className="size-4" />{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(log.createdAt))}</time></div>) : <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground"><CircleOff aria-hidden="true" className="size-4" />Nenhum registro para este evento.</div>}<div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-muted-foreground">{logsTotal} registros · página {logsPage} de {lastPage}</p><div className="flex gap-2"><Button type="button" variant="outline" className="min-h-11" aria-label="Página anterior" disabled={logsPage <= 1} onClick={() => setLogsPage(logsPage - 1)}><ChevronLeft data-icon="inline-start" />Anterior</Button><Button type="button" variant="outline" className="min-h-11" aria-label="Próxima página" disabled={logsPage >= lastPage} onClick={() => setLogsPage(logsPage + 1)}>Próxima página<ChevronRight data-icon="inline-end" /></Button></div></div><Separator /><p className="text-xs text-muted-foreground">{selectedEvent ? `Evento: ${selectedEvent.description}` : "Selecione um evento para consultar os registros."}</p></CardContent>
      </Card>
      <p className="sr-only" aria-live="polite">{isSaving ? "Salvando pausa" : ""}</p>
    </main>
  )
}
