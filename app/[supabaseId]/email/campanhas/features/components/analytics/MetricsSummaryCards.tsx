"use client"

import { Info } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { AnalyticsData, MetricDelta } from "./AnalyticsTypes"
import { MetricTrendIndicator } from "./MetricTrendIndicator"

type MetricCardProps = {
  title: string
  tooltip: string
  value: string
  subtitle: string
  highlight?: boolean
  delta?: MetricDelta | null
  isRate?: boolean
  inverse?: boolean
}

function MetricCard({
  title,
  tooltip,
  value,
  subtitle,
  highlight,
  delta,
  isRate,
  inverse,
}: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
          {title}
          <Tooltip>
            <TooltipTrigger
              aria-label={`Mais informações sobre ${title}`}
              className="cursor-help rounded-full border-0 bg-transparent p-0"
            >
              <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">{tooltip}</TooltipContent>
          </Tooltip>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-end gap-2">
          <p className={cn("text-3xl font-bold", highlight && "text-primary")}>{value}</p>
          <MetricTrendIndicator
            delta={delta}
            isRate={isRate}
            inverse={inverse}
            className="mb-1"
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  )
}

type MetricsSummaryCardsProps = {
  data: AnalyticsData | null
  loading: boolean
}

export function MetricsSummaryCards({ data, loading }: MetricsSummaryCardsProps) {
  if (loading || !data) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 12 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="mb-2 h-4 w-24" />
              <Skeleton className="h-9 w-16" />
              <Skeleton className="mt-1 h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const { totals, rates, deltas } = data
  const formViewed = totals.formViewed ?? 0
  const formStarted = totals.formStarted ?? 0
  const formCompletions = totals.formCompletions ?? 0

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
      <MetricCard
        title="Entregabilidade"
        tooltip="Percentual de e-mails confirmados como entregues na caixa de entrada do destinatário."
        value={`${rates.deliverabilityRate.toFixed(1)}%`}
        subtitle={`${totals.delivered.toLocaleString("pt-BR")} entregues de ${totals.sent.toLocaleString("pt-BR")}`}
        delta={deltas?.rates.deliverabilityRate}
        isRate
      />
      <MetricCard
        title="Taxa de Abertura"
        tooltip="Abertura medida pelo provedor; Apple/Gmail podem inflar — use o clique como sinal de intenção."
        value={`${rates.openRate.toFixed(1)}%`}
        subtitle={`${totals.opened.toLocaleString("pt-BR")} abertos`}
        delta={deltas?.rates.openRate}
        isRate
      />
      <MetricCard
        title="Taxa de Cliques"
        tooltip="Percentual de destinatários que clicaram em algum link do e-mail."
        value={`${rates.clickRate.toFixed(1)}%`}
        subtitle={`${totals.clicked.toLocaleString("pt-BR")} cliques`}
        delta={deltas?.rates.clickRate}
        isRate
      />
      <MetricCard
        title="Taxa de Bounce"
        tooltip="Percentual de e-mails que não chegaram ao destino — caixa inexistente ou servidor do destinatário recusou a entrega."
        value={`${rates.bounceRate.toFixed(1)}%`}
        subtitle={`${totals.bounced.toLocaleString("pt-BR")} bounces`}
        highlight={rates.bounceRate > 5}
        delta={deltas?.rates.bounceRate}
        isRate
        inverse
      />
      <MetricCard
        title="Taxa de Reclamação"
        tooltip="Percentual de destinatários que marcaram o e-mail como spam. Acima de 0,1% pode prejudicar a reputação do domínio e a entregabilidade futura."
        value={`${rates.complainRate.toFixed(2)}%`}
        subtitle={`${totals.complained.toLocaleString("pt-BR")} reclamações`}
        highlight={rates.complainRate > 0.1}
        delta={deltas?.rates.complainRate}
        isRate
        inverse
      />
      <MetricCard
        title="Falhas de Envio"
        tooltip="E-mails rejeitados pelo Resend antes de sair dos servidores — geralmente por endereço inválido ou erro de configuração."
        value={totals.failed.toLocaleString("pt-BR")}
        subtitle="e-mails com falha de envio"
        highlight={totals.failed > 0}
        delta={deltas?.totals.failed}
        inverse
      />
      <MetricCard
        title="Entregas Atrasadas"
        tooltip="E-mails aceitos pelo Resend mas com atraso na entrega ao servidor de destino. O e-mail ainda pode ser entregue depois."
        value={totals.deliveryDelayed.toLocaleString("pt-BR")}
        subtitle="e-mails com atraso"
        delta={deltas?.totals.deliveryDelayed}
        inverse
      />
      <MetricCard
        title="Descadastros"
        tooltip="Destinatários que clicaram em 'cancelar inscrição' no rodapé do e-mail. São removidos automaticamente de futuras campanhas."
        value={totals.unsubscribed.toLocaleString("pt-BR")}
        subtitle="descadastros"
        delta={deltas?.totals.unsubscribed}
        inverse
      />
      <MetricCard
        title="Suprimidos"
        tooltip="Destinatários bloqueados automaticamente pelo Resend por histórico de bounces ou reclamações anteriores. O e-mail não é enviado para eles."
        value={totals.suppressed.toLocaleString("pt-BR")}
        subtitle="e-mails suprimidos"
        delta={deltas?.totals.suppressed}
        inverse
      />
      <MetricCard
        title="Form. Visualizado"
        tooltip="Destinatários únicos que abriram a página do formulário pelo menos uma vez. Recargas e novas sessões do mesmo e-mail contam uma só vez."
        value={formViewed.toLocaleString("pt-BR")}
        subtitle="destinatários únicos"
        delta={deltas?.totals.formViewed}
      />
      <MetricCard
        title="Form. Iniciado"
        tooltip="Destinatários únicos que começaram a preencher o formulário. Várias sessões do mesmo e-mail contam uma só vez."
        value={formStarted.toLocaleString("pt-BR")}
        subtitle="destinatários únicos"
        delta={deltas?.totals.formStarted}
      />
      <MetricCard
        title="Form. Finalizado"
        tooltip="Destinatários únicos que concluíram o formulário. Reenvios do mesmo e-mail contam uma só vez."
        value={formCompletions.toLocaleString("pt-BR")}
        subtitle="destinatários únicos"
        delta={deltas?.totals.formCompletions}
      />
    </div>
  )
}
