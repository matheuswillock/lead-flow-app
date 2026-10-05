"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Download, RefreshCw } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { landingAnalyticsService, type LandingAnalyticsFilters, type LandingAnalyticsSummary } from "../../services/LandingAnalyticsService"

function initialFilters(): LandingAnalyticsFilters {
  const to = new Date()
  const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000)
  return { from: from.toISOString(), to: to.toISOString(), timezone: "America/Sao_Paulo" }
}

function formatNumber(value: number | undefined) { return new Intl.NumberFormat("pt-BR").format(value ?? 0) }

export function LandingAnalyticsDashboard({ teamId, headers }: { teamId: string; headers: HeadersInit }) {
  const [filters, setFilters] = useState(initialFilters)
  const [summary, setSummary] = useState<LandingAnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setSummary(await landingAnalyticsService.getSummary(teamId, filters, headers)) } catch (cause) { setError(cause instanceof Error ? cause.message : "Erro ao carregar analytics") } finally { setLoading(false) }
  }, [teamId, filters, headers])
  useEffect(() => { void load() }, [load])
  const maxEvent = useMemo(() => Math.max(...(summary?.byEventType.map((item) => item.count) ?? [1]), 1), [summary])
  function updateDate(key: "from" | "to", value: string) { setFilters((current) => ({ ...current, [key]: new Date(value).toISOString() })) }
  function exportCsv() {
    if (!summary) return
    const blob = new Blob([landingAnalyticsService.buildCsv(summary)], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "landing-analytics.csv"; anchor.click(); URL.revokeObjectURL(url)
  }
  return <main className="container mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="mb-1 text-sm font-medium text-primary">Landing pages</p><h1 className="text-2xl font-semibold tracking-tight">Analytics das landing pages</h1><p className="mt-1 text-sm text-muted-foreground">Acompanhe visitas, interações e conversões por campanha.</p></div><div className="flex gap-2"><Button variant="outline" className="min-h-11" onClick={() => void load()}><RefreshCw data-icon="inline-start" />Atualizar</Button><Button className="min-h-11" onClick={exportCsv} disabled={!summary}><Download data-icon="inline-start" />Exportar CSV</Button></div></div>
    <Card><CardHeader><CardTitle className="text-base">Filtros</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div className="flex flex-col gap-2"><Label htmlFor="analytics-from">De</Label><Input id="analytics-from" type="datetime-local" value={filters.from.slice(0, 16)} onChange={(event) => updateDate("from", event.target.value)} /></div><div className="flex flex-col gap-2"><Label htmlFor="analytics-to">Até</Label><Input id="analytics-to" type="datetime-local" value={filters.to.slice(0, 16)} onChange={(event) => updateDate("to", event.target.value)} /></div><div className="flex flex-col gap-2"><Label htmlFor="analytics-campaign">Campanha</Label><Input id="analytics-campaign" placeholder="Todas" value={filters.campaignId ?? ""} onChange={(event) => setFilters((current) => ({ ...current, campaignId: event.target.value || undefined }))} /></div><div className="flex flex-col gap-2"><Label htmlFor="analytics-timezone">Timezone</Label><Input id="analytics-timezone" value={filters.timezone} onChange={(event) => setFilters((current) => ({ ...current, timezone: event.target.value }))} /></div></CardContent></Card>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><FilterInput label="Landing page" value={filters.landingPageId} onChange={(value) => setFilters((current) => ({ ...current, landingPageId: value || undefined }))} /><FilterInput label="Template" value={filters.templateSlug} onChange={(value) => setFilters((current) => ({ ...current, templateSlug: value || undefined }))} /><FilterInput label="Formulário" value={filters.formId} onChange={(value) => setFilters((current) => ({ ...current, formId: value || undefined }))} /><FilterInput label="Publicação" value={filters.publicationId} onChange={(value) => setFilters((current) => ({ ...current, publicationId: value || undefined }))} /></div>
    {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
    {loading ? <div className="grid gap-4 sm:grid-cols-4">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-28 rounded-lg" />)}</div> : summary ? <><div className="grid gap-4 sm:grid-cols-4"><Metric title="Visitas" value={summary.totals["landing.page_view"]} /><Metric title="Visitantes únicos" value={summary.uniqueVisitors} /><Metric title="Visitantes recorrentes" value={summary.returningVisitors} /><Metric title="Leads criados" value={summary.totals["landing.lead_created"]} /></div><div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle className="text-base">Funil de conversão</CardTitle></CardHeader><CardContent className="flex flex-col gap-3">{["landing.page_view", "landing.scroll_depth", "landing.cta_click", "landing.form_start", "landing.form_submitted", "landing.lead_created"].map((event) => <div key={event} className="flex items-center gap-3 text-sm"><span className="w-40 truncate text-muted-foreground">{event.replace("landing.", "")}</span><div className="h-2 flex-1 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${Math.round(((summary.totals[event] ?? 0) / Math.max(summary.totals["landing.page_view"] ?? 1, 1)) * 100)}%` }} /></div><span className="w-12 text-right font-medium">{formatNumber(summary.totals[event])}</span></div>)}</CardContent></Card><Card><CardHeader><CardTitle className="text-base">Eventos recentes</CardTitle></CardHeader><CardContent className="flex flex-col gap-3">{summary.byEventType.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum evento no período.</p> : summary.byEventType.slice(0, 8).map((item) => <div key={item.eventType} className="flex items-center gap-3 text-sm"><span className="min-w-0 flex-1 truncate">{item.eventType}</span><div className="h-2 w-32 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${Math.round((item.count / maxEvent) * 100)}%` }} /></div><span className="w-12 text-right font-medium">{formatNumber(item.count)}</span></div>)}</CardContent></Card></div></> : null}
  </main>
}

function Metric({ title, value }: { title: string; value?: number }) { return <Card><CardContent className="flex flex-col gap-2 p-5"><span className="text-sm text-muted-foreground">{title}</span><strong className="text-2xl tracking-tight">{formatNumber(value)}</strong></CardContent></Card> }
function FilterInput({ label, value, onChange }: { label: string; value?: string; onChange: (value: string) => void }) { return <div className="flex flex-col gap-2"><Label>{label}</Label><Input placeholder="Todos" value={value ?? ""} onChange={(event) => onChange(event.target.value)} /></div> }
