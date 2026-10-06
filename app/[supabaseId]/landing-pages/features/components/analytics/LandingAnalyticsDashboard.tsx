"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Download, RefreshCw, CalendarDays } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useTimezone } from "@/app/context/TimezoneContext"
import { combineDateAndTimeInTz, formatLocalTimeValue } from "@/lib/dates"
import { landingAnalyticsService, type LandingAnalyticsFilterOption, type LandingAnalyticsFilters, type LandingAnalyticsSummary } from "../../services/LandingAnalyticsService"

type DateRange = { from?: Date; to?: Date }

function initialFilters(tz: string, landingPageId?: string): LandingAnalyticsFilters {
  const to = new Date()
  const from = new Date(to.getTime() - 30 * 60 * 1000)
  return { from: from.toISOString(), to: to.toISOString(), landingPageId }
}

function formatNumber(value: number | undefined) { return new Intl.NumberFormat("pt-BR").format(value ?? 0) }
function optionLabel(option: LandingAnalyticsFilterOption) { return option.context ? `${option.name} · ${option.context}` : option.name }

export function LandingAnalyticsDashboard({ teamId, headers }: { teamId: string; headers: HeadersInit }) {
  const { tz } = useTimezone()
import { combineDateAndTimeInTz, formatLocalTimeValue } from "@/lib/dates"
  const searchParams = useSearchParams()
  const requestedLandingId = searchParams.get("landingPageId") ?? undefined
  const [filters, setFilters] = useState(() => initialFilters(tz, requestedLandingId))
  const [range, setRange] = useState<DateRange>(() => ({ from: new Date(filters.from), to: new Date(filters.to) }))
  const [startTime, setStartTime] = useState(() => formatLocalTimeValue(new Date(filters.from), tz))
  const [endTime, setEndTime] = useState(() => formatLocalTimeValue(new Date(filters.to), tz))
  const [summary, setSummary] = useState<LandingAnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rangeError, setRangeError] = useState<string | null>(null)

  useEffect(() => {
    if (!filters.landingPageId && requestedLandingId) setFilters((current) => ({ ...current, landingPageId: requestedLandingId }))
  }, [filters.landingPageId, requestedLandingId])

  const load = useCallback(async () => {
    if (rangeError) return
    setLoading(true); setError(null)
    try { setSummary(await landingAnalyticsService.getSummary(teamId, filters, headers)) } catch (cause) { setError(cause instanceof Error ? cause.message : "Erro ao carregar analytics") } finally { setLoading(false) }
  }, [teamId, filters, headers, rangeError])
  useEffect(() => { void load() }, [load])
  const maxEvent = useMemo(() => Math.max(...(summary?.byEventType.map((item) => item.count) ?? [1]), 1), [summary])

  function updateRange(nextRange: DateRange | undefined) {
    if (!nextRange?.from) return
    const nextTo = nextRange.to ?? nextRange.from
    const from = combineDateAndTimeInTz(nextRange.from, startTime, tz)
    const to = combineDateAndTimeInTz(nextTo, endTime, tz)
    setRange(nextRange); setRangeError(to <= from ? "O fim deve ser posterior ao início." : null)
    if (to > from) setFilters((current) => ({ ...current, from: from.toISOString(), to: to.toISOString() }))
  }
  function updateTime(kind: "from" | "to", value: string) {
    if (!/^\d{2}:\d{2}$/.test(value)) return
    const date = kind === "from" ? range.from : range.to ?? range.from
    if (!date) return
    const nextStart = kind === "from" ? value : startTime
    const nextEnd = kind === "to" ? value : endTime
    const from = combineDateAndTimeInTz(range.from ?? date, nextStart, tz)
    const to = combineDateAndTimeInTz(range.to ?? date, nextEnd, tz)
    if (kind === "from") setStartTime(value); else setEndTime(value)
    setRangeError(to <= from ? "O fim deve ser posterior ao início." : null)
    if (to > from) setFilters((current) => ({ ...current, from: from.toISOString(), to: to.toISOString() }))
  }
  function setFilter(key: keyof LandingAnalyticsFilters, value: string) { setFilters((current) => ({ ...current, [key]: value === "all" ? undefined : value })) }
  function exportCsv() { if (!summary) return; const blob = new Blob([landingAnalyticsService.buildCsv(summary)], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "landing-analytics.csv"; anchor.click(); URL.revokeObjectURL(url) }
  const options = summary?.filterOptions
  const rangeLabel = range.from ? range.to ? `${format(range.from, "dd/MM/yyyy", { locale: ptBR })} – ${format(range.to, "dd/MM/yyyy", { locale: ptBR })}` : format(range.from, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar período"

  return <main className="container mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="mb-1 text-sm font-medium text-primary">Landing pages</p><h1 className="text-2xl font-semibold tracking-tight">Analytics das landing pages</h1><p className="mt-1 text-sm text-muted-foreground">Acompanhe visitas, interações e conversões por campanha.</p></div><div className="flex gap-2"><Button variant="outline" className="min-h-11" onClick={() => void load()}><RefreshCw data-icon="inline-start" />Atualizar</Button><Button className="min-h-11" onClick={exportCsv} disabled={!summary}><Download data-icon="inline-start" />Exportar CSV</Button></div></div>
    <Card><CardHeader><CardTitle className="text-base">Filtros</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="flex flex-col gap-2 sm:col-span-2"><Label>Período</Label><Popover><PopoverTrigger asChild><Button variant="outline" className="min-h-11 justify-start text-left font-normal"><CalendarDays data-icon="inline-start" />{rangeLabel}</Button></PopoverTrigger><PopoverContent align="start" className="w-auto max-w-[calc(100vw-2rem)] p-3"><Calendar mode="range" selected={range} onSelect={updateRange} numberOfMonths={1} locale={ptBR} /><div className="grid grid-cols-2 gap-3 border-t pt-3"><div className="flex flex-col gap-2"><Label htmlFor="analytics-from-time">Início</Label><Input id="analytics-from-time" type="time" value={startTime} onChange={(event) => updateTime("from", event.target.value)} /></div><div className="flex flex-col gap-2"><Label htmlFor="analytics-to-time">Fim</Label><Input id="analytics-to-time" type="time" value={endTime} onChange={(event) => updateTime("to", event.target.value)} /></div></div></PopoverContent></Popover>{rangeError ? <p className="text-sm text-destructive" role="alert">{rangeError}</p> : null}</div>
      <FilterSelect label="Campanha" value={filters.campaignId} options={options?.campaigns ?? []} onChange={(value) => setFilter("campaignId", value)} />
      <FilterSelect label="Landing page" value={filters.landingPageId} options={options?.landingPages ?? []} onChange={(value) => setFilter("landingPageId", value)} />
      <FilterSelect label="Template" value={filters.templateSlug} options={options?.templates ?? []} onChange={(value) => setFilter("templateSlug", value)} />
      <FilterSelect label="Formulário" value={filters.formId} options={options?.forms ?? []} onChange={(value) => setFilter("formId", value)} />
      <FilterSelect label="Publicação" value={filters.publicationId} options={options?.publications ?? []} onChange={(value) => setFilter("publicationId", value)} />
    </CardContent></Card>
    {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
    {loading ? <div className="grid gap-4 sm:grid-cols-4">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-28 rounded-lg" />)}</div> : summary ? <><div className="grid gap-4 sm:grid-cols-4"><Metric title="Visitas" value={summary.totals["landing.page_view"]} /><Metric title="Visitantes únicos" value={summary.uniqueVisitors} /><Metric title="Visitantes recorrentes" value={summary.returningVisitors} /><Metric title="Leads criados" value={summary.totals["landing.lead_created"]} /></div><div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle className="text-base">Funil de conversão</CardTitle></CardHeader><CardContent className="flex flex-col gap-3">{["landing.page_view", "landing.scroll_depth", "landing.cta_click", "landing.form_start", "landing.form_submitted", "landing.lead_created"].map((event) => <div key={event} className="flex items-center gap-3 text-sm"><span className="w-40 truncate text-muted-foreground">{event.replace("landing.", "")}</span><div className="h-2 flex-1 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${Math.round(((summary.totals[event] ?? 0) / Math.max(summary.totals["landing.page_view"] ?? 1, 1)) * 100)}%` }} /></div><span className="w-12 text-right font-medium">{formatNumber(summary.totals[event])}</span></div>)}</CardContent></Card><Card><CardHeader><CardTitle className="text-base">Eventos recentes</CardTitle></CardHeader><CardContent className="flex flex-col gap-3">{summary.byEventType.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum evento no período.</p> : summary.byEventType.slice(0, 8).map((item) => <div key={item.eventType} className="flex items-center gap-3 text-sm"><span className="min-w-0 flex-1 truncate">{item.eventType}</span><div className="h-2 w-32 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${Math.round((item.count / maxEvent) * 100)}%` }} /></div><span className="w-12 text-right font-medium">{formatNumber(item.count)}</span></div>)}</CardContent></Card></div></> : null}
  </main>
}

function FilterSelect({ label, value, options, onChange }: { label: string; value?: string; options: LandingAnalyticsFilterOption[]; onChange: (value: string) => void }) { return <div className="flex flex-col gap-2"><Label>{label}</Label><Select value={value ?? "all"} onValueChange={onChange}><SelectTrigger className="min-h-11"><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{options.map((option) => <SelectItem key={option.id} value={option.id}>{optionLabel(option)}</SelectItem>)}</SelectContent></Select></div> }
function Metric({ title, value }: { title: string; value?: number }) { return <Card><CardContent className="flex flex-col gap-2 p-5"><span className="text-sm text-muted-foreground">{title}</span><strong className="text-2xl tracking-tight">{formatNumber(value)}</strong></CardContent></Card> }
