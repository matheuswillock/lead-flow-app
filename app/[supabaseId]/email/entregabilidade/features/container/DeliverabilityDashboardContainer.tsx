"use client"

import { Activity, MailCheck, MousePointerClick, ShieldAlert } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useDeliverabilityContext } from "../context/DeliverabilityContext"

const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 2 })
const integer = new Intl.NumberFormat("pt-BR")

export function DeliverabilityDashboardContainer() {
  const {
    days,
    setDays,
    senderDomain,
    setSenderDomain,
    recipientProvider,
    setRecipientProvider,
    campaignId,
    setCampaignId,
    dashboard,
    loading,
    error,
    reload,
  } = useDeliverabilityContext()
  const metrics = dashboard?.summary

  return (
    <main className="flex flex-col gap-6" data-testid="deliverability-dashboard">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-[family-name:var(--font-poppins)] text-2xl font-bold tracking-[-0.02em] md:text-3xl">
              Entrega e reputação
            </h1>
            <Badge variant="outline">Dados de envio</Badge>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Acompanhe entrega, rejeições e engajamento por domínio e provedor destinatário.
          </p>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Período da análise">
          {([7, 30, 90] as const).map((value) => (
            <Button key={value} type="button" className="min-h-11" variant={days === value ? "default" : "outline"} onClick={() => setDays(value)}>
              {value} dias
            </Button>
          ))}
        </div>
      </header>

      <Card>
        <CardHeader><CardTitle>Filtros</CardTitle><CardDescription>Refine a análise sem alterar os dados de origem.</CardDescription></CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-4 md:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="deliverability-domain">Domínio remetente</FieldLabel>
              <Select value={senderDomain || "all"} onValueChange={(value) => setSenderDomain(value === "all" ? "" : value)}>
                <SelectTrigger id="deliverability-domain" className="min-h-11 w-full"><SelectValue placeholder="Todos os domínios" /></SelectTrigger>
                <SelectContent><SelectItem value="all">Todos os domínios</SelectItem>{(dashboard?.domains ?? []).map((row) => <SelectItem key={row.senderDomain} value={row.senderDomain}>{row.senderDomain}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="deliverability-provider">Provedor destinatário</FieldLabel>
              <Select value={recipientProvider || "all"} onValueChange={(value) => setRecipientProvider(value === "all" ? "" : value)}>
                <SelectTrigger id="deliverability-provider" className="min-h-11 w-full"><SelectValue placeholder="Todos os provedores" /></SelectTrigger>
                <SelectContent><SelectItem value="all">Todos os provedores</SelectItem>{(dashboard?.providers ?? []).map((row) => <SelectItem key={row.recipientProvider} value={row.recipientProvider}>{row.recipientProvider}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="deliverability-campaign">ID da campanha</FieldLabel>
              <Input id="deliverability-campaign" className="min-h-11" value={campaignId} onChange={(event) => setCampaignId(event.target.value)} placeholder="Todas as campanhas" />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      {error ? (
        <Card><CardContent className="flex flex-col items-start gap-3 p-6"><p>{error}</p><Button onClick={() => void reload()}>Tentar novamente</Button></CardContent></Card>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores de entrega">
        <MetricCard title="Entregabilidade" value={metrics ? percent.format(metrics.deliveryRate) : null} detail={metrics ? `${integer.format(metrics.delivered)} entregues` : null} icon={MailCheck} loading={loading} />
        <MetricCard title="Bounces" value={metrics ? percent.format(metrics.bounceRate) : null} detail={metrics ? `${integer.format(metrics.hardBounced)} permanentes` : null} icon={ShieldAlert} loading={loading} />
        <MetricCard title="Aberturas humanas" value={metrics ? percent.format(metrics.humanOpenRate) : null} detail={metrics ? `${integer.format(metrics.humanOpened)} aberturas` : null} icon={Activity} loading={loading} />
        <MetricCard title="Cliques" value={metrics ? percent.format(metrics.clickRate) : null} detail={metrics ? `${integer.format(metrics.clicked)} cliques` : null} icon={MousePointerClick} loading={loading} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Evolução diária</CardTitle><CardDescription>Volume enviado, entregue e rejeitado no período.</CardDescription></CardHeader>
          <CardContent className="overflow-x-auto">
            {loading ? <Skeleton className="h-64 w-full" /> : <DailyTable rows={dashboard?.series ?? []} />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Provedores destinatários</CardTitle><CardDescription>Onde a reputação precisa de atenção.</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-3">
            {loading ? <Skeleton className="h-64 w-full" /> : (dashboard?.providers ?? []).map((provider) => (
              <div key={provider.recipientProvider} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0"><p className="truncate text-sm font-medium">{provider.recipientProvider}</p><p className="text-xs text-muted-foreground">{integer.format(provider.sent)} enviados</p></div>
                <Badge variant={provider.bounceRate >= 0.05 ? "destructive" : "outline"}>{percent.format(provider.deliveryRate)}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader><CardTitle>Domínios remetentes</CardTitle><CardDescription>Comparação de entrega e rejeições por domínio.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {loading ? <Skeleton className="h-32 w-full md:col-span-2" /> : (dashboard?.domains ?? []).map((domain) => (
            <div key={domain.senderDomain} className="flex items-center justify-between gap-3 rounded-lg border p-4">
              <div className="min-w-0"><p className="truncate text-sm font-medium">{domain.senderDomain}</p><p className="text-xs text-muted-foreground">{integer.format(domain.sent)} enviados</p></div>
              <Badge variant={domain.bounceRate >= 0.05 ? "destructive" : "outline"}>{percent.format(domain.deliveryRate)}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </main>
  )
}

function MetricCard({ title, value, detail, icon: Icon, loading }: { title: string; value: string | null; detail: string | null; icon: typeof Activity; loading: boolean }) {
  return <Card><CardHeader className="flex flex-row items-start justify-between gap-3"><div className="flex flex-col gap-1"><CardDescription>{title}</CardDescription>{loading ? <Skeleton className="h-8 w-24" /> : <CardTitle className="text-2xl">{value ?? "—"}</CardTitle>}</div><Icon aria-hidden="true" className="size-5 text-muted-foreground" /></CardHeader><CardContent><p className="text-xs text-muted-foreground">{detail ?? "Aguardando dados"}</p></CardContent></Card>
}

function DailyTable({ rows }: { rows: Array<{ date: string; sent: number; delivered: number; hardBounced: number; softBounced: number }> }) {
  if (rows.length === 0) return <p className="py-12 text-center text-sm text-muted-foreground">Ainda não há eventos no período selecionado.</p>
  return <table className="w-full min-w-[560px] text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="p-3 font-medium">Data</th><th className="p-3 font-medium">Enviados</th><th className="p-3 font-medium">Entregues</th><th className="p-3 font-medium">Bounces</th></tr></thead><tbody>{rows.map((row) => <tr key={row.date} className="border-b last:border-0"><td className="p-3">{new Date(`${row.date}T12:00:00Z`).toLocaleDateString("pt-BR")}</td><td className="p-3">{integer.format(row.sent)}</td><td className="p-3">{integer.format(row.delivered)}</td><td className="p-3">{integer.format(row.hardBounced + row.softBounced)}</td></tr>)}</tbody></table>
}
