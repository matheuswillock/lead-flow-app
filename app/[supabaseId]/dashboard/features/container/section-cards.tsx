// import { DashboardMetrics } from '@/app/api/services/DashboardInfosService'
// import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { DashboardMetricsData } from '../services/IDashboardMetricsService'
// import { TrendingDown, TrendingUp } from 'lucide-react'


export function SectionCards(props: DashboardMetricsData) {
  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      
      {/* Vendas */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Vendas</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            ${props.vendas.toFixed(2)}
          </CardTitle>
          <CardAction>
            {/* TODO: Implementar serviço que irá avaliar a variação ao logo do tempo */}
            {/* <Badge variant="outline">
              <TrendingUp />
              +12.5%
            </Badge> */}
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          {/* <div className="line-clamp-1 flex gap-2 font-medium">
            Trending up this month <TrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Visitors for the last 6 months
          </div> */}
        </CardFooter>
      </Card>

      {/* Negociação */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Negociação</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            ${props.negociacao.toFixed(2)}
          </CardTitle>
          {/* <CardAction>
            <Badge variant="outline">
              <TrendingDown />
              -20%
            </Badge>
          </CardAction> */}
        </CardHeader>
        {/* <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Down 20% this period <TrendingDown className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Acquisition needs attention
          </div>
        </CardFooter> */}
      </Card>

      {/* Implementação */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Implementação</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            ${props.implementacao.toFixed(2)}
          </CardTitle>
          <CardAction>
            {/* <Badge variant="outline">
              <TrendingUp />
              +12.5%
            </Badge> */}
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          {/* <div className="line-clamp-1 flex gap-2 font-medium">
            Strong user retention <TrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">Engagement exceed targets</div> */}
        </CardFooter>
      </Card>

      {/* Agendamentos */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Agendamentos</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            ${props.agendamentos.toFixed(2)}
          </CardTitle>
          <CardAction>
            {/* <Badge variant="outline">
              <TrendingUp />
              +4.5%
            </Badge> */}
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          {/* <div className="line-clamp-1 flex gap-2 font-medium">
            Steady performance increase <TrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">Meets growth projections</div> */}
        </CardFooter>
      </Card>

      {/* taxaConversao */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Taxa de Conversao</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            ${props.taxaConversao.toFixed(2)}%
          </CardTitle>
          <CardAction>
            {/* TODO: Implementar serviço que irá avaliar a variação ao logo do tempo */}
            {/* <Badge variant="outline">
              <TrendingUp />
              +12.5%
            </Badge> */}
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          {/* <div className="line-clamp-1 flex gap-2 font-medium">
            Trending up this month <TrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Visitors for the last 6 months
          </div> */}
        </CardFooter>
      </Card>

      {/* receitaTotal */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Receita Total</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            ${props.receitaTotal.toFixed(2)}
          </CardTitle>
          <CardAction>
            {/* TODO: Implementar serviço que irá avaliar a variação ao logo do tempo */}
            {/* <Badge variant="outline">
              <TrendingUp />
              +12.5%
            </Badge> */}
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          {/* <div className="line-clamp-1 flex gap-2 font-medium">
            Trending up this month <TrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Visitors for the last 6 months
          </div> */}
        </CardFooter>
      </Card>

      {/* churnRate */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Churn Rate</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            ${props.churnRate.toFixed(2)}%
          </CardTitle>
          <CardAction>
            {/* TODO: Implementar serviço que irá avaliar a variação ao logo do tempo */}
            {/* <Badge variant="outline">
              <TrendingUp />
              +12.5%
            </Badge> */}
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          {/* <div className="line-clamp-1 flex gap-2 font-medium">
            Trending up this month <TrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Visitors for the last 6 months
          </div> */}
        </CardFooter>
      </Card>
    </div>
  )
}


/*
  Agendamentos (Num total) ok
  Negociação (Negociação + Cotação) ok 
  Implementação (Proposta + DPS + Boleto + Dctos Pendentes) ok
  Vendas (em número) ok
  Taxa de Conversão (Vendas / Agendadas) ok
  Receita Total (R$) ok
  Churn (Negada Operadora em Percentual, a conta é:  (Negadas / Vendas) ok
*/