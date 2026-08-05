'use client'

import type { ReactNode } from 'react'
import { MailOpen, MousePointerClick, Trophy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { RankedTemplate, TemplateRankingResult } from '../context/TemplatesTypes'

function RateRow({
  title,
  icon,
  items,
  rateKey,
}: {
  title: string
  icon: ReactNode
  items: RankedTemplate[]
  rateKey: 'openRate' | 'clickRate'
}) {
  const eventCountOf =
    rateKey === 'openRate'
      ? (item: RankedTemplate) => item.opened
      : (item: RankedTemplate) => item.clicked
  const eventLabel = rateKey === 'openRate' ? 'aberturas' : 'cliques'

  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-dashed p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {title}
        </div>
        <p className="text-xs text-muted-foreground">
          Ainda não há envios suficientes para montar este ranking.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </div>
      <ol className="flex flex-col gap-2">
        {items.map((item) => (
          <li
            key={`${rateKey}-${item.versionGroupId}`}
            className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2"
          >
            <div className="flex min-w-0 items-center gap-2">
              <Badge variant={item.rank === 1 ? 'default' : 'secondary'}>{item.rank}º</Badge>
              <span className="truncate text-sm font-medium">{item.name}</span>
            </div>
            <div className="shrink-0 text-right text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">
                {item.rates[rateKey].toFixed(2)}%
              </span>
              <span className="ml-1">
                · {eventCountOf(item)} {eventLabel}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function TemplateRankingPanel({
  ranking,
  loading,
}: {
  ranking: TemplateRankingResult | null
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>
    )
  }

  if (!ranking) return null

  const empty = ranking.byOpenRate.length === 0 && ranking.byClickRate.length === 0

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Trophy className="size-4 text-primary" />
        <h2 className="text-sm font-semibold tracking-tight">Top 3 templates (últimos 30 dias)</h2>
      </div>
      {empty ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-xs text-muted-foreground">
          Dispare campanhas com estes templates para ver o ranking de abertura e clique.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <RateRow
            title="Melhor taxa de abertura"
            icon={<MailOpen className="size-4 text-muted-foreground" />}
            items={ranking.byOpenRate}
            rateKey="openRate"
          />
          <RateRow
            title="Melhor taxa de clique"
            icon={<MousePointerClick className="size-4 text-muted-foreground" />}
            items={ranking.byClickRate}
            rateKey="clickRate"
          />
        </div>
      )}
    </section>
  )
}
