'use client'

import { Trophy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { RankedForm } from '../context/PublicFormsTypes'

export function FormRankingPanel({
  items,
  loading,
}: {
  items: RankedForm[]
  loading: boolean
}) {
  if (loading) {
    return <Skeleton className="h-40 w-full" />
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-center gap-2">
        <Trophy className="size-4 text-primary" />
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Top 3 formulários</h2>
          <p className="text-xs text-muted-foreground">
            Ranking por taxa de conversão (conclusões ÷ visualizações) nos últimos 30 dias.
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-xs text-muted-foreground">
          Ainda não há visualizações suficientes para montar o ranking.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.formId}
              className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Badge variant={item.rank === 1 ? 'default' : 'secondary'}>{item.rank}º</Badge>
                <span className="truncate text-sm font-medium">{item.name}</span>
              </div>
              <div className="shrink-0 text-right text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {item.conversionRate.toFixed(2)}%
                </span>
                <span className="ml-1">
                  · {item.completed}/{item.viewed}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
