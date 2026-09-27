"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import type { BackofficeDeliverabilityTeam } from "../context/BackofficeDeliverabilityTypes"
import { useBackofficeDeliverabilityContext } from "../context/BackofficeDeliverabilityContext"

const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 2 })
const integer = new Intl.NumberFormat("pt-BR")

export function BackofficeDeliverabilityContainer() {
  const { days, setDays, teamId, setTeamId, domain, setDomain, provider, setProvider, teams, loading, error } = useBackofficeDeliverabilityContext()

  return <main className="flex flex-col gap-6" data-testid="backoffice-deliverability-dashboard">
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div className="flex flex-col gap-2"><h1 className="font-[family-name:var(--font-poppins)] text-2xl font-bold tracking-[-0.02em] md:text-3xl">Entrega e reputação</h1><p className="text-sm text-muted-foreground">Visão operacional dos domínios e times que precisam de atenção.</p></div><div className="flex flex-wrap gap-2">{([7, 30, 90] as const).map((value) => <Button key={value} className="min-h-11" variant={days === value ? "default" : "outline"} onClick={() => setDays(value)}>{value} dias</Button>)}</div></header>
    <Card><CardHeader><CardTitle>Filtros operacionais</CardTitle><CardDescription>Consulte um time, domínio ou provedor específico.</CardDescription></CardHeader><CardContent><FieldGroup className="grid gap-4 md:grid-cols-3"><Field><FieldLabel htmlFor="backoffice-deliverability-team">ID do time</FieldLabel><Input id="backoffice-deliverability-team" className="min-h-11" value={teamId} onChange={(event) => setTeamId(event.target.value)} placeholder="Todos os times" /></Field><Field><FieldLabel htmlFor="backoffice-deliverability-domain">Domínio</FieldLabel><Input id="backoffice-deliverability-domain" className="min-h-11" value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="Todos os domínios" /></Field><Field><FieldLabel htmlFor="backoffice-deliverability-provider">Provedor</FieldLabel><Input id="backoffice-deliverability-provider" className="min-h-11" value={provider} onChange={(event) => setProvider(event.target.value)} placeholder="Todos os provedores" /></Field></FieldGroup></CardContent></Card>
    {error ? <Card><CardContent className="p-6 text-sm text-destructive">{error}</CardContent></Card> : null}
    <Card><CardHeader><CardTitle>Times monitorados</CardTitle><CardDescription>Ordenados pela maior taxa de bounce.</CardDescription></CardHeader><CardContent className="overflow-x-auto">{loading ? <Skeleton className="h-72 w-full" /> : <TeamsTable teams={teams} />}</CardContent></Card>
  </main>
}

function TeamsTable({ teams }: { teams: BackofficeDeliverabilityTeam[] }) {
  if (teams.length === 0) return <p className="py-12 text-center text-sm text-muted-foreground">Nenhuma projeção de deliverability disponível no período.</p>
  return <table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="p-3 font-medium">Time</th><th className="p-3 font-medium">Enviados</th><th className="p-3 font-medium">Entrega</th><th className="p-3 font-medium">Bounce</th><th className="p-3 font-medium">Complaint</th><th className="p-3 font-medium">Estado</th></tr></thead><tbody>{teams.map((team) => <tr key={team.teamId} className="border-b last:border-0"><td className="p-3 font-medium">{team.teamName}</td><td className="p-3">{integer.format(team.sent)}</td><td className="p-3">{percent.format(team.deliveryRate)}</td><td className="p-3">{percent.format(team.bounceRate)}</td><td className="p-3">{percent.format(team.complaintRate)}</td><td className="p-3"><Badge variant={team.bounceRate >= 0.05 || team.complaintRate >= 0.001 ? "destructive" : "outline"}>{team.bounceRate >= 0.05 || team.complaintRate >= 0.001 ? "Atenção" : "Saudável"}</Badge></td></tr>)}</tbody></table>
}
